// Spec 042: the event page. US1 everything in one place, US2 deleting a repeating event someone
// else added, the one-off Dialog, Duplicate and Share (FR-003). Spec 075: ticking the notes' checklist.
// Spec 050 FR-006: ✎ and ⋯ in the top bar, the menu, the compact layout.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { eventOccurrence } from '../../lib/event-detail';
import { ToastProvider } from '../../lib/toast';
import { NOW, babyMusic, members } from '../../test/baby-music';
import { fakeTracker, flush, gabriel, last } from '../../test/fakes';
import { EventDetail, type EventDetailProps } from './EventDetail';
import { expectAccessible } from '../../test/axe';

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
    now: NOW,
    onBack: vi.fn(),
    onEdit: vi.fn(),
    onShare: vi.fn(),
    onOpenUrl: vi.fn(),
    onCopy: vi.fn(async () => undefined),
    noteChecklist: { save: vi.fn(async () => 'saved' as const), reload: vi.fn(async () => null), onSaved: vi.fn() },
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

/** Picks an item from the top bar's ⋯ menu. */
const menu = (item: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
  fireEvent.click(screen.getByRole('menuitem', { name: item }));
};

describe('Event detail', () => {
  it('US1: shows everything about Baby music class, in order', async () => {
    setup();
    const text = document.body.textContent ?? '';
    const order = [
      // Spec 053 FR-005: the people lead the meta row, above the title.
      'James',
      'Social',
      'Every Saturday',
      'Baby music class',
      'Sat, Oct 31',
      ' · Morning, about 09:00–12:00',
      // Spec 075: its old "Bring" list is a checklist in the notes.
      'Bring:',
      'Diaper bag',
      'Bottle',
      'Spare clothes',
      'Gabriel takes James',
      'Little Notes studio, 4 Elm St',
      '1 hour before',
      ' · reminds Gabriel · 08:00',
      'Added by Eva · 2 days ago',
    ];
    // The top bar: back, ✎ and ⋯; the page's own buttons are gone (spec 050 FR-006).
    expect(screen.getByRole('button', { name: 'Back to Calendar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit event' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'More actions' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Duplicate' })).toBeNull();
    // After the bar, which holds the title too (shown once it scrolls under).
    let at = text.indexOf('James') - 1;
    for (const part of order) {
      const next = text.indexOf(part, at + 1);
      expect(next, part).toBeGreaterThan(at);
      at = next;
    }
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Baby music class']);
    expect(screen.getByRole('checkbox', { name: 'Diaper bag' }).getAttribute('aria-checked')).toBe('true');
    expect(document.body.textContent).not.toContain('anyone can tick');
    // Spec 030 SC-001.
    await expectAccessible();
  });

  // Spec 053 FR-007: the notes under the date line; spec 073: formatted, whole, no Show more.
  it('shows the whole note under the date line, formatted', () => {
    setup(babyMusic({ notes: 'Bring the yellow socks' }));
    const text = document.body.textContent ?? '';
    expect(text.indexOf('Bring the yellow socks')).toBeGreaterThan(text.indexOf('Morning, about 09:00–12:00'));
    expect(text.indexOf('Bring the yellow socks')).toBeLessThan(text.indexOf('Gabriel takes James'));
    expect(screen.getByRole('region', { name: 'Notes' })).toBeTruthy();
    cleanup();
    const { tracker } = setup(babyMusic({ notes: '**Bring**\n1. Socks\n2. Water\n3. Snack\n4. Hat\n5. Coat\n6. Book\n7. Toy' }));
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    expect(screen.getByText('Toy')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(tracker.track).toHaveBeenCalledWith('note_viewed_formatted', { entity: 'event', has_bold: true, has_link: false, has_list: true, has_checklist: false, has_table: false });
  });

  it('opens a link in the notes outside the app (spec 073 FR-004)', () => {
    const { onOpenUrl, tracker } = setup(babyMusic({ notes: 'Parking: [map](https://maps.example.com/a)' }));
    fireEvent.click(screen.getByRole('link', { name: 'map' }));
    expect(onOpenUrl).toHaveBeenCalledWith('https://maps.example.com/a');
    expect(tracker.track).toHaveBeenCalledWith('note_link_opened', { entity: 'event', scheme: 'https' });
  });

  it('hides rows without a value, and says an assistant added it (FR-006)', () => {
    setup(babyMusic({ category: null, recurrence: null, starts_on: '2026-10-31', ends_on: '2026-10-31', location: null, responsible_member_id: null, reminder: 'none', notes: null, source: 'claude' }));
    expect(screen.queryByRole('button', { name: /in Google Maps$/ })).toBeNull();
    for (const gone of ['Social', 'Every Saturday', 'takes', 'hour before', 'Bring']) expect(document.body.textContent).not.toContain(gone);
    expect(screen.getByText('Added via Claude · 2 days ago')).toBeTruthy();
  });

  it('opens the place in Google Maps, or copies it', async () => {
    const { onOpenUrl, onCopy } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Open Little Notes studio, 4 Elm St in Google Maps' }));
    expect(onOpenUrl).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=Little%20Notes%20studio%2C%204%20Elm%20St');
    fireEvent.click(screen.getByRole('button', { name: 'Copy Little Notes studio, 4 Elm St' }));
    expect(onCopy).toHaveBeenCalledWith('Little Notes studio, 4 Elm St');
    expect(await screen.findByText('Address copied')).toBeTruthy();
  });

  it('says so when the place can’t be copied', async () => {
    setup(undefined, { onCopy: vi.fn(async () => Promise.reject(new Error('no clipboard'))) });
    fireEvent.click(screen.getByRole('button', { name: 'Copy Little Notes studio, 4 Elm St' }));
    expect(await screen.findByText("Couldn't copy the address.")).toBeTruthy();
  });

  it('spec 075: ticking an item in the notes shows at once, then saves that line (FR-001, FR-002)', async () => {
    const { noteChecklist, tracker } = setup();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bottle' }));
    expect(screen.getByRole('checkbox', { name: 'Bottle' }).getAttribute('aria-checked')).toBe('true');
    await flush();
    expect(noteChecklist.save).toHaveBeenCalledWith('Bring:\n- [x] Diaper bag\n- [ ] Bottle\n- [ ] Spare clothes', 'Bring:\n- [x] Diaper bag\n- [x] Bottle\n- [ ] Spare clothes');
    expect(tracker.track).toHaveBeenCalledWith('note_checklist_toggled', { entity: 'event', checked: true, items_total: 3, items_checked: 2 });
    expect(noteChecklist.onSaved).toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Bottle' }).getAttribute('aria-checked')).toBe('true');
  });

  it('spec 075: a failed save undoes the tick and says so', async () => {
    const { tracker } = setup(babyMusic(), { noteChecklist: { save: vi.fn(async () => Promise.reject(new Error('offline'))), reload: vi.fn(async () => null) } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Diaper bag' }));
    await flush();
    expect(screen.getByRole('checkbox', { name: 'Diaper bag' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText("Couldn't save. Try again.")).toBeTruthy();
    expect(tracker.track).not.toHaveBeenCalledWith('note_checklist_toggled', expect.anything());
  });

  it('spec 075 FR-003: someone changed the note meanwhile', async () => {
    // Eva added a line at the end: the tick goes onto her version.
    const evas = 'Bring:\n- [x] Diaper bag\n- [ ] Bottle\n- [ ] Spare clothes\n- [ ] Hat';
    const save = vi.fn(async (from: string) => (from === evas ? ('saved' as const) : ('changed' as const)));
    setup(babyMusic(), { noteChecklist: { save, reload: vi.fn(async () => evas) } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bottle' }));
    await flush();
    expect(save).toHaveBeenLastCalledWith(evas, 'Bring:\n- [x] Diaper bag\n- [x] Bottle\n- [ ] Spare clothes\n- [ ] Hat');
    expect(screen.getByRole('checkbox', { name: 'Hat' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Bottle' }).getAttribute('aria-checked')).toBe('true');
    cleanup();
    // She rewrote the list: that line is something else now, so the latest note shows and nothing is saved.
    const rewritten = 'Bring:\n- [ ] Snacks';
    const once = vi.fn(async () => 'changed' as const);
    setup(babyMusic(), { noteChecklist: { save: once, reload: vi.fn(async () => rewritten) } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bottle' }));
    await flush();
    expect(once).toHaveBeenCalledOnce();
    expect(screen.getByText('This note changed. Showing the latest version.')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Snacks' })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'Bottle' })).toBeNull();
  });

  it('US2: deleting a repeating event Eva added asks which ones', async () => {
    const { onDelete, tracker, undo, onChanged } = setup();
    menu('Delete event');
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
    menu('Delete event');
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(onDelete).not.toHaveBeenCalled();
    menu('Delete event');
    fireEvent.click(screen.getByRole('button', { name: 'Only this one' }));
    await flush();
    expect(onDelete).toHaveBeenCalledWith('this');
  });

  it('a one-off event goes at once, with Undo in the toast and no Dialog', async () => {
    const { onDelete, tracker } = setup(babyMusic({ recurrence: null, starts_on: '2026-10-31', ends_on: '2026-10-31', creator_member_id: gabriel.id }));
    menu('Delete event');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await flush();
    expect(onDelete).toHaveBeenCalledWith('all');
    expect(screen.getByRole('status').textContent).toContain('Event deleted');
    expect(tracker.track).toHaveBeenCalledWith('event_deleted', { scope: 'all', own_event: true, undone: false });
  });

  it('says so when Delete fails', async () => {
    setup(babyMusic(), { onDelete: vi.fn(async () => Promise.reject(new Error('offline'))) });
    menu('Delete event');
    fireEvent.click(screen.getByRole('button', { name: 'Only this one' }));
    await flush();
    expect(screen.getByText("Couldn't delete. Check your connection and try again.")).toBeTruthy();
  });

  it('says so when Duplicate fails, and when the delete toast’s Undo fails', async () => {
    setup(babyMusic(), { onDuplicate: vi.fn(async () => Promise.reject(new Error('offline'))) });
    menu('Duplicate');
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Saturday, Nov 7' }));
    await flush();
    expect(screen.getByText("Couldn't copy. Check your connection and try again.")).toBeTruthy();
    cleanup();
    const failing = vi.fn(async () => Promise.reject(new Error('offline')));
    const { tracker } = setup(babyMusic(), { onDelete: vi.fn(async () => failing) });
    menu('Delete event');
    fireEvent.click(screen.getByRole('button', { name: 'Only this one' }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await flush();
    expect(screen.getByRole('status').textContent).toBe("Couldn't undo. Check your connection and try again.");
    expect(tracker.track).not.toHaveBeenCalledWith('event_deleted', expect.objectContaining({ undone: true }));
  });

  it('FR-003 Duplicate: pick a day, then "Copied to Sat, Nov 7" with Undo', async () => {
    const { onDuplicate, tracker, undo } = setup();
    menu('Duplicate');
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

  it('the ⋯ menu holds Duplicate, Share and Delete, in that order', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Duplicate', 'Share a view-only link', 'Delete event']);
  });

  it('Edit and Share go to their sheets; Share is not offered for a private event or one that is over', () => {
    const { onEdit, onShare } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit event' }));
    menu('Share a view-only link');
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onShare).toHaveBeenCalledOnce();
    cleanup();
    setup(babyMusic({ visibility: 'private', creator_member_id: gabriel.id }));
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Duplicate', 'Delete event']);
    cleanup();
    setup(babyMusic(), { today: '2026-11-01' });
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.queryByRole('menuitem', { name: 'Share a view-only link' })).toBeNull();
  });

  it('spec 043: a surprise is tagged "Surprise" for those in on it', () => {
    setup(babyMusic({ visibility: 'surprise', surprise: { hidden_from: [members[1]?.id ?? ''], cover_title: 'Music', cover_note: null } }));
    expect(screen.getByText('Surprise')).toBeTruthy();
    expect(screen.getByText('Social')).toBeTruthy();
  });

  it('offline: readable, nothing changes', () => {
    const { noteChecklist } = setup(babyMusic(), { readOnly: true });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bottle' }));
    expect(noteChecklist.save).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Bottle' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'Edit event' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'More actions' }).getAttribute('aria-disabled')).toBe('true');
  });
});
