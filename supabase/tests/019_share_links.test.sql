-- Spec 019: one view-only link per recipe, made by the database; the share endpoint (service role)
-- reads only that recipe's shared fields, and nothing once the link stops or the recipe is deleted.
begin;
select plan(37);

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

-- The share endpoint: the service role, nobody signed in.
create function pg_temp.as_endpoint() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role service_role;
end;
$$;
grant execute on function pg_temp.as_endpoint() to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'sam@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.create_family('The Demanges', 'Gabriel');
insert into public.recipes (id, name, description, serves, photo_path, source_text) values
  ('00000000-0000-4000-8000-000000000001', 'Quiche', 'Silky custard.', 6, null, 'Grandma'),
  ('00000000-0000-4000-8000-000000000002', 'Secret soup', null, 4, null, null);
insert into public.recipe_ingredients (id, recipe_id, position, name, catalog_key, quantity, unit) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 0, 'Leeks', 'leek', 2, 'piece');
insert into public.recipe_steps (id, recipe_id, position, name, body, timer_seconds, tip) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000001', 0, 'Bake', 'Bake it.', 720, 'Watch the crust.');
insert into public.recipe_variants (recipe_id, position, name, kind, changes) values
  ('00000000-0000-4000-8000-000000000001', 0, 'Crisp', 'option', jsonb_build_array(jsonb_build_object(
    'type', 'add_step', 'step_id', '00000000-0000-4000-8000-0000000000b1', 'place', 'after',
    'step', jsonb_build_object('body', 'Grill it.', 'tip', 'Stay close.'))));
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select public.create_family('The Others', 'Sam');
insert into public.recipes (id, name) values ('00000000-0000-4000-8000-000000000009', 'Sam''s stew');

create temp table links (name text, token text);
grant all on links to public;

-- FR-001: the database makes a long random token; asking again returns the same link.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into links select 'first', token from public.share_recipe('00000000-0000-4000-8000-000000000001');
select ok((select token ~ '^[A-Za-z0-9_-]{43}$' from links where name = 'first'), 'a 256-bit base64url token');
select is((select created from public.share_recipe('00000000-0000-4000-8000-000000000001')), false, 'opening the sheet again reuses the link');
select is((select token from public.share_recipe('00000000-0000-4000-8000-000000000001')), (select token from links where name = 'first'), 'the same token');
select throws_ok($$ insert into public.share_links (recipe_id, family_id, token) values ('00000000-0000-4000-8000-000000000001', public.my_family_id(), repeat('a', 43)) $$,
  '23505', null, 'one active link per recipe');
update public.share_links set token = repeat('a', 43) where recipe_id = '00000000-0000-4000-8000-000000000001';
select is((select token from public.share_links where stopped_at is null), (select token from links where name = 'first'), 'nobody can pick the token');
select throws_ok($$ delete from public.share_links $$, '42501', null, 'members can''t delete a link: they stop it, and that''s recorded');

-- Another family and signed-out people see no links and can't make one for this recipe.
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select is((select count(*)::int from public.share_links), 0, 'another family sees no links');
select throws_ok($$ select * from public.share_recipe('00000000-0000-4000-8000-000000000001') $$, 'P0001', 'recipe_not_found', 'or shares another family''s recipe');
update public.share_links set stopped_at = now();
select throws_ok($$ delete from public.share_links $$, '42501', null, 'nobody deletes links through the API');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.share_links where stopped_at is null), 1, 'another family can''t stop or delete it');
-- A member's family corrections stay theirs, even through the facts function.
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
insert into public.family_ingredients (catalog_key, size_medium_g) values ('leek', 999);
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select size_medium_g from public._ingredient_facts((select family_id from public.members where user_id = '00000000-0000-0000-0000-00000000000f')) where catalog_key = 'leek'),
  (select size_medium_g from public.catalog_ingredients where key = 'leek'), 'another family''s corrections never show through _ingredient_facts');
select pg_temp.login(null);
select ok(not has_function_privilege('anon', 'public._ingredient_facts(uuid)', 'execute'), 'signed out can''t read facts');
select throws_ok($$ select count(*) from public.share_links $$, '42501', null, 'signed out: no access');
select ok(not has_function_privilege('anon', 'public.share_recipe(uuid)', 'execute'), 'signed out can''t share');

