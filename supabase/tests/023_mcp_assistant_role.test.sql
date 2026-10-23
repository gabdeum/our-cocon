-- Spec 023: an assistant's token can do only what the shipped MCP tools need, whatever API it
-- calls: its own family's recipes (read, add, change, soft delete), every write logged by the
-- database with the row as it was; nothing else.
begin;
select plan(31);

-- As `role` with the claims an access token carries (`client` adds an assistant's client_id).
create function pg_temp.login(uid uuid, r text, client text default null) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',
    jsonb_strip_nulls(jsonb_build_object('sub', uid, 'role', r, 'client_id', client))::text, true);
  execute format('set local role %I', r);
end;
$$;
grant execute on function pg_temp.login(uuid, text, text) to public;
-- Rows a statement changed (0 when RLS hides them).
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
-- pgTAP itself, for the assistant role (this test only: everything rolls back).
grant usage on schema extensions to cocon_assistant;
grant execute on all functions in schema extensions to cocon_assistant;
create temp table ids (name text primary key, id uuid);
grant all on ids to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'sam@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'authenticated');
insert into ids values ('famA', public.create_family('The Demanges', 'Gabriel'));
with r as (insert into public.recipes (name) values ('Quiche') returning id) insert into ids select 'mine', id from r;
select public.save_recipe_steps((select id from ids where name = 'mine'), '[{"id":"5e000000-0000-4000-8000-000000000001","body":"Bake."}]');
insert into public.grocery_items (name) values ('Leeks');
select pg_temp.login('00000000-0000-0000-0000-00000000000f', 'authenticated');
select public.create_family('The Others', 'Sam');
with r as (insert into public.recipes (name) values ('Soup') returning id) insert into ids select 'theirs', id from r;

-- The hook: only an assistant's token changes role.
reset role;
select is(public.access_token_hook('{"claims":{"role":"authenticated","client_id":"c1"}}') #>> '{claims,role}', 'cocon_assistant', 'an assistant token gets the assistant role');
select is(public.access_token_hook('{"claims":{"role":"authenticated"}}') #>> '{claims,role}', 'authenticated', 'the app keeps its role');
select is(public.password_attempt_hook('{"valid":true}') ->> 'decision', 'reject', 'no one signs in with a password');

select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'cocon_assistant', 'c1');
select is((select count(*)::int from public.recipes), 1, 'the assistant reads its member''s recipes, and only theirs');
select is((select name from public.recipes), 'Quiche', 'its own family''s recipe');
select is((select count(*)::int from public.members), 1, 'and its family''s members');
select ok((select count(*) from public.ingredient_facts) > 0, 'and the catalog');
select is(public.my_family_id(), (select id from ids where name = 'famA'), 'it knows its family');

-- Part B: the write tools.
select lives_ok($$ insert into public.recipes (name) values ('Ratatouille') $$, 'it adds a recipe');
select is((select source::text from public.recipes where name = 'Ratatouille'), 'mcp', 'stamped as an assistant''s');
select lives_ok($$ update public.recipes set serves = 8 where name = 'Quiche' $$, 'it changes one');
select is((select count(*)::int from public.recipes where serves = 8), 1, 'only its own family''s');
select lives_ok($$ update public.recipes set deleted_at = now() where name = 'Quiche' $$, 'it deletes one the app''s way (restorable)');
select throws_ok($$ delete from public.recipes $$, '42501', null, 'it never removes one for good');
select is(pg_temp.affected($$ update public.recipes set serves = 9 where name = 'Soup' $$), 0, 'it cannot change another family''s recipe');
select throws_ok($$ select public.save_recipe_steps((select id from ids where name = 'theirs'), '[]') $$, 'P0002', null, 'or save its steps');
select throws_ok($$ update public.recipes set photo_path = null $$, '42501', null, 'it cannot set photos');

-- FR-005: the database logs what it did, with the row as it was, even straight through the API.
select lives_ok($$ delete from public.recipe_steps $$, 'it removes a step directly');
select throws_ok($$ insert into public.activity (action, target_kind) values ('recipe_created', 'recipe') $$, '42501', null, 'it cannot write log entries itself');
reset role;
select is((select payload #>> '{before,body}' from public.activity where action = 'delete' and target_kind = 'recipe_steps'), 'Bake.', 'the removed step is logged as it was');
select is((select source::text from public.activity where action = 'delete' and target_kind = 'recipe_steps'), 'mcp', 'as the assistant''s');
select is((select count(*)::int from public.activity where action = 'update' and target_kind = 'recipes'), 2, 'each change to a recipe is one entry (serves, then deleted_at)');
select is((select count(*)::int from public.activity where source = 'app'), 0, 'the app''s own writes are not logged');
-- A row too big for the log can't be changed by an assistant: nothing would undo it.
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'authenticated');
insert into public.recipe_variants (recipe_id, position, name, kind, changes)
select (select id from ids where name = 'mine'), 0, 'Huge', 'option',
  (select jsonb_agg(jsonb_build_object('type', 'add_step', 'step_id', '5e000000-0000-4000-8000-000000000001', 'place', 'after',
    'step', jsonb_build_object('body', repeat('x', 1900)))) from generate_series(1, 40));
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'cocon_assistant', 'c1');
select throws_ok($$ delete from public.recipe_variants where name = 'Huge' $$, '54000', null, 'a change too big to log for undo is refused');
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'cocon_assistant', 'c1');
select is((select catalog_key from public.match_ingredients('[{"full":"olive oil","core":"olive oil"}]'::jsonb)), 'olive_oil', 'it matches names against the catalog, as the app does');
select throws_ok($$ select * from public.grocery_items $$, '42501', null, 'it cannot see the grocery list yet (spec 024)');
select throws_ok($$ select * from public.activity $$, '42501', null, 'or the activity log');
select throws_ok($$ select * from public.share_links $$, '42501', null, 'or share links');
select throws_ok($$ select public.delete_family() $$, '42501', null, 'it cannot delete the family');
select throws_ok($$ select public.create_invite() $$, '42501', null, 'or invite someone');
select throws_ok($$ select public.delete_my_account() $$, '42501', null, 'or delete the account');

select * from finish();
rollback;
