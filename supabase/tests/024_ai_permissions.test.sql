-- Spec 024: assistants keep the grocery list, within what each member allows (FR-002), whatever
-- API they call; every assistant grocery write is logged for Undo (FR-003); a removed member's
-- assistants lose access at once.
begin;
select plan(49);

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
create temp table tokens (token text);
grant all on tokens to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'alex@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'sam@example.com');

-- Family A: Gabriel and Alex. Family B: Sam.
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'authenticated');
insert into ids values ('famA', public.create_family('The Demanges', 'Gabriel'));
insert into tokens select public.create_invite();
with r as (insert into public.recipes (name) values ('Apple tart') returning id) insert into ids select 'tart', id from r;
insert into public.grocery_items (name) values ('Bread');
select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'authenticated');
select public.accept_invite((select token from tokens), 'Alex');
select pg_temp.login('00000000-0000-0000-0000-00000000000f', 'authenticated');
insert into ids values ('famB', public.create_family('The Others', 'Sam'));
insert into public.grocery_items (name) values ('Rice');

-- Permissions are each member's own (OC-Connect: "Settings are per person").
select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'authenticated');
select is(public.ai_allowed('groceries'), true, 'the app is never limited');
select lives_ok($$ insert into public.ai_permissions (user_id, recipes_delete) values ('00000000-0000-0000-0000-00000000000a', false) $$,
  'Alex saves a permission');
select is((select user_id::text from public.ai_permissions), '00000000-0000-0000-0000-00000000000b', 'it is always his own, whatever user_id he sends');
select is((select family_id from public.ai_permissions), (select id from ids where name = 'famA'), 'in his family');
select is((select recipes_delete from public.ai_permissions), false, 'Delete recipes: Not allowed');
select is((select recipes_edit and groceries from public.ai_permissions), true, 'the others stay Allowed');
select throws_ok($$ delete from public.ai_permissions $$, '42501', null, 'a permission is set back, never removed');
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'authenticated');
select is((select count(*)::int from public.ai_permissions), 0, 'Gabriel cannot see Alex''s permissions');
select is(pg_temp.affected($$ update public.ai_permissions set recipes_delete = true $$), 0, 'or change them');
select lives_ok($$ insert into public.ai_permissions (groceries) values (true) $$, 'Gabriel has a row of his own');
select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'authenticated');
select is(pg_temp.affected($$ update public.ai_permissions set user_id = '00000000-0000-0000-0000-00000000000a' $$), 1, 'Alex''s row');
select is((select user_id::text from public.ai_permissions), '00000000-0000-0000-0000-00000000000b', 'never becomes someone else''s');
select pg_temp.login('00000000-0000-0000-0000-00000000000f', 'authenticated');
select is((select count(*)::int from public.ai_permissions), 0, 'another family sees none');

