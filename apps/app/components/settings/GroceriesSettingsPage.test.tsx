// Spec 029 US2 and SC-003: Menu › Groceries and the Groceries tab's "Grocery settings" sheet change
// the same family settings. Both read `useFamilySettings`, as their screens do, over one cache and
// one family_settings row.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DEFAULT_FAMILY_SETTINGS, type FamilySettings } from '@cocon/schemas';
import { useFamilySettings } from '../../lib/family-settings';
import { ToastProvider } from '../../lib/toast';
import { family, fakeTracker, gabriel } from '../../test/fakes';
import { GrocerySettings } from './GrocerySettings';
import GroceriesSettingsRoute from '../../app/settings/groceries';

vi.mock('expo-router', () => ({ router: { canGoBack: () => true, back: vi.fn(), replace: vi.fn() } }));

// The family's one row, as the database keeps it.
let row: FamilySettings = { ...DEFAULT_FAMILY_SETTINGS };
const client = {
  from: () => ({
    select: () => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }),
    upsert: (change: Partial<FamilySettings>) => {
      row = { ...row, ...change };
      return Promise.resolve({ error: null });
    },
  }),
};
const tracker = fakeTracker();
vi.mock('../../lib/session', () => ({
  useSession: () => ({ state: { status: 'ready', userId: gabriel.user_id, me: gabriel, family, members: [gabriel] }, client, tracker }),
}));

/** The sheet as the Groceries tab wires it (app/(tabs)/groceries.tsx → GroceryList). */
function Sheet() {
  const { settings, change } = useFamilySettings();
  return (
    <View testID="sheet">
      <GrocerySettings settings={settings} onChange={change} />
    </View>
  );
}
function View({ testID, children }: { testID: string; children: React.ReactNode }) {
  return <div data-testid={testID}>{children}</div>;
}

afterEach(() => {
  cleanup();
  row = { ...DEFAULT_FAMILY_SETTINGS };
});

async function setup() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <View testID="page">
          <GroceriesSettingsRoute />
        </View>
        <Sheet />
      </ToastProvider>
    </QueryClientProvider>,
  );
  await act(async () => undefined);
  return { page: within(screen.getByTestId('page')), sheet: within(screen.getByTestId('sheet')) };
}

const pressed = (scope: ReturnType<typeof within>, name: string) => scope.getByRole('button', { name }).getAttribute('aria-pressed');

describe('Menu › Groceries (OC-SettingsGroceries)', () => {
  it('US2: where you shop and round up, as the sheet says them, under the back link "Menu"', async () => {
    const { page } = await setup();
    expect(page.getByRole('button', { name: 'Back to Menu' })).toBeTruthy();
    expect(page.getByRole('heading', { name: 'Groceries' })).toBeTruthy();
    expect(page.getByText('For the whole family. You can also change these from the Groceries tab.')).toBeTruthy();
    expect(page.getByRole('heading', { name: 'Where do you shop?' })).toBeTruthy();
    expect(page.getByText('Buy 1 pint')).toBeTruthy();
    expect(page.getByRole('switch', { name: /Round up to store sizes/ })).toBeTruthy();
  });

  it('SC-003: a change on the page shows in the sheet, and the other way round', async () => {
    const { page, sheet } = await setup();
    fireEvent.click(page.getByRole('button', { name: 'European stores' }));
    await act(async () => undefined);
    expect(row.store_profile).toBe('eu');
    expect(pressed(sheet, 'European stores')).toBe('true');
    expect(sheet.getByText('Buy 2 × 20 cl')).toBeTruthy();

    fireEvent.click(sheet.getByRole('switch', { name: /Round up to store sizes/ }));
    await act(async () => undefined);
    expect(row.round_to_packs).toBe(false);
    await waitFor(() => expect(page.getByRole('switch', { name: /Round up to store sizes/ }).getAttribute('aria-checked')).toBe('false'));
    expect(tracker.track).toHaveBeenCalledWith('store_profile_changed', { profile: 'eu' });
  });
});
