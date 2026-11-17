-- Spec 056: reminders. Family-only rows (SC-003), and what the database works out from the time
-- now: late, sections, Home and their order (FR-006, FR-008, FR-012), across a clock change; the
-- pages; the safe Done and its Undo (FR-004); the purge.
begin;
select plan(73);

create function pg_temp.login(uid uuid, r text default 'authenticated') returns void language plpgsql as $$
begin
  reset role;
  if uid is null then
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', r)::text, true);
    execute format('set local role %I', r);
  end if;
end;
$$;
grant execute on function pg_temp.login(uuid, text) to public;
create temp table tokens (name text primary key, token text);
grant all on tokens to public;
create temp table ids (name text primary key, id uuid);
grant all on ids to public;
create function pg_temp.id(n text) returns uuid language sql as $$ select id from ids where name = n $$;
grant execute on function pg_temp.id(text) to public;
create function pg_temp.name(i uuid) returns text language sql as $$ select name from ids where id = i $$;
grant execute on function pg_temp.name(uuid) to public;
-- A reminder, added by whoever is signed in.
create function pg_temp.add(n text, due timestamptz, has_time boolean, rollover text, snoozed timestamptz default null, assignee uuid default null)
returns void language sql as $$
  with r as (
    insert into public.reminders (title, due_at, has_time, rollover, snoozed_until, assignee_id)
    values (initcap(replace(n, '_', ' ')), due, has_time, rollover, snoozed, assignee) returning id
  )
  insert into ids select n, id from r;
$$;
grant execute on function pg_temp.add(text, timestamptz, boolean, text, timestamptz, uuid) to public;
-- The caller's reminders in a section at a given time, by name, in order ('snoozed': every snoozed one).
create function pg_temp.section(s text, at timestamptz) returns text[] language sql as $$
  select array_agg(pg_temp.name(r.id) order by r.sort_at, r.id)
  from public._reminder_state(public.my_family_id(), null, at) r where (case when s = 'snoozed' then r.snoozed else r.section = s end);
$$;
grant execute on function pg_temp.section(text, timestamptz) to public;
create function pg_temp.state(n text, at timestamptz) returns jsonb language sql as $$
  select to_jsonb(r) - 'repeat_rule' from public._reminder_state(public.my_family_id(), null, at) r where r.id = pg_temp.id(n);
$$;
grant execute on function pg_temp.state(text, timestamptz) to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000056a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000056b', 'eva@example.com'),
  ('00000000-0000-0000-0000-00000000056f', 'sam@example.com'),
  ('00000000-0000-0000-0000-00000000056c', 'lou@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000056a');
select public.create_family('The Demanges', 'Gabriel');
select public.set_home_time_zone('Europe/Paris');
insert into tokens select 'eva', public.create_invite();
select pg_temp.login('00000000-0000-0000-0000-00000000056b');
select public.accept_invite((select token from tokens where name = 'eva'), 'Eva');
select pg_temp.login('00000000-0000-0000-0000-00000000056f');
select public.create_family('Sam''s', 'Sam');
select pg_temp.login('00000000-0000-0000-0000-00000000056c');
select public.create_family('Lou''s', 'Lou');
reset role;
insert into ids select 'eva', id from public.members where user_id = '00000000-0000-0000-0000-00000000056b';
insert into ids select 'sam', id from public.members where user_id = '00000000-0000-0000-0000-00000000056f';

-- Gabriel's family, in Paris. "Now" is Monday 2026-11-16, 10:00 in Paris (09:00Z).
select pg_temp.login('00000000-0000-0000-0000-00000000056a');
select pg_temp.add('late_day', '2026-11-14 07:00Z', true, 'day');
select pg_temp.add('late_week', '2026-11-08 23:00Z', false, 'week');        -- Monday 9, any time
select pg_temp.add('late_none', '2026-11-12 23:00Z', false, 'none');        -- Friday 13, any time
select pg_temp.add('half_hour', '2026-11-16 08:30Z', true, 'hour');         -- today 09:30
select pg_temp.add('today_15', '2026-11-16 14:00Z', true, 'hour');          -- today 15:00
select pg_temp.add('today_any', '2026-11-15 23:00Z', false, 'day');
select pg_temp.add('tomorrow', '2026-11-17 08:00Z', true, 'hour', null, pg_temp.id('eva'));
select pg_temp.add('later', '2026-11-30 23:00Z', false, 'day');
select pg_temp.add('snoozed', '2026-11-12 07:00Z', true, 'day', '2026-11-20 07:00Z');
select pg_temp.add('back', '2026-11-10 07:00Z', true, 'day', '2026-11-16 07:00Z');
select pg_temp.add('back_any', '2026-11-09 23:00Z', false, 'day', '2026-11-15 23:00Z');
select pg_temp.add('done', '2026-11-16 08:00Z', true, 'hour');
select pg_temp.add('deleted', '2026-11-16 08:00Z', true, 'hour');
update public.reminders set completed_at = now() where id = pg_temp.id('done');
update public.reminders set deleted_at = now() where id = pg_temp.id('deleted');
select is((select source::text from public.reminders where id = pg_temp.id('late_day')), 'app', 'written from the app');

