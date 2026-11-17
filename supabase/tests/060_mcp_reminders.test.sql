-- Spec 060: assistants change reminders as their member, within "Add & change reminders" (FR-002),
-- checked by the database on any API, and never another family's. Their writes are logged for the
-- activity list with Undo and Restore (FR-003). 032-later L144: the family's own reminder changes
-- are logged too, a tick and its Undo included; catching up on what was missed isn't. The tools
-- themselves are tested in apps/mcp/tools/reminders.
begin;
select plan(38);

create function pg_temp.login(uid uuid, r text default 'authenticated', client text default null) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', jsonb_strip_nulls(jsonb_build_object('sub', uid, 'role', r, 'client_id', client))::text, true);
  execute format('set local role %I', r);
end;
$$;
grant execute on function pg_temp.login(uuid, text, text) to public;
-- The MCP server's labels for one tool call.
create function pg_temp.call(id uuid, tool text) returns void language sql as $$
  select set_config('request.headers', jsonb_build_object('x-cocon-call', id, 'x-cocon-tool', tool)::text, true);
$$;
grant execute on function pg_temp.call(uuid, text) to public;
grant usage on schema extensions to cocon_assistant;
grant execute on all functions in schema extensions to cocon_assistant;
create temp table ids (name text primary key, id uuid);
create temp table tokens (name text primary key, token text);
grant all on ids, tokens to public;
create function pg_temp.id(n text) returns uuid language sql as $$ select id from ids where name = n $$;
grant execute on function pg_temp.id(text) to public;
-- The kinds of the caller's entries about a reminder, A to Z (one transaction: they share a time).
create function pg_temp.kinds(n text) returns text[] language sql as $$
  select coalesce(array_agg(e.kind order by e.kind), '{}') from public.activity_entries(100) e where e.reminder_id = pg_temp.id(n)
$$;
grant execute on function pg_temp.kinds(text) to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000060a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000060b', 'eva@example.com'),
  ('00000000-0000-0000-0000-00000000060f', 'sam@example.com');
insert into public.oauth_client_sources (client_id, source) values ('c60', 'claude');

select pg_temp.login('00000000-0000-0000-0000-00000000060a');
select public.create_family('The Demanges', 'Gabriel');
insert into tokens select 'eva', public.create_invite();
select pg_temp.login('00000000-0000-0000-0000-00000000060b');
select public.accept_invite((select token from tokens where name = 'eva'), 'Eva');
select pg_temp.login('00000000-0000-0000-0000-00000000060f');
select public.create_family('The Others', 'Sam');
with r as (
  insert into public.reminders (family_id, title, due_at, has_time, rollover) values (public.my_family_id(), 'Sam''s dentist', now() + interval '1 day', false, 'day') returning id
) insert into ids select 'sams', id from r;
reset role;
insert into ids select 'eva', id from public.members where user_id = '00000000-0000-0000-0000-00000000060b';

-- FR-001 and FR-003: Gabriel's Claude adds a reminder for Eva, as Gabriel, via Claude.
select pg_temp.login('00000000-0000-0000-0000-00000000060a', 'cocon_assistant', 'c60');
select is(public.ai_allowed('reminders'), true, 'changing reminders is allowed until changed');
select pg_temp.call('60606060-6060-4060-8060-000000000001', 'create_reminder');
with r as (
  insert into public.reminders (family_id, title, due_at, has_time, rollover, assignee_id, repeat_rule, repeat_from, next_due_at)
  values (public.my_family_id(), 'Water the plants', now() + interval '1 day', true, 'hour', pg_temp.id('eva'),
    '{"freq":"weekly","ends":{"type":"never"}}', (now() + interval '1 day')::date, now() + interval '8 days')
  returning id
) insert into ids select 'plants', id from r;
select is((select row(source, created_by)::text from public.reminders where id = pg_temp.id('plants')),
  row('claude', '00000000-0000-0000-0000-00000000060a')::text, 'saved as Gabriel via Claude');
