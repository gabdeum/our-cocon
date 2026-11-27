-- Spec 075: ticking a checklist item saves the notes the event shows on that date, only if nobody
-- changed them since (FR-002, FR-003, FR-008), as an edit by the member who can see it (FR-005,
-- FR-006); a reminder's notes the same way. The event's old checklist is gone (FR-009).
begin;
select plan(20);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;
grant execute on function pg_temp.login(uuid) to public;
create temp table ids (name text primary key, id uuid);
create temp table tokens (name text primary key, token text);
grant all on ids, tokens to public;
create function pg_temp.id(n text) returns uuid language sql as $$ select id from ids where name = n $$;
grant execute on function pg_temp.id(text) to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000075a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000075b', 'eva@example.com'),
  ('00000000-0000-0000-0000-00000000075f', 'sam@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000075a');
select public.create_family('The Demanges', 'Gabriel');
insert into tokens select 'eva', public.create_invite();
select pg_temp.login('00000000-0000-0000-0000-00000000075b');
select public.accept_invite((select token from tokens where name = 'eva'), 'Eva');
select pg_temp.login('00000000-0000-0000-0000-00000000075f');
select public.create_family('The Others', 'Sam');

-- Gabriel's weekly music class, whose Dec 12 has its own notes, and his private yoga.
select pg_temp.login('00000000-0000-0000-0000-00000000075a');
insert into ids select 'music', public.save_event(
  '{"title":"Baby music class","notes":"Bring:\n- [ ] Shaker\n- [x] Snack","starts_on":"2026-12-05","ends_on":"2026-12-05","time_type":"all_day","recurrence":{"freq":"weekly","ends":{"type":"never"}}}',
  '["everyone"]');
insert into public.event_exceptions (event_id, occurrence_date, override)
  values (pg_temp.id('music'), '2026-12-12', '{"notes":"- [ ] Drum"}');
insert into ids select 'party', public.save_event(
  '{"title":"Eva''s party","notes":"- [ ] Cake","starts_on":"2026-12-05","ends_on":"2026-12-05","time_type":"all_day","visibility":"surprise"}', '["everyone"]',
  null, jsonb_build_object('hidden_from', jsonb_build_array((select id from public.members where user_id = '00000000-0000-0000-0000-00000000075b')), 'cover_title', 'Dinner out'));
insert into ids select 'yoga', public.save_event(
  '{"title":"Yoga","notes":"- [ ] Towel","starts_on":"2026-12-05","ends_on":"2026-12-05","time_type":"all_day","visibility":"private"}', '["everyone"]');
with r as (
  insert into public.reminders (title, notes, due_at, has_time, rollover) values ('Water the plants', E'- [ ] Fern\n- [ ] Basil', now(), false, 'day') returning id
)
insert into ids select 'plants', id from r;

-- Eva ticks the shaker on the series (every date shows it, FR-008).
select pg_temp.login('00000000-0000-0000-0000-00000000075b');
select ok(public.set_event_notes(pg_temp.id('music'), '2026-12-19', E'Bring:\n- [ ] Shaker\n- [x] Snack', E'Bring:\n- [x] Shaker\n- [x] Snack'),
  'a member ticks an item on the series');
select is((select notes from public.events where id = pg_temp.id('music')), E'Bring:\n- [x] Shaker\n- [x] Snack', 'the series'' notes change');
select is((select (payload ->> 'kind', actor_id)::text from public.activity where target_id = pg_temp.id('music') order by seq desc limit 1),
  '(event_edited,00000000-0000-0000-0000-00000000075b)', 'and history says Eva edited it (FR-006)');
select ok(not public.set_event_notes(pg_temp.id('music'), '2026-12-19', E'Bring:\n- [ ] Shaker\n- [x] Snack', E'Bring:\n- [ ] Shaker\n- [ ] Snack'),
  'a tick made on notes that changed since is refused (FR-003)');
select is((select notes from public.events where id = pg_temp.id('music')), E'Bring:\n- [x] Shaker\n- [x] Snack', 'and changes nothing');

-- Dec 12 has its own notes: only that date changes.
select ok(public.set_event_notes(pg_temp.id('music'), '2026-12-12', '- [ ] Drum', '- [x] Drum'), 'a date with its own notes');
select is((select override ->> 'notes' from public.event_exceptions where event_id = pg_temp.id('music') and occurrence_date = '2026-12-12'),
  '- [x] Drum', 'changes only that date');
select is((select notes from public.events where id = pg_temp.id('music')), E'Bring:\n- [x] Shaker\n- [x] Snack', 'not the series');
select ok(not public.set_event_notes(pg_temp.id('music'), '2026-12-12', E'Bring:\n- [x] Shaker\n- [x] Snack', 'Mine'),
  'the series'' notes never stand in for a date that has its own');

-- Who may tick (FR-005): only those who see the event, like editing its notes.
select ok(not public.set_event_notes(pg_temp.id('yoga'), '2026-12-05', '- [ ] Towel', '- [x] Towel'), 'Eva can''t tick Gabriel''s private event');
select ok(not public.set_event_notes(pg_temp.id('party'), '2026-12-05', '- [ ] Cake', '- [x] Cake'), 'nor a surprise kept from her');
select throws_ok($$ select public.set_event_notes(pg_temp.id('music'), '2026-12-12', '- [x] Drum', null) $$, '22023', 'notes_needed', 'a tick never empties a note');
select pg_temp.login('00000000-0000-0000-0000-00000000075f');
select ok(not public.set_event_notes(pg_temp.id('music'), '2026-12-19', E'Bring:\n- [x] Shaker\n- [x] Snack', 'Mine'), 'nor can another family');
reset role;
select is((select notes from public.events where id = pg_temp.id('yoga')), '- [ ] Towel', 'the private notes are as they were');
select is((select notes from public.events where id = pg_temp.id('party')), '- [ ] Cake', 'and the surprise''s');
select is((select notes from public.events where id = pg_temp.id('music')), E'Bring:\n- [x] Shaker\n- [x] Snack', 'and so are the class''s');
select ok(not has_function_privilege('anon', 'public.set_event_notes(uuid, date, text, text)', 'execute'), 'signed out: no ticking');

-- A reminder's notes, as `setReminderNotes` saves them: the item ticks, the reminder stays open (FR-004).
select pg_temp.login('00000000-0000-0000-0000-00000000075b');
update public.reminders set notes = E'- [x] Fern\n- [ ] Basil' where id = pg_temp.id('plants') and notes = E'- [ ] Fern\n- [ ] Basil';
select is((select (notes, completed_at is null)::text from public.reminders where id = pg_temp.id('plants')),
  row(E'- [x] Fern\n- [ ] Basil', true)::text, 'Eva ticks a reminder''s item and it stays to do');

-- FR-009: the old checklist is gone.
reset role;
select hasnt_table('public', 'event_checklist_items', 'the event checklist table is gone');
select hasnt_function('public', 'save_event', array['jsonb', 'jsonb', 'uuid', 'jsonb', 'jsonb'], 'and save_event takes no checklist');

select * from finish();
rollback;
