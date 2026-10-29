-- Spec 035: events, privacy in the database (US2, FR-002) for the app's role and an assistant's
-- token, live tables (FR-003), soft delete, calendar settings, and removing a member without the
-- app (032-later L78).
begin;
select plan(91);

-- As `r` (null: signed out) with the claims an access token carries (`client`: an assistant's).
create function pg_temp.login(uid uuid, r text default 'authenticated', client text default null) returns void language plpgsql as $$
begin
  reset role;
  if uid is null then
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims',
      jsonb_strip_nulls(jsonb_build_object('sub', uid, 'role', r, 'client_id', client))::text, true);
    execute format('set local role %I', r);
  end if;
end;
$$;
grant execute on function pg_temp.login(uuid, text, text) to public;
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
grant usage on schema extensions to cocon_assistant;
grant execute on all functions in schema extensions to cocon_assistant;
create temp table ids (name text primary key, id uuid);
create temp table tokens (name text primary key, token text);
grant all on ids, tokens to public;
-- save_event with the event first, as the tests read best.
create function pg_temp.save(id uuid, e jsonb, m jsonb, s jsonb default null, c jsonb default null) returns uuid language sql as $$
  select public.save_event(e, m, id, s, c)
$$;
grant execute on function pg_temp.save(uuid, jsonb, jsonb, jsonb, jsonb) to public;
create function pg_temp.id(n text) returns uuid language sql as $$ select id from ids where name = n $$;
grant execute on function pg_temp.id(text) to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000035a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000035b', 'eva@example.com'),
  ('00000000-0000-0000-0000-00000000035c', 'alex@example.com'),
  ('00000000-0000-0000-0000-00000000035f', 'sam@example.com');

-- The Demanges: Gabriel (owner), Eva, Alex, and James without the app. Sam is in another family.
select pg_temp.login('00000000-0000-0000-0000-00000000035a');
select public.create_family('The Demanges', 'Gabriel');
insert into tokens select 'eva', public.create_invite();
insert into tokens select 'alex', public.create_invite();
insert into ids select 'james', public.add_managed_member('James');
select pg_temp.login('00000000-0000-0000-0000-00000000035b');
select public.accept_invite((select token from tokens where name = 'eva'), 'Eva');
select pg_temp.login('00000000-0000-0000-0000-00000000035c');
select public.accept_invite((select token from tokens where name = 'alex'), 'Alex');
select pg_temp.login('00000000-0000-0000-0000-00000000035f');
select public.create_family('The Others', 'Sam');
reset role;
insert into ids select 'gabriel', id from public.members where user_id = '00000000-0000-0000-0000-00000000035a';
insert into ids select 'eva', id from public.members where user_id = '00000000-0000-0000-0000-00000000035b';
insert into ids select 'alex', id from public.members where user_id = '00000000-0000-0000-0000-00000000035c';

-- Eva's private yoga, with a place, notes, a checklist and one moved occurrence.
select pg_temp.login('00000000-0000-0000-0000-00000000035b');
insert into ids select 'yoga', pg_temp.save(null,
  '{"title":"Yoga","category":"sport","location":"Studio 4","notes":"Mat","starts_on":"2026-11-03","ends_on":"2026-11-03","time_type":"slot","slots":["evening"],"recurrence":{"freq":"weekly","ends":{"type":"never"}},"visibility":"private"}',
  jsonb_build_array(pg_temp.id('eva')), null, '[{"label":"Towel"}]');
insert into public.event_exceptions (event_id, occurrence_date, override)
  values (pg_temp.id('yoga'), '2026-11-10', '{"title":"Yoga with Lou","notes":"Bring Lou","starts_on":"2026-11-11","ends_on":"2026-11-11"}');
