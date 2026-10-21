-- Spec 018: deleted recipes stay restorable for 30 days (FR-004), then a nightly job removes them
-- for good with their photos (FR-002, scripts/purge-deleted.ts).

-- As in 004, plus: a member can't restore a recipe once its 30 days are over (the nightly job is
-- about to remove it). The time is the database's, so it can't be stretched either.
create or replace function public._stamp_recipe_deleted() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.deleted_at is null then
    if tg_op = 'UPDATE' and old.deleted_at is not null and auth.uid() is not null
      and old.deleted_at < now() - interval '30 days' then
      raise exception 'This recipe was deleted more than 30 days ago' using errcode = '22023';
    end if;
    new.deleted_by := null;
  elsif tg_op = 'INSERT' or old.deleted_at is null then
    new.deleted_by := coalesce(auth.uid(), new.deleted_by);
    if auth.uid() is not null then
      new.deleted_at := now();
    end if;
  else
    new.deleted_by := old.deleted_by;
    new.deleted_at := old.deleted_at;
  end if;
  return new;
end;
$$;

-- Recently deleted lists a family's deleted recipes newest first.
create index recipes_family_deleted on public.recipes (family_id, deleted_at desc) where deleted_at is not null;

-- The nightly job (server only): which recipes are due, so their photo folders can be emptied first.
create function public.recipes_due_for_purge() returns table (id uuid, family_id uuid)
language sql stable security definer set search_path = '' as $$
  select r.id, r.family_id from public.recipes r
  where r.deleted_at is not null and r.deleted_at < now() - interval '30 days'
  order by r.deleted_at;
$$;

-- Then removes them; ingredients, steps and variants go with them, grocery items stay (their
-- recipe_id is cleared). Only rows that are still due, so a restore in between is kept.
create function public.purge_deleted_recipes(ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  delete from public.recipes r
  where r.id = any (ids) and r.deleted_at is not null and r.deleted_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.recipes_due_for_purge() from public, anon, authenticated;
revoke execute on function public.purge_deleted_recipes(uuid[]) from public, anon, authenticated;
grant execute on function public.recipes_due_for_purge() to service_role;
grant execute on function public.purge_deleted_recipes(uuid[]) to service_role;
