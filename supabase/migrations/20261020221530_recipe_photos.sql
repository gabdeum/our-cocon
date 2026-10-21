-- Spec 014 FR-004: recipe photos in Storage, and (032-later L5) cuisine checked against the list.

-- Private: photos are read through short-lived signed links, never a public URL. The app resizes
-- to 2000 px JPEG before upload, so 5 MB is plenty.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-photos', 'recipe-photos', false, 5242880, array['image/jpeg', 'image/webp']);

-- Files live at exactly `<family_id>/<recipe_id>/<uuid>.jpg` (or .webp): only the family in the first
-- folder can touch them, and nothing else (no `..`, no other names) is a valid path.
create policy "members read their family's recipe photos" on storage.objects for select to authenticated using (
  bucket_id = 'recipe-photos' and name ~ ('^' || public.my_family_id()::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webp)$'));
create policy "members add their family's recipe photos" on storage.objects for insert to authenticated with check (
  bucket_id = 'recipe-photos' and name ~ ('^' || public.my_family_id()::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webp)$'));
create policy "members change their family's recipe photos" on storage.objects for update to authenticated using (
  bucket_id = 'recipe-photos' and name ~ ('^' || public.my_family_id()::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webp)$')
) with check (
  bucket_id = 'recipe-photos' and name ~ ('^' || public.my_family_id()::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webp)$'));
create policy "members remove their family's recipe photos" on storage.objects for delete to authenticated using (
  bucket_id = 'recipe-photos' and name ~ ('^' || public.my_family_id()::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webp)$'));

-- L5: the same list as `Cuisine` in packages/schemas/recipes.ts (014_recipe_photos.test.sql and
-- cuisine-list.test.ts keep them equal). A value from before the check counts as Other already.
update public.recipes set cuisine = null where cuisine not in (
  'american', 'british', 'caribbean', 'chinese', 'french', 'german', 'greek', 'indian', 'italian', 'japanese', 'korean',
  'latin_american', 'mexican', 'middle_eastern', 'moroccan', 'portuguese', 'scandinavian', 'spanish', 'thai', 'turkish',
  'vietnamese', 'west_african');
alter table public.recipes add constraint recipes_cuisine_known check (cuisine in (
  'american', 'british', 'caribbean', 'chinese', 'french', 'german', 'greek', 'indian', 'italian', 'japanese', 'korean',
  'latin_american', 'mexican', 'middle_eastern', 'moroccan', 'portuguese', 'scandinavian', 'spanish', 'thai', 'turkish',
  'vietnamese', 'west_african'));

-- A recipe or step only points at a photo in its own family's and recipe's folder, so replacing a
-- photo can never remove another recipe's, and a share link can sign only the recipe's own.
alter table public.recipes add constraint recipes_photo_own_folder
  check (photo_path is null or photo_path like family_id::text || '/' || id::text || '/%');
alter table public.recipe_steps add constraint recipe_steps_photo_own_folder
  check (photo_path is null or photo_path like family_id::text || '/' || recipe_id::text || '/%');
