-- Spec 059: reminder notifications. The nudge log that stops duplicates (service role only), the
-- notifier's view of every family's open reminders, quiet hours, and the two reads the app uses.
begin;
select plan(25);

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
  ('00000000-0000-0000-0000-00000000059a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000059b', 'eva@example.com'),
  ('00000000-0000-0000-0000-00000000059f', 'sam@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000059a');
select public.create_family('The Demanges', 'Gabriel');
select public.set_home_time_zone('Europe/Paris');
insert into tokens select 'eva', public.create_invite();
with r as (
  insert into public.reminders (title, due_at, has_time, rollover) values ('Book the check-up', now() + interval '2 hours', true, 'hour') returning id)
insert into ids select 'call', id from r;
with r as (
  insert into public.reminders (title, due_at, has_time, rollover, deleted_at) values ('Old one', now() + interval '2 hours', true, 'hour', now()) returning id)
insert into ids select 'gone', id from r;
select pg_temp.login('00000000-0000-0000-0000-00000000059b');
select public.accept_invite((select token from tokens where name = 'eva'), 'Eva');
insert into public.member_calendar_settings (family_id, quiet_from, quiet_to, time_format) values (public.my_family_id(), '23:30', '06:15', '12h');
select pg_temp.login('00000000-0000-0000-0000-00000000059f');
select public.create_family('Sam''s', 'Sam');
select public.set_home_time_zone('Europe/Paris');
with r as (
  insert into public.reminders (title, due_at, has_time, rollover) values ('Sam''s', now() + interval '1 hour', true, 'hour') returning id)
insert into ids select 'sams', id from r;
select public.add_managed_member('Mia');
reset role;
insert into ids select 'gabriel', id from public.members where user_id = '00000000-0000-0000-0000-00000000059a';
insert into ids select 'eva', id from public.members where user_id = '00000000-0000-0000-0000-00000000059b';
insert into ids select 'sam', id from public.members where user_id = '00000000-0000-0000-0000-00000000059f';

-- FR-007: the "Reminders" switch saves, as a boolean only.
select pg_temp.login('00000000-0000-0000-0000-00000000059a');
select lives_ok($$ select public.set_push_prefs('no-such-device-0059', '{"todo_on": false}') $$, 'todo_on is a known switch');
select throws_ok($$ select public.register_push_device('gabriel-iphone-0059', 'ios', 'ExponentPushToken[abcdefgh05900]', '{"todo_on": "no"}', '1.0.0') $$,
  '23514', null, 'and only a boolean');

-- FR-002: quiet hours, 22:00–07:00 by default, "HH:MM" only.
insert into public.member_calendar_settings (family_id) values (public.my_family_id());
select is((select quiet_from || '–' || quiet_to from public.member_calendar_settings), '22:00–07:00', 'quiet hours default to 22:00–07:00');
select lives_ok($$ update public.member_calendar_settings set quiet_from = '21:30', quiet_to = '06:45' $$, 'a member changes theirs');
select throws_ok($$ update public.member_calendar_settings set quiet_from = '24:00' $$, '23514', null, 'not to a time that doesn''t exist');
select throws_ok($$ update public.member_calendar_settings set quiet_to = '7:00' $$, '23514', null, 'and always as HH:MM');

-- L149: everyone's quiet hours in my family, and only mine.
select is((select array_agg(quiet_from || '–' || quiet_to || ' ' || time_format order by quiet_from) from public.family_quiet_hours()),
  array['21:30–06:45 automatic', '23:30–06:15 12h'], 'family_quiet_hours: Gabriel''s and Eva''s');
select pg_temp.login('00000000-0000-0000-0000-00000000059f');
select is((select array_agg(quiet_from || '–' || quiet_to) from public.family_quiet_hours()), array['22:00–07:00'],
  'another family sees only theirs (defaults without a settings row, Mia without the app left out)');
select pg_temp.login(null);
select throws_ok($$ select * from public.family_quiet_hours() $$, '42501', null, 'signed out can''t ask');

