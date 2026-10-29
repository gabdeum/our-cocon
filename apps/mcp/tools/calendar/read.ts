import { z } from 'zod';
import { addDays, calendarWordsEn, daysBetween, findConflict, slotAt, slotsToRange, timeRange, viewFor } from '@cocon/calendar';
import { SLOT_KEYS, type EventMember, type SlotKey } from '@cocon/schemas/calendar';
import { defineTool, ToolError } from '../../src/tools.js';
import { Day, dayName, loadCalendar, memberRef, occurrences, shownOccurrence } from './shared.js';

const MAX_LIST_DAYS = 62;
const MAX_FREE_DAYS = 14;

export const listMembers = defineTool({
  name: 'list_members',
  title: 'List the family',
  access: 'read',
  description:
    'Who is in the family, with their ids and colors, and whether they have the app (has_app). Members without the app (young children, grandparents) can be on events but someone with the app takes them. Also gives today’s date in the family’s time zone: call this first to work out "Saturday" or "next week".',
  input: z.strictObject({}),
  async run(_args, ctx) {
    const cal = await loadCalendar(ctx);
    return {
      today: cal.today,
      today_is: dayName(cal.today),
      time_zone: cal.timeZone,
      members: cal.members.map((m) => ({ id: m.id, name: m.name, color: m.color, has_app: m.user_id !== null, ...(m.id === cal.me ? { is_you: true } : {}) })),
    };
  },
});

export const listEvents = defineTool({
  name: 'list_events',
  title: 'List events',
  access: 'read',
  description: [
    `The family’s events between two days (at most ${MAX_LIST_DAYS} days), one entry per date, in order. Give member to keep only that person’s events (theirs and Everyone’s).`,
    '"Busy" is someone’s private event: say they’re busy then, never guess what it is.',
  ].join('\n'),
  input: z.strictObject({
    from: Day,
    to: Day,
    member: z.string().max(80).optional().describe('A member’s name or id, from list_members.'),
  }),
  async run(args, ctx) {
    if (args.to < args.from) throw new ToolError('to is before from. Swap them and try again.');
    if (daysBetween(args.from, args.to) >= MAX_LIST_DAYS) throw new ToolError(`Ask for at most ${MAX_LIST_DAYS} days at a time.`);
    const cal = await loadCalendar(ctx);
    const who = args.member ? memberRef(cal, args.member) : null;
    const list = (await occurrences(ctx, args.from, args.to)).filter((o) => !who || o.members.includes(who) || o.members.includes('everyone'));
    return { from: args.from, to: args.to, events: sortByTime(list, cal.slotTimes).map((o) => shownOccurrence(o, cal, ctx)) };
  },
});

export const getDay = defineTool({
  name: 'get_day',
  title: 'See one day',
  access: 'read',
  description: [
    'Everything on one day, grouped as the app shows it: all_day, then early_morning, morning, lunch, afternoon and evening (by when each starts). Use it for "What does Eva have on Tuesday?".',
    '"Busy" is someone’s private event: say they’re busy then, never guess what it is.',
  ].join('\n'),
  input: z.strictObject({ date: Day }),
  async run(args, ctx) {
    const cal = await loadCalendar(ctx);
    const groups: Record<'all_day' | SlotKey, ReturnType<typeof shownOccurrence>[]> = { all_day: [], early_morning: [], morning: [], lunch: [], afternoon: [], evening: [] };
    for (const o of sortByTime(await occurrences(ctx, args.date, args.date), cal.slotTimes)) {
      const range = timeRange(o, cal.slotTimes);
      // An all-day event, or one that started on an earlier day, is with the day's all-day events.
      const group = !range || o.starts_on < args.date ? 'all_day' : slotAt(range.start, cal.slotTimes);
      groups[group].push(shownOccurrence(o, cal, ctx));
    }
    return { date: args.date, day: dayName(args.date), ...groups };
  },
});

export const findFreeSlots = defineTool({
  name: 'find_free_slots',
  title: 'Find free times',
  access: 'read',
  description: `The slots (early morning, morning, lunch, afternoon, evening) when nobody among members has anything on, for one day or up to ${MAX_FREE_DAYS} days. Without members, when the whole family is free. All-day events don’t take a slot.`,
  input: z.strictObject({
    date: Day.optional(),
    from: Day.optional(),
    to: Day.optional(),
    members: z.array(z.string().max(80)).max(20).optional().describe('Names or ids from list_members; leave out for the whole family.'),
  }),
  async run(args, ctx) {
    const from = args.date ?? args.from;
    const to = args.date ?? args.to ?? args.from;
    if (!from || !to) throw new ToolError('Send a date, or from and to.');
    if (to < from) throw new ToolError('to is before from. Swap them and try again.');
    if (daysBetween(from, to) >= MAX_FREE_DAYS) throw new ToolError(`Ask for at most ${MAX_FREE_DAYS} days at a time.`);
    const cal = await loadCalendar(ctx);
    const who: EventMember[] = args.members?.length ? [...new Set(args.members.map((m) => memberRef(cal, m)))] : ['everyone'];
    // As the member sees it: a private event takes its time like any other.
    const all = (await occurrences(ctx, from, to)).map((o) => viewFor(o, cal.me));
    const days = [];
    for (let day = from; day <= to; day = addDays(day, 1)) {
      const free = SLOT_KEYS.filter((slot) => !findConflict({ starts_on: day, ends_on: day, time_type: 'slot', slots: [slot], members: who }, all, cal.slotTimes));
      days.push({
        date: day,
        day: dayName(day),
        free: free.map((slot) => {
          const hours = slotsToRange([slot], cal.slotTimes);
          return { slot, name: calendarWordsEn.slots[slot], time: `${hours.start}–${hours.end}` };
        }),
      });
    }
    return { days };
  },
});

/** By day, then by start time (all day first). */
function sortByTime<T extends Parameters<typeof timeRange>[0] & { starts_on: string; title: string }>(list: T[], slotTimes: Parameters<typeof timeRange>[1]): T[] {
  const start = (o: T) => timeRange(o, slotTimes)?.start ?? '';
  return [...list].sort((a, b) => a.starts_on.localeCompare(b.starts_on) || start(a).localeCompare(start(b)) || a.title.localeCompare(b.title));
}
