-- Spec 051: cooking sessions. Members of the family start, move, finish and cancel them; one
-- open session per recipe; the server keeps who and when; another family and signed-out people
-- see nothing; a deleted recipe's session is cancelled; the nightly job cancels stale ones.
-- Also FR-007 (no detail left after a comma in a name) and FR-015 (the shared page's source).
begin;
select plan(34);

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

create function pg_temp.affected(statement text) returns integer language plpgsql as $$
declare
  n integer;
begin
  execute statement;
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function pg_temp.login(uuid), pg_temp.affected(text) to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'sam@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select public.create_family('The Others', 'Sam');
insert into public.recipes (id, name, serves) values ('00000000-0000-4000-8000-0000000000e2', 'Sam''s soup', 4);
insert into public.recipe_variants (id, recipe_id, position, name, kind)
  values ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000e2', 0, 'Spicy', 'option');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.create_family('The Demanges', 'Gabriel');
insert into public.recipes (id, name, serves) values
  ('00000000-0000-4000-8000-0000000000e1', 'Leek & bacon quiche', 6),
  ('00000000-0000-4000-8000-0000000000e3', 'Apple crumble', 4);

-- Start: the server sets who started it and that it's in progress.
insert into public.cook_sessions (id, recipe_id, servings, started_by, status)
  values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000e1', 6, '00000000-0000-0000-0000-00000000000f', 'done');
select is((select started_by from public.cook_sessions), '00000000-0000-0000-0000-00000000000a'::uuid, 'a session is started by whoever starts it');
select is((select status from public.cook_sessions), 'in_progress', 'and starts in progress');
select throws_ok($$ insert into public.cook_sessions (recipe_id, servings) values ('00000000-0000-4000-8000-0000000000e1', 6) $$, '23505', null,
  'one open session per recipe');
select lives_ok($$ insert into public.cook_sessions (recipe_id, servings) values ('00000000-0000-4000-8000-0000000000e3', 4) $$,
  'another recipe can be in progress at the same time');
select throws_ok($$ insert into public.cook_sessions (recipe_id, servings) values ('00000000-0000-4000-8000-0000000000e2', 4) $$, '23503', null,
  'never for another family''s recipe');
select throws_ok($$ update public.cook_sessions set variant_id = '00000000-0000-4000-8000-0000000000f2' where id = '00000000-0000-4000-8000-0000000000c1' $$,
  '23503', null, 'nor with another recipe''s variant');

-- Move on, finish, undo.
update public.cook_sessions set current_step = 2, recipe_id = '00000000-0000-4000-8000-0000000000e3' where id = '00000000-0000-4000-8000-0000000000c1';
select is((select current_step || ' ' || recipe_id from public.cook_sessions where id = '00000000-0000-4000-8000-0000000000c1'),
  '2 00000000-0000-4000-8000-0000000000e1', 'the step moves; the recipe stays');
update public.cook_sessions set status = 'done', finished_at = '2020-01-01' where id = '00000000-0000-4000-8000-0000000000c1';
select ok((select finished_at > now() - interval '1 minute' and finished_by = '00000000-0000-0000-0000-00000000000a' from public.cook_sessions
  where id = '00000000-0000-4000-8000-0000000000c1'), 'done records when and by whom, from the server');
update public.cook_sessions set status = 'in_progress' where id = '00000000-0000-4000-8000-0000000000c1';
select is((select status || coalesce(finished_at::text, ' (not finished)') from public.cook_sessions where id = '00000000-0000-4000-8000-0000000000c1'),
  'in_progress (not finished)', 'undo puts it back in progress');
select throws_ok($$ update public.cook_sessions set status = 'cancelled' where id = '00000000-0000-4000-8000-0000000000c1' $$, '23514', null,
  'a cancel says why');
select is(pg_temp.affected($$ update public.cook_sessions set status = 'cancelled', cancel_reason = 'user' where id = '00000000-0000-4000-8000-0000000000c1' $$), 1,
  'a member cancels it');
select lives_ok($$ insert into public.cook_sessions (recipe_id, servings) values ('00000000-0000-4000-8000-0000000000e1', 6) $$,
  'and the recipe can be started again');
select throws_ok($$ delete from public.cook_sessions $$, '42501', null, 'members never delete sessions');

-- An ended cook is the log: no reopening one the nightly job ended, nor an old one.
select lives_ok($$ update public.cook_sessions set status = 'done' where recipe_id = '00000000-0000-4000-8000-0000000000e1' and status = 'in_progress' $$, 'a member logs a cook');
select throws_ok($$ update public.cook_sessions set status = 'cancelled', cancel_reason = 'user' where id = '00000000-0000-4000-8000-0000000000c1' $$, '42501', null,
  'an ended cook only comes back in progress, never rewritten');
reset role;
alter table public.cook_sessions disable trigger cook_sessions_stamp;
alter table public.cook_sessions disable trigger cook_sessions_keep;
update public.cook_sessions set updated_at = now() - interval '2 hours' where id = '00000000-0000-4000-8000-0000000000c1';
alter table public.cook_sessions enable trigger cook_sessions_stamp;
alter table public.cook_sessions enable trigger cook_sessions_keep;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok($$ update public.cook_sessions set status = 'in_progress' where id = '00000000-0000-4000-8000-0000000000c1' $$, '42501', null,
  'nor after the hour Undo has');
-- The quiche is back in progress for the stale check below.
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.cook_sessions (family_id, recipe_id, servings)
  select family_id, id, 6 from public.recipes where id = '00000000-0000-4000-8000-0000000000e1';
select pg_temp.login('00000000-0000-0000-0000-00000000000a');

-- Assistants read the family's cooks (get_recipe), and never write them.
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000a', 'role', 'cocon_assistant')::text, true);
reset role;
set local role cocon_assistant;
select ok((select count(*) from public.cook_sessions) > 0, 'an assistant reads its family''s cooks');
select throws_ok($$ insert into public.cook_sessions (recipe_id, servings) values ('00000000-0000-4000-8000-0000000000e1', 6) $$, '42501', null,
  'but never starts one');
select throws_ok($$ update public.cook_sessions set current_step = 3 $$, '42501', null, 'nor changes one');
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000f', 'role', 'cocon_assistant')::text, true);
reset role;
set local role cocon_assistant;
select is((select count(*)::int from public.cook_sessions), 0, 'another family''s assistant reads none');

-- Another family and signed-out people see nothing.
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select is((select count(*)::int from public.cook_sessions), 0, 'another family reads no sessions');
select is(pg_temp.affected($$ update public.cook_sessions set current_step = 5 $$), 0, 'nor changes them');
select pg_temp.login(null);
select throws_ok($$ select * from public.cook_sessions $$, '42501', null, 'signed-out people cannot read them');

-- Deleting the recipe cancels its open session.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.recipes set deleted_at = now() where id = '00000000-0000-4000-8000-0000000000e3';
select is((select cancel_reason from public.cook_sessions where recipe_id = '00000000-0000-4000-8000-0000000000e3'), 'recipe_deleted',
  'a deleted recipe''s session is cancelled');
select throws_ok($$ insert into public.cook_sessions (recipe_id, servings) values ('00000000-0000-4000-8000-0000000000e3', 4) $$, '42501', null,
  'and a deleted recipe can''t be started');

-- Stale sessions: only the service role runs the nightly cancel.
select ok(not has_function_privilege('authenticated', 'public.cancel_stale_cook_sessions()', 'execute'), 'members can''t run the stale cancel');
select ok(has_function_privilege('service_role', 'public.cancel_stale_cook_sessions()', 'execute'), 'the service role can');
reset role;
select set_config('request.jwt.claims', '', true);
alter table public.cook_sessions disable trigger cook_sessions_keep;
update public.cook_sessions set last_active_at = now() - interval '73 hours' where recipe_id = '00000000-0000-4000-8000-0000000000e1' and status = 'in_progress';
alter table public.cook_sessions enable trigger cook_sessions_keep;
select is(public.cancel_stale_cook_sessions(), 1, 'a session untouched for 72 hours is cancelled');
select is((select cancel_reason from public.cook_sessions where recipe_id = '00000000-0000-4000-8000-0000000000e1' and id <> '00000000-0000-4000-8000-0000000000c1' and status = 'cancelled'), 'stale',
  'as stale');

-- FR-007: no ingredient keeps its detail after a comma in its name (brackets aside).
select is((select count(*)::int from public.recipe_ingredients where regexp_replace(name, '\([^)]*\)', '', 'g') like '%,%'), 0,
  'no ingredient name holds a detail after a comma');

-- FR-015: the shared page gets the parts of the source line.
select ok(not has_function_privilege('service_role', 'public._shared_recipe_base(text)', 'execute'), 'the base shared page is internal');
insert into public.share_links (recipe_id, token, created_by, family_id)
  select id, repeat('a', 43), created_by, family_id from public.recipes where id = '00000000-0000-4000-8000-0000000000e1';
select is(public.shared_recipe(repeat('a', 43)) -> 'recipe' ->> 'author_name', 'Gabriel', 'without a source, who added it');
update public.recipes set source_text = 'La Cuisine de Mamie · p. 48' where id = '00000000-0000-4000-8000-0000000000e1';
select is(public.shared_recipe(repeat('a', 43)) -> 'recipe' ->> 'source_text', 'La Cuisine de Mamie · p. 48', 'the shared page has the source');
select ok(not (public.shared_recipe(repeat('a', 43)) -> 'recipe' ? 'author_name'), 'and then no one''s name');

select * from finish();
rollback;
