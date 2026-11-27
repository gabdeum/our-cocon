// The add and edit sheet's event · reminder switch: what goes across, and only what changed.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import { changedSince, eventPatch, reminderPatch, sharedFromEvent, sharedFromReminder } from './add-switch';
import { newDraft } from './event-form';
import { newReminderForm } from './reminders';

const draft = { ...newDraft({ date: '2026-10-30' }, '2026-10-28'), title: 'Swim' };
const never = { repeat: 'never' as const, weekdays: [], ends: { type: 'never' as const } };

describe('add switch', () => {
  it("an event's start is its slot's first hour; several people (or Others) are Everyone", () => {
    expect(sharedFromEvent({ ...draft, time: { kind: 'slot', slots: ['evening'] }, who: ['m-eva'] }, DEFAULT_SLOT_TIMES)).toEqual({ title: 'Swim', date: '2026-10-30', time: '18:00', who: 'm-eva', repeat: never, notes: '' });
    expect(sharedFromEvent({ ...draft, who: ['m-eva', 'm-gabriel'] }, DEFAULT_SLOT_TIMES)).toMatchObject({ time: null, who: 'everyone' });
    expect(sharedFromEvent({ ...draft, who: ['others'] }, DEFAULT_SLOT_TIMES).who).toBe('everyone');
  });

  it('a reminder with its time off has none', () => {
    expect(sharedFromReminder({ ...newReminderForm('m-gabriel', '2026-10-28'), title: 'Pay' })).toEqual({ title: 'Pay', date: '2026-10-28', time: null, who: 'm-gabriel', repeat: never, notes: '' });
  });

  it('only what changed since the form was left goes across; the first switch takes everything', () => {
    const before = { title: 'Swim', date: '2026-10-30', time: '18:00', who: 'm-eva', repeat: never, notes: '' };
    expect(changedSince(before, null)).toEqual(before);
    expect(changedSince({ ...before, title: 'Swim lesson' }, before)).toEqual({ title: 'Swim lesson' });
    // The same repeat, held anew, didn't change.
    expect(changedSince({ ...before, repeat: { ...never } }, before)).toEqual({});
  });

  it('into an event a start lasts an hour and none is All day; into a reminder it turns the time on or off', () => {
    expect(eventPatch({ time: '18:00', who: 'm-eva', title: 'x'.repeat(80) })).toEqual({ time: { kind: 'custom', start: '18:00', end: '19:00' }, who: ['m-eva'], title: 'x'.repeat(60) });
    expect(eventPatch({ time: null })).toEqual({ time: { kind: 'all_day' } });
    expect(reminderPatch({ time: '18:00', who: 'everyone' }, '2026-10-30')).toEqual({ hasTime: true, time: '18:00', assignee: 'everyone' });
    expect(reminderPatch({ time: null }, '2026-10-30')).toEqual({ hasTime: false });
  });

  it('the repeat and the notes go across both ways (Gabriel: they were lost)', () => {
    // 2026-10-30 is a Friday (5).
    const weekly = { repeat: 'weekly' as const, weekdays: [5], ends: { type: 'never' as const } };
    const fromEvent = sharedFromEvent({ ...draft, ...weekly, notes: 'Bring towels' }, DEFAULT_SLOT_TIMES);
    expect(reminderPatch(fromEvent, draft.date)).toMatchObject({ repeat: 'weekly', notes: 'Bring towels' });
    // Every 2 weeks, or with an end, is the reminder's Custom with the same repeat.
    const biweekly = { repeat: 'biweekly' as const, weekdays: [5], ends: { type: 'after' as const, count: '6' } };
    expect(reminderPatch({ repeat: biweekly }, draft.date)).toEqual({ repeat: 'custom', custom: biweekly });
    expect(reminderPatch({ notes: 'x'.repeat(5500) }, draft.date).notes).toHaveLength(5000);

    const monthly = sharedFromReminder({ ...newReminderForm('m-gabriel', '2026-10-30'), repeat: 'monthly', notes: 'Card' });
    expect(eventPatch(monthly)).toMatchObject({ repeat: 'monthly', weekdays: [], ends: { type: 'never' }, notes: 'Card' });
    const custom = sharedFromReminder({ ...newReminderForm('m-gabriel', '2026-10-30'), repeat: 'custom', custom: biweekly });
    expect(eventPatch(custom)).toMatchObject(biweekly);
  });

  it('one date of a repeating event goes across without the repeat', () => {
    expect(sharedFromEvent({ ...draft, repeat: 'weekly', weekdays: [5] }, DEFAULT_SLOT_TIMES, true).repeat).toEqual(never);
  });
});
