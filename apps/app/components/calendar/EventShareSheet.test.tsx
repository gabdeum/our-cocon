// Spec 042 FR-005: the event share sheet (OC-CalEvent.md › Share): OC-Share's layout and states.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EventShareSheet, type EventShareSheetApi } from './EventShareSheet';
import { fakeTracker, last } from '../../test/fakes';

vi.mock('expo-linking', () => ({ createURL: (p: string) => `ourcocon://${p}` }));
vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn() }));

afterEach(cleanup);

const token = 'b'.repeat(43);
const url = `${window.location.origin}/e/${token}`;

function fakeApi(over: Partial<EventShareSheetApi> = {}) {
  return {
    open: vi.fn<EventShareSheetApi['open']>().mockResolvedValue({ token, created_at: '2026-10-31T10:00:00Z', created: true }),
    stop: vi.fn<EventShareSheetApi['stop']>().mockResolvedValue(undefined),
    copy: vi.fn<EventShareSheetApi['copy']>().mockResolvedValue(true),
    share: vi.fn<EventShareSheetApi['share']>().mockResolvedValue('shared'),
    ...over,
  };
}

async function setup(api = fakeApi()) {
  const tracker = fakeTracker();
  render(<EventShareSheet api={api} tracker={tracker} onClose={vi.fn()} />);
  await act(async () => undefined);
  return { api, tracker };
}

describe('Event share sheet', () => {
  it('says what the link shows, makes it on open and tracks a new one', async () => {
    const { tracker } = await setup();
    expect(screen.getByText('Share this event')).toBeTruthy();
    expect(screen.getByText('People with the link see the title, day, time and place. No notes or checklist.')).toBeTruthy();
    expect(screen.getByText(url)).toBeTruthy();
    for (const name of ['Copy link', 'Message', 'Email', 'More', 'Stop sharing this link']) expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(tracker.track).toHaveBeenCalledWith('event_shared', {});
  });

  it('reopening the same link sends nothing', async () => {
    const { tracker } = await setup(fakeApi({ open: vi.fn<EventShareSheetApi['open']>().mockResolvedValue({ token, created_at: '2026-10-31T10:00:00Z', created: false }) }));
    expect(tracker.track).not.toHaveBeenCalled();
  });

  it('copies the link and sends it', async () => {
    const { api } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await act(async () => undefined);
    expect(api.copy).toHaveBeenCalledWith(url);
    expect(screen.getByText('Link copied')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Message' }));
    expect(api.share).toHaveBeenCalledWith(token);
  });

  it('stops sharing after asking, then offers a new link', async () => {
    const { api } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Stop sharing this link' }));
    expect(screen.getByRole('alertdialog', { name: 'Stop sharing?' })).toBeTruthy();
    fireEvent.click(last(screen.getAllByRole('button', { name: 'Stop sharing' })));
    await act(async () => undefined);
    expect(api.stop).toHaveBeenCalledWith(token);
    expect(screen.getByText('Not shared')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create a new link' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Stop sharing this link' })).toBeNull();
  });

  it('says what to do when the link could not be made', async () => {
    await setup(fakeApi({ open: vi.fn<EventShareSheetApi['open']>().mockRejectedValue(new Error('offline')) }));
    expect(screen.getByText("Couldn't create the link. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
