-- Spec 053 FR-002, FR-004: suggested event titles. Starts-with before a word match, used often and
-- lately first, one row per title and part of the day whatever its case; never someone else's private event, a surprise
-- (kept from the reader or not, nor its cover), a deleted event, another family's, or anything for an assistant.
begin;
select plan(14);

create function pg_temp.login(uid uuid, client text default null) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', jsonb_strip_nulls(jsonb_build_object('sub', uid, 'role', 'authenticated', 'client_id', client))::text, true);
  set local role authenticated;
end;
$$;
grant execute on function pg_temp.login(uuid, text) to public;
create temp table tokens (token text);
create temp table ids (name text primary key, id uuid);
grant all on tokens, ids to public;
create function pg_temp.ev(t text, day date) returns uuid language sql as $$
  select public.save_event(jsonb_build_object('title', t, 'starts_on', day, 'ends_on', day, 'time_type', 'all_day'), '["everyone"]');
$$;
grant execute on function pg_temp.ev(text, date) to public;
create function pg_temp.titles(q text) returns text[] language sql as $$
  select coalesce(array_agg(title), '{}') from public.suggest_event_titles(q);
$$;
grant execute on function pg_temp.titles(text) to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000053b', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000053c', 'eva@example.com'),
  ('00000000-0000-0000-0000-00000000053d', 'other@example.com');
-- Another family with its own "Swim team".
select pg_temp.login('00000000-0000-0000-0000-00000000053d');
select public.create_family('The Others', 'Olga');
select pg_temp.ev('Swim team', current_date - 1);
select pg_temp.login('00000000-0000-0000-0000-00000000053b');
select public.create_family('The Demanges', 'Gabriel');
insert into tokens select public.create_invite();
select pg_temp.login('00000000-0000-0000-0000-00000000053c');
select public.accept_invite((select token from tokens), 'Eva');

-- Gabriel's family events: "Swim" three times lately, "Swimming party" once long ago, "Pool swim" once.
select pg_temp.login('00000000-0000-0000-0000-00000000053b');
select pg_temp.ev('Swim', current_date - 7);
select pg_temp.ev('swim', current_date - 14);
select pg_temp.ev('Swim', current_date - 21);
select pg_temp.ev('Swimming party', current_date - 400);
select pg_temp.ev('Pool swim', current_date - 2);
select pg_temp.ev('100% fun', current_date - 3);
-- "Gym" twice in the morning (once with lunch too), once at 17:30: two options, not three.
select public.save_event(jsonb_build_object('title', 'Gym', 'starts_on', current_date - 4, 'ends_on', current_date - 4, 'time_type', 'slot', 'slots', '{morning}'::text[]), '["everyone"]');
select public.save_event(jsonb_build_object('title', 'Gym', 'starts_on', current_date - 5, 'ends_on', current_date - 5, 'time_type', 'slot', 'slots', '{lunch,morning}'::text[]), '["everyone"]');
select public.save_event(jsonb_build_object('title', 'Gym', 'starts_on', current_date - 30, 'ends_on', current_date - 30, 'time_type', 'custom', 'start_time', '17:30', 'end_time', '18:30'), '["everyone"]');
-- Custom times count as the slot they start in: 17:45 joins 17:30 (afternoon), 09:30 joins the mornings.
select public.save_event(jsonb_build_object('title', 'Gym', 'starts_on', current_date - 40, 'ends_on', current_date - 40, 'time_type', 'custom', 'start_time', '17:45', 'end_time', '18:30'), '["everyone"]');
select public.save_event(jsonb_build_object('title', 'gym', 'starts_on', current_date - 60, 'ends_on', current_date - 60, 'time_type', 'custom', 'start_time', '09:30', 'end_time', '10:30'), '["everyone"]');
-- Gabriel's own surprise, kept from Eva: he's in on it, but it's never suggested.
select public.save_event('{"title":"Swim cake for Eva","starts_on":"2026-11-01","ends_on":"2026-11-01","time_type":"all_day","visibility":"surprise"}', '["everyone"]', null,
  jsonb_build_object('hidden_from', jsonb_build_array((select id from public.members where user_id = '00000000-0000-0000-0000-00000000053c')), 'cover_title', 'Errands'));
insert into ids select 'gone', pg_temp.ev('Swim gala', current_date - 1);
update public.events set deleted_at = now() where id = (select id from ids where name = 'gone');

-- Eva's private "Swim lesson" and a surprise kept from Gabriel.
select pg_temp.login('00000000-0000-0000-0000-00000000053c');
select public.save_event('{"title":"Swim lesson","starts_on":"2026-11-01","ends_on":"2026-11-01","time_type":"all_day","visibility":"private"}', '["everyone"]');
select public.save_event('{"title":"Swim surprise","starts_on":"2026-11-01","ends_on":"2026-11-01","time_type":"all_day","visibility":"surprise"}', '["everyone"]', null,
  jsonb_build_object('hidden_from', jsonb_build_array((select id from public.members where user_id = '00000000-0000-0000-0000-00000000053b')), 'cover_title', 'Dinner'));

select pg_temp.login('00000000-0000-0000-0000-00000000053b');
select is(pg_temp.titles('sw'), array['Swim', 'Swimming party', 'Pool swim'],
  'starts-with first, the often and lately used one on top, one row whatever its case; then a word match');
select is((select title from public.suggest_event_titles('SW') limit 1), 'Swim', 'the latest spelling of a title comes back');
select is((select array_agg(coalesce(start_time, slots[1]) order by score desc) from public.suggest_event_titles('gym')), array['morning', '17:30'],
  'one option per part of the day, from the latest of each, used often first');
select is(pg_temp.titles('swim l'), '{}'::text[], 'never someone else''s private event');
select is(pg_temp.titles('swim s'), '{}'::text[], 'never a surprise kept from the reader');
select is(pg_temp.titles('swim g'), '{}'::text[], 'never a deleted event');
select is(pg_temp.titles(''), '{}'::text[], 'nothing for no text');
select is(pg_temp.titles('swim c'), '{}'::text[], 'never a surprise, even one he''s in on');
select is(pg_temp.titles('din'), '{}'::text[], 'never a surprise''s cover title');
select is(pg_temp.titles('swim t'), '{}'::text[], 'never another family''s');
select is(pg_temp.titles('100%'), array['100% fun'], 'a typed % is matched as text');
select is(pg_temp.titles('1_0'), '{}'::text[], 'and so is _');

select pg_temp.login('00000000-0000-0000-0000-00000000053b', 'c53');
select is(pg_temp.titles('sw'), '{}'::text[], 'nothing for an assistant');

reset role;
select ok(not has_function_privilege('anon', 'public.suggest_event_titles(text, int)', 'execute')
  and not has_function_privilege('cocon_assistant', 'public.suggest_event_titles(text, int)', 'execute'), 'signed out and assistants can''t call it');

select * from finish();
rollback;
