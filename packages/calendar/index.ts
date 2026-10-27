// Calendar rules (spec 034): slots, recurrence, overlaps, conflicts, labels and visibility.
// Used by the app and the MCP server, so both give the same answer. No React.
export { CalendarError, type CalendarErrorCode } from './errors';
export { addDays, daysBetween, daysInMonth, makeDate, parts, todayIn, weekRange, weekStartFor, weekday, type WeekStartsOn } from './dates';
export { DEFAULT_SLOT_TIMES, fromMinutes, slotStartingAt, slotsToRange, sortSlots, timeRange, toMinutes } from './slots';
export { WIDE_TITLE_MIN_WIDTH, dayTitle, formatTime, monthTitle, rangeLabel, timeLabel, uses24h, weekTitle, type LabelOptions } from './labels';
export { assertValidEvent, expand } from './recurrence';
export { layoutDay, type LaneSlot, type LayoutItem } from './layout';
export { findConflict, type ConflictDraft } from './conflicts';
export { viewFor, type FullView, type HiddenView, type Viewed } from './visibility';
export type { CalendarEvent, EventException, EventOverride, Occurrence, SlotTimes, SurpriseCover } from './types';
export { en as calendarWordsEn, type CalendarWords } from './words.en';