select is((select title from public.events_visible where id = pg_temp.id('yoga')), 'Yoga', 'Eva sees her private event in full');
select is((select jsonb_array_length(checklist) from public.events_visible where id = pg_temp.id('yoga')), 1, 'with its checklist');
select is((select exceptions -> 0 -> 'override' ->> 'title' from public.events_visible where id = pg_temp.id('yoga')), 'Yoga with Lou', 'and its exceptions');
select is((select source from public.events where id = pg_temp.id('yoga')), 'app', 'every write records how it came (FR-004)');
select is((select created_by from public.events where id = pg_temp.id('yoga')), '00000000-0000-0000-0000-00000000035b'::uuid, 'and who made it');

-- Gabriel's surprise dinner, kept from Eva, and a family event for James.
select pg_temp.login('00000000-0000-0000-0000-00000000035a');
insert into ids select 'dinner', pg_temp.save(null,
  '{"title":"Eva''s birthday dinner","category":"social","location":"Café Lalo","notes":"Book the window table","starts_on":"2026-11-14","ends_on":"2026-11-14","time_type":"custom","start_time":"19:30","end_time":"22:30","visibility":"surprise"}',
  jsonb_build_array('everyone'),
  jsonb_build_object('hidden_from', jsonb_build_array(pg_temp.id('eva')), 'cover_title', 'Dinner out', 'cover_note', 'Meet at Café Lalo at 19:30. Dress nice!'),
  '[{"label":"Cake"}]');
insert into public.event_exceptions (event_id, occurrence_date, override)
  values (pg_temp.id('dinner'), '2026-11-14', '{"title":"Eva''s 40th","location":"Chez Lou","notes":"Shh"}');

-- US2, private: Gabriel only ever gets "Busy" with Eva's member, day and time.
select is((select count(*)::int from public.events where id = pg_temp.id('yoga')), 0, 'the events table hides Eva''s private event from Gabriel');
select is((select title from public.events_visible where id = pg_temp.id('yoga')), 'Busy', 'the view says Busy');
-- A repeat reaches Busy viewers with its known keys only, whatever else was written into it.
reset role;
update public.events set recurrence = recurrence || '{"secret":"Lou"}' where id = pg_temp.id('yoga');
select pg_temp.login('00000000-0000-0000-0000-00000000035a');
select is((select recurrence from public.events_visible where id = pg_temp.id('yoga')), '{"freq":"weekly","ends":{"type":"never"}}'::jsonb, 'its repeat, and nothing else in it');
select is((select row(location, notes, category, reminder, responsible_member_id::text, checklist::text, surprise::text)::text
  from public.events_visible where id = pg_temp.id('yoga')), '(,,,,,,)', 'no place, notes, type, reminder, who takes them or checklist');
select is((select members from public.events_visible where id = pg_temp.id('yoga')), jsonb_build_array(pg_temp.id('eva')), 'Eva''s member, for her color');
select is((select row(starts_on, slots, visibility, creator_member_id)::text from public.events_visible where id = pg_temp.id('yoga')),
  row('2026-11-03'::date, array['evening'], 'private', pg_temp.id('eva'))::text, 'the day, the slot, private, and its creator');
select is((select exceptions -> 0 -> 'override' from public.events_visible where id = pg_temp.id('yoga')),
  '{"starts_on":"2026-11-11","ends_on":"2026-11-11"}'::jsonb, 'a moved occurrence keeps only its new time');
select is((select count(*)::int from public.event_checklist_items i where i.event_id = pg_temp.id('yoga')), 0, 'its checklist is hidden');
select is((select count(*)::int from public.event_exceptions x where x.event_id = pg_temp.id('yoga')), 0, 'and its exceptions');
select is((select count(*)::int from public.event_members m where m.event_id = pg_temp.id('yoga')), 1, 'who it''s for is not');
select is(pg_temp.affected($$ update public.events set title = 'Mine' where id = pg_temp.id('yoga') $$), 0, 'Gabriel can''t change it');
select is(pg_temp.affected($$ delete from public.event_members m where m.event_id = pg_temp.id('yoga') $$), 0, 'or who it''s for');
select throws_ok($$ insert into public.event_checklist_items (event_id, family_id, position, label) values (pg_temp.id('yoga'), public.my_family_id(), 1, 'X') $$,
  '42501', null, 'or add to its checklist');

