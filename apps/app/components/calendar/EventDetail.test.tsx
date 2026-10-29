// Spec 042: the event page. US1 everything in one place, US2 deleting a repeating event someone
// else added, the one-off Dialog, the live checklist (FR-002), Duplicate and Share (FR-003).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { eventOccurrence } from '../../lib/event-detail';
import { ToastProvider } from '../../lib/toast';
import { NOW, babyMusic, members } from '../../test/baby-music';
import { fakeTracker, flush, gabriel, last } from '../../test/fakes';
import { EventDetail, type EventDetailProps } from './EventDetail';

afterEach(cleanup);

function setup(event: StoredEvent = babyMusic(), over: Partial<EventDetailProps> = {}) {
  const tracker = fakeTracker();
  const undo = vi.fn(async () => undefined);
  const props: EventDetailProps = {
    event,
    occurrence: eventOccurrence(event, '2026-10-31') ?? event,
    date: '2026-10-31',
    members,
    myMemberId: gabriel.id,
    slotTimes: DEFAULT_SLOT_TIMES,
    today: '2026-10-31',
    weekStartsOn: 0,
    tracker,
    os: 'web',
    now: NOW,
    onBack: vi.fn(),
    onEdit: vi.fn(),
    onShare: vi.fn(),
    onOpenUrl: vi.fn(),
    onTick: vi.fn(async () => undefined),
    onDelete: vi.fn(async () => undo),
    onDuplicate: vi.fn(async () => undo),
    onChanged: vi.fn(),
    ...over,
  };
  render(
    <ToastProvider>
      <EventDetail {...props} />
    </ToastProvider>,
  );
  return { ...props, tracker, undo };
}

