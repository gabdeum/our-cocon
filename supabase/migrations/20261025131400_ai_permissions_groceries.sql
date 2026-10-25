-- Spec 024: assistants keep the grocery list, within what each member allows them.
--   - Per-member permissions (FR-002): "Allowed" or "Not allowed" for creating and editing recipes,
--     changing the grocery list and deleting recipes. All Allowed until changed. They apply to every
--     assistant the member connected, and are checked by the database on every assistant write,
--     whatever API it uses (032-later L58), not only by the MCP tools.
--   - The assistant role (spec 023) gets exactly what the grocery tools need, and every assistant
--     grocery write is logged with the row as it was (FR-003; 026 shows and undoes it).

-- --- Permissions ---------------------------------------------------------------------------------

-- One row per member, made the first time they change something; no row means all Allowed. It goes
-- with the member when they're removed from the family.
create table public.ai_permissions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null unique references public.members (user_id) on delete cascade,
  recipes_edit boolean not null default true,
  groceries boolean not null default true,
  recipes_delete boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  source public.write_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select public._family_table('public.ai_permissions', live => false);
-- Nothing to remove: a member sets each one back to Allowed.
drop policy "members remove their family's rows" on public.ai_permissions;
revoke delete on public.ai_permissions from authenticated;

-- Settings are per person (OC-Connect): each member reads and changes only their own row. The row
-- is always the signed-in member's, whatever user_id is sent.
create policy "members see only their own permissions" on public.ai_permissions
  as restrictive for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create function public._stamp_ai_permissions_user() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.user_id := case when tg_op = 'INSERT' then coalesce(auth.uid(), new.user_id) else old.user_id end;
  return new;
end;
$$;
-- Named to run before ai_permissions_stamp (triggers fire in name order).
create trigger ai_permissions_a_user before insert or update on public.ai_permissions
  for each row execute function public._stamp_ai_permissions_user();

