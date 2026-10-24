-- Spec 022: the servings a recipe is on the grocery list for, so its card reads "serves 8" and a
-- quick change of servings rescales its items. One row per recipe per family; "Add to groceries…"
-- adds to it while the recipe still has items on the list, and starts it again otherwise. Never
-- deleted by people (removing a recipe's items leaves it, unused, until the recipe is added again);
-- it goes with the recipe when that is purged.
create table public.grocery_recipes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  recipe_id uuid not null,
  servings int not null check (servings between 1 and 50),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, recipe_id),
  foreign key (recipe_id, family_id) references public.recipes (id, family_id) on delete cascade
);

-- Live like grocery_items: everyone on the list sees the servings change.
select public._family_table('public.grocery_recipes', live => true);
-- As for grocery_items (spec 020), nothing is deleted from the app.
revoke delete on public.grocery_recipes from authenticated;

-- A row stays its recipe's: an update changes only the servings.
create function public._keep_grocery_recipe() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.recipe_id := old.recipe_id;
  return new;
end;
$$;
create trigger grocery_recipes_keep_recipe before update on public.grocery_recipes
  for each row execute function public._keep_grocery_recipe();

-- Recipes already on a list were added at their own servings (the cards showed those until now).
insert into public.grocery_recipes (family_id, recipe_id, servings, created_by, source)
select distinct on (g.family_id, g.recipe_id) g.family_id, g.recipe_id, r.serves, g.created_by, g.source
from public.grocery_items g
join public.recipes r on r.id = g.recipe_id and r.family_id = g.family_id
where g.recipe_id is not null and g.deleted_at is null
order by g.family_id, g.recipe_id, g.created_at;
