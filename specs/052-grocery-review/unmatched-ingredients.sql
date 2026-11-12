-- Our Cocon · ingredients the catalog doesn't know (they land in Other)
-- Read-only. Run in the Supabase dashboard (SQL editor) on prod.
-- Assumes the spec 004 / 031 columns: recipe_ingredients.name, .catalog_key, .unit,
-- recipes.name, .deleted_at, grocery_items.name, .catalog_key, .deleted_at.
-- Rename a column here if your build named it differently.

-- 1) Recipes: one row per ingredient name, most used first
select
  lower(trim(split_part(ri.name, ',', 1)))           as ingredient,   -- detail after a comma dropped
  count(*)                                           as lines,
  count(distinct ri.recipe_id)                       as recipes,
  count(distinct r.family_id)                        as families,
  string_agg(distinct coalesce(ri.unit, '—'), ', ')  as units_used,
  (array_agg(distinct r.name))[1:3]                  as example_recipes
from recipe_ingredients ri
join recipes r on r.id = ri.recipe_id
where ri.catalog_key is null
  and r.deleted_at is null
group by 1
order by lines desc, ingredient;

-- 2) Same, across recipes AND what's on grocery lists now (one combined list to send to Claude Code)
with names as (
  select lower(trim(split_part(ri.name, ',', 1))) as ingredient, 'recipe' as seen_in
  from recipe_ingredients ri
  join recipes r on r.id = ri.recipe_id
  where ri.catalog_key is null and r.deleted_at is null
  union all
  select lower(trim(gi.name)), 'groceries'
  from grocery_items gi
  where gi.catalog_key is null and gi.deleted_at is null
)
select ingredient,
       count(*) filter (where seen_in = 'recipe')    as in_recipes,
       count(*) filter (where seen_in = 'groceries') as on_lists
from names
group by ingredient
order by count(*) desc, ingredient;

-- Export the result as CSV and save it as data/catalog/unmatched-2026-11.csv (spec 052 FR-002).
