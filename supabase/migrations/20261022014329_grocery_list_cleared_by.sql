-- Spec 020, from the security review: clearing is the database's, like a recipe's delete (018).

-- Who cleared or removed an item (for the activity log, 026), and when by the database's clock, so
-- a member can't pick a past time to skip Undo or a future one to dodge the purge. An item already
-- cleared keeps its time. Undo works for a day, until the nightly purge.
alter table public.grocery_items add column deleted_by uuid references auth.users (id) on delete set null;

create function public._stamp_grocery_deleted() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.deleted_at is null then
    if tg_op = 'UPDATE' and old.deleted_at is not null and auth.uid() is not null
      and old.deleted_at < now() - interval '1 day' then
      raise exception 'This item was cleared more than a day ago' using errcode = '22023';
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
create trigger grocery_items_deleted before insert or update on public.grocery_items
  for each row execute function public._stamp_grocery_deleted();

-- Items are only ever cleared (deleted_at); only the nightly purge removes them for good.
drop policy "members remove their family's rows" on public.grocery_items;
revoke delete on public.grocery_items from authenticated;
