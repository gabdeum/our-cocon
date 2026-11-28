import type { SlotKey } from '@cocon/schemas/calendar';

/**
 * Every word the calendar engine shows, one file per language (`words.fr.ts`, `words.es.ts`, spec
 * 076) with the same shape. Titles follow design/ui/CalHeader.md.
 */
export interface CalendarWords {
  /** For Intl (time-zone names, sorting): "en-US". */
  locale: string;
  slots: Record<SlotKey, string>;
  allDay: string;
  /** What others see of a private event (spec 043). */
  busy: string;
  months: string[];
  /** Short month for narrow titles: "Oct." ("May" has no period). */
  monthsShort: string[];
  weekdays: string[];
  weekdaysShort: string[];
  am: string;
  pm: string;
  /** Word order of dates: "October 25" / "25 octobre". */
  monthDay: (month: string, day: number) => string;
  /** "Sunday, October 25" / "dimanche 25 octobre". */
  weekdayDate: (weekday: string, month: string, day: number) => string;
  /** "October 25 – 31", "November 29 – December 5" (`endMonth` null in the same month). */
  dayRange: (month: string, day: number, endMonth: string | null, endDay: number) => string;
  /** Added after a title outside this year: ", 2027". */
  yearSuffix: (year: number) => string;
  /** "James, Mia and Lou". */
  list: (names: readonly string[]) => string;
  everyone: string;
  /** The Responsible line (spec 042): "Gabriel takes James", or "Gabriel drives" when everyone on it has the app. */
  takes: (driver: string, names: readonly string[]) => string;
  drives: (driver: string) => string;
  /** Spec 049 FR-004: what a reminder on the phone says (design/ui/OC-Notifications.md). */
  reminders: {
    minutes_15: (title: string) => string;
    hour_before: (title: string) => string;
    at: (title: string, time: string) => string;
    /** "{title} this {slot}": "Baby music this morning". */
    inSlot: Record<SlotKey, (title: string) => string>;
    today: (title: string) => string;
    tomorrow: (title: string) => string;
  };
}

const list = (names: readonly string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : (names[0] ?? ''));

export const en: CalendarWords = {
  locale: 'en-US',
  slots: { early_morning: 'Early morning', morning: 'Morning', lunch: 'Lunch', afternoon: 'Afternoon', evening: 'Evening' },
  allDay: 'All day',
  busy: 'Busy',
  months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  monthsShort: ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'],
  weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  am: 'AM',
  pm: 'PM',
  monthDay: (month, day) => `${month} ${day}`,
  weekdayDate: (weekday, month, day) => `${weekday}, ${month} ${day}`,
  dayRange: (month, day, endMonth, endDay) => `${month} ${day} – ${endMonth ? `${endMonth} ` : ''}${endDay}`,
  yearSuffix: (year) => `, ${year}`,
  list,
  everyone: 'Everyone',
  takes: (driver, names) => `${driver} takes ${list(names)}`,
  drives: (driver) => `${driver} drives`,
  reminders: {
    minutes_15: (title) => `${title} in 15 minutes`,
    hour_before: (title) => `${title} in 1 hour`,
    at: (title, time) => `${title} at ${time}`,
    inSlot: {
      early_morning: (title) => `${title} early this morning`,
      morning: (title) => `${title} this morning`,
      lunch: (title) => `${title} at lunch`,
      afternoon: (title) => `${title} this afternoon`,
      evening: (title) => `${title} this evening`,
    },
    today: (title) => `Today: ${title}`,
    tomorrow: (title) => `Tomorrow: ${title}`,
  },
};
