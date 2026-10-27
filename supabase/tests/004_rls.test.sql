-- Spec 004: family tables. US2 / SC-002: for every table, read, insert, update and delete as a
-- member, as another family's member and signed out. FR-003 stamps, FR-002 live changes.
begin;
select plan(77);

-- As a signed-in person (or signed out with null), until the next call. `client` adds the
-- OAuth client_id claim an MCP connection's token carries (spec 023).
create function pg_temp.login(uid uuid, client text default null) returns void language plpgsql as $$
begin
  reset role;
  if uid is null then
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims',
      jsonb_strip_nulls(jsonb_build_object('sub', uid, 'role', 'authenticated', 'client_id', client))::text, true);
    set local role authenticated;
  end if;
end;
$$;

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

grant execute on function pg_temp.login(uuid, text), pg_temp.affected(text) to public;

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated, anon;
create function pg_temp.id(name text) returns uuid language sql as $$ select id from ids where ids.name = id.name $$;
grant execute on function pg_temp.id(text) to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'alex@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'sam@example.com');

-- Family A: Gabriel and Alex. Family B: Sam.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids values ('famA', public.create_family('The Demanges', 'Gabriel'));
create temp table tokens (token text);
grant all on tokens to authenticated;
insert into tokens select public.create_invite();
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.accept_invite((select token from tokens), 'Alex');
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
insert into ids values ('famB', public.create_family('The Others', 'Sam'));

-- Gabriel writes one row in every table. The family, author and source are not his to choose.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
with r as (
  insert into public.recipes (name, family_id, created_by, source)
  values ('Leek & bacon quiche', pg_temp.id('famB'), '00000000-0000-0000-0000-00000000000f', 'claude') returning id) insert into ids select 'recipe', id from r;
select is((select family_id from public.recipes where id = pg_temp.id('recipe')), pg_temp.id('famA'), 'a recipe goes to my family, whatever family_id says');
select is((select created_by from public.recipes where id = pg_temp.id('recipe')), '00000000-0000-0000-0000-00000000000a'::uuid, 'created_by is me');
select is((select updated_by from public.recipes where id = pg_temp.id('recipe')), '00000000-0000-0000-0000-00000000000a'::uuid, 'updated_by is me');
select is((select source::text from public.recipes where id = pg_temp.id('recipe')), 'app', 'the app cannot pose as an assistant');

with r as (
  insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit) values (pg_temp.id('recipe'), 0, 'Leeks', 2, 'piece') returning id) insert into ids select 'ingredient', id from r;
with r as (
  insert into public.recipe_steps (recipe_id, position, body, timer_seconds) values (pg_temp.id('recipe'), 0, 'Soften the leeks', 600) returning id) insert into ids select 'step', id from r;
with r as (
  insert into public.recipe_variants (recipe_id, position, name, kind) values (pg_temp.id('recipe'), 0, 'Vegetarian', 'version') returning id) insert into ids select 'variant', id from r;
with r as (
  insert into public.grocery_items (name, quantity, unit, recipe_id) values ('Leeks', 2, 'piece', pg_temp.id('recipe')) returning id) insert into ids select 'grocery', id from r;
-- Members only add undo entries for an AI entry (spec 026); one written by the database here.
reset role;
insert into public.activity (family_id, action, target_kind, target_id, source) values (pg_temp.id('famA'), 'insert', 'recipes', pg_temp.id('recipe'), 'claude');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select family_id from public.recipe_ingredients), pg_temp.id('famA'), 'ingredient is in my family');
select is((select family_id from public.grocery_items), pg_temp.id('famA'), 'grocery item is in my family');
select throws_ok(format($$ insert into public.activity (action, target_kind, target_id) values ('undo', 'activity', %L) $$, pg_temp.id('recipe')),
  '42501', null, 'members cannot mark something undone that isn''t an AI entry');

