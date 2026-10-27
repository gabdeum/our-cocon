import type { SlotKey } from '@cocon/schemas/calendar';

/**
 * Every English word the calendar engine shows, in one place, so French can be added as
 * `words.fr.ts` with the same shape. Titles follow design/ui/CalHeader.md.
 */
export interface CalendarWords {
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
}

export const en: CalendarWords = {
  slots: { early_morning: 'Early morning', morning: 'Morning', lunch: 'Lunch', afternoon: 'Afternoon', evening: 'Evening' },
  allDay: 'All day',
  busy: 'Busy',
  months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  monthsShort: ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'],
  weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  am: 'AM',
  pm: 'PM',
};
