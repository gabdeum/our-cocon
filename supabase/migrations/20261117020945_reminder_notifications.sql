-- Spec 059: reminders (things to do, spec 056) on the phone. The notifier (service role) reads
-- every family's open reminders as they stand, works out who gets what (`@cocon/reminders`), claims
-- each send in reminder_nudges so nobody gets it twice, and sends it. Each person has quiet hours.

-- FR-007: the per-phone "Reminders" switch joins the others (spec 046 FR-003, 049 FR-004).
create or replace function public._push_prefs_ok(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
    and not exists (
      select 1 from jsonb_each(p) e
      where not (
        (e.key in ('timers_live', 'timers_alert', 'reminders_on', 'todo_on', 'clock_24h') and jsonb_typeof(e.value) = 'boolean')
        or (e.key = 'reminders_scope' and e.value in ('"mine"', '"all"'))
      )
    )
$$;

-- FR-002: quiet hours, per person (the notifier holds and drops nudges per recipient). "HH:MM" in
-- the family's home time zone; the same two times mean none.
alter table public.member_calendar_settings
  add column quiet_from text not null default '22:00' check (quiet_from ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add column quiet_to text not null default '07:00' check (quiet_to ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- The send log knows this kind too.
alter table public.notification_log drop constraint notification_log_kind_check;
alter table public.notification_log add constraint notification_log_kind_check check (kind in ('timer_done', 'reminder', 'todo', 'test'));

-- FR-006 / SC-002: one row per notification sent to a member for one reminder's open occurrence
-- (`late_from`), kind and moment. The notifier inserts it before sending; a row that's already there
-- means it went out. A snooze or a Done moves `late_from`, so the next occurrence starts afresh.
-- Service role only, as reminder_deliveries (spec 049).
create table public.reminder_nudges (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  reminder_id uuid not null,
  late_from timestamptz not null,
  kind text not null check (kind in ('before', 'due', 'nudge')),
  slot_at timestamptz not null,
  member_id uuid not null,
  sent_at timestamptz not null default now(),
  foreign key (reminder_id, family_id) references public.reminders (id, family_id) on delete cascade,
  foreign key (member_id, family_id) references public.members (id, family_id) on delete cascade,
  unique (reminder_id, late_from, kind, slot_at, member_id)
);
create index reminder_nudges_sent_at on public.reminder_nudges (sent_at);
alter table public.reminder_nudges enable row level security;
revoke all on public.reminder_nudges from anon, authenticated;

-- FR-006: every family's open reminders as they stand at p_now, placed in the family's home time
-- zone (families without one get nothing, as event reminders). Unmasked: no private reminders yet.
create function public.todo_candidates(p_now timestamptz) returns table (family_id uuid, time_zone text, reminder jsonb)
language sql stable security definer set search_path = '' as $$
  select f.family_id, f.home_time_zone, to_jsonb(s)
  from public.family_calendar_settings f
  cross join lateral public._reminder_state(f.family_id, f.home_time_zone, p_now) s
  where f.home_time_zone is not null
    and exists (select 1 from public.reminders r where r.family_id = f.family_id and r.deleted_at is null and r.completed_at is null)
$$;
revoke all on function public.todo_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.todo_candidates(timestamptz) to service_role;

-- 032-later L146: the families with repeating reminders whose next date has come, and their home
-- time zone, for the notifier's catch-up (FR-005 of spec 056).
create function public.todo_catch_up_families(p_now timestamptz) returns table (family_id uuid, time_zone text)
language sql stable security definer set search_path = '' as $$
  select f.family_id, f.home_time_zone
  from public.family_calendar_settings f
  where f.home_time_zone is not null
    and exists (select 1 from public.reminders r where r.family_id = f.family_id and r.deleted_at is null
      and r.completed_at is null and r.next_due_at <= p_now)
$$;
revoke all on function public.todo_catch_up_families(timestamptz) from public, anon, authenticated;
grant execute on function public.todo_catch_up_families(timestamptz) to service_role;

-- 032-later L149: everyone's quiet hours and time format in my family, for the sheet's "Notifies
-- {name} at …" line. Settings rows are each member's own, so this reads only these columns.
-- Account members without a settings row get the defaults.
create function public.family_quiet_hours() returns table (member_id uuid, quiet_from text, quiet_to text, time_format text)
language sql stable security definer set search_path = '' as $$
  select m.id, coalesce(s.quiet_from, '22:00'), coalesce(s.quiet_to, '07:00'), coalesce(s.time_format, 'automatic')
  from public.members m
  left join public.member_calendar_settings s on s.user_id = m.user_id and s.family_id = m.family_id
  where m.family_id = public.my_family_id() and m.user_id is not null
$$;
revoke all on function public.family_quiet_hours() from public, anon;
grant execute on function public.family_quiet_hours() to authenticated;

-- 032-later L148: one open reminder, placed, for `/reminders?open={id}` when it isn't on the loaded
-- pages (a notification links there). Security invoker: only my family's.
create function public.reminder_placed(p_id uuid, p_tz text default null) returns jsonb
language sql stable set search_path = '' as $$
  select to_jsonb(s) from public._reminder_state(public.my_family_id(), p_tz, now()) s where s.id = p_id
$$;
revoke all on function public.reminder_placed(uuid, text) from public, anon;
grant execute on function public.reminder_placed(uuid, text) to authenticated;

-- The nightly purge keeps 90 days of these too.
create or replace function public.purge_notification_history() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  logged integer;
  delivered integer;
  nudged integer;
begin
  delete from public.notification_log where sent_at < now() - interval '90 days';
  get diagnostics logged = row_count;
  delete from public.reminder_deliveries where sent_at < now() - interval '90 days';
  get diagnostics delivered = row_count;
  delete from public.reminder_nudges where sent_at < now() - interval '90 days';
  get diagnostics nudged = row_count;
  return logged + delivered + nudged;
end;
$$;
