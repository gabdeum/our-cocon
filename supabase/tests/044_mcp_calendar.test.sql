-- Spec 044: assistants add and change events as their member, within "Add & change events" (FR-003),
-- checked by the database on any API. They can't change what their member can't (someone else's
-- private event, a surprise kept from them). Their event writes are logged for the activity list and
-- Undo (FR-004), and a private or surprise event's entries are read only by the people who may see
-- it (032-later L83). The tools themselves are tested in apps/mcp/tools/calendar.
begin;
select plan(33);

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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000044a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000044b', 'eva@example.com'),
  ('00000000-0000-0000-0000-00000000044f', 'sam@example.com');
insert into public.oauth_client_sources (client_id, source) values ('c44', 'claude');

select pg_temp.login('00000000-0000-0000-0000-00000000044a');
select public.create_family('The Demanges', 'Gabriel');
insert into tokens select 'eva', public.create_invite();
select public.add_managed_member('James', 'mint');
select pg_temp.login('00000000-0000-0000-0000-00000000044b');
select public.accept_invite((select token from tokens where name = 'eva'), 'Eva');
select pg_temp.login('00000000-0000-0000-0000-00000000044f');
select public.create_family('The Others', 'Sam');
reset role;
insert into ids select 'gabriel', id from public.members where user_id = '00000000-0000-0000-0000-00000000044a';
insert into ids select 'eva', id from public.members where user_id = '00000000-0000-0000-0000-00000000044b';
insert into ids select 'james', m.id from public.members m join public.members g on g.family_id = m.family_id where m.display_name = 'James' and g.user_id = '00000000-0000-0000-0000-00000000044a';

-- Eva's private appointment, and Gabriel's surprise for her (in the app).
select pg_temp.login('00000000-0000-0000-0000-00000000044b');
insert into ids select 'private', public.save_event(
  '{"title":"Therapist","starts_on":"2026-11-03","ends_on":"2026-11-03","time_type":"slot","slots":["afternoon"],"visibility":"private"}',
  jsonb_build_array(pg_temp.id('eva')));
select pg_temp.login('00000000-0000-0000-0000-00000000044a');
insert into ids select 'dinner', public.save_event(
  '{"title":"Eva''s surprise dinner","starts_on":"2026-11-07","ends_on":"2026-11-07","time_type":"slot","slots":["evening"],"visibility":"surprise"}',
  jsonb_build_array(pg_temp.id('eva')), null,
  jsonb_build_object('hidden_from', jsonb_build_array(pg_temp.id('eva')), 'cover_title', 'Dinner out'));

-- US1: Gabriel's Claude adds James's music class, every Saturday morning, Gabriel takes him.
select pg_temp.login('00000000-0000-0000-0000-00000000044a', 'cocon_assistant', 'c44');
select is(public.ai_allowed('events'), true, 'adding events is allowed until changed');
select pg_temp.call('44444444-4444-4444-8444-000000000001', 'create_event');
insert into ids select 'music', public.save_event(
  jsonb_build_object('title', 'Baby music class', 'starts_on', '2026-10-31', 'ends_on', '2026-10-31', 'time_type', 'slot', 'slots', '["morning"]'::jsonb,
    'recurrence', '{"freq":"weekly","weekdays":[6],"ends":{"type":"never"}}'::jsonb, 'responsible_member_id', pg_temp.id('gabriel')),
  jsonb_build_array(pg_temp.id('james')));
select is((select row(title, source, responsible_member_id, view)::text from public.events_visible where id = pg_temp.id('music')),
  row('Baby music class', 'claude', pg_temp.id('gabriel'), 'full')::text, 'saved as Gabriel via Claude ("Added via Claude")');

-- His assistant can't change what Gabriel can't.
select throws_ok(format($$ select public.save_event('{"title":"Busy","starts_on":"2026-11-03","ends_on":"2026-11-03","time_type":"all_day"}', '["everyone"]', '%s') $$, pg_temp.id('private')),
  'P0002', 'event_not_found', 'nor Eva''s private event');
