-- Spec 016: save_recipe_steps saves a recipe's step list in one go, for the family's members only,
-- and a recipe holds at most 100 steps (032-later L23).
begin;
select plan(15);

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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'sam@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.create_family('The Demanges', 'Gabriel');
insert into public.recipes (id, name) values
  ('00000000-0000-4000-8000-000000000001', 'Quiche'),
  ('00000000-0000-4000-8000-000000000002', 'Soup');
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select public.create_family('The Others', 'Sam');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select ok(has_function_privilege('authenticated', 'public.save_recipe_steps(uuid, jsonb)', 'execute'), 'members can call it');
select ok(not has_function_privilege('anon', 'public.save_recipe_steps(uuid, jsonb)', 'execute'), 'signed out, nobody can');

select lives_ok($$ select public.save_recipe_steps('00000000-0000-4000-8000-000000000001', '[
  {"id": "00000000-0000-4000-8000-0000000000b1", "name": "Preheat", "body": "Heat the oven to {temp:180}.", "tip": "Line the tin first."},
  {"id": "00000000-0000-4000-8000-0000000000b2", "name": "Bake", "body": "Bake until set.", "timer_seconds": 2100, "timer_label": "Bake",
   "temp_check_c": 71, "temp_check_text": "center reaches"},
  {"id": "00000000-0000-4000-8000-0000000000b3", "body": "Rest before cutting."}
]') $$, 'a member saves three steps');
select is((select array_agg(body order by position) from public.recipe_steps where recipe_id = '00000000-0000-4000-8000-000000000001'),
  array['Heat the oven to {temp:180}.', 'Bake until set.', 'Rest before cutting.'], 'in the order sent');
select is((select (timer_seconds, temp_check_c)::text from public.recipe_steps where id = '00000000-0000-4000-8000-0000000000b2'),
  '(2100,71)', 'with its timer and temperature check');

select lives_ok($$ select public.save_recipe_steps('00000000-0000-4000-8000-000000000001', '[
  {"id": "00000000-0000-4000-8000-0000000000b3", "body": "Rest 10 minutes."},
  {"id": "00000000-0000-4000-8000-0000000000b1", "name": "Preheat", "body": "Heat the oven to {temp:180}."}
]') $$, 'reordering and removing saves in one go');
select is((select array_agg(id::text order by position) from public.recipe_steps where recipe_id = '00000000-0000-4000-8000-000000000001'),
  array['00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000b1'], 'rows swap; the one left out is gone');
select is((select tip from public.recipe_steps where id = '00000000-0000-4000-8000-0000000000b1'), null, 'an add-on left out is cleared');

select throws_ok($$ select public.save_recipe_steps('00000000-0000-4000-8000-000000000002', '[
  {"id": "00000000-0000-4000-8000-0000000000b1", "body": "Mine"}]') $$, '22023', null, 'a step cannot move to another recipe');
select throws_ok($$ select public.save_recipe_steps('00000000-0000-4000-8000-000000000001', '[
  {"id": "00000000-0000-4000-8000-0000000000b4", "body": "Wait", "timer_label": "Wait"}]') $$, '23514', null, 'the table''s checks still apply (a label needs a timer)');
select throws_ok(format($$ select public.save_recipe_steps('00000000-0000-4000-8000-000000000002', %L) $$,
  (select jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'body', 'Stir.')) from generate_series(1, 101))),
  '22023', null, '101 steps are refused');
select throws_ok($$ insert into public.recipe_steps (recipe_id, position, body) values ('00000000-0000-4000-8000-000000000002', 100, 'Too far') $$,
  '23514', null, 'the table holds at most 100 steps a recipe');
select is((select count(*)::int from public.recipe_steps where recipe_id = '00000000-0000-4000-8000-000000000001'), 2, 'a refused save changes nothing');

-- Sam (another family) can't save into family A's recipe, nor take its steps.
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select throws_ok($$ select public.save_recipe_steps('00000000-0000-4000-8000-000000000001', '[]') $$, 'P0002', null, 'other family: the recipe is not found');
insert into public.recipes (id, name) values ('00000000-0000-4000-8000-000000000003', 'Sam''s');
select throws_ok($$ select public.save_recipe_steps('00000000-0000-4000-8000-000000000003', '[
  {"id": "00000000-0000-4000-8000-0000000000b1", "body": "Mine now"}]') $$, '22023', null, 'other family: cannot take over another family''s step');

select * from finish();
rollback;
