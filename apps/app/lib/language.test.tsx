// Spec 076: the language provider. SC-002 (a choice applies at once and is saved to the account),
// and the Warnings row (a failed save keeps the choice on this device and is sent again next time).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { render } from '../test/render';
import { fakeApi, family, flush, gabriel } from '../test/fakes';
import { getLanguage, setLanguage, strings } from '../strings';
import { LanguageProvider, useLanguage } from './language';

const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
    multiSet: async (pairs: [string, string][]) => pairs.forEach(([k, v]) => store.set(k, v)),
  },
}));
vi.mock('expo-router', () => ({ router: { navigate: vi.fn() }, usePathname: () => '/settings/language' }));
const track = vi.fn();
vi.mock('./tracker', () => ({ tracker: { track: (...a: unknown[]) => track(...a), register: vi.fn() } }));

let me = { ...gabriel };
/** Saves like the database: the account's row changes, and the next refresh reads it. */
const savingApi = () =>
  fakeApi({
    setLanguage: vi.fn(async (language: string) => {
      me = { ...me, language };
      return { ok: true, data: undefined };
    }),
  });
let api = savingApi();
const refresh = vi.fn(async () => undefined);
vi.mock('./session', () => ({
  useSession: () => ({ state: { status: 'ready', userId: me.user_id, me, family, members: [me] }, api, client: { auth: { updateUser: async () => ({ error: null }) } }, refresh }),
}));

function Probe() {
  const { setting, choose } = useLanguage();
  return (
    <>
      <Text>{`${setting}|${strings.menu.reminders}`}</Text>
      <Text role="button" onPress={() => choose('fr')}>
        pick
      </Text>
    </>
  );
}

const show = async () => {
  render(
    <LanguageProvider>
      <Probe />
    </LanguageProvider>,
  );
  await flush();
};

beforeEach(() => {
  store.clear();
  me = { ...gabriel, language: 'automatic' };
  api = savingApi();
  track.mockClear();
});
afterEach(() => {
  cleanup();
  setLanguage('en');
});

describe('LanguageProvider', () => {
  it('follows the account’s choice', async () => {
    me = { ...gabriel, language: 'es' };
    await show();
    expect(getLanguage()).toBe('es');
    expect(screen.getByText('es|Recordatorios')).toBeTruthy();
  });

  it('SC-002: a choice applies at once, then is saved to the account and tracked', async () => {
    await show();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'pick' })));
    await flush();
    expect(screen.getByText('fr|Rappels')).toBeTruthy();
    expect(api.setLanguage).toHaveBeenCalledWith('fr');
    expect(track).toHaveBeenCalledWith('language_changed', { language: 'fr' });
    expect(store.has('cocon.language.pending')).toBe(false);
  });

  it('a failed save keeps the choice here, says so, and sends it again next time', async () => {
    api = fakeApi({ setLanguage: vi.fn(async () => ({ ok: false, error: 'network' })) });
    await show();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'pick' })));
    await flush();
    expect(screen.getByText('fr|Rappels')).toBeTruthy();
    expect(screen.getByText(strings.settings.language.saveFailed)).toBeTruthy();
    expect(track).not.toHaveBeenCalled();
    expect(store.get('cocon.language.pending')).toBe('fr');

    // Next start: the account still says Automatic, the device's choice wins and is sent again.
    cleanup();
    api = savingApi();
    await show();
    expect(screen.getByText('fr|Rappels')).toBeTruthy();
    expect(api.setLanguage).toHaveBeenCalledWith('fr');
  });
});
