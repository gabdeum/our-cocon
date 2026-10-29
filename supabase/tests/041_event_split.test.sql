-- Spec 041: "All future events" splits a repeating event (split_event), only for people who may
-- change it, keeping cancelled dates; and Undo after adding removes the event for good.
begin;
select plan(27);

create function pg_temp.login(uid uuid, r text default 'authenticated') returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', r)::text, true);
  execute format('set local role %I', r);
end;
$$;
grant execute on function pg_temp.login(uuid, text) to public;
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
create temp table ids (name text primary key, id uuid);
create temp table tokens (name text primary key, token text);
grant all on ids, tokens to public;
create function pg_temp.id(n text) returns uuid language sql as $$ select id from ids where name = n $$;
grant execute on function pg_temp.id(text) to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000041a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000041b', 'eva@example.com'),
  ('00000000-0000-0000-0000-00000000041c', 'alex@example.com'),
  ('00000000-0000-0000-0000-00000000041f', 'sam@example.com');

-- The Demanges: Gabriel, Eva, and James without the app. Sam is in another family.
select pg_temp.login('00000000-0000-0000-0000-00000000041a');
select public.create_family('The Demanges', 'Gabriel');
insert into tokens select 'eva', public.create_invite();
insert into tokens select 'alex', public.create_invite();
insert into ids select 'james', public.add_managed_member('James');
select pg_temp.login('00000000-0000-0000-0000-00000000041b');
select public.accept_invite((select token from tokens where name = 'eva'), 'Eva');
select pg_temp.login('00000000-0000-0000-0000-00000000041c');
select public.accept_invite((select token from tokens where name = 'alex'), 'Alex');
select pg_temp.login('00000000-0000-0000-0000-00000000041f');
select public.create_family('The Others', 'Sam');
reset role;
insert into ids select 'gabriel', id from public.members where user_id = '00000000-0000-0000-0000-00000000041a';
insert into ids select 'eva', id from public.members where user_id = '00000000-0000-0000-0000-00000000041b';
grant usage on schema extensions to cocon_assistant;
grant execute on all functions in schema extensions to cocon_assistant;

-- Eva's weekly music class for James, from Oct 3, with Oct 31 cancelled and a checklist.
select pg_temp.login('00000000-0000-0000-0000-00000000041b');
insert into ids select 'music', public.save_event(
  '{"title":"Baby music class","starts_on":"2026-10-03","ends_on":"2026-10-03","time_type":"slot","slots":["morning"],"recurrence":{"freq":"weekly","weekdays":[6],"ends":{"type":"never"}}}',
  jsonb_build_array(pg_temp.id('james')), null, null, '[{"label":"Shaker"}]');
insert into public.event_exceptions (event_id, occurrence_date, cancelled) values
  (pg_temp.id('music'), '2026-10-10', true), (pg_temp.id('music'), '2026-10-31', true);

-- Eva's yoga, whose Oct 31 change must stay where it is.
select pg_temp.login('00000000-0000-0000-0000-00000000041b');
insert into ids select 'yoga', public.save_event(
  '{"title":"Yoga","starts_on":"2026-10-03","ends_on":"2026-10-03","time_type":"slot","slots":["evening"],"recurrence":{"freq":"weekly","ends":{"type":"never"}}}',
  jsonb_build_array(pg_temp.id('eva')));
insert into public.event_exceptions (event_id, occurrence_date, cancelled) values (pg_temp.id('yoga'), '2026-10-31', true);

-- Sam can't split it, nor can a signed-out caller or an assistant (writes come with spec 044).
select pg_temp.login('00000000-0000-0000-0000-00000000041f');
select throws_ok($$ select public.split_event(pg_temp.id('music'), '2026-10-24', '{"freq":"weekly","ends":{"type":"on","date":"2026-10-23"}}',
  '{"title":"Mine","starts_on":"2026-10-24","ends_on":"2026-10-24","time_type":"all_day"}', '["everyone"]') $$,
  'P0002', null, 'another family can''t split it');
reset role;
set local role anon;
select throws_ok($$ select public.split_event(pg_temp.id('music'), '2026-10-24', '{}', '{}', '[]') $$, '42501', null, 'nor can someone signed out');
select pg_temp.login('00000000-0000-0000-0000-00000000041a', 'cocon_assistant');
select throws_ok($$ select public.split_event(pg_temp.id('music'), '2026-10-24', '{}', '{}', '[]') $$, '42501', null, 'nor can an assistant');

