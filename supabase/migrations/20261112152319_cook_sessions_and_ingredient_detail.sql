-- Spec 051: cooking sessions (FR-001), the ingredient detail on the grocery list (FR-009) and in
-- prep_note only (FR-007), and the recipe's source on the shared page (FR-015).

-- FR-001: a recipe being cooked. It stays "in progress" until someone marks it done or cancels
-- it; leaving cooking mode never ends it. One open session per recipe per family. Done sessions
-- are the cooking log ("Cooked 4 times · last by Eva"); nothing counts them separately.
create table public.cook_sessions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  recipe_id uuid not null,
  started_by uuid default auth.uid() references auth.users (id) on delete set null,
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  current_step int not null default 0 check (current_step between 0 and 200),
  variant_id uuid references public.recipe_variants (id) on delete set null,
  servings int not null check (servings between 1 and 50),
  status text not null default 'in_progress' check (status in ('in_progress', 'done', 'cancelled')),
  finished_at timestamptz,
  finished_by uuid references auth.users (id) on delete set null,
  cancel_reason text check (cancel_reason in ('user', 'stale', 'replaced', 'recipe_deleted')),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (recipe_id, family_id) references public.recipes (id, family_id) on delete cascade,
  check ((status = 'cancelled') = (cancel_reason is not null)),
  check ((status = 'done') = (finished_at is not null))
);
create unique index cook_sessions_one_open on public.cook_sessions (family_id, recipe_id) where status = 'in_progress';
create index cook_sessions_recipe on public.cook_sessions (recipe_id, status, finished_at desc);

