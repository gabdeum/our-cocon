-- Spec 027: cooking defaults for the whole family, and a recipe's own exceptions. The family's are
-- on its settings row (021); a recipe's are on the recipe, null meaning "same as the family". Both
-- tables are already family-scoped and live. Limits match packages/schemas/family.ts.
create type public.unit_system as enum ('metric', 'imperial');

alter table public.family_settings
  add column keep_awake boolean not null default true,
  add column has_scale boolean not null default true,
  add column has_thermometer boolean not null default true,
  add column units public.unit_system not null default 'metric';

-- Assistants keep their column-level grants on recipes (023): they read these but never change them.
alter table public.recipes
  add column keep_awake boolean,
  add column has_scale boolean,
  add column has_thermometer boolean,
  add column units public.unit_system;
