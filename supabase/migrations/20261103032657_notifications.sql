-- Spec 046: notifications foundation. Each phone registered for push (one row per installed app,
-- following whoever is signed in on it), the server's send log, and each member's default reminder.

-- FR-003: the per-device switches. Only these keys, each of its own type; missing keys are defaults.
create function public._push_prefs_ok(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
    and not exists (
      select 1 from jsonb_each(p) e
      where not (
        (e.key in ('timers_live', 'timers_alert', 'reminders_on') and jsonb_typeof(e.value) = 'boolean')
        or (e.key = 'reminders_scope' and e.value in ('"mine"', '"all"'))
      )
    )
$$;

-- FR-004: device_id is a random id the app makes once per install, so a shared iPad is one row that
-- moves to whoever signs in. Rows are written only through the functions below.
create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  device_id text not null unique check (device_id ~ '^[A-Za-z0-9-]{16,64}$'),
  platform text not null check (platform in ('ios', 'android')),
  expo_push_token text check (expo_push_token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,128}\]$'),
  live_activity_start_token text check (char_length(live_activity_start_token) <= 512),
  prefs jsonb not null default '{}' check (public._push_prefs_ok(prefs)),
  app_version text check (char_length(app_version) <= 32),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_devices_member_id on public.push_devices (member_id);
-- One row per phone: a reinstall makes a new device_id but often keeps the token (security review).
create unique index push_devices_token on public.push_devices (expo_push_token) where expo_push_token is not null;
alter table public.push_devices enable row level security;
revoke all on public.push_devices from anon, authenticated;
grant select on public.push_devices to authenticated;
create policy "members read their own devices" on public.push_devices
  for select to authenticated using (member_id in (select m.id from public.members m where m.user_id = auth.uid()));

-- Registers this phone for the signed-in member (after permission, and on every app start), taking
-- it over from whoever used it before. Clears disabled_at: a fresh token works again. Another
-- member's row moves only when the token is the same (the same install, a shared iPad): knowing a
-- device_id alone isn't enough (42501, and the app makes a new id). Any older row with this token
-- goes, so a reinstalled phone never gets the previous person's notifications.
create function public.register_push_device(
  p_device_id text, p_platform text, p_token text, p_prefs jsonb, p_app_version text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public._my_member_id();
begin
  if me is null then
    raise exception 'not a family member' using errcode = '42501';
  end if;
  if p_token is null then
    raise exception 'a push token is required' using errcode = '22004';
  end if;
  if exists (select 1 from public.push_devices where device_id = p_device_id and member_id <> me and expo_push_token is distinct from p_token) then
    raise exception 'this device is registered to someone else' using errcode = '42501';
  end if;
  delete from public.push_devices where expo_push_token = p_token and device_id <> p_device_id;
  insert into public.push_devices as d (family_id, member_id, device_id, platform, expo_push_token, prefs, app_version)
  values (public.my_family_id(), me, p_device_id, p_platform, p_token, coalesce(p_prefs, '{}'), p_app_version)
  on conflict (device_id) do update set
    family_id = excluded.family_id,
    member_id = excluded.member_id,
    platform = excluded.platform,
    expo_push_token = excluded.expo_push_token,
    -- A Live Activity token belongs to the person it was made for.
    live_activity_start_token = case when d.member_id = excluded.member_id then d.live_activity_start_token end,
    prefs = excluded.prefs,
    app_version = excluded.app_version,
    last_seen_at = now(),
    disabled_at = null,
    updated_at = now();
end;
$$;

-- FR-003: a switch changed on this phone.
create function public.set_push_prefs(p_device_id text, p_prefs jsonb) returns void
language sql security definer set search_path = '' as $$
  update public.push_devices set prefs = p_prefs, updated_at = now()
  where device_id = p_device_id and member_id = public._my_member_id();
$$;

-- Edge case: signing out removes this phone's registration, so reminders stop.
create function public.unregister_push_device(p_device_id text) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_devices where device_id = p_device_id and member_id = public._my_member_id();
$$;

grant execute on function public.register_push_device(text, text, text, jsonb, text),
  public.set_push_prefs(text, jsonb), public.unregister_push_device(text) to authenticated;

-- FR-005: every push the server sends, for receipts and support. Service role only.
create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families (id) on delete cascade,
  kind text not null check (kind in ('timer_done', 'reminder', 'test')),
  member_id uuid references public.members (id) on delete set null,
  device_id uuid references public.push_devices (id) on delete set null,
  ref text,
  sent_at timestamptz not null default now(),
  status text not null check (status in ('sent', 'error', 'delivered', 'failed')),
  ticket_id text,
  error text,
  receipt_checked_at timestamptz
);
create index notification_log_receipts on public.notification_log (sent_at) where status = 'sent' and receipt_checked_at is null;
alter table public.notification_log enable row level security;
revoke all on public.notification_log from anon, authenticated;

-- FR-003: the reminder Add event starts with (spec 049), following the member on every phone.
alter table public.member_calendar_settings add column default_reminder text not null default 'none'
  check (default_reminder in ('none', 'minutes_15', 'hour_before', 'morning_of', 'day_before'));