-- FR-012 sections and their order; done and deleted ones are in none.
select is(pg_temp.section('overdue', '2026-11-16 09:00Z'), array['late_week', 'late_none', 'late_day', 'back', 'half_hour'], 'overdue, oldest first');
select is((pg_temp.section('today', '2026-11-16 09:00Z'))[1], 'today_15', 'today by time');
select is((select array_agg(x order by x) from unnest((pg_temp.section('today', '2026-11-16 09:00Z'))[2:]) x), array['back_any', 'today_any'],
  'then "any time", including one back from a snooze today');
select is(pg_temp.section('tomorrow', '2026-11-16 09:00Z'), array['tomorrow'], 'tomorrow');
-- Spec 058: a snoozed one is listed on the day it's back (here Later), flagged, by when it's back.
select is(pg_temp.section('later', '2026-11-16 09:00Z'), array['snoozed', 'later'], 'later, with the one snoozed until Friday');
select is(pg_temp.section('snoozed', '2026-11-16 09:00Z'), array['snoozed'], 'snoozed until it comes back');

-- FR-006 late.
select is(pg_temp.state('late_day', '2026-11-16 09:00Z') ->> 'late_hours', '50', 'with a time: whole hours late');
select is(pg_temp.state('late_day', '2026-11-16 09:00Z') ->> 'late_days', '2', 'and whole days');
select is(pg_temp.state('late_none', '2026-11-16 09:00Z') ->> 'late_days', '3', 'any time: days since its day');
select is(pg_temp.state('today_any', '2026-11-16 09:00Z') ->> 'section', 'today', 'any time isn''t late on its own day');
select is(pg_temp.state('today_any', '2026-11-16 23:00Z') ->> 'late_days', '1', 'but is from the next day');
select is(pg_temp.state('half_hour', '2026-11-16 09:00Z') ->> 'late_hours', '0', 'half an hour late: no hours yet');
select is(pg_temp.state('back', '2026-11-16 09:00Z') ->> 'late_hours', '2', 'back from a snooze: late from when it came back');
select is(pg_temp.state('back', '2026-11-16 09:00Z') ->> 'late_days', '0', 'not from its due date');
select is(pg_temp.state('back_any', '2026-11-16 09:00Z') ->> 'late_days', '0', 'any time, back today: no late badge');
select is(pg_temp.state('snoozed', '2026-11-20 07:00Z') ->> 'section', 'today', 'a snooze ends at its time');
select is(pg_temp.state('snoozed', '2026-11-20 07:01Z') ->> 'section', 'overdue', 'and is late just after');
select is(pg_temp.state('snoozed', '2026-11-20 08:00Z') ->> 'late_hours', '1', 'and lateness counts from then');
select is(pg_temp.state('later', '2026-11-16 09:00Z') ->> 'due_on', '2026-12-01', 'the due day is in the home time zone');

-- FR-008 Home: overdue and today, never "Leave it", "Next week" only on its weekday, never snoozed.
select is((select array_agg(pg_temp.name(r.id) order by pg_temp.name(r.id)) from public._reminder_state(public.my_family_id(), null, '2026-11-16 09:00Z') r where r.on_home),
  array['back', 'back_any', 'half_hour', 'late_day', 'late_week', 'today_15', 'today_any'], 'on Home on Monday');
