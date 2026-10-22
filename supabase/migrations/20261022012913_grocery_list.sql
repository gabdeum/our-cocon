-- Spec 020: the shared grocery list.

-- "Clear done items" and "Remove" set deleted_at, and Undo clears it. Rows aren't removed at once:
-- inserting them again would stamp the person undoing as their author (_stamp_row), so
-- "Added by Mia" would become "Added by Gabriel". The nightly purge removes them a day later.
alter table public.grocery_items add column deleted_at timestamptz;
create index grocery_items_list on public.grocery_items (family_id) where deleted_at is null;

-- FR-001 for writers that don't pass an aisle (an assistant, the seed): the family's correction,
-- then the catalog, then Other. The app passes the aisle match_ingredients gave, which also knows
-- the family's custom ingredients by name.
create function public._grocery_item_aisle() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.aisle is null then
    new.aisle := coalesce(
      (select f.aisle from public.family_ingredients f where f.family_id = new.family_id and f.catalog_key = new.catalog_key),
      (select c.aisle from public.catalog_ingredients c where c.key = new.catalog_key),
      'other');
  end if;
  return new;
end;
$$;
-- Named to run after grocery_items_stamp (triggers fire in name order), so family_id is set.
create trigger grocery_items_zaisle before insert or update of aisle, catalog_key on public.grocery_items
  for each row execute function public._grocery_item_aisle();

update public.grocery_items g set aisle = coalesce(
  (select f.aisle from public.family_ingredients f where f.family_id = g.family_id and f.catalog_key = g.catalog_key),
  (select c.aisle from public.catalog_ingredients c where c.key = g.catalog_key),
  'other')
where g.aisle is null;

-- The nightly purge (scripts/purge-deleted.ts): cleared or removed items, a day on.
create function public.purge_cleared_groceries() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  delete from public.grocery_items where deleted_at is not null and deleted_at < now() - interval '1 day';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.purge_cleared_groceries() from public, anon, authenticated;
grant execute on function public.purge_cleared_groceries() to service_role;
