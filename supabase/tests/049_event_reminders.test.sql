-- Spec 049: reminders on the phone. "15 minutes before", the delivery log that stops duplicates,
-- and the notifier's view of every family's events.
begin;
select plan(19);

create function pg_temp.login(uid uuid, r text default 'authenticated') returns void language plpgsql as $$
begin
  reset role;
  if uid is null then
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', r, 'client_id', 'c1')::text, true);
    execute format('set local role %I', r);
  end if;
end;
$$;
grant execute on function pg_temp.login(uuid, text) to public;
-- pgTAP itself, for the assistant role (this test only: everything rolls back).
grant usage on schema extensions to cocon_assistant;
grant execute on all functions in schema extensions to cocon_assistant;
create temp table tokens (name text primary key, token text);
grant all on tokens to public;
create temp table ids (name text primary key, id uuid);
grant all on ids to public;
create function pg_temp.id(n text) returns uuid language sql as $$ select id from ids where name = n $$;
grant execute on function pg_temp.id(text) to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000049a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000049b', 'eva@example.com'),
  ('00000000-0000-0000-0000-00000000049f', 'sam@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000049a');
select public.create_family('The Demanges', 'Gabriel');
insert into tokens select 'eva', public.create_invite();
select pg_temp.login('00000000-0000-0000-0000-00000000049b');
select public.accept_invite((select token from tokens where name = 'eva'), 'Eva');
insert into public.member_calendar_settings (family_id, default_reminder) values (public.my_family_id(), 'day_before');
select pg_temp.login('00000000-0000-0000-0000-00000000049f');
select public.create_family('Sam''s', 'Sam');
reset role;
insert into ids select 'gabriel', id from public.members where user_id = '00000000-0000-0000-0000-00000000049a';
insert into ids select 'sam', id from public.members where user_id = '00000000-0000-0000-0000-00000000049f';

-- FR-001: the new choice saves.
select pg_temp.login('00000000-0000-0000-0000-00000000049a');
insert into ids select 'swim', public.save_event(
  '{"title":"Baby swim class","location":"Aquatic Center","starts_on":"2026-11-08","ends_on":"2026-11-08","time_type":"custom","start_time":"14:30","end_time":"15:15","reminder":"minutes_15"}',
  '["everyone"]');
select is((select reminder from public.events where id = pg_temp.id('swim')), 'minutes_15', '"15 minutes before" saves');
insert into ids select 'none', public.save_event('{"title":"Poker night","starts_on":"2026-11-08","ends_on":"2026-11-08","time_type":"all_day"}', '["everyone"]');
insert into ids select 'yoga', public.save_event(
  '{"title":"Yoga","starts_on":"2026-09-01","ends_on":"2026-09-01","time_type":"slot","slots":["morning"],"recurrence":{"freq":"weekly","weekdays":["TU"]},"reminder":"morning_of"}',
  jsonb_build_array(pg_temp.id('gabriel')));
select throws_ok($$ update public.events set reminder = 'week_before' where id = pg_temp.id('swim') $$, '23514', null, 'nothing else does');
select lives_ok($$ select public.set_push_prefs('no-such-device-0001', '{"clock_24h": true}') $$, 'clock_24h is a known switch');
select throws_ok($$ select public.register_push_device('gabriel-iphone-0049', 'ios', 'ExponentPushToken[abcdefgh04900]', '{"clock_24h": "yes"}', '1.0.0') $$,
  '23514', null, 'and only a boolean');

-- Service role only: members can't read, write or ask for every family's events.
select throws_ok($$ select count(*) from public.reminder_deliveries $$, '42501', null, 'a member can''t read the delivery log');
select throws_ok(format($$ insert into public.reminder_deliveries (family_id, event_id, occurrence_date, kind, member_id)
  values (public.my_family_id(), '%s', '2026-11-08', 'minutes_15', '%s') $$, pg_temp.id('swim'), pg_temp.id('gabriel')),
  '42501', null, 'nor write to it');
select throws_ok($$ select * from public.reminder_candidates('2026-11-07', '2026-11-09') $$, '42501', null, 'nor list the events that remind');
select pg_temp.login(null);
select throws_ok($$ select * from public.reminder_candidates('2026-11-07', '2026-11-09') $$, '42501', null, 'signed out neither');
reset role;
select ok(not has_function_privilege('authenticated', 'public.reminder_candidates(date, date)', 'execute'), 'authenticated has no execute');
select ok(has_function_privilege('service_role', 'public.reminder_candidates(date, date)', 'execute'), 'the service role has');

-- FR-005: one-off events in range and repeating ones, with a reminder, not deleted.
set local role service_role;
select is((select array_agg(title order by title) from public.reminder_candidates('2026-11-07', '2026-11-09')),
  array['Baby swim class', 'Yoga'], 'events with a reminder in range, and repeating ones');
select is((select members from public.reminder_candidates('2026-11-07', '2026-11-09') where title = 'Baby swim class'),
  '["everyone"]'::jsonb, 'with their members');

-- Assistants start events on their member's default reminder: they read that member's own row only.
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000049a');
insert into public.member_calendar_settings (family_id, default_reminder) values (public.my_family_id(), 'hour_before');
select pg_temp.login('00000000-0000-0000-0000-00000000049a', 'cocon_assistant');
select is((select array_agg(default_reminder) from public.member_calendar_settings), array['hour_before'], 'Gabriel''s assistant reads his default, not Eva''s');
select throws_ok($$ update public.member_calendar_settings set default_reminder = 'none' $$, '42501', null, 'and can''t change it');
select throws_ok($$ insert into public.member_calendar_settings (family_id) values (public.my_family_id()) $$, '42501', null, 'or add one');
select pg_temp.login('00000000-0000-0000-0000-00000000049f', 'cocon_assistant');
select is((select count(*)::int from public.member_calendar_settings), 0, 'another family''s assistant reads none');
select pg_temp.login('00000000-0000-0000-0000-00000000049b');
select is((select default_reminder from public.member_calendar_settings), 'day_before', 'Eva still reads hers');
reset role;

-- SC-003: the same reminder for the same date and member is claimed once.
insert into public.reminder_deliveries (family_id, event_id, occurrence_date, kind, member_id)
  select family_id, id, '2026-11-08', 'minutes_15', pg_temp.id('gabriel') from public.events where id = pg_temp.id('swim');
select throws_ok(format($$ insert into public.reminder_deliveries (family_id, event_id, occurrence_date, kind, member_id)
  select family_id, id, '2026-11-08', 'minutes_15', '%s' from public.events where id = '%s' $$, pg_temp.id('gabriel'), pg_temp.id('swim')),
  '23505', null, 'a second delivery of the same reminder is refused');
select throws_ok(format($$ insert into public.reminder_deliveries (family_id, event_id, occurrence_date, kind, member_id)
  select family_id, id, '2026-11-08', 'hour_before', '%s' from public.events where id = '%s' $$, pg_temp.id('sam'), pg_temp.id('swim')),
  '23503', null, 'and a member of another family can''t be on it');

select * from finish();
rollback;
