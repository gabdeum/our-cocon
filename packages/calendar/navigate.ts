import type { CalendarView } from '@cocon/schemas/calendar';
import { addDays, makeDate, parts } from './dates';

/** How far ‹ › move each view (spec 036 FR-005). Agenda pages by the week, as on the CalHeader screen. */
export const VIEW_STEP: Record<CalendarView, 'month' | 'week' | 'day'> = { month: 'month', week: 'week', day: 'day', agenda: 'week' };

/** The day a view shows after one step back (-1) or forward (+1). Months land on the 1st, so Jan 31 never skips February. */
export function shiftAnchor(view: CalendarView, date: string, dir: -1 | 1): string {
  const step = VIEW_STEP[view];
  if (step === 'day') return addDays(date, dir);
  if (step === 'week') return addDays(date, 7 * dir);
  const { year, month } = parts(date);
  return makeDate(year, month + dir, 1);
}
