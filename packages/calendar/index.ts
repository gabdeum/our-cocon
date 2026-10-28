// Calendar rules (spec 034): slots, recurrence, overlaps, conflicts, labels and visibility;
// spec 036 adds the header's paging and member filter.
// Used by the app and the MCP server, so both give the same answer. No React.
export { CalendarError, type CalendarErrorCode } from './errors';
export { addDays, daysBetween, daysInMonth, makeDate, parts, timeIn, todayIn, weekRange, weekStartFor, weekday, type WeekStartsOn } from './dates';
export { DEFAULT_SLOT_TIMES, fromMinutes, slotAt, slotStartingAt, slotsToRange, sortSlots, timeRange, toMinutes } from './slots';
export { WIDE_TITLE_MIN_WIDTH, dateLabel, dayTitle, formatTime, monthTitle, rangeLabel, timeLabel, uses24h, weekTitle, whenWord, type LabelOptions } from './labels';
export { assertValidEvent, expand, splitSeries } from './recurrence';
export { layoutDay, layoutSpans, type LaneSlot, type LayoutItem, type SpanItem } from './layout';
export { conflictWho, findConflict, type ConflictDraft, type ConflictWho } from './conflicts';
export { VIEW_STEP, shiftAnchor } from './navigate';
export { shownByFilter } from './filter';
export { viewFor, type FullView, type HiddenView, type Viewed } from './visibility';
export type { CalendarEvent, EventException, EventOverride, Occurrence, SlotTimes, SurpriseCover } from './types';
export { en as calendarWordsEn, type CalendarWords } from './words.en';