describe('Event detail', () => {
  it('US1: shows everything about Baby music class, in order', () => {
    setup();
    const text = document.body.textContent ?? '';
    const order = [
      'Calendar',
      'Social',
      'Baby music class',
      'James',
      'Saturday, Oct 31',
      'Morning · about 09:00–12:00',
      'Every Saturday',
      'Little Notes studio, 4 Elm St',
      'Open in Maps',
      'Gabriel takes James',
      '1 hour before',
      'Shows on Home for Gabriel',
      'Bring',
      'Diaper bag',
      'Bottle',
      'Spare clothes',
      'Anyone in the family can tick these.',
      'Added by Eva · 2 days ago',
      'Edit',
      'Duplicate',
      'Share a view-only link',
      'Delete event',
    ];
    let at = -1;
    for (const part of order) {
      const next = text.indexOf(part, at + 1);
      expect(next, part).toBeGreaterThan(at);
      at = next;
    }
    expect(screen.getByRole('heading', { name: 'Baby music class' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Diaper bag' }).getAttribute('aria-checked')).toBe('true');
  });

  it('hides rows without a value, and says an assistant added it (FR-006)', () => {
    setup(babyMusic({ category: null, recurrence: null, starts_on: '2026-10-31', ends_on: '2026-10-31', location: null, responsible_member_id: null, reminder: 'none', checklist: [], source: 'claude' }));
    for (const gone of ['Social', 'Every Saturday', 'Open in Maps', 'takes', 'hour before', 'Bring']) expect(document.body.textContent).not.toContain(gone);
    expect(screen.getByText('Added via Claude · 2 days ago')).toBeTruthy();
  });

  it('opens the place in Maps', () => {
    const { onOpenUrl } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Open Little Notes studio, 4 Elm St in Maps' }));
    expect(onOpenUrl).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=Little%20Notes%20studio%2C%204%20Elm%20St');
  });

  it('FR-002: anyone ticks the checklist; it shows at once and goes back if it fails', async () => {
    const { onTick, tracker } = setup();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bottle' }));
    expect(screen.getByRole('checkbox', { name: 'Bottle' }).getAttribute('aria-checked')).toBe('true');
    await flush();
    expect(onTick).toHaveBeenCalledWith('00000000-0000-4000-8000-0000000000c2', true);
    expect(tracker.track).toHaveBeenCalledWith('event_checklist_ticked', {});
    cleanup();
    setup(babyMusic(), { onTick: vi.fn(async () => Promise.reject(new Error('offline'))) });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bottle' }));
    await flush();
    expect(screen.getByRole('checkbox', { name: 'Bottle' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText("Couldn't change that. Try again.")).toBeTruthy();
  });

  it('US2: deleting a repeating event Eva added asks which ones', async () => {
    const { onDelete, tracker, undo, onChanged } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete event' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete “Baby music class”?' });
    expect(dialog.textContent).toContain("Eva added this. Delete only this one, or this and all future ones? It's removed for the whole family.");
    expect(within(dialog).getAllByRole('button').map((b) => b.textContent)).toEqual(['Only this one', 'This and all future ones', 'Keep it']);
    fireEvent.click(within(dialog).getByRole('button', { name: 'This and all future ones' }));
    await flush();
    expect(onDelete).toHaveBeenCalledWith('future');
    expect(tracker.track).toHaveBeenCalledWith('event_deleted', { scope: 'future', own_event: false, undone: false });
    expect(screen.getByRole('status').textContent).toContain('Event deleted');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await flush();
    expect(undo).toHaveBeenCalledOnce();
    expect(tracker.track).toHaveBeenCalledWith('event_deleted', { scope: 'future', own_event: false, undone: true });
    expect(onChanged).toHaveBeenCalled();
  });

  it('"Only this one" deletes that date; "Keep it" deletes nothing', async () => {
    const { onDelete } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete event' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete event' }));
    fireEvent.click(screen.getByRole('button', { name: 'Only this one' }));
    await flush();
    expect(onDelete).toHaveBeenCalledWith('this');
  });

  it('a one-off event of my own: "Delete" with no one to name', async () => {
    const { onDelete, tracker } = setup(babyMusic({ recurrence: null, starts_on: '2026-10-31', ends_on: '2026-10-31', creator_member_id: gabriel.id }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete event' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete “Baby music class”?' });
    expect(dialog.textContent).toContain('This removes it for the whole family.');
    expect(dialog.textContent).not.toContain('added this');
    expect(within(dialog).getAllByRole('button').map((b) => b.textContent)).toEqual(['Delete', 'Keep it']);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await flush();
    expect(onDelete).toHaveBeenCalledWith('all');
    expect(tracker.track).toHaveBeenCalledWith('event_deleted', { scope: 'all', own_event: true, undone: false });
  });

  it('says so when Delete fails', async () => {
    setup(babyMusic(), { onDelete: vi.fn(async () => Promise.reject(new Error('offline'))) });
    fireEvent.click(screen.getByRole('button', { name: 'Delete event' }));
    fireEvent.click(screen.getByRole('button', { name: 'Only this one' }));
    await flush();
    expect(screen.getByText("Couldn't delete. Check your connection and try again.")).toBeTruthy();
  });

  it('says so when Duplicate fails, and when the delete toast’s Undo fails', async () => {
    setup(babyMusic(), { onDuplicate: vi.fn(async () => Promise.reject(new Error('offline'))) });
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Saturday, Nov 7' }));
    await flush();
    expect(screen.getByText("Couldn't copy. Check your connection and try again.")).toBeTruthy();
    cleanup();
    const failing = vi.fn(async () => Promise.reject(new Error('offline')));
    const { tracker } = setup(babyMusic(), { onDelete: vi.fn(async () => failing) });
    fireEvent.click(screen.getByRole('button', { name: 'Delete event' }));
    fireEvent.click(screen.getByRole('button', { name: 'Only this one' }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await flush();
    expect(screen.getByRole('status').textContent).toBe("Couldn't undo. Check your connection and try again.");
    expect(tracker.track).not.toHaveBeenCalledWith('event_deleted', expect.objectContaining({ undone: true }));
  });

  it('FR-003 Duplicate: pick a day, then "Copied to Sat, Nov 7" with Undo', async () => {
    const { onDuplicate, tracker, undo } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(screen.getByRole('heading', { name: 'Pick a date' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Saturday, Nov 7' }));
    await flush();
    expect(onDuplicate).toHaveBeenCalledWith('2026-11-07');
    expect(tracker.track).toHaveBeenCalledWith('event_duplicated', {});
    expect(screen.getByRole('status').textContent).toContain('Copied to Sat, Nov 7');
    fireEvent.click(last(screen.getAllByRole('button', { name: 'Undo' })));
    await flush();
    expect(undo).toHaveBeenCalledOnce();
  });

  it('Edit and Share go to their sheets; Share is not offered for a private event or one that is over', () => {
    const { onEdit, onShare } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share a view-only link' }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onShare).toHaveBeenCalledOnce();
    cleanup();
    setup(babyMusic({ visibility: 'private', creator_member_id: gabriel.id }));
    expect(screen.queryByRole('button', { name: 'Share a view-only link' })).toBeNull();
    cleanup();
    setup(babyMusic(), { today: '2026-11-01' });
    expect(screen.queryByRole('button', { name: 'Share a view-only link' })).toBeNull();
  });

  it('offline: readable, nothing changes', () => {
    const { onTick } = setup(babyMusic(), { readOnly: true });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bottle' }));
    expect(onTick).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Bottle' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'Delete event' }).getAttribute('aria-disabled')).toBe('true');
  });
});