-- The same through an assistant acting for Gabriel (MCP token).
select pg_temp.login('00000000-0000-0000-0000-00000000035a', 'cocon_assistant', 'c1');
select is((select title from public.events_visible where id = pg_temp.id('yoga')), 'Busy', 'Gabriel''s assistant gets Busy');
select is((select row(location, notes, checklist::text)::text from public.events_visible where id = pg_temp.id('yoga')), '(,,)', 'and no details');
select is((select title from public.events_visible where id = pg_temp.id('dinner')), 'Eva''s birthday dinner', 'it sees what Gabriel sees in full');
-- Since spec 044 it saves events, so it reads their tables too, through Gabriel's own policies.
select is((select count(*)::int from public.events where id = pg_temp.id('yoga')), 0, 'the tables never show it a private event past the view');
select is((select count(*)::int from public.event_checklist_items c where c.event_id = pg_temp.id('yoga')), 0, 'nor its checklist');
select throws_ok($$ delete from public.events $$, '42501', null, 'and it never removes an event for good');

-- Surprise: Eva gets the cover, read as a family event, and nothing else.
select pg_temp.login('00000000-0000-0000-0000-00000000035b');
select is((select row(title, notes, location, visibility)::text from public.events_visible where id = pg_temp.id('dinner')),
  row('Dinner out', 'Meet at Café Lalo at 19:30. Dress nice!', 'Café Lalo', 'family')::text, 'Eva sees the cover title, note, place, as a family event');
select is((select row(category, reminder, responsible_member_id::text, checklist::text, surprise::text)::text from public.events_visible where id = pg_temp.id('dinner')),
  '(,none,,[],)', 'and no type, reminder, checklist or surprise details, shaped like a family event');
select is((select row(start_time, end_time, members::text)::text from public.events_visible where id = pg_temp.id('dinner')),
  '(19:30,22:30,"[""everyone""]")', 'with the time and who it''s for');
select is((select exceptions -> 0 -> 'override' from public.events_visible where id = pg_temp.id('dinner')),
  '{"location":"Chez Lou"}'::jsonb, 'an exception keeps only what the cover shows');
select is((select count(*)::int from public.events where id = pg_temp.id('dinner')), 0, 'the events table hides it from her');
select is((select count(*)::int from public.event_surprise), 0, 'and every surprise');
select is((select count(*)::int from public.event_checklist_items i where i.event_id = pg_temp.id('dinner')), 0, 'and its checklist');
select is(pg_temp.affected($$ update public.events set title = 'Hm' where id = pg_temp.id('dinner') $$), 0, 'she can''t change it');
select is(pg_temp.affected($$ update public.events set deleted_at = now() where id = pg_temp.id('dinner') $$), 0, 'or delete it');
select pg_temp.login('00000000-0000-0000-0000-00000000035b', 'cocon_assistant', 'c1');
select is((select row(title, visibility, surprise::text)::text from public.events_visible where id = pg_temp.id('dinner')),
  '("Dinner out",family,)', 'Eva''s assistant gets only the cover too');

-- Alex is in on it.
select pg_temp.login('00000000-0000-0000-0000-00000000035c');
select is((select row(title, visibility, surprise ->> 'cover_title')::text from public.events_visible where id = pg_temp.id('dinner')),
  '("Eva''s birthday dinner",surprise,"Dinner out")', 'Alex sees the real event, tagged surprise');
select is((select count(*)::int from public.event_surprise), 1, 'and its surprise');
select throws_ok($$ update public.events set visibility = 'family' where id = pg_temp.id('dinner') $$,
  '42501', 'only_creator_changes_visibility', 'only the creator changes who can see it');
