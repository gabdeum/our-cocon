-- Spec 071: keeping times on the time zone you travel to, for yourself or the whole family. Your
-- settings stay yours; timed reminders keep their clock time; when everyone has moved, the family has.
begin;
select plan(35);

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
create temp table ids (name text primary key, id uuid);
create temp table tokens (name text primary key, token text);
grant all on ids, tokens to public;
create function pg_temp.id(n text) returns uuid language sql as $$ select id from ids where name = n $$;
grant execute on function pg_temp.id(text) to public;
-- A reminder's due time as a clock time in a zone.
create function pg_temp.at(n text, tz text) returns text language sql security definer as $$
  select to_char(due_at at time zone tz, 'YYYY-MM-DD HH24:MI') from public.reminders where id = pg_temp.id(n)
$$;
grant execute on function pg_temp.at(text, text) to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000071a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000071b', 'eva@example.com'),
  ('00000000-0000-0000-0000-00000000071f', 'sam@example.com');

select pg_temp.login('00000000-0000-0000-0000-00000000071a');
select public.create_family('The Demanges', 'Gabriel');
select public.set_home_time_zone('Europe/Paris');
insert into tokens select 'eva', public.create_invite();
select pg_temp.login('00000000-0000-0000-0000-00000000071b');
select public.accept_invite((select token from tokens where name = 'eva'), 'Eva');
select pg_temp.login('00000000-0000-0000-0000-00000000071f');
select public.create_family('Sam''s', 'Sam');
select public.set_home_time_zone('Europe/London');
reset role;
insert into ids select 'gabriel', id from public.members where user_id = '00000000-0000-0000-0000-00000000071a';
insert into ids select 'eva', id from public.members where user_id = '00000000-0000-0000-0000-00000000071b';
insert into ids select 'demanges', family_id from public.members where user_id = '00000000-0000-0000-0000-00000000071a';

select pg_temp.login('00000000-0000-0000-0000-00000000071a');
with r as (
  insert into public.reminders (title, due_at, has_time, rollover, assignee_id) values
    ('Call the bank', '2026-12-10 16:00 Europe/Paris', true, 'day', pg_temp.id('gabriel')),
    ('Pack', '2026-12-11 00:00 Europe/Paris', false, 'day', pg_temp.id('gabriel')),
    ('Bins', '2026-12-10 19:00 Europe/Paris', true, 'day', null),
    ('Eva''s call', '2026-12-10 09:00 Europe/Paris', true, 'day', pg_temp.id('eva'))
  returning title, id
)
insert into ids select title, id from r;

-- FR-003: only Gabriel keeps his times in New York.
select is(public.set_away_time_zone('America/New_York', 'America/New_York'), 1, 'one reminder moves: Gabriel''s own, with a time');
select is(pg_temp.at('Call the bank', 'America/New_York'), '2026-12-10 16:00', 'his 16:00 stays 16:00, New York time');
select is(pg_temp.at('Pack', 'Europe/Paris'), '2026-12-11 00:00', 'a reminder without a time keeps its day');
select is(pg_temp.at('Bins', 'Europe/Paris'), '2026-12-10 19:00', 'Everyone''s reminders stay on the family''s time');
select is(pg_temp.at('Eva''s call', 'Europe/Paris'), '2026-12-10 09:00', 'other people''s reminders stay on the family''s time');
select is(public._reminder_time_zone(public.my_family_id(), null), 'America/New_York', 'his reminders read in New York');
select is((select away_time_zone from public.member_calendar_settings), 'America/New_York', 'his own time zone is saved');

-- Eva doesn't see his settings, and her reminders still read in Paris.
select pg_temp.login('00000000-0000-0000-0000-00000000071b');
select is((select count(*)::int from public.member_calendar_settings where away_time_zone is not null), 0, 'a member never sees another''s settings');
select is(public._reminder_time_zone(public.my_family_id(), null), 'Europe/Paris', 'the family stays on its time');

-- Another family gets nothing and moves nothing.
select pg_temp.login('00000000-0000-0000-0000-00000000071f');
select is(public._my_away_time_zone(pg_temp.id('demanges')), null, 'another family never reads his time zone');
select is(public._reminder_time_zone(pg_temp.id('demanges'), 'Europe/London'), 'Europe/London', 'nor the family''s');
select is(public.set_away_time_zone('Asia/Tokyo', 'Asia/Tokyo'), 0, 'Sam keeping his times moves none of the Demanges'' reminders');
select is(public.set_away_time_zone('Asia/Tokyo', 'Asia/Tokyo', 'family'), 0, 'nor does his family moving');
select pg_temp.login('00000000-0000-0000-0000-00000000071a');
select is(pg_temp.at('Call the bank', 'America/New_York'), '2026-12-10 16:00', 'his reminder is where he left it');

