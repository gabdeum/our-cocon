-- Spec 073: event and reminder notes can be 5000 characters (NOTES_MAX in packages/schemas/calendar.ts),
-- room for formatted notes and the checklists spec 075 moves into them. A one-date change may carry
-- a note too: the same 5000 characters, and its override grows to fit (4-byte text plus the other fields).
alter table public.events drop constraint events_notes_check;
alter table public.events add constraint events_notes_check check (char_length(notes) between 1 and 5000);

alter table public.reminders drop constraint reminders_notes_check;
alter table public.reminders add constraint reminders_notes_check check (char_length(notes) between 1 and 5000);

alter table public.event_exceptions drop constraint event_exceptions_override_check;
alter table public.event_exceptions add constraint event_exceptions_override_check
  check (public._override_keys_ok(override) and pg_column_size(override) <= 24576
    and coalesce(char_length(override ->> 'notes'), 0) <= 5000);