select is(pg_temp.state('late_week', '2026-11-17 09:00Z') ->> 'on_home', 'false', '"Next week" isn''t on Home on Tuesday');
select is(pg_temp.state('late_week', '2026-11-23 09:00Z') ->> 'on_home', 'true', 'and is again the Monday after');
-- Spec 058: between its weekdays it rests in Snoozed, back the next Monday (any time: its start).
select is(pg_temp.state('late_week', '2026-11-17 09:00Z') ->> 'snoozed', 'true', 'on Tuesday it rests, snoozed');
select is(pg_temp.state('late_week', '2026-11-17 09:00Z') ->> 'section', 'later', 'listed on the day it''s back (Later)');
select is((pg_temp.state('late_week', '2026-11-17 09:00Z') ->> 'snoozed_until')::timestamptz, '2026-11-22 23:00Z'::timestamptz, 'back on Monday');
select is(pg_temp.state('late_week', '2026-11-23 09:00Z') ->> 'section', 'overdue', 'and overdue again that Monday');

-- Across the clock change (Paris goes from UTC+2 to UTC+1 on 2026-10-25).
select pg_temp.add('dst_any', '2026-10-23 22:00Z', false, 'day');           -- Saturday 24, any time
select pg_temp.add('dst_time', '2026-10-24 06:00Z', true, 'day');           -- Saturday 24, 08:00
select is(pg_temp.state('dst_any', '2026-10-26 09:00Z') ->> 'late_days', '2', 'any time: whole days across the change');
select is(pg_temp.state('dst_any', '2026-10-24 21:59Z') ->> 'section', 'today', 'still its day at 23:59 summer time');
select is(pg_temp.state('dst_any', '2026-10-24 22:00Z') ->> 'section', 'overdue', 'late at midnight');
select is(pg_temp.state('dst_time', '2026-10-26 07:00Z') ->> 'late_hours', '49', 'with a time: real hours, 49 across the extra hour');
select is((select r.sort_at from public._reminder_state(public.my_family_id(), null, '2026-10-20 09:00Z') r where r.id = pg_temp.id('dst_any')),
  '2026-10-24 21:59:59.999999Z'::timestamptz, '"any time" sorts at the end of its day');
delete from public.reminders where id in (pg_temp.id('dst_any'), pg_temp.id('dst_time'));

-- FR-001 and FR-010: rules the table keeps.
select throws_ok($$ insert into public.reminders (title, due_at, has_time, rollover) values ('Bins', now(), false, 'hour') $$,
  '23514', null, '"Every hour" needs a time');
select throws_ok($$ insert into public.reminders (title, due_at, has_time, rollover) values (repeat('x', 81), now(), true, 'day') $$,
  '23514', null, 'a title is 80 characters at most');
select throws_ok(format($$ select pg_temp.add('theirs', now(), true, 'day', null, '%s') $$, pg_temp.id('sam')),
  '23503', null, 'it can''t be for someone in another family');

-- FR-004: Done moves the reminder on, once, and Undo puts it back.
select pg_temp.add('bins', '2026-11-09 07:00Z', true, 'day');
update public.reminders set repeat_rule = '{"freq":"weekly","ends":{"type":"never"}}', repeat_from = '2026-11-09', next_due_at = '2026-11-16 07:00Z'
  where id = pg_temp.id('bins');
select ok(not public.reminder_apply(pg_temp.id('bins'), '2026-11-02 07:00Z', '[]', '2026-11-16 07:00Z', false), 'a change from where it no longer is does nothing');
select ok(public.reminder_apply(pg_temp.id('bins'), '2026-11-09 07:00Z', '[{"due_at":"2026-11-09 07:00Z","status":"done"}]',
  '2026-11-16 07:00Z', false, '2026-11-23 07:00Z'), 'Done');
select is((select array[due_at::text, next_due_at::text] from public.reminders where id = pg_temp.id('bins')),
  array['2026-11-16 07:00:00+00', '2026-11-23 07:00:00+00'], 'moves to the next date');
select is((select array[status, (closed_by = (select id from public.members where user_id = auth.uid()))::text] from public.reminder_occurrences where reminder_id = pg_temp.id('bins')),
  array['done', 'true'], 'and keeps who ticked it in its history');
select ok(not public.reminder_apply(pg_temp.id('bins'), '2026-11-09 07:00Z', '[{"due_at":"2026-11-09 07:00Z","status":"done"}]', '2026-11-16 07:00Z', false),
  'a second tick from another phone does nothing');
