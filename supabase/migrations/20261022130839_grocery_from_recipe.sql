-- Spec 022 (032-later L39): an item added from a recipe remembers it, so once the recipe is
-- deleted and purged (recipe_id cleared) its source still reads "From a deleted recipe". Set by
-- the database from recipe_id, never by the writer, and kept once true.
alter table public.grocery_items add column from_recipe boolean not null default false;

create function public._stamp_grocery_from_recipe() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.from_recipe := new.recipe_id is not null or (tg_op = 'UPDATE' and old.from_recipe);
  return new;
end;
$$;
create trigger grocery_items_from_recipe before insert or update on public.grocery_items
  for each row execute function public._stamp_grocery_from_recipe();

update public.grocery_items set from_recipe = true where recipe_id is not null;
