-- Spec 004: the recipes module's tables. Limits match packages/schemas/recipes.ts.
-- Settings overrides (027), the catalog foreign key (031) and the photo bucket (014) come later.

create type public.unit as enum ('g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'oz', 'lb', 'piece', 'pinch');
create type public.size_word as enum ('small', 'medium', 'large');
create type public.variant_kind as enum ('option', 'version');

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80 and name = btrim(name)),
  description text check (char_length(description) <= 140),
  serves integer not null default 4 check (serves between 1 and 50),
  total_minutes integer check (total_minutes between 1 and 10080),
  prep_minutes integer check (prep_minutes between 1 and 10080),
  cuisine text check (char_length(cuisine) between 1 and 40),
  source_text text check (char_length(source_text) <= 200),
  best_months integer[] not null default '{}' check (best_months <@ array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
  photo_path text check (char_length(photo_path) <= 300),
  -- Soft delete (FR-004, spec 018): hidden everywhere, restorable for 30 days.
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Children reference (id, family_id), so a row can never point at another family's recipe.
  unique (id, family_id)
);
create index recipes_family_created on public.recipes (family_id, created_at desc);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  recipe_id uuid not null,
  position integer not null check (position >= 0),
  name text not null check (char_length(name) between 1 and 80 and name = btrim(name)),
  catalog_key text check (catalog_key ~ '^[a-z0-9_]{1,60}$'),
  quantity numeric check (quantity > 0 and quantity < 100000),
  unit public.unit,
  -- Pieces only: "2 small onions", and the weight of one piece when it was saved.
  size_word public.size_word check (size_word is null or unit = 'piece'),
  weight_per_piece_g numeric check (weight_per_piece_g is null or (weight_per_piece_g > 0 and weight_per_piece_g < 100000 and unit = 'piece')),
  piece_noun_singular text check (char_length(piece_noun_singular) between 1 and 40),
  piece_noun_plural text check (char_length(piece_noun_plural) between 1 and 40),
  prep_note text check (char_length(prep_note) <= 80),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (unit is null or quantity is not null),
  foreign key (recipe_id, family_id) references public.recipes (id, family_id) on delete cascade,
  -- Deferred, so rows can swap positions in one save.
  unique (recipe_id, position) deferrable initially deferred
);

create table public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  recipe_id uuid not null,
  position integer not null check (position >= 0),
  name text check (char_length(name) between 1 and 60),
  -- Text with ingredient tokens `{ing:<ingredient id>}` (spec 016).
  body text not null check (char_length(body) between 1 and 2000),
  timer_seconds integer check (timer_seconds between 1 and 86400),
  timer_label text check (timer_label is null or (char_length(timer_label) between 1 and 40 and timer_seconds is not null)),
  -- Stored in °C; the app shows both scales (constitution V).
  temp_check_c numeric check (temp_check_c between -50 and 400),
  temp_check_text text check (char_length(temp_check_text) between 1 and 120),
  tip text check (char_length(tip) between 1 and 200),
  photo_path text check (char_length(photo_path) <= 300),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (recipe_id, family_id) references public.recipes (id, family_id) on delete cascade,
  unique (recipe_id, position) deferrable initially deferred
);

create table public.recipe_variants (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  recipe_id uuid not null,
  position integer not null check (position >= 0),
  name text not null check (char_length(name) between 1 and 40 and name = btrim(name)),
  kind public.variant_kind not null,
  -- Ordered changes, shaped by VariantChange in packages/schemas/recipes.ts (spec 017).
  changes jsonb not null default '[]' check (jsonb_typeof(changes) = 'array'),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (recipe_id, family_id) references public.recipes (id, family_id) on delete cascade,
  unique (recipe_id, position) deferrable initially deferred
);

create index recipe_ingredients_recipe on public.recipe_ingredients (recipe_id);
create index recipe_steps_recipe on public.recipe_steps (recipe_id);
create index recipe_variants_recipe on public.recipe_variants (recipe_id);

-- Realtime only for recipes and steps (FR-002).
select public._family_table('public.recipes', live => true);
select public._family_table('public.recipe_ingredients', live => false);
select public._family_table('public.recipe_steps', live => true);
select public._family_table('public.recipe_variants', live => false);

-- Who deleted it, for Recently deleted (spec 018); cleared on restore.
create function public._stamp_recipe_deleted() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.deleted_at is null then
    new.deleted_by := null;
  elsif tg_op = 'INSERT' or old.deleted_at is null then
    new.deleted_by := coalesce(auth.uid(), new.deleted_by);
  else
    new.deleted_by := old.deleted_by;
  end if;
  return new;
end;
$$;
create trigger recipes_deleted before insert or update on public.recipes
  for each row execute function public._stamp_recipe_deleted();

-- Any change to a recipe's ingredients, steps or variants also marks the recipe as changed by that
-- person, so one `recipes` event tells everyone with it open (US1, "Alex just changed this recipe").
create function public._touch_parent_recipe() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.recipes set updated_at = now()
    where id = case when tg_op = 'DELETE' then old.recipe_id else new.recipe_id end;
  return null;
end;
$$;
create trigger recipe_ingredients_touch_recipe after insert or update or delete on public.recipe_ingredients
  for each row execute function public._touch_parent_recipe();
create trigger recipe_steps_touch_recipe after insert or update or delete on public.recipe_steps
  for each row execute function public._touch_parent_recipe();
create trigger recipe_variants_touch_recipe after insert or update or delete on public.recipe_variants
  for each row execute function public._touch_parent_recipe();