-- Through an MCP connection (OAuth client_id claim), the assistant's name comes from the server's
-- list of clients, never from the row; an unknown client is just 'mcp'.
reset role;
insert into public.oauth_client_sources values ('c0ffee00-0000-4000-8000-000000000001', 'claude');
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'c0ffee00-0000-4000-8000-000000000001');
with r as (insert into public.recipes (name, source) values ('Soup', 'chatgpt') returning id) insert into ids select 'ai_recipe', id from r;
select is((select source::text from public.recipes where id = pg_temp.id('ai_recipe')), 'claude', 'an MCP write records its assistant, whatever source says');
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'c0ffee00-0000-4000-8000-000000000002');
with r as (insert into public.recipes (name, source) values ('Stew', 'app') returning id) insert into ids select 'ai_recipe2', id from r;
select is((select source::text from public.recipes where id = pg_temp.id('ai_recipe2')), 'mcp', 'an unknown client is recorded as mcp, never as the app');
select throws_ok($$ select * from public.oauth_client_sources $$, '42501', null, 'members cannot read the client list');
select throws_ok($$ insert into public.oauth_client_sources values ('mine', 'claude') $$, '42501', null, 'members cannot name their own client');

-- Alex (same family) sees and changes everything; who changed it is recorded.
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.recipes), 3, 'Alex sees the family''s recipes');
select is(pg_temp.affected($$ update public.recipes set serves = 6, created_by = auth.uid(), source = 'gemini' where name = 'Leek & bacon quiche' $$), 1, 'Alex updates a recipe');
select is((select updated_by from public.recipes where id = pg_temp.id('recipe')), '00000000-0000-0000-0000-00000000000b'::uuid, 'updated_by is Alex');
select is((select created_by from public.recipes where id = pg_temp.id('recipe')), '00000000-0000-0000-0000-00000000000a'::uuid, 'created_by cannot change');
select is((select source::text from public.recipes where id = pg_temp.id('recipe')), 'app', 'source cannot change');
update public.recipes set family_id = pg_temp.id('famB') where id = pg_temp.id('recipe');
select is((select family_id from public.recipes where id = pg_temp.id('recipe')), pg_temp.id('famA'), 'a recipe cannot be moved to another family');

-- A change to an ingredient or a variant marks the recipe as changed by that person.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.recipe_variants set name = 'Veggie' where id = pg_temp.id('variant');
select is((select updated_by from public.recipes where id = pg_temp.id('recipe')), '00000000-0000-0000-0000-00000000000a'::uuid, 'variant edit stamps the recipe');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
update public.recipe_ingredients set quantity = 3 where id = pg_temp.id('ingredient');
select is((select updated_by from public.recipes where id = pg_temp.id('recipe')), '00000000-0000-0000-0000-00000000000b'::uuid, 'ingredient edit stamps the recipe');

select is(pg_temp.affected(format('update public.recipe_steps set tip = %L where id = %L', 'Use a deep pan', pg_temp.id('step'))), 1, 'Alex updates a step');
select is((select updated_by from public.recipe_steps where id = pg_temp.id('step')), '00000000-0000-0000-0000-00000000000b'::uuid, 'step updated_by is Alex');

-- Ticking records who and when; unticking clears it.
update public.grocery_items set checked = true, checked_by = '00000000-0000-0000-0000-00000000000f' where id = pg_temp.id('grocery');
select is((select checked_by from public.grocery_items), '00000000-0000-0000-0000-00000000000b'::uuid, 'checked_by is who ticked it');
select isnt((select checked_at from public.grocery_items), null, 'checked_at is set');
update public.grocery_items set checked = false where id = pg_temp.id('grocery');
select is((select checked_by from public.grocery_items), null, 'unticking clears checked_by');

-- Soft delete (FR-004).
update public.recipes set deleted_at = now() - interval '60 days' where id = pg_temp.id('ai_recipe2');
select is((select deleted_at from public.recipes where id = pg_temp.id('ai_recipe2')), now(), 'the deletion time is the database''s, not backdated');
select is((select deleted_by from public.recipes where id = pg_temp.id('ai_recipe2')), '00000000-0000-0000-0000-00000000000b'::uuid, 'deleted_by is who deleted it');
update public.recipes set deleted_at = null where id = pg_temp.id('ai_recipe2');
select is((select deleted_by from public.recipes where id = pg_temp.id('ai_recipe2')), null, 'restoring clears deleted_by');

