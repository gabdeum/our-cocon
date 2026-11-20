// The add sheet's "New event · New reminder" switch: what goes across, and only what changed.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import { changedSince, eventPatch, reminderPatch, sharedFromEvent, sharedFromReminder } from './add-switch';
import { newDraft } from './event-form';
import { newReminderForm } from './reminders';

const draft = { ...newDraft({ date: '2026-10-30' }, '2026-10-28'), title: 'Swim' };

describe('add switch', () => {
  it("an event's start is its slot's first hour; several people (or Others) are Everyone", () => {
    expect(sharedFromEvent({ ...draft, time: { kind: 'slot', slots: ['evening'] }, who: ['m-eva'] }, DEFAULT_SLOT_TIMES)).toEqual({ title: 'Swim', date: '2026-10-30', time: '18:00', who: 'm-eva' });
    expect(sharedFromEvent({ ...draft, who: ['m-eva', 'm-gabriel'] }, DEFAULT_SLOT_TIMES)).toMatchObject({ time: null, who: 'everyone' });
    expect(sharedFromEvent({ ...draft, who: ['others'] }, DEFAULT_SLOT_TIMES).who).toBe('everyone');
  });

  it('a reminder with its time off has none', () => {
    expect(sharedFromReminder({ ...newReminderForm('m-gabriel', '2026-10-28'), title: 'Pay' })).toEqual({ title: 'Pay', date: '2026-10-28', time: null, who: 'm-gabriel' });
  });

  it('only what changed since the form was left goes across; the first switch takes everything', () => {
    const before = { title: 'Swim', date: '2026-10-30', time: '18:00', who: 'm-eva' };
    expect(changedSince(before, null)).toEqual(before);
    expect(changedSince({ ...before, title: 'Swim lesson' }, before)).toEqual({ title: 'Swim lesson' });
  });

  it('into an event a start lasts an hour and none is All day; into a reminder it turns the time on or off', () => {
    expect(eventPatch({ time: '18:00', who: 'm-eva', title: 'x'.repeat(80) })).toEqual({ time: { kind: 'custom', start: '18:00', end: '19:00' }, who: ['m-eva'], title: 'x'.repeat(60) });
    expect(eventPatch({ time: null })).toEqual({ time: { kind: 'all_day' } });
    expect(reminderPatch({ time: '18:00', who: 'everyone' })).toEqual({ hasTime: true, time: '18:00', assignee: 'everyone' });
    expect(reminderPatch({ time: null })).toEqual({ hasTime: false });
  });
});
