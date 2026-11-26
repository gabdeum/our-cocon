// Spec 072 US1, US4 and US5 on the share sheet (design/ui/OC-ShareGroceries.md).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../lib/toast';
import { ShareGroceriesSheet, type ShareGroceriesApi } from './ShareGroceriesSheet';
import type { GroceryShareLink } from '../../lib/grocery-share';
import { fakeTracker } from '../../test/fakes';
import { expectAccessible } from '../../test/axe';

const dims = vi.hoisted(() => ({ width: 390, height: 844 }));
vi.mock('react-native', async (actual) => ({ ...(await actual<typeof import('react-native')>()), useWindowDimensions: () => ({ ...dims, scale: 2, fontScale: 1 }) }));
vi.mock('expo-linking', () => ({ createURL: (p: string) => `ourcocon://${p}` }));
vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn() }));

afterEach(() => cleanup());

const token = 'a'.repeat(43);
const url = `${window.location.origin}/g/${token}`;
// Tonight at 23:59 on this machine's clock: "Ends today at 23:59".
const tonight = new Date(new Date().setHours(23, 59, 59, 999)).toISOString();
const link: GroceryShareLink = { token, duration: 'today', expires_at: tonight, can_edit: true, created_at: new Date(Date.now() - 3 * 3_600_000 - 1000).toISOString() };

function fakeApi(over: Partial<ShareGroceriesApi> = {}) {
  return {
    load: vi.fn<ShareGroceriesApi['load']>().mockResolvedValue(null),
    create: vi.fn<ShareGroceriesApi['create']>(async (duration, canEdit) => ({ ...link, duration, can_edit: canEdit, created: true })),
    setOptions: vi.fn<ShareGroceriesApi['setOptions']>().mockResolvedValue(null),
    stop: vi.fn<ShareGroceriesApi['stop']>().mockResolvedValue(undefined),
    copy: vi.fn<ShareGroceriesApi['copy']>().mockResolvedValue(true),
    share: vi.fn<ShareGroceriesApi['share']>().mockResolvedValue('shared'),
    ...over,
  };
}

async function setup(api = fakeApi(), listText: string | null = 'Groceries\n\nProduce\n- Onion: 2 pieces') {
  const tracker = fakeTracker();
  render(<ShareGroceriesSheet api={api} listText={listText} tracker={tracker} use24h onClose={vi.fn()} />, { wrapper: ToastProvider });
  await act(async () => undefined);
  return { api, tracker };
}

const pill = (name: string) => screen.getByRole('button', { name });

describe('Share the grocery list', () => {
  it('starts with no link, Today and editing on', async () => {
    await setup();
    expect(screen.getByText('Share the grocery list')).toBeTruthy();
    expect(screen.getByText('Not shared')).toBeTruthy();
    expect(pill('Today').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Let people edit it' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(/They can add, tick and remove items\./)).toBeTruthy();
    for (const name of ['Message', 'Email', 'More']) expect(screen.getByRole('button', { name }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Stop sharing this link' })).toBeNull();
    // Spec 030 SC-001.
    await expectAccessible();
  });

  it('makes the link with the chosen time and switch (US1)', async () => {
    const { api, tracker } = await setup();
    fireEvent.click(pill('1 hour'));
    fireEvent.click(screen.getByRole('switch', { name: 'Let people edit it' }));
    expect(screen.getByText('Anyone with the link can see the list as it changes, without an account.')).toBeTruthy();
    // Before a link, only "Create link" uses them.
    expect(api.setOptions).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create link' })));
    expect(api.create).toHaveBeenCalledWith('1h', false);
    expect(tracker.track).toHaveBeenCalledWith('grocery_share_created', { duration: '1h', can_edit: false });
    expect(screen.getByText(url)).toBeTruthy();
    expect(screen.getByText('Ends today at 23:59')).toBeTruthy();
  });

  it('shows a live link as it is, without a new event', async () => {
    const { tracker } = await setup(fakeApi({ load: vi.fn().mockResolvedValue({ ...link, duration: 'none', expires_at: null, can_edit: false }) }));
    expect(screen.getByText(url)).toBeTruthy();
    expect(pill('Until I stop').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Let people edit it' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Until you stop sharing')).toBeTruthy();
    expect(tracker.track).not.toHaveBeenCalled();
  });

  it('changes a live link at once, and puts it back when that fails', async () => {
    const setOptions = vi.fn<ShareGroceriesApi['setOptions']>().mockResolvedValue({ expires_at: null });
    const api = fakeApi({ load: vi.fn().mockResolvedValue(link), setOptions });
    const { tracker } = await setup(api);
    await act(async () => fireEvent.click(pill('Until I stop')));
    expect(setOptions).toHaveBeenCalledWith(token, { duration: 'none' });
    expect(tracker.track).toHaveBeenCalledWith('grocery_share_changed', { duration: 'none' });
    expect(screen.getByText('Until you stop sharing')).toBeTruthy();
    setOptions.mockRejectedValueOnce(new Error('offline'));
    await act(async () => fireEvent.click(screen.getByRole('switch', { name: 'Let people edit it' })));
    expect(screen.getByRole('switch', { name: 'Let people edit it' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText("Couldn't change that. Try again.")).toBeTruthy();
  });

  it('copies the link and sends it', async () => {
    const { api } = await setup(fakeApi({ load: vi.fn().mockResolvedValue(link) }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy link' })));
    expect(api.copy).toHaveBeenCalledWith(url);
    expect(screen.getByText('Link copied')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Message' }));
    expect(api.share).toHaveBeenCalledWith(token);
  });

  it('copies the list as text, with or without a link (US5)', async () => {
    const { api, tracker } = await setup();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy as text' })));
    expect(api.copy).toHaveBeenCalledWith('Groceries\n\nProduce\n- Onion: 2 pieces');
    expect(tracker.track).toHaveBeenCalledWith('grocery_list_copied', {});
    expect(screen.getByText('List copied')).toBeTruthy();
  });

  it('says so when there is nothing to copy', async () => {
    const { api } = await setup(fakeApi(), null);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy as text' })));
    expect(api.copy).not.toHaveBeenCalled();
    expect(screen.getByText('Nothing to buy on the list.')).toBeTruthy();
  });

  it('stops sharing after asking (US4)', async () => {
    const { api, tracker } = await setup(fakeApi({ load: vi.fn().mockResolvedValue(link) }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop sharing this link' }));
    expect(screen.getByText('The link will stop working for everyone who has it.')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Stop sharing' })));
    expect(api.stop).toHaveBeenCalledWith(token);
    expect(tracker.track).toHaveBeenCalledWith('grocery_share_stopped', { hours_active: 3 });
    expect(screen.getByText('Not shared')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create link' })).toBeTruthy();
  });

  it('offers to try again when the link can\'t be made', async () => {
    await setup(fakeApi({ create: vi.fn().mockRejectedValue(new Error('offline')) }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create link' })));
    expect(screen.getByText("Couldn't create the link. Check your connection and try again.")).toBeTruthy();
  });
});