select throws_ok(format($$ insert into public.reminder_occurrences (reminder_id, due_at, status) values ('%s', '2026-11-09 07:00Z', 'missed') $$, pg_temp.id('bins')),
  '23505', null, 'an occurrence is closed once');
select ok(public.reminder_revert(pg_temp.id('bins'), '2026-11-16 07:00Z', array['2026-11-09 07:00Z'::timestamptz], '2026-11-09 07:00Z', '2026-11-16 07:00Z'), 'Undo');
select is((select due_at from public.reminders where id = pg_temp.id('bins')) || ' ' || (select count(*) from public.reminder_occurrences where reminder_id = pg_temp.id('bins')),
  '2026-11-09 07:00:00+00 0', 'puts it back and clears its history entry');
select ok(public.reminder_apply(pg_temp.id('late_day'), '2026-11-14 07:00Z', '[]', '2026-11-14 07:00Z', true), 'a one-off completes');
insert into public.reminder_occurrences (reminder_id, due_at, status) values (pg_temp.id('bins'), '2026-11-02 07:00Z', 'missed');
select isnt((select completed_at from public.reminders where id = pg_temp.id('late_day')), null, 'with the database''s time');

-- FR-012 "Mine" (Gabriel's and Everyone's) and the calendar's range; deleted ones are in neither.
-- The lists use the real clock: look in every section, so the test doesn't depend on today's date.
create function pg_temp.listed(p_id uuid, p_mine boolean) returns boolean language sql as $$
  select exists (select 1 from unnest(array['overdue', 'today', 'tomorrow', 'later', 'snoozed']) k, public.reminders_section(k, p_mine, 51) r where (r ->> 'id')::uuid = p_id)
$$;
select ok(not pg_temp.listed(pg_temp.id('tomorrow'), true) and pg_temp.listed(pg_temp.id('tomorrow'), false),
  '"Mine" leaves out Eva''s reminder; Everyone''s has it');
select pg_temp.login('00000000-0000-0000-0000-00000000056b');
select ok(pg_temp.listed(pg_temp.id('tomorrow'), true), 'and Eva''s "Mine" has it');
select pg_temp.login('00000000-0000-0000-0000-00000000056a');
select ok(exists (select 1 from public.reminders_in_range(current_date + 300, current_date + 301) r where (r ->> 'id')::uuid = pg_temp.id('bins'))
  and not exists (select 1 from public.reminders_in_range(current_date + 300, current_date + 301) r where (r ->> 'id')::uuid = pg_temp.id('later')),
  'the calendar gets repeating ones from before its range, not one-offs');
select ok(exists (select 1 from public.reminders_in_range('2026-11-30', '2026-12-02') r where (r ->> 'id')::uuid = pg_temp.id('later')), 'and the ones due in it');
select ok(not exists (select 1 from public.reminders_in_range('2026-11-01', '2026-12-31') r where (r ->> 'id')::uuid in (pg_temp.id('deleted'), pg_temp.id('done'))),
  'never deleted or completed ones');
select throws_ok($$ select public.reminders_in_range('2026-01-01', '2027-06-01') $$, '22023', null, 'a range over a year is refused');
select throws_ok($$ select public.reminder_apply(pg_temp.id('bins'), now(), '{"due_at":"x"}', now(), false) $$, '22023', null, 'occurrences come as a list');

-- FR-013: a live reminder isn't removed for good, only a deleted one.
delete from public.reminders where id = pg_temp.id('bins');
select is((select count(*)::int from public.reminders where id = pg_temp.id('bins')), 1, 'deleting a live reminder for good does nothing');

-- FR-010: anyone in the family changes any reminder.
select pg_temp.login('00000000-0000-0000-0000-00000000056b');
update public.reminders set title = 'Green bins' where id = pg_temp.id('bins');
select is((select title from public.reminders where id = pg_temp.id('bins')), 'Green bins', 'Eva edits Gabriel''s reminder');

-- SC-003: nothing of it for another family, or signed out.
select pg_temp.login('00000000-0000-0000-0000-00000000056f');
select is((select count(*)::int from public.reminders), 0, 'another family reads no reminders');
select is((select count(*)::int from public.reminder_occurrences), 0, 'nor their history');
select is((select count(*)::int from public._reminder_state((select family_id from public.reminders where false union select f.id from public.families f
  join public.members m on m.family_id = f.id where m.id = pg_temp.id('eva')), null, now())), 0, 'nor their state, even by family id');
