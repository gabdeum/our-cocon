-- Spec 049: event reminders on the phone. The notifier (service role) finds the reminders due,
-- claims each one in reminder_deliveries so nobody gets it twice, and sends it.

-- FR-001: "15 minutes before" joins the event's reminder choices.
alter table public.events drop constraint events_reminder_check;
alter table public.events add constraint events_reminder_check
  check (reminder in ('none', 'minutes_15', 'hour_before', 'morning_of', 'day_before'));

-- FR-004: the phone says whether its clock is 24-hour, so a reminder's time follows a member's
-- "Automatic" time format. Same keys as spec 046, plus clock_24h.
create or replace function public._push_prefs_ok(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
    and not exists (
      select 1 from jsonb_each(p) e
      where not (
        (e.key in ('timers_live', 'timers_alert', 'reminders_on', 'clock_24h') and jsonb_typeof(e.value) = 'boolean')
        or (e.key = 'reminders_scope' and e.value in ('"mine"', '"all"'))
      )
    )
$$;

-- FR-005 / SC-003: one row per reminder sent to a member for one date of an event. The notifier
-- inserts it before sending; a row that's already there means it went out. Service role only.
create table public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  event_id uuid not null,
  occurrence_date date not null,
  kind text not null check (kind in ('minutes_15', 'hour_before', 'morning_of', 'day_before')),
  member_id uuid not null,
  sent_at timestamptz not null default now(),
  foreign key (event_id, family_id) references public.events (id, family_id) on delete cascade,
  foreign key (member_id, family_id) references public.members (id, family_id) on delete cascade,
  unique (event_id, occurrence_date, kind, member_id)
);
create index reminder_deliveries_sent_at on public.reminder_deliveries (sent_at);
alter table public.reminder_deliveries enable row level security;
revoke all on public.reminder_deliveries from anon, authenticated;

-- FR-005: every family's events that can remind on the days p_from–p_to, unmasked: the notifier
-- applies visibility itself through @cocon/calendar (private reminds only its owner, a surprise
-- never the hidden person). One-off events in range, and every repeating event that started by
-- p_to (`expand` places them). `events_visible` can't serve here: it is relative to auth.uid().
create function public.reminder_candidates(p_from date, p_to date) returns table (
  id uuid, family_id uuid, title text, location text,
  starts_on date, ends_on date, time_type text, slots text[], start_time text, end_time text,
  recurrence jsonb, reminder text, responsible_member_id uuid, visibility text, creator_member_id uuid,
  members jsonb, exceptions jsonb, hidden_from uuid[], created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select e.id, e.family_id, e.title, e.location, e.starts_on, e.ends_on, e.time_type, e.slots,
    e.start_time, e.end_time, e.recurrence, e.reminder, e.responsible_member_id, e.visibility, cm.id,
    coalesce((select jsonb_agg(case em.who when 'member' then to_jsonb(em.member_id) else to_jsonb(em.who) end order by em.created_at, em.id)
      from public.event_members em where em.event_id = e.id and em.who <> 'removed'), '[]'),
    coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'occurrence_date', x.occurrence_date, 'cancelled', x.cancelled, 'override', x.override)) order by x.occurrence_date)
      from public.event_exceptions x where x.event_id = e.id), '[]'),
    -- Null for a surprise without its cover row: the notifier then reminds only its creator.
    case when e.visibility = 'surprise' then s.hidden_from end,
    e.created_at
  from public.events e
  left join public.members cm on cm.user_id = e.created_by and cm.family_id = e.family_id
  left join public.event_surprise s on s.event_id = e.id
  where e.deleted_at is null
    and e.reminder <> 'none'
    and e.starts_on <= p_to
    and (e.ends_on >= p_from or e.recurrence is not null)
$$;
revoke all on function public.reminder_candidates(date, date) from public, anon, authenticated;
grant execute on function public.reminder_candidates(date, date) to service_role;

-- 032-later L118: the nightly purge (cocon-purge) keeps 90 days of sends, so the log doesn't grow
-- forever now that reminders go out daily. A reminder sent over 90 days ago can't be sent again:
-- it's far past the 2 hours a late one may be.
create function public.purge_notification_history() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  logged integer;
  delivered integer;
begin
  delete from public.notification_log where sent_at < now() - interval '90 days';
  get diagnostics logged = row_count;
  delete from public.reminder_deliveries where sent_at < now() - interval '90 days';
  get diagnostics delivered = row_count;
  return logged + delivered;
end;
$$;
revoke all on function public.purge_notification_history() from public, anon, authenticated;
grant execute on function public.purge_notification_history() to service_role;

-- "Events added by an AI assistant remind like any other": an assistant adding an event for a
-- member starts it on that member's default reminder, as Add event does. It reads only their own
-- settings row, like the app.
grant select on public.member_calendar_settings to cocon_assistant;
alter policy "members read their own calendar settings" on public.member_calendar_settings to authenticated, cocon_assistant;