-- L148: one reminder, placed, for my family only.
select pg_temp.login('00000000-0000-0000-0000-00000000059a');
select is((select reminder_placed(pg_temp.id('call')) ->> 'title'), 'Book the check-up', 'reminder_placed gives one of mine, placed');
select ok((select reminder_placed(pg_temp.id('call')) ? 'late_from'), 'with its state');
select is(public.reminder_placed(pg_temp.id('sams')), null, 'and nothing for another family''s');
select pg_temp.login(null);
select throws_ok(format($$ select public.reminder_placed('%s') $$, pg_temp.id('call')), '42501', null, 'signed out can''t ask for one');

-- Assistants (MCP) get none of it: the nudge log, quiet hours or a placed reminder.
select pg_temp.login('00000000-0000-0000-0000-00000000059a', 'cocon_assistant');
select throws_ok($$ select count(*) from public.reminder_nudges $$, '42501', null, 'an assistant can''t read the nudge log');
select throws_ok($$ select * from public.family_quiet_hours() $$, '42501', null, 'nor anyone''s quiet hours');
select throws_ok(format($$ select public.reminder_placed('%s') $$, pg_temp.id('call')), '42501', null, 'nor ask for a placed reminder');
select pg_temp.login('00000000-0000-0000-0000-00000000059a');

-- Service role only: members can't read or write the nudge log, nor list every family's reminders.
select throws_ok($$ select count(*) from public.reminder_nudges $$, '42501', null, 'a member can''t read the nudge log');
select throws_ok(format($$ insert into public.reminder_nudges (family_id, reminder_id, late_from, kind, slot_at, member_id)
  values (public.my_family_id(), '%s', now(), 'due', now(), '%s') $$, pg_temp.id('call'), pg_temp.id('gabriel')),
  '42501', null, 'nor write to it');
select throws_ok($$ select * from public.todo_candidates(now()) $$, '42501', null, 'nor list the reminders that notify');
select throws_ok($$ select * from public.todo_catch_up_families(now()) $$, '42501', null, 'nor the families to catch up');
reset role;
select ok(not has_function_privilege('authenticated', 'public.todo_candidates(timestamptz)', 'execute')
  and has_function_privilege('service_role', 'public.todo_candidates(timestamptz)', 'execute'), 'only the service role lists them');

-- FR-006: open reminders of every family with a home time zone, not deleted.
set local role service_role;
select is((select array_agg(reminder ->> 'title' order by reminder ->> 'title') from public.todo_candidates(now())
    where family_id in (select family_id from public.members where id in (pg_temp.id('gabriel'), pg_temp.id('sam')))),
  array['Book the check-up', 'Sam''s'], 'open reminders of each family, deleted ones left out');
select is((select distinct time_zone from public.todo_candidates(now()) where reminder ->> 'id' = pg_temp.id('call')::text), 'Europe/Paris', 'with the home time zone');
reset role;

-- SC-002: the same send to the same member is claimed once.
insert into public.reminder_nudges (family_id, reminder_id, late_from, kind, slot_at, member_id)
  select family_id, id, due_at, 'due', due_at, pg_temp.id('gabriel') from public.reminders where id = pg_temp.id('call');
select throws_ok(format($$ insert into public.reminder_nudges (family_id, reminder_id, late_from, kind, slot_at, member_id)
  select family_id, id, due_at, 'due', due_at, '%s' from public.reminders where id = '%s' $$, pg_temp.id('gabriel'), pg_temp.id('call')),
  '23505', null, 'a second send of the same slot is refused');
select throws_ok(format($$ insert into public.reminder_nudges (family_id, reminder_id, late_from, kind, slot_at, member_id)
  select family_id, id, due_at, 'nudge', due_at, '%s' from public.reminders where id = '%s' $$, pg_temp.id('sam'), pg_temp.id('call')),
  '23503', null, 'and a member of another family can''t be on it');

select * from finish();
rollback;
