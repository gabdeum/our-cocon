// Spec 019 US1 and US3 on the share sheet (design/ui/OC-Share.md).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { COPIED_MS, ShareSheet, type ShareSheetApi } from './ShareSheet';
import { fakeTracker } from '../../test/fakes';

vi.mock('expo-linking', () => ({ createURL: (p: string) => `ourcocon://${p}` }));
vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const token = 'a'.repeat(43);
const link = { token, include_variants: true, include_tips: true, created_at: new Date(Date.now() - 3 * 86_400_000 - 1000).toISOString() };

function fakeApi(over: Partial<ShareSheetApi> = {}) {
  return {
    open: vi.fn<ShareSheetApi['open']>().mockResolvedValue({ ...link, created: true }),
    stop: vi.fn<ShareSheetApi['stop']>().mockResolvedValue(undefined),
    setOptions: vi.fn<ShareSheetApi['setOptions']>().mockResolvedValue(undefined),
    copy: vi.fn<ShareSheetApi['copy']>().mockResolvedValue(true),
    share: vi.fn<ShareSheetApi['share']>().mockResolvedValue('shared'),
    ...over,
  };
}

async function setup(api = fakeApi()) {
  const tracker = fakeTracker();
  const onClose = vi.fn();
  render(<ShareSheet recipeName="Leek & bacon quiche" familyName="The Demanges" api={api} tracker={tracker} onClose={onClose} />);
  await act(async () => undefined);
  return { api, tracker, onClose };
}

const url = `${window.location.origin}/r/${token}`;

describe('Share sheet', () => {
  beforeEach(() => vi.useRealTimers());

  it('shows the recipe, the view-only note and the controls, in order', async () => {
    await setup();
    expect(screen.getByText('Share this recipe')).toBeTruthy();
    expect(screen.getByText('Leek & bacon quiche')).toBeTruthy();
    expect(screen.getByText('From the Demanges family')).toBeTruthy();
    expect(screen.getByText("View only. Anyone with the link can read and cook it, but can't change it or see your other recipes.")).toBeTruthy();
    for (const name of ['Copy link', 'Message', 'Email', 'More', 'Stop sharing this link']) expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Include variants' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: "Include chef's tips" }).getAttribute('aria-checked')).toBe('true');
  });

  it('makes the link when it opens, and says so while it does', async () => {
    type Opened = Awaited<ReturnType<ShareSheetApi['open']>>;
    let resolve: (v: Opened) => void = () => undefined;
    const api = fakeApi({ open: vi.fn(() => new Promise<Opened>((r) => (resolve = r))) });
    const tracker = fakeTracker();
    render(<ShareSheet recipeName="Quiche" familyName="F" api={api} tracker={tracker} onClose={vi.fn()} />);
    expect(screen.getByText('Creating link…')).toBeTruthy();
    await act(async () => resolve({ ...link, created: true }));
    expect(screen.getByText(url)).toBeTruthy();
    expect(tracker.track).toHaveBeenCalledWith('share_link_created', {});
  });

  it('reuses an existing link without a new event', async () => {
    const { tracker } = await setup(fakeApi({ open: vi.fn().mockResolvedValue({ ...link, created: false }) }));
    expect(screen.getByText(url)).toBeTruthy();
    expect(tracker.track).not.toHaveBeenCalled();
  });

  it('US1: Copy link copies it, reads "Copied ✓" for 2 s and shows "Link copied"', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { api } = await setup();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy link' })));
    expect(api.copy).toHaveBeenCalledWith(url);
    expect(screen.getByRole('button', { name: 'Copied ✓' })).toBeTruthy();
    expect(screen.getByText('Link copied')).toBeTruthy();
    act(() => vi.advanceTimersByTime(COPIED_MS));
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
  });

  it('US1: Message, Email and More open the system share sheet', async () => {
    const { api } = await setup();
    for (const name of ['Message', 'Email', 'More']) fireEvent.click(screen.getByRole('button', { name }));
    expect(api.share).toHaveBeenCalledTimes(3);
    expect(api.share).toHaveBeenCalledWith(token);
  });

  it('switches apply to the live link at once', async () => {
    const { api } = await setup();
    await act(async () => fireEvent.click(screen.getByRole('switch', { name: 'Include variants' })));
    expect(api.setOptions).toHaveBeenCalledWith(token, { include_variants: false });
    expect(screen.getByRole('switch', { name: 'Include variants' }).getAttribute('aria-checked')).toBe('false');
  });

  it('a switch that fails to save goes back and says so', async () => {
    const { api } = await setup(fakeApi({ setOptions: vi.fn().mockRejectedValue(new Error('offline')) }));
    await act(async () => fireEvent.click(screen.getByRole('switch', { name: "Include chef's tips" })));
    expect(api.setOptions).toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: "Include chef's tips" }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText("Couldn't change that. Try again.")).toBeTruthy();
  });

  it('US3: Stop sharing asks first, then shows "Not shared" and "Create a new link"', async () => {
    const { api, tracker } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Stop sharing this link' }));
    expect(screen.getByText('Stop sharing?')).toBeTruthy();
    expect(screen.getByText('The link will stop working for everyone who has it.')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Stop sharing' })));
    expect(api.stop).toHaveBeenCalledWith(token);
    expect(tracker.track).toHaveBeenCalledWith('share_link_stopped', { days_active: 3 });
    expect(screen.getByText('Not shared')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Stop sharing this link' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Message' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('"Keep sharing" changes nothing', async () => {
    const { api } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Stop sharing this link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep sharing' }));
    expect(api.stop).not.toHaveBeenCalled();
    expect(screen.getByText(url)).toBeTruthy();
  });

  it('edge case: sharing again after stopping makes a new link', async () => {
    const other = 'b'.repeat(43);
    const open = vi.fn<ShareSheetApi['open']>().mockResolvedValueOnce({ ...link, created: true }).mockResolvedValueOnce({ ...link, token: other, created: true });
    const { tracker } = await setup(fakeApi({ open }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop sharing this link' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Stop sharing' })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create a new link' })));
    expect(open).toHaveBeenCalledTimes(2);
    expect(screen.getByText(`${window.location.origin}/r/${other}`)).toBeTruthy();
    expect(tracker.track).toHaveBeenCalledTimes(3);
  });

  it('says what to do when the link could not be made', async () => {
    const open = vi.fn<ShareSheetApi['open']>().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ...link, created: true });
    await setup(fakeApi({ open }));
    expect(screen.getByText("Couldn't create the link. Check your connection and try again.")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Try again' })));
    expect(screen.getByText(url)).toBeTruthy();
  });
});
