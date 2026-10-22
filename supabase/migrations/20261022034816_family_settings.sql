-- Spec 021: the family's settings, one row per family. 021 adds where the family shops and
-- whether the list rounds up to store sizes; spec 027 adds the cooking defaults here. No row
-- means the defaults below. Limits match FamilySettings in packages/schemas/family.ts.
create table public.family_settings (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null unique references public.families (id) on delete cascade,
  store_profile public.store_profile not null default 'us',
  round_to_packs boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Live: a change on one phone updates every grocery list in the family (US2).
select public._family_table('public.family_settings', live => true);
-- The app only ever saves this row; deleting it would silently put everyone back on the defaults.
revoke delete on public.family_settings from authenticated;