-- Alex's assistant: the grocery list (L58).
select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'cocon_assistant', 'c1');
select is(public.ai_allowed('groceries'), true, 'groceries are Allowed for his assistant');
select is(public.ai_allowed('recipes_delete'), false, 'deleting recipes is not');
select is(public.ai_allowed('anything'), false, 'an unknown permission is never allowed');
select is(public.ai_allowed(null), false, 'nor a missing one');
select throws_ok($$ select * from public.ai_permissions $$, '42501', null, 'it cannot read permissions');
select throws_ok($$ update public.ai_permissions set recipes_delete = true $$, '42501', null, 'or allow itself more');
select is((select array_agg(name)::text from public.grocery_items), '{Bread}', 'it reads its family''s list, and only theirs');
select lives_ok($$ insert into public.grocery_items (name, catalog_key, quantity, unit) values ('Milk', 'milk', 1, 'l') $$, 'it adds an item');
select is((select source::text || ' ' || aisle::text from public.grocery_items where name = 'Milk'), 'mcp dairy_eggs', 'stamped as the assistant''s, in its aisle');
select lives_ok($$ update public.grocery_items set checked = true where name = 'Bread' $$, 'it ticks one');
select is((select checked_by::text from public.grocery_items where name = 'Bread'), '00000000-0000-0000-0000-00000000000b', 'as Alex');
select lives_ok($$ update public.grocery_items set deleted_at = now() where name = 'Bread' $$, 'it clears one the app''s way (Undo)');
select is((select deleted_by::text from public.grocery_items where name = 'Bread'), '00000000-0000-0000-0000-00000000000b', 'stamped as cleared by Alex');
select throws_ok($$ delete from public.grocery_items $$, '42501', null, 'it never removes one for good');
select throws_ok($$ update public.grocery_items set created_by = null $$, '42501', null, 'it cannot change who added an item');
select is(pg_temp.affected($$ update public.grocery_items set checked = true where name = 'Rice' $$), 0, 'or touch another family''s list');
select lives_ok($$ insert into public.grocery_recipes (recipe_id, servings) values ((select id from ids where name = 'tart'), 4) $$, 'it records a recipe''s servings');
select lives_ok($$ update public.grocery_recipes set servings = 6 $$, 'and changes them');
-- What it may send can't move a row: the database keeps the family, the recipe and the stamps.
select lives_ok($$ insert into public.grocery_items (name, family_id) values ('Onion', (select id from ids where name = 'famB')) $$, 'an item sent for another family');
select is((select family_id from public.grocery_items where name = 'Onion'), (select id from ids where name = 'famA'), 'lands in its own');
select throws_ok($$ insert into public.grocery_items (name, source) values ('Leek', 'claude') $$, '42501', null, 'it cannot choose the source');
select throws_ok($$ insert into public.grocery_items (name, created_by) values ('Leek', '00000000-0000-0000-0000-00000000000a') $$, '42501', null, 'or the author');
select lives_ok($$ update public.grocery_recipes set recipe_id = gen_random_uuid(), family_id = (select id from ids where name = 'famB') $$, 'a servings row sent elsewhere');
select is((select recipe_id::text || family_id::text from public.grocery_recipes),
  (select (select id from ids where name = 'tart')::text || (select id from ids where name = 'famA')::text), 'keeps its recipe and family');

-- FR-002: Not allowed holds on the direct API too.
select throws_ok($$ update public.recipes set deleted_at = now() $$, '42501', 'recipes_delete', 'Delete recipes: Not allowed refuses a delete');
select lives_ok($$ update public.recipes set serves = 6 $$, 'while editing is still Allowed');
reset role;
update public.ai_permissions set groceries = false, recipes_edit = false, recipes_delete = true where user_id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'cocon_assistant', 'c1');
select throws_ok($$ insert into public.grocery_items (name) values ('Eggs') $$, '42501', 'groceries', 'Change the grocery list: Not allowed refuses adding');
select throws_ok($$ update public.grocery_items set checked = false $$, '42501', 'groceries', 'and ticking');
select throws_ok($$ update public.recipes set serves = 2 $$, '42501', 'recipes_edit', 'Create and edit recipes: Not allowed refuses an edit');
select lives_ok($$ update public.recipes set deleted_at = now() $$, 'a delete alone needs only Delete recipes (Allowed now)');

-- FR-003: every assistant grocery write is logged, with the row as it was.
reset role;
select is((select count(*)::int from public.activity where target_kind = 'grocery_items'), 4, 'each add, the tick and the clear are an entry');
select is((select payload ->> 'name' from public.activity where target_kind = 'grocery_items' and action = 'insert' order by payload ->> 'name' limit 1), 'Milk', 'with the item''s name');
select ok((select payload #>> '{before,deleted_at}' is null from public.activity
  where target_kind = 'grocery_items' and action = 'update' and payload #>> '{before,checked}' = 'true'), 'the clear keeps the item as it was, for Undo');

-- A member removed from the family: their assistant sees nothing at once.
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'authenticated');
select public.remove_member('00000000-0000-0000-0000-00000000000b');
select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'cocon_assistant', 'c1');
select is((select count(*)::int from public.grocery_items), 0, 'a removed member''s assistant sees no list');
select is(pg_temp.affected($$ update public.grocery_items set checked = true $$), 0, 'and changes nothing');
select pg_temp.login('00000000-0000-0000-0000-00000000000f', 'cocon_assistant', 'c2');
select is((select count(*)::int from public.grocery_recipes), 0, 'another family''s assistant sees no servings rows');

select * from finish();
rollback;