select is((select count(*)::int from public.events where id = pg_temp.id('private')), 0, 'whose row it can''t read either');
select is((select count(*)::int from public.events where id = pg_temp.id('dinner')), 1, 'while the surprise it''s in on, it can');
insert into public.event_exceptions (event_id, occurrence_date, override) values (pg_temp.id('music'), '2026-11-14', '{"slots":["afternoon"]}');
select is((select override::text from public.event_exceptions where event_id = pg_temp.id('music')), '{"slots": ["afternoon"]}', 'it changes one date of an event');
select throws_ok($$ delete from public.events $$, '42501', null, 'it never removes an event for good');
select throws_ok($$ update public.events set created_by = null $$, '42501', null, 'nor changes who created one');

-- Eva's Claude: the surprise is a cover it can't change, delete or learn about.
select pg_temp.login('00000000-0000-0000-0000-00000000044b', 'cocon_assistant', 'c44');
select throws_ok(format($$ select public.save_event('{"title":"Dinner out","starts_on":"2026-11-07","ends_on":"2026-11-07","time_type":"all_day"}', '["everyone"]', '%s') $$, pg_temp.id('dinner')),
  'P0002', 'event_not_found', 'Eva''s assistant can''t save over the surprise');
update public.events set deleted_at = now() where id = pg_temp.id('dinner');
reset role;
select is((select deleted_at from public.events where id = pg_temp.id('dinner')), null, 'or delete it');
select pg_temp.login('00000000-0000-0000-0000-00000000044b', 'cocon_assistant', 'c44');
select is((select count(*)::int from public.event_surprise), 0, 'or read its surprise');
select is((select count(*)::int from public.events where id = pg_temp.id('dinner')), 0, 'or its row');

-- FR-003: Gabriel turns "Add & change events" off. Reading still works; any write is refused.
select pg_temp.login('00000000-0000-0000-0000-00000000044a');
insert into public.ai_permissions (family_id, user_id, events) values (public.my_family_id(), '00000000-0000-0000-0000-00000000044a', false);
select is(public.ai_allowed('events'), true, 'the app is never limited');
select pg_temp.login('00000000-0000-0000-0000-00000000044a', 'cocon_assistant', 'c44');
select is(public.ai_allowed('events'), false, 'his assistant isn''t allowed any more');
select throws_ok($$ select public.save_event('{"title":"Swim","starts_on":"2026-11-01","ends_on":"2026-11-01","time_type":"all_day"}', '["everyone"]') $$,
  '42501', 'events', 'so a new event is refused');
select throws_ok(format($$ update public.events set deleted_at = now() where id = '%s' $$, pg_temp.id('music')), '42501', 'events', 'and a delete');
select throws_ok(format($$ insert into public.event_exceptions (event_id, occurrence_date, cancelled) values ('%s', '2026-11-07', true) $$, pg_temp.id('music')),
  '42501', 'events', 'and cancelling one date');
select is((select count(*)::int from public.events_visible), 3, 'while reading still works');
select pg_temp.login('00000000-0000-0000-0000-00000000044a');
update public.ai_permissions set events = true;

-- His assistant makes the music class private, then it's back to family with Undo.
select pg_temp.login('00000000-0000-0000-0000-00000000044a', 'cocon_assistant', 'c44');
select pg_temp.call('44444444-4444-4444-8444-000000000002', 'update_event');
update public.events set title = 'Music class', visibility = 'private' where id = pg_temp.id('music');

-- FR-004 and L83: Gabriel sees both entries; Eva sees none of a private event's rows.
select pg_temp.login('00000000-0000-0000-0000-00000000044a');
select results_eq($$ select kind, event_name, can_undo from public.activity_entries() order by created_at, kind $$,
  $$ values ('event_created', 'Music class', true), ('event_edited', 'Music class', true) $$, 'Gabriel sees what Claude did, by the event''s title');
