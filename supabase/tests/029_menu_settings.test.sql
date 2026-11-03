-- Spec 029: each member's calendar settings, the family's times of day and home time zone, and
-- deleting the account of a member who joined (FR-013, 032-later L71).
begin;
select plan(46);

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
create temp table ids (name text primary key, id uuid);
create temp table tokens (name text primary key, token text);
grant all on ids, tokens to public;
create function pg_temp.id(n text) returns uuid language sql as $$ select id from ids where name = n $$;
grant execute on function pg_temp.id(text) to public;
-- The default slots with one change.
create function pg_temp.slots(k text, starts text, ends text) returns jsonb language sql as $$
  select '{"early_morning": {"start": "06:00", "end": "09:00"}, "morning": {"start": "09:00", "end": "12:00"},
    "lunch": {"start": "12:00", "end": "14:00"}, "afternoon": {"start": "14:00", "end": "18:00"},
    "evening": {"start": "18:00", "end": "22:00"}}'::jsonb || jsonb_build_object(k, jsonb_build_object('start', starts, 'end', ends))
$$;
grant execute on function pg_temp.slots(text, text, text) to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000029a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000029b', 'eva@example.com'),
  ('00000000-0000-0000-0000-00000000029c', 'alex@example.com'),
  ('00000000-0000-0000-0000-00000000029f', 'sam@example.com');

-- The Demanges: Gabriel (owner), Eva and Alex, who joined. Sam has his own family.
select pg_temp.login('00000000-0000-0000-0000-00000000029a');
select public.create_family('The Demanges', 'Gabriel');
insert into tokens select 'eva', public.create_invite();
insert into tokens select 'alex', public.create_invite();
select pg_temp.login('00000000-0000-0000-0000-00000000029b');
select public.accept_invite((select token from tokens where name = 'eva'), 'Eva');
select pg_temp.login('00000000-0000-0000-0000-00000000029c');
select public.accept_invite((select token from tokens where name = 'alex'), 'Alex');
select pg_temp.login('00000000-0000-0000-0000-00000000029f');
select public.create_family('Sam''s', 'Sam');

-- US5 / SC-002: "For you" settings are each member's own.
select pg_temp.login('00000000-0000-0000-0000-00000000029a');
select lives_ok($$ insert into public.member_calendar_settings (family_id, opens_on) values (public.my_family_id(), 'agenda') $$, 'Gabriel opens on Agenda');
select is((select opens_on from public.member_calendar_settings), 'agenda', 'and reads it back');
select is((select user_id from public.member_calendar_settings), '00000000-0000-0000-0000-00000000029a'::uuid, 'his own row');
select is((select (week_start, time_format, show_birthdays, fade_past, month_hint_seen)::text from public.member_calendar_settings),
  '(automatic,automatic,t,t,f)', 'the rest starts on the defaults');
select is(pg_temp.affected($$ update public.member_calendar_settings set user_id = '00000000-0000-0000-0000-00000000029b' $$), 1, 'an update that tries to hand it over');
select is((select user_id from public.member_calendar_settings), '00000000-0000-0000-0000-00000000029a'::uuid, 'keeps it his');

select pg_temp.login('00000000-0000-0000-0000-00000000029b');
select is((select count(*)::int from public.member_calendar_settings), 0, 'Eva doesn''t see Gabriel''s settings');
select is(pg_temp.affected($$ update public.member_calendar_settings set opens_on = 'week' $$), 0, 'nor change them');
select throws_ok($$ insert into public.member_calendar_settings (family_id, user_id, opens_on) values (public.my_family_id(), '00000000-0000-0000-0000-00000000029a', 'day') $$,
  '42501', null, 'nor write a row for him');
select lives_ok($$ insert into public.member_calendar_settings (family_id, opens_on) values (public.my_family_id(), 'week') $$, 'her own Week');
select throws_ok($$ delete from public.member_calendar_settings $$, '42501', null, 'nobody deletes a row');
select throws_ok($$ insert into public.member_calendar_settings (family_id, opens_on) values (public.my_family_id(), 'year') $$, '23514', null, 'only the four views');

select pg_temp.login('00000000-0000-0000-0000-00000000029a');
select is((select opens_on from public.member_calendar_settings), 'agenda', 'Gabriel''s view hasn''t changed');
select pg_temp.login('00000000-0000-0000-0000-00000000029f');
select is((select count(*)::int from public.member_calendar_settings), 0, 'another family sees none');
select pg_temp.login(null);
select throws_ok($$ select * from public.member_calendar_settings $$, '42501', null, 'signed out: nothing');

