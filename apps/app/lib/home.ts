import { addDays, calendarWordsEn, dateLabel, parts, timeLabel, weekday, type SlotTimes } from '@cocon/calendar';
import type { GroceryItem, HomeHero, StoredEvent } from '@cocon/data';
import { groceryIdentity } from '@cocon/quantity';
import type { HomeCardState } from '@cocon/schemas';
import type { EventColor, EventListItem, WeekEventDay, WeekStripDay } from '@cocon/ui';
import { agendaRow } from './calendar-agenda';
import { inAllDay, isBirthday } from './calendar-day';
import { longDate, monthOccurrences, occurrenceKey, type MemberLook, type MonthOccurrence } from './calendar-month';
import { remindsMember } from './event-detail';
import type { Member } from './session';
import { strings } from '../strings/en';

const c = strings.calCard;
const words = calendarWordsEn;

/** FR-002: "This week" is today and the next 6 days. */
export const CARD_DAYS = 7;
/** FR-004: birthdays show from 3 days ahead. */
export const BIRTHDAY_DAYS_AHEAD = 3;
/** US2: the week lists up to five events, then "See all (N more)". */
export const WEEK_ROWS = 5;

/** The hero's query: under `recipes`, so a recipe change refetches it (lib/sync.tsx). */
export const homeHeroKey = (familyId: string) => ['recipes', familyId, 'home'] as const;

/** The days Home loads events for: today to today + 6. */
export const cardWindow = (today: string) => ({ from: today, to: addDays(today, CARD_DAYS - 1) });

/** FR-007: Good morning 5:00–11:59, Hi 12:00–17:59, Good evening 18:00–4:59. `now` is "HH:MM". */
export function greeting(now: string, firstName: string): string {
  const hour = Number(now.slice(0, 2));
  const g = strings.home.greeting;
  if (hour >= 5 && hour < 12) return g.morning(firstName);
  if (hour >= 12 && hour < 18) return g.day(firstName);
  return g.evening(firstName);
}

/** "Sunday, Oct 25" (OC-Home's date line). */
export const homeDate = (date: string) => dateLabel(date, 'long');

/** The first word of a member's name: "Gabriel" for "Gabriel Demange". */
export const firstName = (displayName: string) => displayName.trim().split(/\s+/)[0] ?? displayName;

/**
 * US3: how many of the hero recipe's ingredients aren't on the grocery list yet, matched as "Add to
 * groceries" matches them (one thing per catalog key or name). A ticked item is on the list: bought.
 */
export function recipeToBuy(ingredients: HomeHero['ingredients'], list: readonly Pick<GroceryItem, 'catalog_key' | 'name'>[]): number {
  const onList = new Set(list.map(groceryIdentity));
  return new Set(ingredients.map(groceryIdentity).filter((id) => !onList.has(id))).size;
}

export interface CardContext {
  today: string;
  /** "HH:MM" in the home time zone, for "Now". */
  now: string;
  look: MemberLook;
  slotTimes: SlotTimes;
  members: readonly Member[];
  /** The signed-in member: what they may see, and whose reminders show. */
  me: Member;
  /** The member's Time format (spec 029); 24-hour when not given. */
  use24h?: boolean;
  /** "Show birthdays" (spec 029, L111): off hides the birthday banner. */
  showBirthdays?: boolean;
}

export interface CardBirthday {
  key: string;
  /** "Eva’s birthday is on Tuesday". */
  text: string;
}

export interface CardLayout {
  state: HomeCardState;
  /** Today: birthdays from today to 3 days ahead (FR-004). */
  birthdays: CardBirthday[];
  /** Today: reminders due today first (FR-003), then today's events by time. */
  today: EventListItem[];
  strip: WeekStripDay[];
  /** This week: the first five events, grouped by day (the day label once). */
  week: WeekEventDay[];
  /** FR-008: each strip day as the card shows it once picked, in the Today layout. */
  days: CardDay[];
  /** How many more events the week has than it lists: "See all (6 more)". */
  more: number;
  /** FR-002: the day "+" opens Add event on, for each view. */
  addDate: { today: string; week: string };
}

