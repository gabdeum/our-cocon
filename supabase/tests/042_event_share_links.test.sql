-- Spec 042 FR-005: one event date shared as a view-only link, made by the database. The share
-- endpoint (service role) reads only the title, day, time, place and first names, and nothing
-- once the link stops, the event is deleted, private or a surprise, that date is cancelled, or it's over.
begin;
select plan(34);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  reset role;
  if uid is null then
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
    set local role authenticated;
  end if;
end;
$$;
grant execute on function pg_temp.login(uuid) to public;
create function pg_temp.as_endpoint() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role service_role;
end;
$$;
grant execute on function pg_temp.as_endpoint() to public;
create temp table ids (name text primary key, id uuid);
create temp table tokens (name text primary key, token text);
grant all on ids, tokens to public;
create function pg_temp.id(n text) returns uuid language sql as $$ select id from ids where name = n $$;
grant execute on function pg_temp.id(text) to public;
create function pg_temp.token(n text) returns text language sql as $$ select token from tokens where name = n $$;
grant execute on function pg_temp.token(text) to public;
-- A date `n` days from today, as text for event JSON.
create function pg_temp.day(n integer) returns text language sql as $$ select to_char(current_date + n, 'YYYY-MM-DD') $$;
grant execute on function pg_temp.day(integer) to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000042a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000042b', 'eva@example.com'),
  ('00000000-0000-0000-0000-00000000042f', 'sam@example.com');

-- The Demanges: Gabriel, Eva Martin, and James Demange without the app. Sam is in another family.
select pg_temp.login('00000000-0000-0000-0000-00000000042a');
select public.create_family('The Demanges', 'Gabriel');
insert into tokens select 'eva', public.create_invite();
insert into ids select 'james', public.add_managed_member('James Demange');
select pg_temp.login('00000000-0000-0000-0000-00000000042b');
select public.accept_invite(pg_temp.token('eva'), 'Eva Martin');
select pg_temp.login('00000000-0000-0000-0000-00000000042f');
select public.create_family('The Others', 'Sam');
reset role;
insert into ids select 'gabriel', id from public.members where user_id = '00000000-0000-0000-0000-00000000042a';
insert into ids select 'eva', id from public.members where user_id = '00000000-0000-0000-0000-00000000042b';

-- Eva's weekly music class for James and Eva, starting in a week, with notes, a reminder, a driver
-- and a checklist; a one-off swim that ended last week; a private and a surprise event.
select pg_temp.login('00000000-0000-0000-0000-00000000042b');
insert into ids select 'music', public.save_event(
  jsonb_build_object('title', 'Baby music class', 'location', 'Little Notes studio', 'notes', 'Gate code 1234',
    'starts_on', pg_temp.day(7), 'ends_on', pg_temp.day(7), 'time_type', 'slot', 'slots', jsonb_build_array('morning'),
    'reminder', 'hour_before', 'responsible_member_id', pg_temp.id('gabriel'),
    'recurrence', '{"freq":"weekly","ends":{"type":"never"}}'::jsonb),
  jsonb_build_array(pg_temp.id('james'), pg_temp.id('eva'), 'others'), null, null, '[{"label":"Shaker"}]');
insert into ids select 'swim', public.save_event(
  jsonb_build_object('title', 'Swim', 'starts_on', pg_temp.day(-7), 'ends_on', pg_temp.day(-7), 'time_type', 'all_day'),
  jsonb_build_array('everyone'));
insert into ids select 'diary', public.save_event(
  jsonb_build_object('title', 'Therapy', 'starts_on', pg_temp.day(7), 'ends_on', pg_temp.day(7), 'time_type', 'all_day', 'visibility', 'private'),
  jsonb_build_array(pg_temp.id('eva')));
insert into ids select 'party', public.save_event(
  jsonb_build_object('title', 'Gabriel''s party', 'starts_on', pg_temp.day(7), 'ends_on', pg_temp.day(7), 'time_type', 'all_day', 'visibility', 'surprise'),
  jsonb_build_array('everyone'), null,
  jsonb_build_object('hidden_from', jsonb_build_array(pg_temp.id('gabriel')), 'cover_title', 'Dinner out'));