-- Sam (another family) sees nothing of family A, and changes nothing.
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select is((select count(*)::int from public.recipes), 0, 'other family: recipes read 0 rows');
select is((select count(*)::int from public.recipe_ingredients), 0, 'other family: ingredients read 0 rows');
select is((select count(*)::int from public.recipe_steps), 0, 'other family: steps read 0 rows');
select is((select count(*)::int from public.recipe_variants), 0, 'other family: variants read 0 rows');
select is((select count(*)::int from public.grocery_items), 0, 'other family: grocery items read 0 rows');
select is((select count(*)::int from public.activity), 0, 'other family: activity reads 0 rows');

select is(pg_temp.affected($$ update public.recipes set name = 'Mine now' $$), 0, 'other family: recipes update 0 rows');
select is(pg_temp.affected($$ update public.recipe_ingredients set name = 'x' $$), 0, 'other family: ingredients update 0 rows');
select is(pg_temp.affected($$ update public.recipe_steps set body = 'x' $$), 0, 'other family: steps update 0 rows');
select is(pg_temp.affected($$ update public.recipe_variants set name = 'x' $$), 0, 'other family: variants update 0 rows');
select is(pg_temp.affected($$ update public.grocery_items set checked = true $$), 0, 'other family: grocery items update 0 rows');
select throws_ok($$ update public.activity set action = 'x' $$, '42501', null, 'other family: activity cannot be updated');

select is(pg_temp.affected($$ delete from public.recipes $$), 0, 'other family: recipes delete 0 rows');
select is(pg_temp.affected($$ delete from public.recipe_ingredients $$), 0, 'other family: ingredients delete 0 rows');
select is(pg_temp.affected($$ delete from public.recipe_steps $$), 0, 'other family: steps delete 0 rows');
select is(pg_temp.affected($$ delete from public.recipe_variants $$), 0, 'other family: variants delete 0 rows');
select throws_ok($$ delete from public.grocery_items $$, '42501', null, 'other family: grocery items cannot be deleted (cleared instead, spec 020)');
select throws_ok($$ delete from public.activity $$, '42501', null, 'other family: activity cannot be deleted');

-- Inserting into family A: the row lands in Sam's own family, and can't point at A's recipe.
insert into public.recipes (name, family_id) values ('Sneaky', pg_temp.id('famA'));
select is((select family_id from public.recipes where name = 'Sneaky'), pg_temp.id('famB'), 'other family: a recipe insert lands in their own family');
select throws_ok(format($$ insert into public.recipe_ingredients (recipe_id, position, name) values (%L, 1, 'x') $$, pg_temp.id('recipe')),
  '23503', null, 'other family: cannot add an ingredient to A''s recipe');
select throws_ok(format($$ insert into public.recipe_steps (recipe_id, position, body) values (%L, 1, 'x') $$, pg_temp.id('recipe')),
  '23503', null, 'other family: cannot add a step to A''s recipe');
select throws_ok(format($$ insert into public.recipe_variants (recipe_id, position, name, kind) values (%L, 1, 'x', 'option') $$, pg_temp.id('recipe')),
  '23503', null, 'other family: cannot add a variant to A''s recipe');
select throws_ok(format($$ insert into public.grocery_items (name, recipe_id) values ('x', %L) $$, pg_temp.id('recipe')),
  '23503', null, 'other family: cannot link a grocery item to A''s recipe');
select throws_ok(format($$ insert into public.activity (action, target_kind, target_id) values ('undo', 'activity', %L) $$,
  (select id from public.activity limit 1)), '42501', null, 'other family: cannot mark A''s AI entry undone');

