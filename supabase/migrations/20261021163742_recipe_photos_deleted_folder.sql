-- Spec 018: no new photo goes into a deleted recipe's folder, so the nightly purge (and "Delete now")
-- never leaves one behind. A folder with no recipe yet stays open: a new recipe's photo is stored
-- before its first Save (014).

-- True when the photo path's recipe folder belongs to a recipe in Recently deleted. Compared as
-- text, so a malformed path is simply false (the path pattern in the policy refuses it anyway).
create function public._recipe_folder_deleted(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.recipes r
    where r.id::text = split_part(path, '/', 2) and r.family_id::text = split_part(path, '/', 1) and r.deleted_at is not null
  );
$$;
-- Storage policies run as the member.
grant execute on function public._recipe_folder_deleted(text) to authenticated;

drop policy "members add their family's recipe photos" on storage.objects;
create policy "members add their family's recipe photos" on storage.objects for insert to authenticated with check (
  bucket_id = 'recipe-photos' and name ~ ('^' || public.my_family_id()::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webp)$')
  and not public._recipe_folder_deleted(name));

drop policy "members change their family's recipe photos" on storage.objects;
create policy "members change their family's recipe photos" on storage.objects for update to authenticated using (
  bucket_id = 'recipe-photos' and name ~ ('^' || public.my_family_id()::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webp)$')
) with check (
  bucket_id = 'recipe-photos' and name ~ ('^' || public.my_family_id()::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webp)$')
  and not public._recipe_folder_deleted(name));
