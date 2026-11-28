-- Spec 078: the catalog answers to French and Spanish names, and shows names in the person's language.
begin;
select plan(15);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000078a', 'gabriel@example.com', '{"lang": "fr"}'),
  ('00000000-0000-0000-0000-00000000078b', 'eva@example.com', '{}'),
  ('00000000-0000-0000-0000-00000000078c', 'mia@example.com', '{"lang": "de"}');
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000078a', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.create_family('The Demanges', 'Gabriel');
-- A custom ingredient with its own packs, for the isolation checks below.
insert into public.family_ingredients (custom_name, name_norm, aisle, packs)
values ('Mamie’s spice mix', 'mamie spice mix', 'other', '[{"size": 1, "unit": "piece", "label": "jar", "loose": false}]');

select is((select catalog_key from public.match_ingredients('[{"full": "oignon", "core": "oignon"}]')), 'onion', 'FR-003: "oignons" is the onion');
select is((select catalog_key from public.match_ingredients('[{"full": "cebolla", "core": "cebolla"}]')), 'onion', 'and so is "cebollas"');
select is((select catalog_key from public.match_ingredients('[{"full": "onion", "core": "onion"}]')), 'onion', 'English still matches');
select is((select name from public.match_ingredients('[{"full": "onion", "core": "onion"}]')), 'Oignon', 'a French speaker reads the French name');
select is((select noun_singular from public.ingredient_facts where catalog_key = 'garlic'), 'gousse d’ail', 'and the French piece noun');
select ok((select count(*) from public.suggest_ingredients('oign')) > 0, 'suggestions find French names');
select ok(exists (select 1 from public.ingredient_packs where catalog_key = 'onion' and label ~ 'à l’unité|filet|kg'), 'pack labels are French');

-- An assistant for the same person reads English (MCP tool text stays English).
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000078a', 'role', 'cocon_assistant')::text, true);
select is(public._lang(), 'en', 'an assistant reads English, whatever the person picked');

-- Someone with no language saved, or one the app doesn't speak, reads English.
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000078b', 'role', 'authenticated')::text, true);
select is(public._lang(), 'en', 'no language saved: English');
select public.create_family('The Martins', 'Eva');
select is((select count(*)::int from public.ingredient_facts where name = 'Mamie’s spice mix'), 0, 'another family’s custom ingredient stays hidden');
select is((select count(*)::int from public.ingredient_packs where label = 'jar'), 0, 'and so do its packs');
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000078c', 'role', 'authenticated')::text, true);
select is(public._lang(), 'en', 'a language the app doesn’t speak: English');
reset role;
select ok(not has_function_privilege('anon', 'public._lang()', 'execute'), 'signed-out people can’t call it');
select is((select f.name from public._ingredient_facts(null::uuid) f where f.catalog_key = 'onion'), 'Onion', 'share pages (no person) read English');
select is((select count(*)::int from public.catalog_ingredients where names -> 'fr' is null or names -> 'es' is null), 0, 'SC-003: every item has French and Spanish names');

select * from finish();
rollback;