-- The database makes the token; asking again returns the same link; one per event date.
insert into tokens select 'music', token from public.share_event(pg_temp.id('music'), current_date + 7);
select ok(pg_temp.token('music') ~ '^[A-Za-z0-9_-]{43}$', 'a 256-bit base64url token');
select is((select created from public.share_event(pg_temp.id('music'), current_date + 7)), false, 'opening the sheet again reuses the link');
select is((select token from public.share_event(pg_temp.id('music'), current_date + 7)), pg_temp.token('music'), 'the same token');
insert into tokens select 'music-next', token from public.share_event(pg_temp.id('music'), current_date + 14);
select isnt(pg_temp.token('music-next'), pg_temp.token('music'), 'another date of the series gets its own link');
select throws_ok($$ insert into public.event_share_links (event_id, occurrence_date, family_id, token) values (pg_temp.id('music'), current_date + 7, public.my_family_id(), repeat('a', 43)) $$,
  '23505', null, 'one active link per event date');
update public.event_share_links set token = repeat('a', 43), occurrence_date = current_date + 21 where occurrence_date = current_date + 7;
select is((select token || occurrence_date from public.event_share_links where token = pg_temp.token('music')), pg_temp.token('music') || (current_date + 7), 'nobody can pick the token or move the link');
select throws_ok($$ delete from public.event_share_links $$, '42501', null, 'members can''t delete a link: they stop it');

-- Only a family event, on one of its days.
select throws_ok($$ select * from public.share_event(pg_temp.id('diary'), current_date + 7) $$, 'P0001', 'event_not_shareable', 'a private event can''t be shared');
select throws_ok($$ select * from public.share_event(pg_temp.id('party'), current_date + 7) $$, 'P0001', 'event_not_shareable', 'nor a surprise');
select throws_ok($$ select * from public.share_event(pg_temp.id('music'), current_date) $$, 'P0001', 'not_an_event_date', 'nor a day before the event starts');
select throws_ok($$ select * from public.share_event(pg_temp.id('swim'), current_date - 6) $$, 'P0001', 'not_an_event_date', 'nor a one-off event on another day');
insert into tokens select 'swim', token from public.share_event(pg_temp.id('swim'), current_date - 7);

-- Another family and signed-out people see no links and can't share this family's events.
select pg_temp.login('00000000-0000-0000-0000-00000000042f');
select is((select count(*)::int from public.event_share_links), 0, 'another family sees no links');
select throws_ok($$ select * from public.share_event(pg_temp.id('music'), current_date + 7) $$, 'P0001', 'event_not_found', 'or shares another family''s event');
update public.event_share_links set stopped_at = now();
select pg_temp.login('00000000-0000-0000-0000-00000000042a');
select is((select count(*)::int from public.event_share_links where stopped_at is null), 3, 'another family can''t stop the links');
select pg_temp.login(null);
select throws_ok($$ select count(*) from public.event_share_links $$, '42501', null, 'signed out can''t read links');
select ok(not has_function_privilege('anon', 'public.share_event(uuid, date)', 'execute'), 'signed out can''t share');
select ok(not has_function_privilege('anon', 'public.shared_event(text)', 'execute'), 'signed out can''t call shared_event directly');
select ok(not has_function_privilege('authenticated', 'public.shared_event(text)', 'execute'), 'nor can members');

