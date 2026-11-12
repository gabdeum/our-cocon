-- Spec 051 (after review, with Gabriel): units are a person's choice, not the family's or a
-- recipe's. Each member picks Metric or Imperial on Menu › Recipes; the recipe page and cooking
-- mode have a quick switch for the visit only. Until someone picks, the family's old setting
-- applies, so nothing changes for anyone today. `recipes.units` is no longer read.
create table public.member_recipe_settings (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  units public.unit_system,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, user_id)
);
select public._family_table('public.member_recipe_settings', live => false);
-- A member's own row only, as member_calendar_settings (spec 029). Nobody deletes it.
revoke delete on public.member_recipe_settings from authenticated;
drop policy "members read their family's rows" on public.member_recipe_settings;
drop policy "members add to their family" on public.member_recipe_settings;
drop policy "members change their family's rows" on public.member_recipe_settings;
drop policy "members remove their family's rows" on public.member_recipe_settings;
create policy "members read their own recipe settings" on public.member_recipe_settings
  for select to authenticated using (family_id = public.my_family_id() and user_id = auth.uid());
create policy "members add their own recipe settings" on public.member_recipe_settings
  for insert to authenticated with check (family_id = public.my_family_id() and user_id = auth.uid());
create policy "members change their own recipe settings" on public.member_recipe_settings
  for update to authenticated using (family_id = public.my_family_id() and user_id = auth.uid())
  with check (family_id = public.my_family_id() and user_id = auth.uid());
create trigger member_recipe_settings_keep_owner before update on public.member_recipe_settings
  for each row execute function public._keep_settings_owner();