-- Gabriel can't make Eva's series his own private one, nor overlap the two series.
select pg_temp.login('00000000-0000-0000-0000-00000000041a');
select throws_ok($$ select public.split_event(pg_temp.id('music'), '2026-10-24', '{"freq":"weekly","ends":{"type":"on","date":"2026-10-23"}}',
  '{"title":"Mine","starts_on":"2026-10-24","ends_on":"2026-10-24","time_type":"all_day","visibility":"private"}', '["everyone"]') $$,
  '42501', null, 'only the creator changes who can see the future ones');
select throws_ok($$ select public.split_event(pg_temp.id('music'), '2026-10-24', '{"freq":"weekly","ends":{"type":"on","date":"2026-10-24"}}',
  '{"title":"Mine","starts_on":"2026-10-24","ends_on":"2026-10-24","time_type":"all_day"}', '["everyone"]') $$,
  '22023', null, 'the old series ends before the new one starts');

-- Gabriel moves every class from Oct 24 to the afternoon, with Eva too.
select pg_temp.login('00000000-0000-0000-0000-00000000041a');
insert into ids select 'music2', public.split_event(pg_temp.id('music'), '2026-10-24',
  '{"freq":"weekly","weekdays":[6],"ends":{"type":"on","date":"2026-10-23"}}',
  '{"title":"Baby music class","starts_on":"2026-10-24","ends_on":"2026-10-24","time_type":"slot","slots":["afternoon"],"recurrence":{"freq":"weekly","weekdays":[6],"ends":{"type":"never"}}}',
  jsonb_build_array(pg_temp.id('james'), pg_temp.id('eva')), null,
  (select jsonb_agg(jsonb_build_object('id', id, 'label', label)) from public.event_checklist_items where event_id = pg_temp.id('music')));
select isnt(pg_temp.id('music2'), pg_temp.id('music'), 'a family member splits it into a new series');
select is((select recurrence -> 'ends' from public.events where id = pg_temp.id('music')), '{"type":"on","date":"2026-10-23"}'::jsonb, 'the old one ends the day before');
select is((select slots from public.events where id = pg_temp.id('music')), array['morning'], 'and keeps its time');
select is((select row(starts_on, slots)::text from public.events where id = pg_temp.id('music2')), row('2026-10-24'::date, array['afternoon'])::text, 'the new one starts on the day, with the change');
select is((select count(*)::int from public.event_members where event_id = pg_temp.id('music2')), 2, 'for both members');
select is((select created_by from public.events where id = pg_temp.id('music2')), '00000000-0000-0000-0000-00000000041a'::uuid, 'added by whoever split it');
select is((select array_agg(occurrence_date::text) from public.event_exceptions where event_id = pg_temp.id('music')), array['2026-10-10'], 'earlier cancelled dates stay with the old series');
select is((select array_agg(occurrence_date::text) from public.event_exceptions where event_id = pg_temp.id('music2')), array['2026-10-31'], 'later ones move, so Oct 31 stays cancelled');
select is((select array_agg(label) from public.event_checklist_items where event_id = pg_temp.id('music2')), array['Shaker'], 'the checklist is copied');
select is((select count(*)::int from public.event_checklist_items where event_id = pg_temp.id('music')), 1, 'and stays on the old series');
select is((select array_agg(occurrence_date::text) from public.event_exceptions where event_id = pg_temp.id('yoga')), array['2026-10-31'], 'other events'' exceptions stay put');
select throws_ok($$ select public.split_event(pg_temp.id('music'), '2026-10-03', '{"freq":"weekly","ends":{"type":"never"}}',
  '{"title":"X","starts_on":"2026-10-03","ends_on":"2026-10-03","time_type":"all_day"}', '["everyone"]') $$,
  'P0002', null, 'a split on the first date is refused: that edits the whole series');

-- Eva's private run: Gabriel can't see it, so he can't split it.
select pg_temp.login('00000000-0000-0000-0000-00000000041b');
insert into ids select 'run', public.save_event(
  '{"title":"Run","starts_on":"2026-10-01","ends_on":"2026-10-01","time_type":"slot","slots":["early_morning"],"recurrence":{"freq":"daily","ends":{"type":"never"}},"visibility":"private"}',
  jsonb_build_array(pg_temp.id('eva')));
select pg_temp.login('00000000-0000-0000-0000-00000000041a');
select throws_ok($$ select public.split_event(pg_temp.id('run'), '2026-10-05', '{"freq":"daily","ends":{"type":"on","date":"2026-10-04"}}',
  '{"title":"Run","starts_on":"2026-10-05","ends_on":"2026-10-05","time_type":"all_day"}', '["everyone"]') $$,
  'P0002', null, 'nobody splits a private event they can''t see');