-- The share endpoint sees only the shown fields: first names, no notes, checklist, reminder, driver or ids.
select pg_temp.as_endpoint();
select is(public.shared_event(pg_temp.token('music')) #>> '{event,title}', 'Baby music class', 'the page gets the title');
select is((select array_agg(w order by w) from jsonb_array_elements_text(public.shared_event(pg_temp.token('music')) -> 'who') w),
  array['Eva', 'James', 'others'], 'and first names');
select is((select array_agg(k order by k) from jsonb_object_keys(public.shared_event(pg_temp.token('music')) -> 'event') k),
  array['ends_on', 'location', 'recurrence', 'slots', 'starts_on', 'time_type', 'title'], 'and nothing else of the event');
select ok(public.shared_event(pg_temp.token('music'))::text !~ 'Gate code|Shaker|hour_before|0000-0000', 'no notes, checklist, reminder or ids anywhere');
select is(public.shared_event(pg_temp.token('swim')), null, 'a link to an event that''s over shows nothing');
select is(public.shared_event(repeat('z', 43)), null, 'nor an unknown token');

-- That date changed: only its shown fields and names; cancelled: nothing.
reset role;
insert into public.event_exceptions (family_id, event_id, occurrence_date, override) select family_id, id, current_date + 7,
  jsonb_build_object('location', 'Town hall', 'notes', 'Shh', 'members', jsonb_build_array(pg_temp.id('gabriel'), 'everyone')) from public.events where id = pg_temp.id('music');
select pg_temp.as_endpoint();
select is(public.shared_event(pg_temp.token('music')) #> '{exception,override}', '{"location": "Town hall"}'::jsonb, 'a changed date shows its new place, not its notes');
select is(public.shared_event(pg_temp.token('music')) -> 'who', '["Gabriel", "everyone"]'::jsonb, 'and its own people, in the change''s order');
reset role;
update public.event_exceptions set cancelled = true, override = null where event_id = pg_temp.id('music');
select pg_temp.as_endpoint();
select is(public.shared_event(pg_temp.token('music')), null, 'a cancelled date shows nothing');
select isnt(public.shared_event(pg_temp.token('music-next')), null, 'while the next week''s link still works');

-- Split at a later date ("This and all future ones", "All future events"): that date's link ends,
-- whatever the new part becomes; earlier dates keep theirs. No link for a date after the end.
select pg_temp.login('00000000-0000-0000-0000-00000000042b');
insert into tokens select 'music-4', token from public.share_event(pg_temp.id('music'), current_date + 28);
insert into tokens select 'music-3', token from public.share_event(pg_temp.id('music'), current_date + 21);
insert into ids select 'tail', public.split_event(pg_temp.id('music'), current_date + 28,
  jsonb_build_object('freq', 'weekly', 'ends', jsonb_build_object('type', 'on', 'date', to_char(current_date + 27, 'YYYY-MM-DD'))),
  jsonb_build_object('title', 'Secret class', 'starts_on', pg_temp.day(28), 'ends_on', pg_temp.day(28), 'time_type', 'all_day', 'visibility', 'private'),
  jsonb_build_array(pg_temp.id('eva')));
select pg_temp.as_endpoint();
select is(public.shared_event(pg_temp.token('music-4')), null, 'a date moved to the new part of a split series shows nothing');
select isnt(public.shared_event(pg_temp.token('music-3')), null, 'an earlier date still shows');
select pg_temp.login('00000000-0000-0000-0000-00000000042b');
select throws_ok($$ select * from public.share_event(pg_temp.id('music'), current_date + 35) $$, 'P0001', 'not_an_event_date', 'no new link after the series ends');
-- A one-off event moved to another day: its old link shows nothing.
update public.events set starts_on = current_date - 6, ends_on = current_date - 6 where id = pg_temp.id('swim');
insert into tokens select 'swim-now', token from public.share_event(pg_temp.id('swim'), current_date - 6);
update public.events set starts_on = current_date + 3, ends_on = current_date + 3 where id = pg_temp.id('swim');
select pg_temp.as_endpoint();
select is(public.shared_event(pg_temp.token('swim-now')), null, 'a moved one-off event''s old link shows nothing');

-- Deleting the event or stopping the link ends it.
select pg_temp.login('00000000-0000-0000-0000-00000000042b');
update public.events set deleted_at = now() where id = pg_temp.id('music');
select pg_temp.as_endpoint();
select is(public.shared_event(pg_temp.token('music-next')), null, 'a deleted event''s link shows nothing');
select pg_temp.login('00000000-0000-0000-0000-00000000042b');
update public.events set deleted_at = null where id = pg_temp.id('music');
update public.event_share_links set stopped_at = now() where token = pg_temp.token('music-next');
select pg_temp.as_endpoint();
select is(public.shared_event(pg_temp.token('music-next')), null, 'and a stopped link shows nothing');

select * from finish();
rollback;