-- Signed out: no access at all.
select pg_temp.login(null);
select throws_ok($$ select 1 from public.recipes $$, '42501', null, 'signed out: recipes unreadable');
select throws_ok($$ select 1 from public.recipe_ingredients $$, '42501', null, 'signed out: ingredients unreadable');
select throws_ok($$ select 1 from public.recipe_steps $$, '42501', null, 'signed out: steps unreadable');
select throws_ok($$ select 1 from public.recipe_variants $$, '42501', null, 'signed out: variants unreadable');
select throws_ok($$ select 1 from public.grocery_items $$, '42501', null, 'signed out: grocery items unreadable');
select throws_ok($$ select 1 from public.activity $$, '42501', null, 'signed out: activity unreadable');
select throws_ok($$ insert into public.recipes (name) values ('x') $$, '42501', null, 'signed out: cannot insert');

-- Gabriel deletes in every table except activity, which nobody can change.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok($$ update public.activity set action = 'x' $$, '42501', null, 'member: activity cannot be updated');
select throws_ok($$ delete from public.activity $$, '42501', null, 'member: activity cannot be deleted');
select is(pg_temp.affected(format('delete from public.recipe_ingredients where id = %L', pg_temp.id('ingredient'))), 1, 'member deletes an ingredient');
select is(pg_temp.affected(format('delete from public.recipe_steps where id = %L', pg_temp.id('step'))), 1, 'member deletes a step');
select is(pg_temp.affected(format('delete from public.recipe_variants where id = %L', pg_temp.id('variant'))), 1, 'member deletes a variant');
select throws_ok(format('delete from public.grocery_items where id = %L', pg_temp.id('grocery')), '42501', null,
  'grocery items are cleared, never deleted (spec 020)');
select is(pg_temp.affected(format('delete from public.recipes where id = %L', pg_temp.id('ai_recipe'))), 0, 'a recipe cannot be removed for good before it is deleted');
update public.recipes set deleted_at = now() where id = pg_temp.id('ai_recipe');
select is(pg_temp.affected(format('delete from public.recipes where id = %L', pg_temp.id('ai_recipe'))), 1, 'a deleted recipe can be removed for good (Delete now)');
select is((select count(*)::int from public.recipe_ingredients), 0, 'a recipe''s rows go with it');

-- Live changes (FR-002): only recipes, steps, grocery items and activity send, on the family's
-- channel, with ids only.
reset role;
select ok((select count(*) from realtime.messages where topic = 'family:' || pg_temp.id('famA') and payload ->> 'table' = 'recipes') > 0, 'recipes send changes');
select ok((select count(*) from realtime.messages where topic = 'family:' || pg_temp.id('famA') and payload ->> 'table' = 'recipe_steps') > 0, 'steps send changes');
select ok((select count(*) from realtime.messages where topic = 'family:' || pg_temp.id('famA') and payload ->> 'table' = 'grocery_items') > 0, 'grocery items send changes');
select ok((select count(*) from realtime.messages where topic = 'family:' || pg_temp.id('famA') and payload ->> 'table' = 'activity') > 0, 'activity sends changes');
select is((select count(*)::int from realtime.messages where payload ->> 'table' in ('recipe_ingredients', 'recipe_variants')), 0, 'ingredients and variants travel through their recipe');
select is((select array_agg(distinct k order by k) from realtime.messages, jsonb_object_keys(payload) k where topic = 'family:' || pg_temp.id('famA')),
  array['by', 'id', 'op', 'recipe_id', 'source', 'table'], 'messages carry ids, never content');
select ok(exists (select 1 from realtime.messages where payload ->> 'id' = pg_temp.id('ai_recipe')::text and payload ->> 'op' = 'delete'), 'deletes are sent too');

-- Who may listen: Alex to family A's channel, Sam not.
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select set_config('realtime.topic', 'family:' || pg_temp.id('famA'), true);
select ok((select count(*) from realtime.messages) > 0, 'a member can listen to their family''s channel');
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select set_config('realtime.topic', 'family:' || pg_temp.id('famA'), true);
select is((select count(*)::int from realtime.messages), 0, 'another family cannot listen');
select throws_ok(format($$ insert into realtime.messages (topic, extension, payload, private) values ('family:%s', 'broadcast', '{}', true) $$, pg_temp.id('famA')),
  '42501', null, 'members cannot send on a family channel');

select * from finish();
rollback;
