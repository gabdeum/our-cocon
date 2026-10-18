-- Spec 004: the groceries module's table. Limits match packages/schemas/groceries.ts.

-- The fixed aisle order (spec 031 FR-007): enum order is display order.
create type public.aisle as enum (
  'produce', 'bakery', 'dairy_eggs', 'meat_fish', 'dry_goods', 'spices_baking', 'frozen', 'drinks', 'household', 'other'
);

create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80 and name = btrim(name)),
  catalog_key text check (catalog_key ~ '^[a-z0-9_]{1,60}$'),
  quantity numeric check (quantity > 0 and quantity < 100000),
  unit public.unit,
  -- Null until spec 020 resolves it (family override, then catalog, then Other).
  aisle public.aisle,
  checked boolean not null default false,
  checked_by uuid references auth.users (id) on delete set null,
  checked_at timestamptz,
  -- "For Leek & bacon quiche" (spec 022). Same family only; kept when the recipe goes.
  recipe_id uuid,
  -- created_by is who added it ("Added by Mia"), source how ("via Claude").
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (unit is null or quantity is not null),
  foreign key (recipe_id, family_id) references public.recipes (id, family_id) on delete set null (recipe_id)
);
create index grocery_items_recipe on public.grocery_items (recipe_id);

select public._family_table('public.grocery_items', live => true);

-- Who ticked it and when; cleared when unticked.
create function public._stamp_grocery_checked() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not new.checked then
    new.checked_by := null;
    new.checked_at := null;
  elsif tg_op = 'INSERT' or not old.checked then
    new.checked_by := coalesce(auth.uid(), new.checked_by);
    new.checked_at := now();
  else
    new.checked_by := old.checked_by;
    new.checked_at := old.checked_at;
  end if;
  return new;
end;
$$;
create trigger grocery_items_checked before insert or update on public.grocery_items
  for each row execute function public._stamp_grocery_checked();