select is((select count(*)::int from public.reminders where id = pg_temp.id('sams')), 0, 'it never sees another family''s reminders');
update public.reminders set title = 'Not yours' where id = pg_temp.id('sams');
reset role;
select is((select title from public.reminders where id = pg_temp.id('sams')), 'Sam''s dentist', 'nor changes them');
select pg_temp.login('00000000-0000-0000-0000-00000000060a', 'cocon_assistant', 'c60');
select is((select count(*)::int from public.reminders_section('tomorrow', false, 10, null, null, null, pg_temp.id('eva')::text)), 1, 'it lists Eva''s reminders');
select is((select count(*)::int from public.reminders_section('tomorrow', false, 10, null, null, null, 'everyone')), 0, 'and Everyone''s apart');
select throws_ok($$ select public.reminders_section('tomorrow', false, 10, null, null, null, 'nobody') $$, '22023', 'bad_assignee', 'a malformed assignee is refused');
select throws_ok($$ delete from public.reminders $$, '42501', null, 'it never removes a reminder for good');
select throws_ok($$ update public.reminders set created_by = null $$, '42501', null, 'nor changes who created one');

-- A tick through reminder_apply, as complete_reminder does it, logged with the call.
select pg_temp.call('60606060-6060-4060-8060-000000000002', 'complete_reminder');
select is(public.reminder_apply(pg_temp.id('plants'), r.due_at, jsonb_build_array(jsonb_build_object('due_at', r.due_at, 'status', 'done')),
  r.next_due_at, false, r.next_due_at + interval '7 days'), true, 'it ticks a reminder off')
  from public.reminders r where r.id = pg_temp.id('plants');

-- FR-003: an entry with Undo; undone, the reminder is back on its date with no done occurrence.
select pg_temp.login('00000000-0000-0000-0000-00000000060a');
select is((select row(source, reminder_name, can_undo)::text from public.activity_entries(100) e where e.reminder_id = pg_temp.id('plants') and e.kind = 'reminder_completed'),
  row('claude', 'Water the plants', true)::text, 'the tick is an entry of its own, with Undo');
select is((public.undo_ai_change(e.key) ->> 'applied')::boolean, true, 'Undo reopens the tick') from public.activity_entries(100) e
  where e.reminder_id = pg_temp.id('plants') and e.kind = 'reminder_completed';
select is((select due_at < now() + interval '2 days' from public.reminders where id = pg_temp.id('plants')), true, 'the reminder is back on its date');
select is((select count(*)::int from public.reminder_occurrences where reminder_id = pg_temp.id('plants')), 0, 'with no done occurrence left');

-- A delete is restored, not undone.
select pg_temp.login('00000000-0000-0000-0000-00000000060a', 'cocon_assistant', 'c60');
select pg_temp.call('60606060-6060-4060-8060-000000000003', 'delete_reminder');
update public.reminders set deleted_at = now() where id = pg_temp.id('plants');
select pg_temp.login('00000000-0000-0000-0000-00000000060a');
select is(pg_temp.kinds('plants'), array['reminder_completed', 'reminder_created', 'reminder_deleted'], 'each call is an entry');
select is((select row(can_undo, can_restore)::text from public.activity_entries(100) e where e.reminder_id = pg_temp.id('plants') and e.kind = 'reminder_deleted'),
  row(false, true)::text, 'Restore while it''s in Recently deleted');
select is((public.undo_ai_change(e.key) ->> 'applied')::boolean, true, 'Restore brings it back') from public.activity_entries(100) e
  where e.reminder_id = pg_temp.id('plants') and e.kind = 'reminder_deleted';
select is((select deleted_at from public.reminders where id = pg_temp.id('plants')), null, 'out of Recently deleted');