-- US6: the owner changes the times of day; events already on them keep their hours.
select pg_temp.login('00000000-0000-0000-0000-00000000029b');
insert into ids select 'dinner', public.save_event(
  '{"title":"Dinner","starts_on":"2026-11-10","ends_on":"2026-11-10","time_type":"slot","slots":["evening"]}', '["everyone"]');
insert into ids select 'walk', public.save_event(
  '{"title":"Walk","starts_on":"2026-11-10","ends_on":"2026-11-10","time_type":"slot","slots":["afternoon","evening"]}', '["everyone"]');
insert into ids select 'brunch', public.save_event(
  '{"title":"Brunch","starts_on":"2026-11-10","ends_on":"2026-11-10","time_type":"slot","slots":["morning"],"recurrence":{"freq":"weekly","ends":{"type":"never"}}}', '["everyone"]');
insert into public.event_exceptions (event_id, occurrence_date, override) values (pg_temp.id('brunch'), '2026-11-17', '{"slots":["evening"]}');
insert into ids select 'lunch', public.save_event(
  '{"title":"Lunch","starts_on":"2026-11-10","ends_on":"2026-11-10","time_type":"slot","slots":["lunch"]}', '["everyone"]');

select throws_ok($$ select public.set_slot_times(pg_temp.slots('evening', '18:30', '22:00')) $$, '42501', 'not_owner', 'only the owner changes them');
select pg_temp.login('00000000-0000-0000-0000-00000000029f');
insert into ids select 'sams', public.save_event(
  '{"title":"Sam dinner","starts_on":"2026-11-10","ends_on":"2026-11-10","time_type":"slot","slots":["evening"]}', '["everyone"]');
select pg_temp.login('00000000-0000-0000-0000-00000000029a');
select throws_ok($$ select public.set_slot_times(pg_temp.slots('evening', '18:30', '22:00')) $$, '22023', 'slots_overlap', 'Evening has to start when Afternoon ends');
select throws_ok($$ select public.set_slot_times(pg_temp.slots('evening', '18:00', '17:00')) $$, '22023', 'slots_overlap', 'a slot ends after it starts');
select throws_ok($$ select public.set_slot_times(pg_temp.slots('lunch', '12:00', '14:00') - 'lunch') $$, '22023', 'slots_overlap', 'all five slots');
select throws_ok($$ select public.set_slot_times(pg_temp.slots('lunch', '12:00', '14:00') || '{"night": {"start": "22:00", "end": "24:00"}}') $$, '22023', 'slots_overlap', 'and no others');
select throws_ok($$ select public.set_slot_times(pg_temp.slots('lunch', '12:00', '14:00') || '{"lunch": {"start": "12:00", "end": "14:00", "note": "x"}}') $$, '22023', 'slots_overlap', 'a slot holds only its start and end');
select is(public.set_slot_times(pg_temp.slots('evening', '18:30', '22:00') || '{"afternoon": {"start": "14:00", "end": "18:30"}}'), 3,
  'Gabriel moves Evening to 18:30: three events and one exception pinned');
select is((select slot_times -> 'evening' from public.family_calendar_settings), '{"start": "18:30", "end": "22:00"}'::jsonb, 'saved for the family');
select is((select (time_type, start_time, end_time, slots)::text from public.events where id = pg_temp.id('dinner')), '(custom,18:00,22:00,{})', 'Dinner keeps 18:00–22:00');
select is((select (time_type, start_time, end_time)::text from public.events where id = pg_temp.id('walk')), '(custom,14:00,22:00)', 'the Walk keeps 14:00–22:00');
select is((select (time_type, slots)::text from public.events where id = pg_temp.id('lunch')), '(slot,{lunch})', 'Lunch didn''t change, so it stays a slot');
select is((select (time_type, slots)::text from public.events where id = pg_temp.id('brunch')), '(slot,{morning})', 'nor does the Brunch series');
reset role;
select is((select (time_type, slots)::text from public.events where id = pg_temp.id('sams')), '(slot,{evening})', 'another family''s events are left alone');
select pg_temp.login('00000000-0000-0000-0000-00000000029a');
select is((select override from public.event_exceptions where event_id = pg_temp.id('brunch')),
  '{"slots": [], "end_time": "22:00", "time_type": "custom", "start_time": "18:00"}'::jsonb, 'but its evening exception keeps 18:00–22:00');
