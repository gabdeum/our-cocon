-- Spec 046: phones registered for push, the send log and each member's default reminder.
begin;
select plan(41);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  reset role;
  if uid is null then
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    set local role authenticated;
  end if;
end;
$$;
grant execute on function pg_temp.login(uuid) to public;
create function pg_temp.affected(statement text) returns integer language plpgsql as $$
declare
  n integer;
begin
  execute statement;
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function pg_temp.affected(text) to public;
create temp table tokens (name text primary key, token text);
grant all on tokens to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000046a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000046b', 'eva@example.com'),
  ('00000000-0000-0000-0000-00000000046f', 'sam@example.com');

-- The Demanges: Gabriel (owner) and Eva. Sam has his own family.
select pg_temp.login('00000000-0000-0000-0000-00000000046a');
select public.create_family('The Demanges', 'Gabriel');
insert into tokens select 'eva', public.create_invite();
select pg_temp.login('00000000-0000-0000-0000-00000000046b');
select public.accept_invite((select token from tokens where name = 'eva'), 'Eva');
select pg_temp.login('00000000-0000-0000-0000-00000000046f');
select public.create_family('Sam''s', 'Sam');

-- FR-004: Gabriel registers his iPhone.
select pg_temp.login('00000000-0000-0000-0000-00000000046a');
select lives_ok($$ select public.register_push_device('gabriel-iphone-0001', 'ios', 'ExponentPushToken[abcdefgh12345]', '{"reminders_scope": "all"}', '1.0.0') $$,
  'Gabriel registers his iPhone');
select is((select (platform, expo_push_token, prefs ->> 'reminders_scope')::text from public.push_devices),
  '(ios,ExponentPushToken[abcdefgh12345],all)', 'and reads it back');
select is((select family_id from public.push_devices), public.my_family_id(), 'in his family');
select throws_ok($$ insert into public.push_devices (family_id, member_id, device_id, platform) select family_id, id, 'gabriel-ipad-00001', 'ios' from public.members where user_id = auth.uid() $$,
  '42501', null, 'rows are written only through the functions');
select throws_ok($$ update public.push_devices set disabled_at = now() $$, '42501', null, 'not updated directly');
select throws_ok($$ delete from public.push_devices $$, '42501', null, 'nor deleted directly');
select throws_ok($$ select public.register_push_device('gabriel-iphone-0001', 'ios', 'not a token', '{}', '1.0.0') $$,
  '23514', null, 'only an Expo push token');
select throws_ok($$ select public.register_push_device('gabriel-iphone-0001', 'ios', 'ExponentPushToken[abcdefgh12345]', '{"timers_live": "yes"}', '1.0.0') $$,
  '23514', null, 'only known switches of the right type');
select throws_ok($$ select public.register_push_device('gabriel-iphone-0001', 'web', 'ExponentPushToken[abcdefgh12345]', '{}', '1.0.0') $$,
  '23514', null, 'only iPhone or Android');
select lives_ok($$ select public.set_push_prefs('gabriel-iphone-0001', '{"reminders_on": false}') $$, 'a switch changed');
select is((select prefs from public.push_devices), '{"reminders_on": false}'::jsonb, 'is saved');

-- Only your own devices.
select pg_temp.login('00000000-0000-0000-0000-00000000046b');
select is((select count(*)::int from public.push_devices), 0, 'Eva doesn''t see Gabriel''s iPhone');
select lives_ok($$ select public.set_push_prefs('gabriel-iphone-0001', '{"reminders_on": true}') $$, 'her change to it');
select lives_ok($$ select public.unregister_push_device('gabriel-iphone-0001') $$, 'and her sign-out of it');
select pg_temp.login('00000000-0000-0000-0000-00000000046a');
select is((select prefs from public.push_devices), '{"reminders_on": false}'::jsonb, 'do nothing to it');
select pg_temp.login('00000000-0000-0000-0000-00000000046f');
select is((select count(*)::int from public.push_devices), 0, 'another family sees none');
select pg_temp.login(null);
select throws_ok($$ select count(*) from public.push_devices $$, '42501', null, 'signed out: no access');
select throws_ok($$ select public.register_push_device('signed-out-000001', 'ios', null, '{}', '1.0.0') $$, '42501', null, 'nor registering');

