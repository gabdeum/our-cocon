-- Spec 043: `events_visible` says which view each row is (032-later L101), for the app's role and
-- an assistant's token: 'full' for the creator and those in on a surprise, 'cover' for the people
-- it's hidden from, 'busy' for someone else's private event. The hidden person can't save over it
-- (FR-005). An assistant acting for the hidden person gets the cover as 'full' (FR-003). The rest of
-- the privacy rules are spec 035's test.
begin;
select plan(16);

create function pg_temp.login(uid uuid, r text default 'authenticated', client text default null) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', jsonb_strip_nulls(jsonb_build_object('sub', uid, 'role', r, 'client_id', client))::text, true);
  execute format('set local role %I', r);
end;
$$;
grant execute on function pg_temp.login(uuid, text, text) to public;
grant usage on schema extensions to cocon_assistant;
grant execute on all functions in schema extensions to cocon_assistant;
create temp table ids (name text primary key, id uuid);
create temp table tokens (name text primary key, token text);
grant all on ids, tokens to public;
create function pg_temp.id(n text) returns uuid language sql as $$ select id from ids where name = n $$;
grant execute on function pg_temp.id(text) to public;
create function pg_temp.view_of(n text) returns text language sql as $$ select view from public.events_visible where id = pg_temp.id(n) $$;
grant execute on function pg_temp.view_of(text) to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000043a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000043b', 'eva@example.com'),
  ('00000000-0000-0000-0000-00000000043c', 'alex@example.com');

-- Gabriel (owner), Eva and Alex.
select pg_temp.login('00000000-0000-0000-0000-00000000043a');
select public.create_family('The Demanges', 'Gabriel');
insert into tokens select 'eva', public.create_invite();
insert into tokens select 'alex', public.create_invite();
select pg_temp.login('00000000-0000-0000-0000-00000000043b');
select public.accept_invite((select token from tokens where name = 'eva'), 'Eva');
select pg_temp.login('00000000-0000-0000-0000-00000000043c');
select public.accept_invite((select token from tokens where name = 'alex'), 'Alex');
reset role;
insert into ids select 'gabriel', id from public.members where user_id = '00000000-0000-0000-0000-00000000043a';
insert into ids select 'eva', id from public.members where user_id = '00000000-0000-0000-0000-00000000043b';

-- Story 1: Eva's private afternoon. Story 2: Gabriel's surprise dinner, kept from Eva.
select pg_temp.login('00000000-0000-0000-0000-00000000043b');
insert into ids select 'private', public.save_event(
  '{"title":"Dentist","starts_on":"2026-10-22","ends_on":"2026-10-22","time_type":"slot","slots":["afternoon"],"visibility":"private"}',
  jsonb_build_array(pg_temp.id('eva')));
insert into ids select 'family', public.save_event('{"title":"Poker night","starts_on":"2026-10-23","ends_on":"2026-10-23","time_type":"all_day"}', '["everyone"]');
select pg_temp.login('00000000-0000-0000-0000-00000000043a');
insert into ids select 'dinner', public.save_event(
  '{"title":"Eva''s surprise dinner","location":"Café Lalo","starts_on":"2026-10-31","ends_on":"2026-10-31","time_type":"slot","slots":["evening"],"visibility":"surprise"}',
  jsonb_build_array(pg_temp.id('eva')), null,
  jsonb_build_object('hidden_from', jsonb_build_array(pg_temp.id('eva')), 'cover_title', 'Dinner out', 'cover_note', 'Meet at Café Lalo at 19:30. Dress nice!'));

select is(pg_temp.view_of('dinner'), 'full', 'Gabriel sees his surprise in full');
select is(pg_temp.view_of('private'), 'busy', 'and Eva''s private event as Busy');
select is(pg_temp.view_of('family'), 'full', 'and a family event in full');

select pg_temp.login('00000000-0000-0000-0000-00000000043c');
select is(pg_temp.view_of('dinner'), 'full', 'Alex is in on the surprise');
select is(pg_temp.view_of('private'), 'busy', 'Eva''s private event is Busy to Alex too');

select pg_temp.login('00000000-0000-0000-0000-00000000043b');
select is(pg_temp.view_of('dinner'), 'cover', 'Eva gets the cover, marked as one');
select is((select row(title, location, notes, visibility)::text from public.events_visible where id = pg_temp.id('dinner')),
  row('Dinner out', 'Café Lalo', 'Meet at Café Lalo at 19:30. Dress nice!', 'family')::text, 'with only the cover''s fields');
select is(pg_temp.view_of('private'), 'full', 'and her own private event in full');
select throws_ok(format($$ select public.save_event('{"title":"Dinner out","starts_on":"2026-10-31","ends_on":"2026-10-31","time_type":"all_day"}', '["everyone"]', '%s') $$, pg_temp.id('dinner')),
  'P0002', 'event_not_found', 'she can''t save over the surprise');
select is((select count(*)::int from public.events_visible where id = pg_temp.id('dinner') and title = 'Dinner out' and time_type = 'slot'), 1, 'which stays as it was');

-- Through an assistant's token: the same views (FR-003).
select pg_temp.login('00000000-0000-0000-0000-00000000043b', 'cocon_assistant', 'c1');
select is(pg_temp.view_of('dinner'), 'full', 'Eva''s assistant isn''t told it''s a cover');
select is((select row(title, location, notes, visibility, surprise::text)::text from public.events_visible where id = pg_temp.id('dinner')),
  row('Dinner out', 'Café Lalo', 'Meet at Café Lalo at 19:30. Dress nice!', 'family', null)::text, 'and gets only the cover''s fields');
select pg_temp.login('00000000-0000-0000-0000-00000000043a', 'cocon_assistant', 'c1');
select is(pg_temp.view_of('private'), 'busy', 'Gabriel''s assistant gets Busy');
select is(pg_temp.view_of('dinner'), 'full', 'and his surprise in full');

-- Signed out: nothing.
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.events_visible $$, '42501', null, 'signed-out callers can''t read the view');
select throws_ok($$ select count(*) from public._events_visible() $$, '42501', null, 'or call its function');

select * from finish();
rollback;
