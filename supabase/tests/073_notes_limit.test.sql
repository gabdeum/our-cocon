-- Spec 073: event and reminder notes hold up to 5000 characters, and so does a one-date change.
begin;
select plan(7);

create temp table ids (name text primary key, id uuid);
grant all on ids to public;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000073a', 'gabriel@example.com');
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000073a', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.create_family('The Demanges', 'Gabriel');

with e as (
  insert into public.events (title, notes, starts_on, ends_on, time_type, recurrence)
  values ('Walk', repeat('é', 5000), '2026-11-30', '2026-11-30', 'all_day', '{"freq":"weekly","ends":{"type":"never"}}') returning id
)
insert into ids select 'walk', id from e;
select is((select char_length(notes) from public.events where id = (select id from ids)), 5000, 'an event keeps a 5000-character note');
select throws_ok($$ insert into public.events (title, notes, starts_on, ends_on, time_type) values ('Long', repeat('a', 5001), '2026-11-30', '2026-11-30', 'all_day') $$,
  '23514', null, 'an event note over 5000 characters is refused');

select lives_ok($$ insert into public.reminders (title, notes, due_at, has_time, rollover) values ('Shop', repeat('a', 5000), now(), false, 'day') $$,
  'a reminder keeps a 5000-character note');
select throws_ok($$ insert into public.reminders (title, notes, due_at, has_time, rollover) values ('Shop', repeat('a', 5001), now(), false, 'day') $$,
  '23514', null, 'a reminder note over 5000 characters is refused');

select lives_ok($$ insert into public.event_exceptions (event_id, occurrence_date, override)
  values ((select id from ids), '2026-12-07', jsonb_build_object('title', 'Walk', 'notes', repeat('😀', 5000))) $$,
  'a one-date change keeps a 5000-character note, even in emoji');
select throws_ok($$ insert into public.event_exceptions (event_id, occurrence_date, override)
  values ((select id from ids), '2026-12-14', jsonb_build_object('notes', repeat('a', 5001))) $$,
  '23514', null, 'a one-date note over 5000 characters is refused');
select throws_ok($$ insert into public.event_exceptions (event_id, occurrence_date, override)
  values ((select id from ids), '2026-12-21', jsonb_build_object('notes', repeat(md5(random()::text), 1000))) $$,
  '23514', null, 'a one-date change is still capped in size');

select * from finish();
rollback;