-- FR-009: Eva keeps her times in New York too: everyone with the app is there, so the family moved.
select pg_temp.login('00000000-0000-0000-0000-00000000071b');
select is(public.set_away_time_zone('America/New_York', 'America/New_York'), 2, 'Eva''s and Everyone''s reminders move; his were there already');
select is((select home_time_zone from public.family_calendar_settings), 'America/New_York', 'the family''s time zone is New York');
select is((select count(*)::int from public.member_calendar_settings where away_time_zone is not null), 0, 'and nobody keeps their own any more');
select is(array[pg_temp.at('Call the bank', 'America/New_York'), pg_temp.at('Bins', 'America/New_York'), pg_temp.at('Eva''s call', 'America/New_York')],
  array['2026-12-10 16:00', '2026-12-10 19:00', '2026-12-10 09:00'], 'everyone''s keep their clock time, in New York');
select is(pg_temp.at('Pack', 'Europe/Paris'), '2026-12-11 00:00', 'a day stays a day');

-- FR-007: Gabriel moves everyone to Tokyo, then back to Paris.
select pg_temp.login('00000000-0000-0000-0000-00000000071a');
select is(public.set_away_time_zone('Asia/Tokyo', 'Asia/Tokyo', 'family'), 3, 'everyone''s reminders with a time move');
select is(array[pg_temp.at('Call the bank', 'Asia/Tokyo'), pg_temp.at('Bins', 'Asia/Tokyo'), pg_temp.at('Eva''s call', 'Asia/Tokyo')],
  array['2026-12-10 16:00', '2026-12-10 19:00', '2026-12-10 09:00'], 'in Tokyo');
select pg_temp.login('00000000-0000-0000-0000-00000000071b');
select is(public._reminder_time_zone(public.my_family_id(), null), 'Asia/Tokyo', 'Eva''s reminders read in Tokyo without being asked');
select pg_temp.login('00000000-0000-0000-0000-00000000071a');
select is(public.set_away_time_zone('Europe/Paris', 'Europe/Paris', 'family'), 3, 'and back to Paris');
select is(pg_temp.at('Bins', 'Europe/Paris'), '2026-12-10 19:00', 'on Paris time again');

-- FR-005: keeping his own times, then back on the family's clock.
select is(public.set_away_time_zone('America/New_York', 'America/New_York'), 1, 'his own reminder moves');
select is(public.set_away_time_zone(null, null), 1, 'back on the family''s time: it moves back');
select is(pg_temp.at('Call the bank', 'Europe/Paris'), '2026-12-10 16:00', 'his 16:00 is 16:00 Paris time again');

-- Nothing in Activity to undo, and no shortcut around the reminders.
select is((select count(*)::int from public.activity where payload ->> 'kind' = 'reminder_edited'), 0, 'moving times logs no edits');
update public.member_calendar_settings set away_time_zone = 'Asia/Tokyo';
select is((select away_time_zone from public.member_calendar_settings), null, 'a plain write can''t set my time zone');
select pg_temp.login('00000000-0000-0000-0000-00000000071a');
select throws_ok($$ update public.family_calendar_settings set home_time_zone = 'Asia/Tokyo' $$, '42501', null, 'nor the family''s, even for the owner');
select lives_ok($$ select public.set_home_time_zone('Europe/Paris') $$, 'the owner''s own RPC still works');

-- Refused: an unknown zone, a made-up scope, the family moving nowhere, nobody signed in.
select throws_ok($$ select public.set_away_time_zone('Mars/Olympus', null) $$, '22023', 'unknown_time_zone', 'an unknown zone is refused');
select throws_ok($$ select public.set_away_time_zone(null, null, 'everyone') $$, '22023', 'bad_scope', 'only me or family');
select throws_ok($$ select public.set_away_time_zone(null, null, 'family') $$, '22023', 'no_time_zone', 'the family always has a time zone');
select pg_temp.login(null);
reset role;
select ok(not has_function_privilege('anon', 'public.set_away_time_zone(text, text, text)', 'execute') and not has_function_privilege('cocon_assistant', 'public.set_away_time_zone(text, text, text)', 'execute'), 'anon and assistants can''t call it');

select * from finish();
rollback;