-- Security review: knowing a device id isn't enough to take it over.
select pg_temp.login('00000000-0000-0000-0000-00000000046f');
select throws_ok($$ select public.register_push_device('gabriel-iphone-0001', 'ios', 'ExponentPushToken[samsamsam1234]', '{}', '1.0.0') $$,
  '42501', null, 'Sam can''t take Gabriel''s device with his own token');
select pg_temp.login('00000000-0000-0000-0000-00000000046a');
select is((select count(*)::int from public.push_devices), 1, 'Gabriel still has it');
select throws_ok($$ select public.register_push_device('gabriel-iphone-0001', 'ios', null, '{}', '1.0.0') $$, '22004', null, 'a token is required');

-- Edge case: two members on one iPad (the same install, so the same token). It follows whoever signs in.
reset role;
update public.push_devices set disabled_at = now(), live_activity_start_token = 'la-token';
select pg_temp.login('00000000-0000-0000-0000-00000000046b');
select lives_ok($$ select public.register_push_device('gabriel-iphone-0001', 'ios', 'ExponentPushToken[abcdefgh12345]', '{}', '1.0.0') $$,
  'Eva signs in on the same device');
select is((select count(*)::int from public.push_devices), 1, 'it is hers now');
reset role;
select is((select (member_id = (select id from public.members where user_id = '00000000-0000-0000-0000-00000000046b'),
  disabled_at is null, live_activity_start_token is null)::text from public.push_devices), '(t,t,t)',
  'one row, enabled again, without Gabriel''s Live Activity token');
select pg_temp.login('00000000-0000-0000-0000-00000000046a');
select is((select count(*)::int from public.push_devices), 0, 'Gabriel no longer has it');

-- Security review: a reinstall makes a new device id but keeps the token. Only the new row stays.
select pg_temp.login('00000000-0000-0000-0000-00000000046f');
select lives_ok($$ select public.register_push_device('sam-reinstalled-01', 'ios', 'ExponentPushToken[abcdefgh12345]', '{}', '1.0.0') $$,
  'Sam signs in on the reinstalled phone');
reset role;
select is((select string_agg(device_id, ',') from public.push_devices where expo_push_token = 'ExponentPushToken[abcdefgh12345]'), 'sam-reinstalled-01',
  'one row for that token, Sam''s: Eva''s reminders don''t reach his phone');
select pg_temp.login('00000000-0000-0000-0000-00000000046b');
select lives_ok($$ select public.register_push_device('gabriel-iphone-0001', 'ios', 'ExponentPushToken[evaevaeva1234]', '{}', '1.0.0') $$,
  'Eva''s own phone again');

-- Sign-out removes the registration.
select pg_temp.login('00000000-0000-0000-0000-00000000046b');
select is(pg_temp.affected($$ select public.unregister_push_device('gabriel-iphone-0001') $$), 1, 'Eva signs out');
reset role;
select is((select count(*)::int from public.push_devices where device_id = 'gabriel-iphone-0001'), 0, 'and the row is gone');

-- FR-005: the send log is the server's alone.
insert into public.notification_log (kind, status) values ('test', 'sent');
select pg_temp.login('00000000-0000-0000-0000-00000000046a');
select throws_ok($$ select count(*) from public.notification_log $$, '42501', null, 'members can''t read the send log');

-- Nobody else may call the functions or read the tables: signed-out people, AI assistants.
reset role;
select ok(not has_function_privilege(r, f, 'execute'), format('%s can''t run %s', r, f))
from unnest(array['anon', 'cocon_assistant']) r,
  unnest(array['public.register_push_device(text,text,text,jsonb,text)', 'public.set_push_prefs(text,jsonb)', 'public.unregister_push_device(text)']) f;
select ok(not has_table_privilege(r, t, 'select'), format('%s can''t read %s', r, t))
from unnest(array['cocon_assistant']) r, unnest(array['public.push_devices', 'public.notification_log']) t;

-- FR-003: the default reminder for new events.
select lives_ok($$ insert into public.member_calendar_settings (family_id, default_reminder) values (public.my_family_id(), 'minutes_15') $$,
  'Gabriel picks 15 minutes before');
select throws_ok($$ update public.member_calendar_settings set default_reminder = 'week_before' $$, '23514', null, 'only the five choices');

select * from finish();
rollback;