-- SC-001: only the endpoint reads a shared recipe, and only the shared fields.
select ok(not has_function_privilege('anon', 'public.shared_recipe(text)', 'execute'), 'signed out can''t call it directly');
select ok(not has_function_privilege('authenticated', 'public.shared_recipe(text)', 'execute'), 'nor can members');
select pg_temp.as_endpoint();
create temp table shared as select public.shared_recipe((select token from links where name = 'first')) as j;
select is((select array_agg(k order by k) from shared, jsonb_object_keys(j) k), array['photo_prefix', 'recipe'], 'the endpoint gets the recipe and the photo folder');
select is((select array_agg(k order by k) from shared, jsonb_object_keys(j -> 'recipe') k),
  array['best_months', 'cuisine', 'description', 'facts', 'ingredients', 'name', 'photo_path', 'prep_minutes', 'serves', 'shared_by', 'steps', 'total_minutes', 'variants'], 'only the shared fields, no ids of the family, recipe or members');
select is((select j -> 'recipe' ->> 'name' from shared), 'Quiche', 'the shared recipe, not another');
select is((select j -> 'recipe' ->> 'shared_by' from shared), 'Gabriel', 'with who shared it');
select is((select j ->> 'photo_prefix' from shared), (select family_id || '/00000000-0000-4000-8000-000000000001/' from public.recipes where id = '00000000-0000-4000-8000-000000000001'), 'photos only from its own folder');
select ok((select j -> 'recipe' -> 'facts' ? 'leek' from shared), 'with its ingredients'' catalog facts');
select is((select jsonb_array_length(j -> 'recipe' -> 'variants') from shared), 1, 'variants included by default');
select is((select j -> 'recipe' -> 'steps' -> 0 ->> 'tip' from shared), 'Watch the crust.', 'tips included by default');
select is(public.shared_recipe(repeat('a', 43)), null, 'an unknown token reads nothing');
select is(public.shared_recipe('short'), null, 'nor does a malformed one');
select is(public.shared_recipe(null), null, 'nor null');

-- Edge cases: without variants or tips (the variants' added steps lose theirs too).
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.share_links set include_tips = false where recipe_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_endpoint();
select is((select public.shared_recipe(token) -> 'recipe' -> 'steps' -> 0 ->> 'tip' from links where name = 'first'), null, 'tips off hides them');
select is((select public.shared_recipe(token) -> 'recipe' -> 'variants' -> 0 -> 'changes' -> 0 -> 'step' ->> 'tip' from links where name = 'first'), null, 'also in a variant''s added step');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.share_links set include_variants = false where recipe_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_endpoint();
select is((select jsonb_array_length(public.shared_recipe(token) -> 'recipe' -> 'variants') from links where name = 'first'), 0, 'variants off shows only the base recipe');

-- 032-later L38: a deleted recipe's link reads nothing, and works again once restored.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.recipes set deleted_at = now() where id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_endpoint();
select is((select public.shared_recipe(token) from links where name = 'first'), null, 'a deleted recipe is no longer shared');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.recipes set deleted_at = null where id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_endpoint();
select isnt((select public.shared_recipe(token) from links where name = 'first'), null, 'restored, the link works again');

-- US3: stopping ends the link at once; sharing again makes a new one.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.share_links set stopped_at = '2000-01-01' where recipe_id = '00000000-0000-4000-8000-000000000001' and stopped_at is null;
select ok((select stopped_at > now() - interval '1 minute' and stopped_by = '00000000-0000-0000-0000-00000000000a' from public.share_links), 'stopping records when and who');
select is((select stopped_source::text from public.share_links), 'app', 'and through what');
select throws_ok($$ update public.share_links set stopped_at = null $$, 'P0001', 'link_stopped', 'a stopped link stays stopped');
select pg_temp.as_endpoint();
select is((select public.shared_recipe(token) from links where name = 'first'), null, 'a stopped link reads nothing');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select isnt((select token from public.share_recipe('00000000-0000-4000-8000-000000000001')), (select token from links where name = 'first'), 'sharing again makes a new link');

select * from finish();
rollback;
