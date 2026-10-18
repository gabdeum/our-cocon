-- Spec 031: the ingredient catalog. The global catalog is read-only for everyone signed in and
-- hidden when signed out; family_ingredients follows the family rules; the matcher applies a
-- family's own corrections only to that family. The matching itself (normalising, US1–US3,
-- SC-001) is tested from TypeScript in scripts/catalog.test.ts.
begin;
select plan(38);

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

-- The aisle the matcher gives one name (already normalised, as packages/schemas sends it).
create function pg_temp.aisle_of(name text) returns text language sql as $$
  select aisle::text from public.match_ingredients(jsonb_build_array(jsonb_build_object('full', name, 'core', name)))
$$;
grant execute on function pg_temp.login(uuid), pg_temp.affected(text), pg_temp.aisle_of(text) to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'sam@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.create_family('The Demanges', 'Gabriel');
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select public.create_family('The Others', 'Sam');

-- The catalog: loaded by the data migration, readable when signed in, never writable.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select ok((select count(*) from public.catalog_ingredients) >= 200, 'the catalog ships about 200 ingredients (FR-003)');
select ok((select count(*) from public.catalog_names) > (select count(*) from public.catalog_ingredients), 'with names and synonyms to match');
select ok((select count(*) from public.catalog_packs) > 0, 'and store packs');
select is((select count(*)::int from public.catalog_ingredients where size_medium_g is null and (size_small_g is not null or size_large_g is not null)),
  0, 'everything with sizes has a medium one (SC-002)');
select throws_ok($$ insert into public.catalog_ingredients (key, names, aisle) values ('mine', '{"en": {}}', 'other') $$, '42501', null,
  'members cannot add to the catalog');
select throws_ok($$ update public.catalog_ingredients set aisle = 'other' $$, '42501', null, 'members cannot change the catalog');
select throws_ok($$ delete from public.catalog_packs $$, '42501', null, 'members cannot remove packs');
select throws_ok($$ insert into public.catalog_names values ('en', 'mine', 'onion', 'synonym') $$, '42501', null, 'members cannot add names');

select pg_temp.login(null);
select throws_ok($$ select count(*) from public.catalog_ingredients $$, '42501', null, 'signed out sees no catalog');
select throws_ok($$ select count(*) from public.ingredient_facts $$, '42501', null, 'signed out sees no facts');
select throws_ok($$ select * from public.match_ingredients('[]') $$, '42501', null, 'signed out cannot match');
select throws_ok($$ select * from public.suggest_ingredients('onion') $$, '42501', null, 'signed out gets no suggestions');
select throws_ok($$ select count(*) from public.ingredient_packs $$, '42501', null, 'signed out sees no packs');

-- Grants: the API is callable when signed in; internal helpers never.
reset role;
select ok(has_function_privilege('authenticated', 'public.match_ingredients(jsonb)', 'execute'), 'members can match');
select ok(has_function_privilege('authenticated', 'public.suggest_ingredients(text, integer)', 'execute'), 'members get suggestions');
select ok(not has_function_privilege('authenticated', 'public._load_catalog(jsonb)', 'execute'), 'only migrations load the catalog');
select ok(not has_function_privilege('anon', 'public.suggest_ingredients(text, integer)', 'execute'), 'signed out gets no suggestions');

-- Keys are permanent: data without an existing key stops the load.
select throws_like($$ select public._load_catalog('{"ingredients": []}') $$, '%keys are permanent%', 'a missing key stops the catalog load');

-- Catalog keys on recipes and groceries must exist.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok($$ insert into public.grocery_items (name, catalog_key) values ('Unicorn', 'unicorn') $$, '23503', null,
  'an unknown catalog key is refused');
select lives_ok($$ insert into public.grocery_items (name, catalog_key) values ('Leeks', 'leek') $$, 'a known catalog key is fine');

-- US3: Za'atar is unknown, lands in Other; after Gabriel moves it, it goes there for his family only.
select is(pg_temp.aisle_of('zaatar'), 'other', 'an unknown ingredient lands in Other');
select lives_ok($$ insert into public.family_ingredients (custom_name, name_norm, aisle) values ('Za''atar', 'zaatar', 'spices_baking') $$,
  'a member saves a custom ingredient');
select is(pg_temp.aisle_of('zaatar'), 'spices_baking', 'it lands in the aisle the family chose from then on');
select lives_ok($$ insert into public.family_ingredients (catalog_key, aisle, size_medium_g, packs)
  values ('leek', 'other', 180, '[{"size": 3, "unit": "piece", "label": "bunch of 3", "loose": false}]') $$, 'a member corrects a catalog entry');
select is((select aisle::text || ' ' || size_medium_g from public.ingredient_facts where catalog_key = 'leek'), 'other 180', 'the correction applies to the family');
select is((select label from public.ingredient_packs where catalog_key = 'leek' and profile = 'eu'), 'bunch of 3', 'and its packs replace the catalog''s');
select throws_ok($$ insert into public.family_ingredients (catalog_key, packs) values ('onion', '[{"size": "lots"}]') $$, '23514', null,
  'packs must be shaped like PackSize');
select throws_ok($$ insert into public.family_ingredients (catalog_key, custom_name, name_norm) values ('onion', 'Onion', 'onion') $$, '23514', null,
  'a row is a catalog correction or a custom ingredient, not both');

select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select is(pg_temp.aisle_of('zaatar'), 'other', 'another family still gets Other');
select is((select aisle::text from public.ingredient_facts where catalog_key = 'leek'), 'produce', 'and the catalog aisle for leeks');
select is((select count(*)::int from public.family_ingredients), 0, 'another family sees none of our corrections');
select is(pg_temp.affected($$ update public.family_ingredients set aisle = 'frozen' $$), 0, 'or changes them');
select is(pg_temp.affected($$ delete from public.family_ingredients $$), 0, 'or deletes them');
select is((select count(*)::int from public.ingredient_facts where family_ingredient_id is not null), 0, 'or sees our custom ingredients in the facts');
select is((select count(*)::int from public.ingredient_packs where family_ingredient_id is not null), 0, 'or our packs');
select is((select label from public.ingredient_packs where catalog_key = 'leek' and profile = 'eu' and position = 0), '1 kg bunch', 'and gets the catalog''s packs for leeks');
select is((select count(*)::int from public.suggest_ingredients('zaatar') where family_ingredient_id is not null), 0, 'and no suggestions from our ingredients');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select catalog_key is null and name = 'Za''atar' from public.suggest_ingredients('zaatar') limit 1), true, 'while we get our own custom ingredient suggested');

select * from finish();
rollback;