select is(pg_temp.affected($$ update public.event_surprise set hidden_from = '{}' $$), 0, 'or the surprise');
select lives_ok($$ update public.event_checklist_items set done = true where event_id = pg_temp.id('dinner') $$, 'Alex ticks the cake');
select is((select done_by from public.event_checklist_items where event_id = pg_temp.id('dinner')), pg_temp.id('alex'), 'and the database says he did');
select lives_ok($$ update public.event_checklist_items set done = false, done_by = pg_temp.id('gabriel') where event_id = pg_temp.id('dinner') $$, 'unticked');
select is((select done_by from public.event_checklist_items where event_id = pg_temp.id('dinner')), null, 'nobody ticked it');
select throws_ok($$ insert into public.event_exceptions (event_id, family_id, occurrence_date, override) values (pg_temp.id('dinner'), public.my_family_id(), '2026-11-14', '{"visibility":"family"}') $$,
  '23514', null, 'an exception can''t change who can see it');

-- Setting up a surprise.
select pg_temp.login('00000000-0000-0000-0000-00000000035a');
select throws_ok(format($$ update public.event_surprise set hidden_from = array['%s'::uuid] $$, pg_temp.id('james')),
  '23514', 'hidden_from_needs_app', 'a surprise is kept from people with the app');
select throws_ok(format($$ update public.event_surprise set hidden_from = array['%s'::uuid] $$, pg_temp.id('gabriel')),
  '23514', 'hidden_from_creator', 'never from its creator');
select throws_ok(format($$ select pg_temp.save(null, '{"title":"X","starts_on":"2026-11-01","ends_on":"2026-11-01","time_type":"all_day","responsible_member_id":"%s"}', '["everyone"]') $$, pg_temp.id('james')),
  '23514', 'responsible_needs_app', 'whoever takes them has the app');
select throws_ok($$ select pg_temp.save(null, '{"title":"X","starts_on":"2026-11-01","ends_on":"2026-11-01","time_type":"all_day"}', '[]') $$,
  '22023', 'members_needed', 'an event is for someone');
select throws_ok($$ select pg_temp.save(null, '{"title":"X","starts_on":"2026-11-02","ends_on":"2026-11-01","time_type":"all_day"}', '["everyone"]') $$,
  '23514', null, 'it can''t end before it starts');
select throws_ok($$ select pg_temp.save(null, '{"title":"X","starts_on":"2026-11-01","ends_on":"2026-11-01","time_type":"slot"}', '["everyone"]') $$,
  '23514', null, 'a slot event has a slot');
-- Turning it into a family event drops its surprise.
select lives_ok(format($$ select pg_temp.save('%s', '{"title":"Eva''s birthday dinner","starts_on":"2026-11-14","ends_on":"2026-11-14","time_type":"all_day","visibility":"family"}', '["everyone"]') $$, pg_temp.id('dinner')),
  'Gabriel makes it a family event');
select is((select count(*)::int from public.event_surprise), 0, 'and its surprise goes');
select is((select jsonb_array_length(checklist) from public.events_visible where id = pg_temp.id('dinner')), 1, 'a null checklist is left as it is');

-- Another family, and signed-out people, see nothing.
select pg_temp.login('00000000-0000-0000-0000-00000000035f');
select is((select count(*)::int from public.events_visible), 0, 'Sam sees no Demange event');
select is(public._sees_event(pg_temp.id('dinner')) or public._created_event(pg_temp.id('dinner')), false, 'and can''t ask about one');
select is((select count(*)::int from public.events) + (select count(*)::int from public.event_members) + (select count(*)::int from public.event_exceptions)
  + (select count(*)::int from public.event_checklist_items) + (select count(*)::int from public.event_surprise)
  + (select count(*)::int from public.family_calendar_settings), 0, 'nor any of their rows');
select throws_ok(format($$ select pg_temp.save('%s', '{"title":"Mine","starts_on":"2026-11-01","ends_on":"2026-11-01","time_type":"all_day"}', '["everyone"]') $$, pg_temp.id('dinner')),
  'P0002', 'event_not_found', 'nor change them');
select pg_temp.login(null);
select throws_ok($$ select * from public.events_visible $$, '42501', null, 'signed out: no view');
select throws_ok($$ select * from public.events $$, '42501', null, 'and no table');
select throws_ok($$ select * from public.family_calendar_settings $$, '42501', null, 'and no settings');

