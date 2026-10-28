import { CALENDAR_VIEWS, CalendarView, CalendarDate } from '@cocon/schemas/calendar';
import { VIEW_STEP, dayTitle, monthTitle, parts, weekRange, weekTitle, type WeekStartsOn } from '@cocon/calendar';
import { strings } from '../strings/en';

const h = strings.calendar.header;

/** The switcher's segments, in the header's order. */
export const viewSegments = CALENDAR_VIEWS.map((key) => ({ key, label: h.views[key] }));

/** `?view=`: Month unless the URL names another view (spec 036 FR-001; the member's default comes with 029). */
export function viewFrom(param: unknown): CalendarView {
  const parsed = CalendarView.safeParse(param);
  return parsed.success ? parsed.data : 'month';
}

/** `?date=`: the day the view shows, today when missing or not a date. */
export function anchorFrom(param: unknown, today: string): string {
  return CalendarDate.safeParse(param).success ? (param as string) : today;
}

/** `calendar_viewed`'s entry: Home's card opens `/calendar?from=home` (spec 028); anything else is the tab bar. */
export function entryFrom(param: unknown): 'nav' | 'homepage' {
  return param === 'home' ? 'homepage' : 'nav';
}

/** FR-003 (spec 034 FR-007): the header title for a view showing `anchor`, at this screen width. */
export function headerTitle(view: CalendarView, anchor: string, today: string, width: number, weekStartsOn: WeekStartsOn): string {
  if (view === 'agenda') return h.agendaTitle;
  if (view === 'day') return dayTitle(anchor, width);
  if (view === 'week') {
    const { start, end } = weekRange(anchor, weekStartsOn);
    return weekTitle(start, end, width);
  }
  const { year, month } = parts(anchor);
  return monthTitle(year, month, today, width);
}

/** FR-002: "Previous month" / "Next week", by how far the arrows move the view. */
export function arrowLabels(view: CalendarView): { prev: string; next: string } {
  const step = VIEW_STEP[view];
  return { prev: h.previous[step], next: h.next[step] };
}

/** The device's region ("US", "FR"), for the week start; null when the device doesn't say. */
export function deviceRegion(): string | null {
  try {
    return new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale).maximize().region ?? null;
  } catch {
    return null;
  }
}

/** The family's calendar settings (slot times, home time zone; spec 035), by family. */
export const calendarSettingsKey = (familyId: string) => ['family_calendar_settings', familyId] as const;

/** Spec 037: the family's events for some days. Starts with 'events', so spec 035's sync refetches it live. */
export const eventsKey = (familyId: string, from: string, to: string) => ['events', familyId, from, to] as const;
