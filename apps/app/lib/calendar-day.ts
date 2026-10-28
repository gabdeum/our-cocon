import { SLOT_KEYS, type SlotKey } from '@cocon/schemas/calendar';
import { calendarWordsEn, daysBetween, slotAt, sortSlots, timeLabel, timeRange, toMinutes, weekday, type SlotTimes } from '@cocon/calendar';
import type { DayAllDayItem, DayBand, DayEventItem, MemberChipColor } from '@cocon/ui';
import { eventLook, longDate, occurrenceKey, type MemberLook, type MonthOccurrence } from './calendar-month';
import type { Member } from './session';
import { strings } from '../strings/en';

const d = strings.calendar.day;
const words = calendarWordsEn;

export interface DayViewContext {
  today: string;
  /** "HH:MM" now in the home time zone, for "Now". */
  now: string;
  look: MemberLook;
  slotTimes: SlotTimes;
  /** In member order: the busy chips follow it. */
  members: readonly Member[];
}

/** FR-001: "Gabriel 2", in member order, then "Everyone 2". */
export interface DayBusyChip {
  key: string;
  text: string;
  initial: string;
  color: MemberChipColor;
}

export interface DayLayout {
  busy: DayBusyChip[];
  allDay: DayAllDayItem[];
  bands: (DayBand & { slot: SlotKey })[];
}

/** Like the week's All day row: all-day events and anything spanning more than one day. */
const inAllDay = (o: MonthOccurrence) => o.time_type === 'all_day' || o.ends_on > o.starts_on;

/** "Sunday October 25", as the week reads a day. */
export const dayName = (date: string) => strings.calendar.week.dayLabel(words.weekdays[weekday(date)] ?? '', longDate(date));

/**
 * Spec 039 (OC-CalDay): one day's visible events (already through `viewFor` and the header's
 * filter). FR-001 who's busy and how often; FR-002 the All day rows ("Day 2 of 3", "Birthday");
 * FR-003 the five bands with their events, each in the slot it starts in (`slotAt`), with the
 * time line, who takes whom and "Now"; FR-004 an add row in each empty band. An event the engine
 * can't read is left out.
 */
export function layoutDayView(date: string, occurrences: readonly MonthOccurrence[], ctx: DayViewContext): DayLayout {
  const onDay = occurrences.filter((o) => o.starts_on <= date && o.ends_on >= date);

  const allDay: DayAllDayItem[] = onDay.filter(inAllDay).map((o) => {
    const total = daysBetween(o.starts_on, o.ends_on) + 1;
    const tag = total > 1 ? d.dayOf(daysBetween(o.starts_on, date) + 1, total) : o.view === 'full' && o.category === 'birthday' ? d.birthday : null;
    return { key: occurrenceKey(o), title: o.title, tag, colors: eventLook(o.members, ctx.look).colors, label: d.allDayLabel(o.title, tag) };
  });

  const timed = onDay
    .filter((o) => !inAllDay(o))
    .flatMap((o) => {
      try {
        const range = timeRange(o, ctx.slotTimes);
        if (!range) return [];
        const slot = o.time_type === 'slot' ? (sortSlots(o.slots)[0] ?? slotAt(range.start, ctx.slotTimes)) : slotAt(range.start, ctx.slotTimes);
        return [{ o, range, slot, item: eventRow(o, range, date, ctx) }];
      } catch {
        return [];
      }
    })
    .sort((a, b) => toMinutes(a.range.start) - toMinutes(b.range.start) || a.o.title.localeCompare(b.o.title));

  const bands = SLOT_KEYS.map((slot) => {
    const { start, end } = ctx.slotTimes[slot];
    return {
      key: slot,
      slot,
      title: words.slots[slot],
      hours: d.hours(start, end),
      events: timed.filter((t) => t.slot === slot).map((t) => t.item),
      addText: d.addIn(d.bands[slot]),
      addLabel: d.addInLabel(d.bands[slot], dayName(date)),
    };
  });

  return { busy: busyChips([...onDay.filter(inAllDay), ...timed.map((t) => t.o)], ctx), allDay, bands };
}

function eventRow(o: MonthOccurrence, range: { start: string; end: string }, date: string, ctx: DayViewContext): DayEventItem {
  const { initials, colors } = eventLook(o.members, ctx.look);
  const when = timeLabel(o, { use24h: true, slotTimes: ctx.slotTimes });
  const time = o.location ? d.at(when, o.location) : when;
  const driver = o.view === 'full' ? driverLine(o.responsible_member_id, o.members, ctx.members) : null;
  const now = date === ctx.today && toMinutes(ctx.now) >= toMinutes(range.start) && toMinutes(ctx.now) < toMinutes(range.end);
  return {
    key: occurrenceKey(o),
    title: o.title,
    time,
    driver,
    nowText: now ? d.now : null,
    initials,
    colors,
    label: d.rowLabel([o.title, time, ...(driver ? [driver] : [])], now),
  };
}

/** "Gabriel takes James": the member responsible, and the members without the app on the event. */
function driverLine(responsible: string | null | undefined, eventMembers: readonly string[], members: readonly Member[]): string | null {
  const driver = members.find((m) => m.id === responsible);
  const taken = members.filter((m) => m.user_id === null && eventMembers.includes(m.id)).map((m) => m.display_name);
  return driver && taken.length ? d.takes(driver.display_name, taken) : null;
}

/** FR-001: each member (in member order), then Everyone, with how many of the day's events are theirs. */
function busyChips(events: readonly MonthOccurrence[], ctx: DayViewContext): DayBusyChip[] {
  const count = (id: string) => events.filter((o) => o.members.includes(id)).length;
  const people = ctx.members.flatMap((m) => {
    const n = count(m.id);
    return n ? [{ key: m.id, text: d.count(m.display_name, n), initial: ctx.look.initials.get(m.id) ?? '?', color: m.color as MemberChipColor }] : [];
  });
  const everyone = count('everyone');
  const h = strings.calendar.header;
  return everyone ? [...people, { key: 'everyone', text: d.count(h.everyone, everyone), initial: h.everyoneInitial, color: 'everyone' }] : people;
}