-- FR-003: exactly these tables are live.
reset role;
select is((select array_agg(tgrelid::regclass::text order by tgrelid::regclass::text) from pg_trigger
  where tgname like '%\_broadcast' and tgrelid::regclass::text in ('events', 'event_members', 'event_exceptions', 'event_checklist_items', 'event_surprise', 'family_calendar_settings')),
  array['event_checklist_items', 'event_exceptions', 'event_members', 'events'], 'events, members, exceptions and checklists are live');
select ok(not has_function_privilege('anon', 'public.save_event(jsonb, jsonb, uuid, jsonb, jsonb)', 'execute'), 'signed out: no saving');
select ok(not has_function_privilege('authenticated', 'public.purge_deleted_events()', 'execute'), 'members can''t purge');
select ok(not has_function_privilege('cocon_assistant', 'public.claim_home_time_zone(text)', 'execute'), 'assistants don''t set the time zone');

-- Calendar settings: the first device sets the time zone; then only the owner changes things.
select pg_temp.login('00000000-0000-0000-0000-00000000035b');
select throws_ok($$ select public.claim_home_time_zone('Mars/Olympus') $$, '22023', 'unknown_time_zone', 'a time zone must exist');
select lives_ok($$ select public.claim_home_time_zone('Europe/Paris') $$, 'Eva''s device sets the home time zone');
select pg_temp.login('00000000-0000-0000-0000-00000000035a');
select lives_ok($$ select public.claim_home_time_zone('America/New_York') $$, 'a second device');
select is((select home_time_zone from public.family_calendar_settings), 'Europe/Paris', 'doesn''t change it');
select pg_temp.login('00000000-0000-0000-0000-00000000035b');
select is(pg_temp.affected($$ update public.family_calendar_settings set home_time_zone = 'UTC' $$), 0, 'Eva can''t change it');
select pg_temp.login('00000000-0000-0000-0000-00000000035a', 'cocon_assistant', 'c1');
select is((select home_time_zone from public.family_calendar_settings), 'Europe/Paris', 'assistants read it');
select pg_temp.login('00000000-0000-0000-0000-00000000035a');
select is(pg_temp.affected($$ update public.family_calendar_settings set home_time_zone = 'America/New_York' $$), 1, 'the owner can');

-- Delete and restore (spec 018): exceptions and the repeat come back.
select pg_temp.login('00000000-0000-0000-0000-00000000035b');
select is(pg_temp.affected($$ delete from public.events where id = pg_temp.id('yoga') $$), 0, 'an event is removed for good only from Recently deleted');
select is(pg_temp.affected($$ update public.events set deleted_at = now() where id = pg_temp.id('yoga') $$), 1, 'Eva deletes her yoga');
select is((select deleted_by from public.events where id = pg_temp.id('yoga')), '00000000-0000-0000-0000-00000000035b'::uuid, 'the database records who');
select is(pg_temp.affected($$ update public.events set deleted_at = null where id = pg_temp.id('yoga') $$), 1, 'and she restores it');
select is((select row(recurrence ->> 'freq', jsonb_array_length(exceptions))::text from public.events_visible where id = pg_temp.id('yoga')),
  '(weekly,1)', 'with its repeat and its exceptions');
reset role;
select set_config('request.jwt.claims', '', true);
update public.events set deleted_at = now() - interval '31 days' where id = pg_temp.id('yoga');
select pg_temp.login('00000000-0000-0000-0000-00000000035b');
select throws_ok($$ update public.events set deleted_at = null where id = pg_temp.id('yoga') $$,
  '22023', 'This event was deleted more than 30 days ago', 'after 30 days it can''t be restored');
reset role;
select is(public.purge_deleted_events(), 1, 'the nightly job removes it');
select is((select count(*)::int from public.event_exceptions where event_id = pg_temp.id('yoga')), 0, 'with its exceptions');

