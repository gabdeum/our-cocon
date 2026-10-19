-- Spec 004 FR-005: the seed loads the reference data (supabase/seed.sql). CI's `supabase start`
-- and a local `supabase db reset` load it before these tests run.
begin;
select plan(8);

select is((select count(*)::int from public.recipes where name = 'Leek & bacon quiche'), 1, 'the quiche is seeded');
select is((select count(*)::int from public.recipe_ingredients i join public.recipes r on r.id = i.recipe_id where r.name = 'Leek & bacon quiche'), 8, 'with its 8 ingredients');
select is((select count(*)::int from public.recipe_steps s join public.recipes r on r.id = s.recipe_id where r.name = 'Leek & bacon quiche'), 6, 'and 6 steps');
select is((select array_agg(v.kind::text || ':' || v.name order by v.position) from public.recipe_variants v join public.recipes r on r.id = v.recipe_id
  where r.name = 'Leek & bacon quiche'), array['version:Vegetarian', 'option:Make my own dough'], 'and its 2 variants');
select is((select count(*)::int from public.grocery_items), 7, 'the sample grocery list is seeded');

-- Every {ing:<id>} token in a step points at one of the recipe's ingredients.
select is((select count(*)::int from public.recipe_steps s, regexp_matches(s.body, '\{ing:([0-9a-f-]{36})\}', 'g') m
  where not exists (select 1 from public.recipe_ingredients i where i.id = m[1]::uuid and i.recipe_id = s.recipe_id)), 0, 'step tokens point at the recipe''s ingredients');
select is((select count(*)::int from public.recipe_variants where jsonb_array_length(changes) = 0), 0, 'variants have changes');

-- Spec 031: the samples are linked to the catalog.
select is((select count(*)::int from public.recipe_ingredients where catalog_key is null)
  + (select count(*)::int from public.grocery_items where catalog_key is null), 0, 'seeded ingredients and groceries have catalog keys');

select * from finish();
rollback;