export interface CardDay {
  date: string;
  /** "Wednesday, Oct. 28", "Today, Sunday, Oct. 25". */
  title: string;
  items: EventListItem[];
  /** "Nothing planned on Thursday." */
  empty: string;
  /** "Add event on Wednesday". */
  addLabel: string;
}

const covers = (o: MonthOccurrence, date: string) => o.starts_on <= date && o.ends_on >= date;

/** Every member color an event shows, Everyone and Others included. */
function eventColors(o: MonthOccurrence, look: MemberLook): EventColor[] {
  return o.members.map((id): EventColor => (id === 'everyone' ? 'everyone' : id === 'others' ? 'others' : (look.colors.get(id) ?? 'removed')));
}

/** "Eva", "Gabriel, James", "Everyone". */
function whoLine(o: MonthOccurrence, members: readonly Member[]): string {
  const h = strings.calendar.header;
  return o.members
    .map((id) => (id === 'everyone' ? h.everyone : id === 'others' ? h.others : members.find((m) => m.id === id)?.display_name))
    .filter((n): n is string => Boolean(n))
    .join(', ');
}

/** "All day", "Evening", "10:00", or "Wed–Fri" for an event over several days. */
function whenLine(o: MonthOccurrence, slotTimes: SlotTimes, use24h = true): string {
  if (o.ends_on > o.starts_on) return `${words.weekdaysShort[weekday(o.starts_on)]}–${words.weekdaysShort[weekday(o.ends_on)]}`;
  if (inAllDay(o)) return words.allDay;
  return timeLabel(o, { use24h, slotTimes });
}

function safeRow(o: MonthOccurrence, date: string, ctx: CardContext) {
  try {
    return agendaRow(o, date, ctx);
  } catch {
    return null;
  }
}

/**
 * Spec 028 (CalCard): the card's three states from the family's events for today and the next 6
 * days, as the signed-in member may see them (`viewFor`: someone else's private event is "Busy").
 */
