-- Spec 023 part B (032-later L58): the recipe write tools. The assistant role gets exactly what
-- create_recipe, update_recipe and delete_recipe need, through the same RPCs and family policies as
-- the app. Its token also works on Supabase's API directly, so two things hold whatever it calls:
--   - It never removes a recipe for good: delete is the app's soft delete (deleted_at), restorable
--     for 30 days (decision 32).
--   - Every write it makes is logged by the database itself, with the row as it was (FR-005; spec
--     026 shows the log and undoes from it). Assistants can't write log entries of their own.

-- The trigger that stamps who deleted a recipe reads auth.uid(); the assistant role can't use
-- Supabase's `auth` schema, so it runs with the database's rights, as _stamp_row already does. It
-- only sets deleted_by and deleted_at.
alter function public._stamp_recipe_deleted() security definer;

-- Recipes: add, change, and delete by setting deleted_at. Not photos (no tool sets them), and no
-- DELETE.
grant insert (id, family_id, name, description, serves, total_minutes, prep_minutes, cuisine, source_text, best_months),
  update (name, description, serves, total_minutes, prep_minutes, cuisine, source_text, best_months, deleted_at)
  on public.recipes to cocon_assistant;
alter policy "members add to their family" on public.recipes to authenticated, cocon_assistant;
alter policy "members change their family's rows" on public.recipes to authenticated, cocon_assistant;

-- Ingredients, steps and variants: written by save_recipe_ingredients, save_recipe_steps and
-- save_recipe_variants, which run as the caller (rows left out of a save are removed).
grant insert, update, delete on public.recipe_ingredients, public.recipe_steps, public.recipe_variants to cocon_assistant;
alter policy "members add to their family" on public.recipe_ingredients to authenticated, cocon_assistant;
alter policy "members change their family's rows" on public.recipe_ingredients to authenticated, cocon_assistant;
alter policy "members remove their family's rows" on public.recipe_ingredients to authenticated, cocon_assistant;
alter policy "members add to their family" on public.recipe_steps to authenticated, cocon_assistant;
alter policy "members change their family's rows" on public.recipe_steps to authenticated, cocon_assistant;
alter policy "members remove their family's rows" on public.recipe_steps to authenticated, cocon_assistant;
alter policy "members add to their family" on public.recipe_variants to authenticated, cocon_assistant;
alter policy "members change their family's rows" on public.recipe_variants to authenticated, cocon_assistant;
alter policy "members remove their family's rows" on public.recipe_variants to authenticated, cocon_assistant;
grant execute on function public.save_recipe_ingredients(uuid, jsonb), public.save_recipe_steps(uuid, jsonb),
  public.save_recipe_variants(uuid, jsonb), public._variant_changes_ok(jsonb) to cocon_assistant;

-- The catalog matcher (spec 031), so "ice water 50 ml" gets its grams as in the app (L11, L32). It
-- scores names with pg_trgm, which lives in the `extensions` schema (members get it from Supabase).
grant execute on function public.match_ingredients(jsonb) to cocon_assistant;
grant usage on schema extensions to cocon_assistant;
grant select on public.catalog_names to cocon_assistant;
alter policy "signed-in people read the catalog" on public.catalog_names to authenticated, cocon_assistant;

-- The activity log, written by the database (FR-005). One entry per row an assistant adds, changes
-- or removes, whatever API it used: `before` is the row as it was (what Undo puts back, spec 026),
-- taken here so no one can forge it. The MCP server tags its requests with one id per tool call
-- (header x-cocon-call) and the tool's name (x-cocon-tool), so 026 can show one entry per call;
-- they're labels only. A recipe's own updated_at, touched when its rows change, isn't an entry.
create function public._log_assistant_write() returns trigger
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
    'name', case when tg_table_name = 'recipes' then r ->> 'name' end,
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
revoke execute on function public._log_assistant_write() from public, anon, authenticated;

create trigger recipes_log_assistant after insert or update or delete on public.recipes
  for each row execute function public._log_assistant_write();
create trigger recipe_ingredients_log_assistant after insert or update or delete on public.recipe_ingredients
  for each row execute function public._log_assistant_write();
create trigger recipe_steps_log_assistant after insert or update or delete on public.recipe_steps
  for each row execute function public._log_assistant_write();
create trigger recipe_variants_log_assistant after insert or update or delete on public.recipe_variants
  for each row execute function public._log_assistant_write();