-- L78: James has football every Saturday, a class with Eva next week, and a party last year.
select pg_temp.login('00000000-0000-0000-0000-00000000035a');
insert into ids select 'football', pg_temp.save(null,
  '{"title":"Football","starts_on":"2026-01-03","ends_on":"2026-01-03","time_type":"slot","slots":["morning"],"recurrence":{"freq":"weekly","ends":{"type":"never"}}}',
  jsonb_build_array(pg_temp.id('james'), 'others'));
insert into ids select 'class', pg_temp.save(null,
  format('{"title":"Music class","starts_on":"%s","ends_on":"%s","time_type":"slot","slots":["morning"]}', current_date + 7, current_date + 7)::jsonb,
  jsonb_build_array(pg_temp.id('james'), pg_temp.id('eva')));
insert into ids select 'party', pg_temp.save(null,
  '{"title":"Party","starts_on":"2025-06-01","ends_on":"2025-06-01","time_type":"all_day"}', jsonb_build_array(pg_temp.id('james')));
select is(public.managed_member_upcoming_events(pg_temp.id('james')), 2, 'two upcoming events for the Remove dialog');
select throws_ok(format($$ select public.managed_member_upcoming_events('%s') $$, pg_temp.id('eva')), 'P0001', 'not_managed', 'only for members without the app');
select lives_ok(format($$ select public.remove_managed_member('%s') $$, pg_temp.id('james')), 'Gabriel removes James');
select is((select array_agg(m order by m) from public.events_visible, jsonb_array_elements_text(members) m where id = pg_temp.id('football')), array['everyone', 'others'], 'football was his alone: it goes to Everyone');
select is((select members from public.events_visible where id = pg_temp.id('class')), jsonb_build_array(pg_temp.id('eva')), 'the class stays Eva''s');
select is((select row(members::text, removed_members::text)::text from public.events_visible where id = pg_temp.id('party')),
  '([],"[""James""]")', 'the past party keeps him, by name');

-- Members who leave with an account keep their past events too; a deleted family takes everything.
-- Alex's surprise for Eva, before Alex leaves the family.
select pg_temp.login('00000000-0000-0000-0000-00000000035c');
insert into ids select 'gift', pg_temp.save(null, '{"title":"Gift shopping","starts_on":"2026-11-20","ends_on":"2026-11-20","time_type":"all_day","visibility":"surprise"}',
  '["everyone"]', jsonb_build_object('hidden_from', jsonb_build_array(pg_temp.id('eva')), 'cover_title', 'Errands'));
select pg_temp.login('00000000-0000-0000-0000-00000000035a');
insert into ids select 'tennis', pg_temp.save(null, '{"title":"Tennis","starts_on":"2025-05-01","ends_on":"2025-05-01","time_type":"all_day"}', jsonb_build_array(pg_temp.id('alex')));
select lives_ok($$ select public.remove_member('00000000-0000-0000-0000-00000000035c') $$, 'Gabriel removes Alex');
select is((select removed_members from public.events_visible where id = pg_temp.id('tennis')), '["Alex"]'::jsonb, 'Alex''s tennis keeps the name');
select is((select title from public.events_visible where id = pg_temp.id('gift')), 'Busy', 'once Alex has left, the surprise is Busy to Gabriel');
select is((select count(*)::int from public.events where id = pg_temp.id('gift')), 0, 'in the tables too');
select pg_temp.login('00000000-0000-0000-0000-00000000035b');
select is((select row(title, visibility)::text from public.events_visible where id = pg_temp.id('gift')), '(Errands,family)', 'and Eva still gets only the cover');
select pg_temp.login('00000000-0000-0000-0000-00000000035a');
select pg_temp.login('00000000-0000-0000-0000-00000000035f');
select pg_temp.save(null, '{"title":"Run","starts_on":"2026-11-01","ends_on":"2026-11-01","time_type":"all_day"}', '["everyone"]');
select lives_ok($$ select public.delete_family() $$, 'Sam deletes the family, events and all');
reset role;
select is((select count(*)::int from public.events where title = 'Run'), 0, 'nothing of it is left');

select * from finish();
rollback;