export function layoutCalendarCard(events: readonly StoredEvent[], ctx: CardContext): CardLayout {
  const { today } = ctx;
  const { from, to } = cardWindow(today);
  const tomorrow = addDays(today, 1);
  const occurrences = monthOccurrences(events, from, to, ctx.me.id, new Set());
  const byId = new Map(events.map((e) => [e.id, e]));
  const reminderOf = (o: MonthOccurrence) => {
    const event = byId.get(o.id);
    return o.view === 'full' && event && remindsMember(o, ctx.me, ctx.members) ? event.reminder : null;
  };

  // FR-004: birthdays from today to 3 days ahead, in the banner rather than the rows.
  const birthdays = occurrences
    .filter((o) => ctx.showBirthdays !== false && isBirthday(o) && o.starts_on >= today && o.starts_on <= addDays(today, BIRTHDAY_DAYS_AHEAD))
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on))
    .map((o) => ({
      key: occurrenceKey(o),
      text: c.birthday(o.title, o.starts_on === today ? 'today' : o.starts_on === tomorrow ? 'tomorrow' : (words.weekdays[weekday(o.starts_on)] ?? '')),
    }));

  // FR-003: a reminder due today: the morning of, an hour or 15 minutes before today's event, or the day before tomorrow's.
  const reminders = occurrences.flatMap((o) => {
    const reminder = reminderOf(o);
    const due = (o.starts_on === today && (reminder === 'morning_of' || reminder === 'hour_before' || reminder === 'minutes_15')) || (o.starts_on === tomorrow && reminder === 'day_before');
    if (!due) return [];
    const row = safeRow(o, o.starts_on, ctx);
    if (!row) return [];
    const sub = o.starts_on === tomorrow ? c.tomorrow(row.item.sub) : row.item.sub;
    const tag = o.starts_on === today ? nowTag(row.item) : null;
    // Today's before tomorrow's.
    const order = (o.starts_on === today ? 0 : 24 * 60) + row.order;
    return [{ order, item: { ...row.item, sub, tag, bell: true, label: c.rowLabel([c.reminder, row.item.title, sub, tag?.label ?? '']) } }];
  });
  const reminded = new Set(reminders.map((r) => r.item.key));
  const todayRows = occurrences
    .filter((o) => covers(o, today) && !isBirthday(o) && !reminded.has(occurrenceKey(o)))
    .flatMap((o) => {
      const row = safeRow(o, today, ctx);
      if (!row) return [];
      const tag = nowTag(row.item);
      return [{ ...row, item: { ...row.item, tag, label: c.rowLabel([row.item.title, row.item.sub, tag?.label ?? '']) } }];
    });
  const byTime = (x: { order: number; item: EventListItem }, y: { order: number; item: EventListItem }) => x.order - y.order || x.item.title.localeCompare(y.item.title);
  const todayItems = [...reminders.sort(byTime), ...todayRows.sort(byTime)].map((r) => r.item);

  // This week: each event once, on its first day in the window, grouped by day.
  const days = Array.from({ length: CARD_DAYS }, (_, i) => addDays(today, i));
  const weekByDay = days.map((date) => {
    const day = words.weekdaysShort[weekday(date)] ?? '';
    const events = occurrences
      .filter((o) => (date === today ? covers(o, today) : o.starts_on === date))
      .flatMap((o) => {
        const row = safeRow(o, date, ctx);
        if (!row) return [];
        const detail = c.detail(whoLine(o, ctx.members), whenLine(o, ctx.slotTimes, ctx.use24h));
        return [{ order: row.order, item: { key: occurrenceKey(o), title: o.title, detail, colors: eventColors(o, ctx.look).slice(0, 2), label: c.rowLabel([day, o.title, detail]) } }];
      })
      .sort((x, y) => x.order - y.order || x.item.title.localeCompare(y.item.title))
      .map((r) => r.item);
    return { date, day, events };
  });
  const weekCount = weekByDay.reduce((n, g) => n + g.events.length, 0);
  let room = WEEK_ROWS;
  const week = weekByDay.flatMap((g) => {
    const events = g.events.slice(0, room);
    room -= events.length;
    return events.length ? [{ ...g, events }] : [];
  });

  // FR-008: a picked day, laid out like Today (birthdays are rows here, there's no banner).
  const dayList = days.map((date): CardDay => {
    const name = words.weekdays[weekday(date)] ?? '';
    const items = occurrences
      .filter((o) => covers(o, date))
      .flatMap((o) => {
        const row = safeRow(o, date, ctx);
        return row ? [row] : [];
      })
      .sort(byTime)
      .map((r) => r.item);
    const { month, day } = parts(date);
    return {
      date,
      title: c.dayTitle(date === today, `${name}, ${words.monthsShort[month - 1] ?? ''} ${day}`),
      items,
      empty: c.dayEmpty(name),
      addLabel: c.addEventOn(name),
    };
  });

  const strip = days.map((date): WeekStripDay => {
    const onDay = occurrences.filter((o) => covers(o, date));
    const dots = [...new Set(onDay.flatMap((o) => eventColors(o, ctx.look)))].slice(0, 3);
    return {
      date,
      letter: strings.calendar.month.weekdays[weekday(date)] ?? '',
      num: String(parts(date).day),
      dots,
      today: date === today,
      label: c.dayLabel(date === today, longDate(date), onDay.map((o) => o.title)),
    };
  });

  // A birthday today is something today, though it shows only in the banner.
  const hasToday = todayItems.length > 0 || occurrences.some((o) => isBirthday(o) && o.starts_on === today);
  const state: HomeCardState = hasToday ? 'today' : weekCount ? 'week' : 'empty';
  const freeDay = days.find((date) => !occurrences.some((o) => covers(o, date))) ?? today;
  return {
    state,
    birthdays,
    today: todayItems,
    strip,
    week,
    days: dayList,
    more: Math.max(0, weekCount - WEEK_ROWS),
    addDate: { today, week: freeDay },
  };
}

/** The card's rows keep only the "Now" tag (CalCard). */
const nowTag = (item: EventListItem): EventListItem['tag'] => (item.tag?.label === strings.calendar.day.now ? item.tag : null);