-- Live (FR-003): another member's phone shows the card within seconds.
select public._family_table('public.cook_sessions', live => true);
-- Sessions end as done or cancelled; nobody deletes them (they go with the recipe when it's purged).
revoke delete on public.cook_sessions from authenticated;
drop policy "members remove their family's rows" on public.cook_sessions;
-- get_recipe reads the cooking log (spec 023 line from 051).
grant select on public.cook_sessions to cocon_assistant;
alter policy "members read their family's rows" on public.cook_sessions to authenticated, cocon_assistant;

-- The server keeps the facts: who started it, the recipe, when it was last touched, and who
-- finished it and when. A variant has to be one of the recipe's own. A deleted recipe isn't
-- cooked. An ended cook is the log: it only comes back in progress by Undo, within the hour, and
-- never after the nightly job or a delete ended it.
create function public._stamp_cook_session() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (tg_op = 'INSERT' or new.status = 'in_progress')
    and exists (select 1 from public.recipes r where r.id = new.recipe_id and r.deleted_at is not null) then
    raise exception 'This recipe was deleted' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.status <> 'in_progress' and (
    new.status <> 'in_progress'
    or old.cancel_reason in ('stale', 'recipe_deleted')
    or old.updated_at < now() - interval '1 hour'
  ) then
    raise exception 'This cook has ended' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.started_by := coalesce(auth.uid(), new.started_by);
    new.started_at := now();
    new.last_active_at := now();
    new.status := 'in_progress';
    new.finished_at := null;
    new.finished_by := null;
    new.cancel_reason := null;
  else
    new.recipe_id := old.recipe_id;
    new.started_by := old.started_by;
    new.started_at := old.started_at;
    new.last_active_at := now();
    if new.status = 'done' and old.status <> 'done' then
      new.finished_at := now();
      new.finished_by := coalesce(auth.uid(), new.finished_by);
    elsif new.status <> 'done' then
      new.finished_at := null;
      new.finished_by := null;
    end if;
    if new.status <> 'cancelled' then
      new.cancel_reason := null;
    end if;
  end if;
  if new.variant_id is not null and not exists (
    select 1 from public.recipe_variants v where v.id = new.variant_id and v.recipe_id = new.recipe_id
  ) then
    raise exception 'That variant isn''t one of this recipe''s' using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger cook_sessions_keep before insert or update on public.cook_sessions
  for each row execute function public._stamp_cook_session();

-- Edge case "Deleted recipe": its open session is cancelled. Security definer so an assistant
-- deleting the recipe (it can't write sessions) still closes it.
create function public._cancel_cooking_of_deleted_recipe() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.cook_sessions set status = 'cancelled', cancel_reason = 'recipe_deleted'
  where recipe_id = new.id and family_id = new.family_id and status = 'in_progress';
  return null;
end;
$$;
create trigger recipes_cancel_cooking after update of deleted_at on public.recipes
  for each row when (old.deleted_at is null and new.deleted_at is not null)
  execute function public._cancel_cooking_of_deleted_recipe();

-- Edge case "Stale sessions": untouched for 72 hours, a session is cancelled as stale. Run by
-- the nightly purge (scripts/purge-deleted.ts) with the service key; the app already hides them.
create function public.cancel_stale_cook_sessions() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  update public.cook_sessions set status = 'cancelled', cancel_reason = 'stale'
  where status = 'in_progress' and last_active_at < now() - interval '72 hours';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.cancel_stale_cook_sessions() from public, anon, authenticated;
grant execute on function public.cancel_stale_cook_sessions() to service_role;

-- FR-009: how the recipe prepares an item ("grated"), copied when it's added from a recipe, so
-- the row reads "In recipe: grated". Items don't point at recipe rows, and the list shows what
-- was asked for when it was added.
alter table public.grocery_items add column recipe_detail text check (char_length(recipe_detail) <= 200);
-- Assistants add recipes to the list too (spec 024): they write it on insert, never change it.
grant insert (recipe_detail) on public.grocery_items to cocon_assistant;

-- FR-007: the detail lives in prep_note only. Rows that still carry it after a comma in the name
-- ("Gruyère, grated") move it there; a comma inside brackets stays in the name.
create function pg_temp.first_free_comma(t text) returns int language plpgsql immutable as $$
declare
  depth int := 0;
  c text;
begin
  for i in 1 .. char_length(t) loop
    c := substr(t, i, 1);
    if c = '(' then depth := depth + 1;
    elsif c = ')' and depth > 0 then depth := depth - 1;
    elsif c = ',' and depth = 0 then return i;
    end if;
  end loop;
  return 0;
end;
$$;
update public.recipe_ingredients i
set name = btrim(left(i.name, p - 1)), prep_note = nullif(left(btrim(substr(i.name, p + 1)), 80), '')
from (select id, pg_temp.first_free_comma(name) as p from public.recipe_ingredients) c
where c.id = i.id and c.p > 1 and coalesce(btrim(i.prep_note), '') = ''
  and btrim(left(i.name, c.p - 1)) <> '';

-- FR-015: the shared page shows the recipe's source, or who made it when it has none. The page
-- builds the line (recipeSource), so it gets the parts.
alter function public.shared_recipe(text) rename to _shared_recipe_base;
revoke all on function public._shared_recipe_base(text) from public, anon, authenticated, service_role;

create function public.shared_recipe(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  base jsonb := public._shared_recipe_base(p_token);
  r public.recipes;
begin
  if base is null then
    return null;
  end if;
  select x.* into r from public.share_links s join public.recipes x on x.id = s.recipe_id where s.token = p_token;
  -- Who made it and how only when there's no source to show instead.
  return jsonb_set(base, '{recipe}', (base -> 'recipe') || case
    when nullif(btrim(r.source_text), '') is not null then jsonb_build_object('source_text', r.source_text, 'source', r.source)
    else jsonb_build_object(
      'source_text', null,
      'source', r.source,
      'author_name', (select m.display_name from public.members m where m.user_id = r.created_by and m.family_id = r.family_id))
  end);
end;
$$;
revoke execute on function public.shared_recipe(text) from public, anon, authenticated;
grant execute on function public.shared_recipe(text) to service_role;