-- The tool's label is checked against the rows: a delete sent as update_reminder isn't "edited".
select pg_temp.login('00000000-0000-0000-0000-00000000060a', 'cocon_assistant', 'c60');
select pg_temp.call('60606060-6060-4060-8060-000000000004', 'update_reminder');
update public.reminders set deleted_at = now() where id = pg_temp.id('plants');
select pg_temp.login('00000000-0000-0000-0000-00000000060a');
select is((select kind from public.activity_entries(100) e where e.key = '60606060-6060-4060-8060-000000000004'), 'other', 'a delete labelled as an edit reads "made 1 change"');
select is((public.undo_ai_change('60606060-6060-4060-8060-000000000004') ->> 'applied')::boolean, true, 'and is undone like one');

-- Another family's assistant gets nothing of this family's reminders.
select pg_temp.login('00000000-0000-0000-0000-00000000060f', 'cocon_assistant', 'c60');
select is(public.reminder_apply(r.id, r.due_at, '[]', r.due_at + interval '1 day', false), false, 'Sam''s assistant can''t move Gabriel''s reminder')
  from (select pg_temp.id('plants') as id, now() as due_at) r;
select is((select count(*)::int from public.reminders_section('tomorrow', false, 10, null, null, null, pg_temp.id('eva')::text)), 0, 'nor list Eva''s');
reset role;
select is((select deleted_at is null from public.reminders where id = pg_temp.id('plants')), true, 'which is still there, unchanged');

-- FR-002: with the switch off, it reads but writes nothing, on any API.
select pg_temp.login('00000000-0000-0000-0000-00000000060a');
insert into public.ai_permissions (family_id, user_id, reminders) values (public.my_family_id(), auth.uid(), false);
select pg_temp.login('00000000-0000-0000-0000-00000000060a', 'cocon_assistant', 'c60');
select is(public.ai_allowed('reminders'), false, 'Gabriel turned it off');
select throws_ok($$ insert into public.reminders (family_id, title, due_at, has_time, rollover) values (public.my_family_id(), 'Swim', now(), false, 'day') $$,
  '42501', 'reminders', 'adding a reminder is refused');
select throws_ok(format($$ update public.reminders set title = 'Plants' where id = '%s' $$, pg_temp.id('plants')), '42501', 'reminders', 'changing one too');
select throws_ok(format($$ update public.reminders set deleted_at = now() where id = '%s' $$, pg_temp.id('plants')), '42501', 'reminders', 'deleting one too');
select throws_ok(format($$ update public.reminders set completed_at = now() where id = '%s' $$, pg_temp.id('plants')), '42501', 'reminders', 'completing one by hand too');
select throws_ok(format($$ select public.reminder_apply(r.id, r.due_at, '[]', r.due_at, true) from public.reminders r where r.id = '%s' $$, pg_temp.id('plants')),
  '42501', 'reminders', 'ticking one off through reminder_apply too');
select throws_ok(format($$ insert into public.reminder_occurrences (family_id, reminder_id, due_at, status) values (public.my_family_id(), '%s', now(), 'done') $$, pg_temp.id('plants')),
  '42501', 'reminders', 'and writing its history');
select is((select count(*)::int from public.reminders where family_id = public.my_family_id()), 1, 'reading still works');
select pg_temp.login('00000000-0000-0000-0000-00000000060a');
with r as (
  insert into public.reminders (family_id, title, due_at, has_time, rollover) values (public.my_family_id(), 'Take the bins out', now() - interval '2 days', false, 'day') returning id
) insert into ids select 'bins', id from r;
select is((select count(*)::int from public.reminders where id = pg_temp.id('bins')), 1, 'Gabriel''s own app isn''t affected');
update public.ai_permissions set reminders = true;