-- Whether the caller may do this: always for the app; for an assistant, its member's setting. The
-- MCP server asks before a tool runs, so the assistant gets a plain refusal (spec 024).
create function public.ai_allowed(permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when permission is null or permission not in ('recipes_edit', 'groceries', 'recipes_delete') then false
    when auth.jwt() ->> 'client_id' is null then true
    else coalesce((
      select case permission when 'recipes_edit' then p.recipes_edit when 'groceries' then p.groceries else p.recipes_delete end
      from public.ai_permissions p where p.user_id = auth.uid()), true)
  end;
$$;
revoke all on function public.ai_allowed(text) from public, anon;
grant execute on function public.ai_allowed(text) to authenticated, cocon_assistant;

-- The boundary: an assistant write its member hasn't allowed is refused, on any API. A trigger, not
-- a policy, so a delete (setting deleted_at) is told apart from an edit, and a refusal is an error
-- the MCP server can name rather than an update that silently changes nothing. The message is the
-- permission's key (apps/mcp reads it). It runs with the database's rights, since the assistant
-- role can't read its own token (the `auth` schema); it only reads.
create function public._check_ai_permission() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ignored text[] := array['updated_at', 'updated_by', 'deleted_at', 'deleted_by'];
  edited boolean;
begin
  if auth.jwt() ->> 'client_id' is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_table_name in ('grocery_items', 'grocery_recipes') then
    if not public.ai_allowed('groceries') then
      raise exception 'groceries' using errcode = '42501', hint = 'ai_not_allowed';
    end if;
  elsif tg_table_name = 'recipes' and tg_op = 'UPDATE' then
    if new.deleted_at is distinct from old.deleted_at and not public.ai_allowed('recipes_delete') then
      raise exception 'recipes_delete' using errcode = '42501', hint = 'ai_not_allowed';
    end if;
    -- A recipe's updated_at, touched when its rows change, is part of that change, not an edit.
    edited := (to_jsonb(new) - ignored) <> (to_jsonb(old) - ignored);
    if edited and not public.ai_allowed('recipes_edit') then
      raise exception 'recipes_edit' using errcode = '42501', hint = 'ai_not_allowed';
    end if;
  elsif not public.ai_allowed('recipes_edit') then
    raise exception 'recipes_edit' using errcode = '42501', hint = 'ai_not_allowed';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke execute on function public._check_ai_permission() from public, anon, authenticated;

-- Named to run first (triggers fire in name order).
create trigger a_ai_permission before insert or update or delete on public.recipes
  for each row execute function public._check_ai_permission();
create trigger a_ai_permission before insert or update or delete on public.recipe_ingredients
  for each row execute function public._check_ai_permission();
create trigger a_ai_permission before insert or update or delete on public.recipe_steps
  for each row execute function public._check_ai_permission();
create trigger a_ai_permission before insert or update or delete on public.recipe_variants
  for each row execute function public._check_ai_permission();
create trigger a_ai_permission before insert or update or delete on public.grocery_items
  for each row execute function public._check_ai_permission();
create trigger a_ai_permission before insert or update or delete on public.grocery_recipes
  for each row execute function public._check_ai_permission();

-- --- The grocery tools (032-later L47, L51, L55, L66) ----------------------------------------------

-- Who ticked and who cleared an item read auth.uid(), which the assistant role can't use; they run
-- with the database's rights, as _stamp_row does. They only set those columns.
alter function public._stamp_grocery_checked() security definer;
alter function public._stamp_grocery_deleted() security definer;

-- Items: add, change, tick, and clear or remove by setting deleted_at (Undo, spec 026). No DELETE:
-- only the nightly purge removes them.
grant select,
  insert (id, family_id, name, catalog_key, quantity, unit, aisle, recipe_id),
  update (name, catalog_key, quantity, unit, aisle, checked, deleted_at)
  on public.grocery_items to cocon_assistant;
alter policy "members read their family's rows" on public.grocery_items to authenticated, cocon_assistant;
alter policy "members add to their family" on public.grocery_items to authenticated, cocon_assistant;
alter policy "members change their family's rows" on public.grocery_items to authenticated, cocon_assistant;

-- The servings a recipe is on the list for. Saved by upsert, which sets every column it sends; the
-- database keeps recipe_id (_keep_grocery_recipe) and family_id (_stamp_row) as they were.
grant select,
  insert (family_id, recipe_id, servings),
  update (family_id, recipe_id, servings)
  on public.grocery_recipes to cocon_assistant;
alter policy "members read their family's rows" on public.grocery_recipes to authenticated, cocon_assistant;
alter policy "members add to their family" on public.grocery_recipes to authenticated, cocon_assistant;
alter policy "members change their family's rows" on public.grocery_recipes to authenticated, cocon_assistant;

-- Buy and Need as the app shows them (spec 021): the family's store and round-up setting, and packs.
grant select on public.family_settings, public.ingredient_packs, public.catalog_packs to cocon_assistant;
alter policy "members read their family's rows" on public.family_settings to authenticated, cocon_assistant;
alter policy "signed-in people read the catalog" on public.catalog_packs to authenticated, cocon_assistant;

-- --- The activity log (FR-003) --------------------------------------------------------------------

-- As in spec 023, plus each grocery item's name, so 026 can say what was added ("Milk").
create or replace function public._log_assistant_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  was jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  headers jsonb;
  call_id text;
  tool text;
  payload jsonb;
begin
  if auth.jwt() ->> 'client_id' is null then
    return null;
  end if;
  if tg_op = 'UPDATE' and (r - 'updated_at' - 'updated_by') = (was - 'updated_at' - 'updated_by') then
    return null;
  end if;
  begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    headers := null;
  end;
  call_id := headers ->> 'x-cocon-call';
  tool := headers ->> 'x-cocon-tool';
  -- Empty labels are left out; `before` keeps its empty fields (Undo puts them back too).
  select coalesce(jsonb_object_agg(k, v), '{}') into payload
  from jsonb_each(jsonb_build_object(
    'recipe_id', coalesce(r ->> 'recipe_id', case when tg_table_name = 'recipes' then r ->> 'id' end),
    'call_id', case when call_id ~ '^[0-9a-f-]{36}$' then call_id end,
    'tool', case when tool ~ '^[a-z][a-z_]{0,39}$' then tool end,
    'name', case when tg_table_name in ('recipes', 'grocery_items') then r ->> 'name' end,
    'before', was)) as e (k, v)
  where v <> 'null'::jsonb;
  -- The log keeps payloads under 64 KB. A change it couldn't undo (a variant's long change list) is
  -- refused rather than made without its `before`; the tool says it couldn't save.
  if octet_length(payload::text) > 60000 then
    raise exception 'too big to log for undo' using errcode = '54000';
  end if;
  insert into public.activity (family_id, actor_id, action, target_kind, target_id, payload)
  values ((r ->> 'family_id')::uuid, auth.uid(), lower(tg_op), tg_table_name, (r ->> 'id')::uuid, payload);
  return null;
end;
$$;

create trigger grocery_items_log_assistant after insert or update or delete on public.grocery_items
  for each row execute function public._log_assistant_write();
create trigger grocery_recipes_log_assistant after insert or update or delete on public.grocery_recipes
  for each row execute function public._log_assistant_write();
