import type { EventMember, EventOverride, Recurrence, SlotKey, TimeType, Visibility } from '@cocon/schemas/calendar';

/** A slot's hours, "HH:MM" in the home time zone (family_calendar_settings, spec 035). */
export type SlotTimes = Record<SlotKey, { start: string; end: string }>;

/**
 * An event as spec 035 stores it, with its members, creator and surprise fields joined in.
 * Dates and times are wall-clock values in the family's home time zone (FR-008).
 */
export type { EventOverride };

export interface CalendarEvent {
  id: string;
  title: string;
  category?: string | null;
  location?: string | null;
  notes?: string | null;
  starts_on: string;
  ends_on: string;
  time_type: TimeType;
  slots: SlotKey[];
  start_time?: string | null;
  end_time?: string | null;
  recurrence?: Recurrence | null;
  members: EventMember[];
  responsible_member_id?: string | null;
  visibility: Visibility;
  /** The member who created it: only they see a private event's details. */
  creator_member_id: string;
  surprise?: SurpriseCover | null;
}

export interface SurpriseCover {
  hidden_from: string[];
  cover_title: string;
  cover_note?: string | null;
}

/** One "this event only" change: the occurrence is cancelled, or some fields are replaced. */
export interface EventException {
  occurrence_date: string;
  cancelled?: boolean;
  override?: EventOverride | null;
}

/** One time an event happens. `occurrence_date` is the series date (the exception key). */
export interface Occurrence extends CalendarEvent {
  occurrence_date: string;
  is_exception: boolean;
}