-- L144: Eva's own changes in the app, logged with who and the app; Gabriel reads them.
select pg_temp.login('00000000-0000-0000-0000-00000000060b');
with r as (
  insert into public.reminders (family_id, title, due_at, has_time, rollover, repeat_rule, repeat_from, next_due_at)
  values (public.my_family_id(), 'Pay the nanny', date_trunc('day', now()) - interval '14 days', false, 'day',
    '{"freq":"weekly","ends":{"type":"never"}}', (now() - interval '14 days')::date, date_trunc('day', now()) - interval '7 days')
  returning id
) insert into ids select 'nanny', id from r;
update public.reminders set title = 'Pay Nadia' where id = pg_temp.id('nanny');
-- Catching up: the missed week closed, nobody's action.
select public.reminder_apply(r.id, r.due_at, jsonb_build_array(jsonb_build_object('due_at', r.due_at, 'status', 'missed')),
  r.next_due_at, false, r.next_due_at + interval '7 days') from public.reminders r where r.id = pg_temp.id('nanny');
-- Ticked, then the tick undone.
select public.reminder_apply(r.id, r.due_at, jsonb_build_array(jsonb_build_object('due_at', r.due_at, 'status', 'done')),
  r.next_due_at, false, r.next_due_at + interval '7 days') from public.reminders r where r.id = pg_temp.id('nanny');
select public.reminder_revert(r.id, r.due_at, array[r.due_at - interval '7 days'], r.due_at - interval '7 days', r.due_at) from public.reminders r where r.id = pg_temp.id('nanny');
update public.reminders set snoozed_until = now() + interval '1 day' where id = pg_temp.id('nanny');
update public.reminders set deleted_at = now() where id = pg_temp.id('nanny');
update public.reminders set deleted_at = null where id = pg_temp.id('nanny');
select is(current_setting('cocon.reminder_move', true), '', 'the tick''s mark is off once it''s done');
-- Anyone can call reminder_apply and reminder_revert: what isn't a real catch-up or reopen is logged
-- as the change it makes.
with r as (
  insert into public.reminders (family_id, title, due_at, has_time, rollover) values (public.my_family_id(), 'Renew the passport', now() + interval '1 day', false, 'day') returning id
) insert into ids select 'passport', id from r;
select public.reminder_apply(r.id, r.due_at, jsonb_build_array(jsonb_build_object('due_at', r.due_at, 'status', 'missed')), r.due_at + interval '30 days', false)
  from public.reminders r where r.id = pg_temp.id('passport');
select public.reminder_revert(r.id, r.due_at, array[r.due_at - interval '60 days'], r.due_at + interval '5 days') from public.reminders r where r.id = pg_temp.id('passport');
select is((select count(*)::int from public.activity a where a.target_id = pg_temp.id('passport') and a.action = 'update' and a.payload ->> 'kind' = 'reminder_edited'), 2,
  'a "catch-up" that moves the date ahead, and a "reopen" of nothing done, are edits in the log');
select pg_temp.login('00000000-0000-0000-0000-00000000060a');
select is(pg_temp.kinds('nanny'),
  array['reminder_completed', 'reminder_created', 'reminder_deleted', 'reminder_reopened', 'reminder_restored', 'reminder_snoozed'],
  'added and edited (one entry), ticked, reopened, snoozed, deleted and restored; the catch-up isn''t there');
select is((select row(source, actor_id, reminder_name, can_undo)::text from public.activity_entries(100) e where e.reminder_id = pg_temp.id('nanny') and e.kind = 'reminder_completed'),
  row('app', '00000000-0000-0000-0000-00000000060b', 'Pay Nadia', false)::text, 'by Eva in the app, never undone from the list');
select is((select count(*)::int from public.activity a where a.target_kind = 'reminder_occurrences' and a.source = 'app'), 0, 'occurrences aren''t entries of their own');

-- Sam, in another family, reads none of it.
select pg_temp.login('00000000-0000-0000-0000-00000000060f');
select is((select count(*)::int from public.activity_entries(100) e where e.reminder_id is not null and e.reminder_id <> pg_temp.id('sams')), 0, 'another family reads none of it');

select * from finish();
rollback;