-- Gabriel's weekly surprise lessons for Eva: Eva can't split them, and Alex, who's in on it, can't either.
select pg_temp.login('00000000-0000-0000-0000-00000000041a');
insert into ids select 'lessons', public.save_event(
  '{"title":"Dance lessons for Eva","starts_on":"2026-10-02","ends_on":"2026-10-02","time_type":"slot","slots":["evening"],"recurrence":{"freq":"weekly","ends":{"type":"never"}},"visibility":"surprise"}',
  jsonb_build_array(pg_temp.id('gabriel')), null, jsonb_build_object('hidden_from', jsonb_build_array(pg_temp.id('eva')), 'cover_title', 'Late at work'));
select pg_temp.login('00000000-0000-0000-0000-00000000041b');
select throws_ok($$ select public.split_event(pg_temp.id('lessons'), '2026-10-09', '{"freq":"weekly","ends":{"type":"on","date":"2026-10-08"}}',
  '{"title":"Late at work","starts_on":"2026-10-09","ends_on":"2026-10-09","time_type":"all_day"}', '["everyone"]') $$,
  'P0002', null, 'the person a surprise is kept from can''t split it');
select pg_temp.login('00000000-0000-0000-0000-00000000041c');
select throws_ok($$ select public.split_event(pg_temp.id('lessons'), '2026-10-09', '{"freq":"weekly","ends":{"type":"on","date":"2026-10-08"}}',
  '{"title":"Dance lessons for Eva","starts_on":"2026-10-09","ends_on":"2026-10-09","time_type":"all_day","visibility":"family"}', '["everyone"]') $$,
  '42501', null, 'someone in on it can''t split it into a family event');
select throws_ok($$ select public.split_event(pg_temp.id('lessons'), '2026-10-09', '{"freq":"weekly","ends":{"type":"on","date":"2026-10-08"}}',
  '{"title":"Dance lessons for Eva","starts_on":"2026-10-09","ends_on":"2026-10-09","time_type":"all_day","visibility":"surprise"}', '["everyone"]',
  jsonb_build_object('hidden_from', jsonb_build_array(pg_temp.id('gabriel')), 'cover_title', 'X')) $$,
  '42501', null, 'nor take the surprise over');
select pg_temp.login('00000000-0000-0000-0000-00000000041a');
select isnt((select public.split_event(pg_temp.id('lessons'), '2026-10-09', '{"freq":"weekly","ends":{"type":"on","date":"2026-10-08"}}',
  '{"title":"Dance lessons for Eva","starts_on":"2026-10-09","ends_on":"2026-10-09","time_type":"slot","slots":["afternoon"],"recurrence":{"freq":"weekly","ends":{"type":"never"}},"visibility":"surprise"}',
  jsonb_build_array(pg_temp.id('gabriel')), jsonb_build_object('hidden_from', jsonb_build_array(pg_temp.id('eva')), 'cover_title', 'Late at work'))), null, 'its creator splits it');
select pg_temp.login('00000000-0000-0000-0000-00000000041b');
select is((select count(*)::int from public.events_visible where title = 'Late at work'), 2, 'and Eva still sees only the cover, on both');

-- A deleted series can't be split.
select pg_temp.login('00000000-0000-0000-0000-00000000041b');
update public.events set deleted_at = now() where id = pg_temp.id('run');
select throws_ok($$ select public.split_event(pg_temp.id('run'), '2026-10-05', '{"freq":"daily","ends":{"type":"on","date":"2026-10-04"}}',
  '{"title":"Run","starts_on":"2026-10-05","ends_on":"2026-10-05","time_type":"all_day"}', '["everyone"]') $$,
  'P0002', null, 'nor a deleted one');

-- FR-009: Undo after adding: deleted, then removed for good, so it never reaches Recently deleted.
select pg_temp.login('00000000-0000-0000-0000-00000000041a');
insert into ids select 'poker', public.save_event(
  '{"title":"Poker night","starts_on":"2026-10-28","ends_on":"2026-10-28","time_type":"slot","slots":["evening"]}', jsonb_build_array(pg_temp.id('gabriel')));
select is(pg_temp.affected($$ update public.events set deleted_at = now() where id = pg_temp.id('poker') $$), 1, 'Undo deletes the new event');
select is(pg_temp.affected($$ delete from public.events where id = pg_temp.id('poker') and deleted_at is not null $$), 1, 'then removes it for good');
reset role;
select is((select count(*)::int from public.events where id = pg_temp.id('poker')), 0, 'with nothing left to restore');

select * from finish();
rollback;