select is(public.set_slot_times(pg_temp.slots('evening', '18:30', '22:00') || '{"afternoon": {"start": "14:00", "end": "18:30"}}'), 0, 'saving the same times pins nothing');
select throws_ok($$ update public.family_calendar_settings set slot_times = null $$, '42501', null, 'slot times change only through set_slot_times');

-- FR-010: the home time zone.
select lives_ok($$ select public.set_home_time_zone('America/New_York') $$, 'the owner sets the home time zone');
select is((select home_time_zone from public.family_calendar_settings), 'America/New_York', 'saved');
select throws_ok($$ select public.set_home_time_zone('Mars/Base') $$, '22023', 'unknown_time_zone', 'a real time zone only');
select pg_temp.login('00000000-0000-0000-0000-00000000029b');
select throws_ok($$ select public.set_home_time_zone('Europe/Paris') $$, '42501', 'not_owner', 'Eva can''t');
select is(pg_temp.affected($$ update public.family_calendar_settings set home_time_zone = 'Europe/Paris' $$), 0, 'nor directly');

-- The leaving flag alone skips nothing: Eva sets it for herself, and her writes are still stamped.
insert into public.recipes (name) values ('Eva''s tart');
insert into ids select 'tart', id from public.recipes where name = 'Eva''s tart';
select public.share_recipe(pg_temp.id('tart'));
insert into ids select 'tartlink', id from public.share_links where recipe_id = pg_temp.id('tart');
update public.share_links set stopped_at = now() where id = pg_temp.id('tartlink');
select set_config('cocon.leaving', '00000000-0000-0000-0000-00000000029b', true);
select throws_ok($$ update public.share_links set include_tips = false where id = pg_temp.id('tartlink') $$, 'P0001', 'link_stopped', 'a stopped link stays stopped');
update public.recipes set updated_by = null, name = 'Eva''s pear tart' where id = pg_temp.id('tart');
select is((select updated_by from public.recipes where id = pg_temp.id('tart')), '00000000-0000-0000-0000-00000000029b'::uuid, 'and her change is still hers');
select set_config('cocon.leaving', '', true);

-- SC-004: Alex, who joined by invite, deletes his account; what he made stays with the family.
select pg_temp.login('00000000-0000-0000-0000-00000000029c');
insert into public.recipes (name) values ('Alex''s soup');
insert into public.grocery_items (name) values ('onion');
update public.grocery_items set checked = true;
insert into ids select 'swim', public.save_event('{"title":"Swim","starts_on":"2026-11-03","ends_on":"2026-11-03","time_type":"all_day"}', '["everyone"]', null, null, '[{"label":"Towel"}]');
update public.event_checklist_items set done = true;
insert into public.member_calendar_settings (family_id) values (public.my_family_id());
insert into ids select 'soup', id from public.recipes where name = 'Alex''s soup';
select public.share_recipe(pg_temp.id('soup'));
insert into ids select 'souplink', id from public.share_links where recipe_id = pg_temp.id('soup');
update public.share_links set stopped_at = now() where id = pg_temp.id('souplink');
select public.set_display_name('Alex D');
select lives_ok($$ select public.delete_my_account() $$, 'Alex deletes his account');
reset role;
select is((select created_by from public.recipes where name = 'Alex''s soup'), null, 'his recipe stays, by a former member');
select is((select (created_by, checked_by)::text from public.grocery_items where name = 'onion'), '(,)', 'and his ticked grocery');
select is((select created_by from public.events where id = pg_temp.id('swim')), null, 'and his event');
select is((select (created_by, stopped_by, stopped_at is not null)::text from public.share_links where id = pg_temp.id('souplink')), '(,,t)', 'his stopped share link stays stopped, by a former member');
select is((select count(*)::int from public.member_calendar_settings where user_id = '00000000-0000-0000-0000-00000000029c'), 0, 'his calendar settings go with him');

-- Grants.
select ok(has_function_privilege('authenticated', 'public.set_slot_times(jsonb)', 'execute')
  and has_function_privilege('authenticated', 'public.set_home_time_zone(text)', 'execute'), 'members call the setters');
select ok(not has_function_privilege('anon', 'public.set_slot_times(jsonb)', 'execute')
  and not has_function_privilege('cocon_assistant', 'public.set_home_time_zone(text)', 'execute'), 'signed-out people and assistants don''t');

select * from finish();
rollback;