update public.reminders set title = 'Mine now' where id = pg_temp.id('bins');
delete from public.reminder_occurrences;
delete from public.reminders;
select ok(not public.reminder_apply(pg_temp.id('bins'), '2026-11-09 07:00Z', '[]', '2026-11-16 07:00Z', true), 'nor tick one');
select ok(not public.reminder_revert(pg_temp.id('bins'), '2026-11-09 07:00Z', '{}', '2026-11-02 07:00Z'), 'nor undo one');
select throws_ok(format($$ insert into public.reminder_occurrences (reminder_id, due_at, status) values ('%s', '2026-10-01 07:00Z', 'missed') $$, pg_temp.id('bins')),
  '23503', null, 'nor add to its history');
select pg_temp.login('00000000-0000-0000-0000-00000000056a');
select is((select title from public.reminders where id = pg_temp.id('bins')), 'Green bins', 'nor change one');
select is((select count(*)::int from public.reminders where id = pg_temp.id('deleted')), 1, 'nor remove one, even deleted');
select is((select count(*)::int from public.reminder_occurrences), 1, 'nor its history');
select pg_temp.login(null);
select throws_ok($$ select count(*) from public.reminders $$, '42501', null, 'signed out reads nothing');
select throws_ok($$ select public.reminders_home() $$, '42501', null, 'nor calls Home');

-- FR-012 Home and pages, with now() (Lou's family, no home time zone: the device's, else UTC).
select pg_temp.login('00000000-0000-0000-0000-00000000056c');
select pg_temp.add('o1', now() - interval '3 days', true, 'day');
select pg_temp.add('o2', now() - interval '2 days', true, 'day');
select pg_temp.add('n1', now() - interval '2 days', true, 'none');
select pg_temp.add('t1', ((now() at time zone 'UTC')::date)::timestamp at time zone 'UTC', false, 'day');
select pg_temp.add('t2', ((now() at time zone 'UTC')::date)::timestamp at time zone 'UTC', false, 'day');
select pg_temp.add('s1', now() - interval '1 day', true, 'day', now() + interval '1 day');
select is((select array(select pg_temp.name((r ->> 'id')::uuid) from jsonb_array_elements(public.reminders_home('UTC') -> 'rows') r)),
  array['o1', 'o2', (select pg_temp.name(id) from ids where name in ('t1', 't2') order by id limit 1)], 'Home: overdue oldest first, then today');
select is(public.reminders_home('UTC') - 'rows', '{"more_today": 1, "snoozed": 1}'::jsonb, 'with how many more today and how many are snoozed');
select is((select array_agg(pg_temp.name((r ->> 'id')::uuid)) from public.reminders_section('today', false, 1, null, null, 'UTC') r)
  || (select array_agg(pg_temp.name((r ->> 'id')::uuid)) from public.reminders_section('today', false, 1,
    (select (r ->> 'sort_at')::timestamptz from public.reminders_section('today', false, 1, null, null, 'UTC') r),
    (select (r ->> 'id')::uuid from public.reminders_section('today', false, 1, null, null, 'UTC') r), 'UTC') r),
  (select array_agg(name order by id) from ids where name in ('t1', 't2')), 'pages follow on with no repeats or gaps');
select throws_ok($$ select public.reminders_section('soon', false, 20) $$, '22023', null, 'an unknown section is refused');
select is(public._reminder_time_zone(public.my_family_id(), 'Not/A_Zone'), 'UTC', 'an unknown device time zone falls back to UTC');

-- From Recently deleted, a deleted reminder can be removed for good.
select pg_temp.login('00000000-0000-0000-0000-00000000056a');
delete from public.reminders where id = pg_temp.id('deleted');
select is((select count(*)::int from public.reminders where id = pg_temp.id('deleted')), 0, 'a deleted reminder can be removed for good');

-- The nightly purge (server only).
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.reminders (family_id, title, due_at, has_time, rollover, deleted_at)
  select family_id, 'Old', now(), true, 'day', now() - interval '31 days' from public.members where id = pg_temp.id('sam');
select ok(not has_function_privilege('authenticated', 'public.purge_deleted_reminders()', 'execute'), 'members can''t purge');
set local role service_role;
select is(public.purge_deleted_reminders(), 1, 'reminders deleted over 30 days ago go');
reset role;

select * from finish();
rollback;