select pg_temp.login('00000000-0000-0000-0000-00000000044b');
select is((select count(*)::int from public.activity where payload ->> 'event_id' = pg_temp.id('music')::text), 0, 'Eva can''t read the private event''s log');
select is((select count(*)::int from public.activity_entries()), 0, 'or see its entries');

select pg_temp.login('00000000-0000-0000-0000-00000000044a');
select is((public.undo_ai_change('44444444-4444-4444-8444-000000000002') ->> 'applied')::boolean, true, 'Gabriel undoes the edit');
select is((select row(title, visibility)::text from public.events where id = pg_temp.id('music')), row('Baby music class', 'family')::text, 'and it''s back as it was');
select pg_temp.login('00000000-0000-0000-0000-00000000044b');
select is((select count(*)::int from public.activity_entries() where kind = 'event_created'), 1, 'Eva now sees the family event''s entry');
select is((select count(*)::int from public.activity where public._activity_key(payload, id) = '44444444-4444-4444-8444-000000000002'), 0,
  'but never the rows logged while it was private');

-- A surprise's log stays with the people who set it up.
select pg_temp.login('00000000-0000-0000-0000-00000000044a', 'cocon_assistant', 'c44');
select pg_temp.call('44444444-4444-4444-8444-000000000003', 'update_event');
update public.events set location = 'Café Lalo' where id = pg_temp.id('dinner');
select pg_temp.login('00000000-0000-0000-0000-00000000044b');
select is((select count(*)::int from public.activity where payload ->> 'event_id' = pg_temp.id('dinner')::text), 0, 'Eva can''t read her surprise''s log');
select pg_temp.login('00000000-0000-0000-0000-00000000044a');
select is((select event_name from public.activity_entries() where key = '44444444-4444-4444-8444-000000000003'), 'Eva''s surprise dinner', 'Gabriel can');

-- Another family sees none of it, and a stray value in a person's undo row breaks nobody's reads.
select pg_temp.login('00000000-0000-0000-0000-00000000044f');
select is((select count(*)::int from public.activity) + (select count(*)::int from public.events), 0, 'another family sees no activity or events');
select pg_temp.login('00000000-0000-0000-0000-00000000044a', 'cocon_assistant', 'c44');
select pg_temp.call('44444444-4444-4444-8444-000000000004', 'create_event');
select public.save_event('{"title":"Swim","starts_on":"2026-11-08","ends_on":"2026-11-08","time_type":"all_day"}', '["everyone"]');
select pg_temp.login('00000000-0000-0000-0000-00000000044b');
insert into public.activity (action, target_kind, target_id, payload)
  values ('undo', 'activity', '44444444-4444-4444-8444-000000000004', '{"event_id":"x","secret":"y"}');
select lives_ok($$ select count(*) from public.activity_entries() $$, 'a malformed undo row doesn''t break the activity list');

-- Someone cancelled a date of the class since: Undo of the add doesn't take it away.
insert into public.event_exceptions (event_id, occurrence_date, cancelled) values (pg_temp.id('music'), '2026-11-21', true);
select pg_temp.login('00000000-0000-0000-0000-00000000044a');
select is(public.undo_ai_change('44444444-4444-4444-8444-000000000001') -> 'conflicts',
  jsonb_build_array(jsonb_build_object('kind', 'edited', 'by', '00000000-0000-0000-0000-00000000044b', 'count', 1)), 'Undo of the add says Eva changed it since');
select is((select count(*)::int from public.events where id = pg_temp.id('music')), 1, 'and keeps the event');
select pg_temp.login('00000000-0000-0000-0000-00000000044b');
delete from public.event_exceptions where event_id = pg_temp.id('music') and occurrence_date = '2026-11-21';

-- Undoing the add removes the event for good (as the app's Undo after adding does).
select pg_temp.login('00000000-0000-0000-0000-00000000044a');
select is((public.undo_ai_change('44444444-4444-4444-8444-000000000001') ->> 'applied')::boolean, true, 'Gabriel undoes the add');
select is((select count(*)::int from public.events where id = pg_temp.id('music')), 0, 'the event is gone, not in Recently deleted');

select * from finish();
rollback;
