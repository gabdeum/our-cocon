-- Spec 014 FR-004: recipe photos are private to the family in the path's first folder.
-- 032-later L5: the database only accepts cuisines from the list.
begin;
select plan(21);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  reset role;
  if uid is null then
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
    set local role authenticated;
  end if;
end;
$$;

-- Rows a statement changed (0 when RLS hides them).
create function pg_temp.affected(statement text) returns integer language plpgsql as $$
declare
  n integer;
begin
  execute statement;
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function pg_temp.login(uuid), pg_temp.affected(text) to public;

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated, anon;
create function pg_temp.id(name text) returns uuid language sql as $$ select id from ids where ids.name = id.name $$;
-- A photo path in a family's folder.
create function pg_temp.path(family text, file text default '00000000-0000-4000-8000-00000000000a.jpg') returns text language sql as $$
  select pg_temp.id(family)::text || '/00000000-0000-4000-8000-000000000001/' || file
$$;
grant execute on function pg_temp.id(text), pg_temp.path(text, text) to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'sam@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids values ('famA', public.create_family('The Demanges', 'Gabriel'));
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
insert into ids values ('famB', public.create_family('The Others', 'Sam'));
reset role;
select is((select public from storage.buckets where id = 'recipe-photos'), false, 'the bucket is private');
-- The Storage API sets this before it deletes; deleting here goes through the same policies.
set local storage.allow_delete_query = 'true';

-- Gabriel uploads, reads, replaces and removes a photo in his family's folder.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select lives_ok(format($$ insert into storage.objects (bucket_id, name) values ('recipe-photos', %L) $$, pg_temp.path('famA')), 'a member adds a photo to the family folder');
select is((select count(*)::int from storage.objects where bucket_id = 'recipe-photos'), 1, 'a member reads the family''s photos');
select is(pg_temp.affected(format($$ update storage.objects set metadata = '{}' where name = %L $$, pg_temp.path('famA'))), 1, 'a member changes a family photo');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('recipe-photos', %L) $$, pg_temp.path('famB')),
  '42501', null, 'a member cannot add a photo to another family''s folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('recipe-photos', 'loose.jpg') $$,
  '42501', null, 'a photo cannot sit at the bucket root');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('recipe-photos', %L) $$, pg_temp.id('famA')::text || '/00000000-0000-4000-8000-000000000001/x/00000000-0000-4000-8000-00000000000a.jpg'),
  '42501', null, 'a photo sits exactly at family/recipe/file');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('recipe-photos', %L) $$, pg_temp.id('famA')::text || '/../' || pg_temp.id('famB')::text || '.jpg'),
  '42501', null, 'a path cannot climb out of the family folder');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('recipe-photos', %L) $$, pg_temp.path('famA', 'shell.php')),
  '42501', null, 'a photo is named <uuid>.jpg or .webp');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('other', %L) $$, pg_temp.path('famA')),
  '42501', null, 'other buckets get no access from the family folder rule');

-- Sam (another family) sees nothing of family A's photos and changes nothing.
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select is((select count(*)::int from storage.objects where bucket_id = 'recipe-photos'), 0, 'other family: reads 0 photos');
select is(pg_temp.affected(format($$ update storage.objects set metadata = '{}' where name = %L $$, pg_temp.path('famA'))), 0, 'other family: updates 0 photos');
select is(pg_temp.affected(format($$ delete from storage.objects where name = %L $$, pg_temp.path('famA'))), 0, 'other family: deletes 0 photos');

-- Signed out: nothing.
select pg_temp.login(null);
select is((select count(*)::int from storage.objects where bucket_id = 'recipe-photos'), 0, 'signed out: reads 0 photos');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('recipe-photos', %L) $$, pg_temp.path('famA', '00000000-0000-4000-8000-00000000000b.jpg')),
  '42501', null, 'signed out: cannot add a photo');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is(pg_temp.affected(format($$ delete from storage.objects where name = %L $$, pg_temp.path('famA'))), 1, 'a member removes a family photo');

-- L5: only cuisines from the list (packages/schemas Cuisine; cuisine-list.test.ts checks the lists match).
select lives_ok($$ insert into public.recipes (name, cuisine) values ('Quiche', 'french') $$, 'a listed cuisine is accepted');
select lives_ok($$ insert into public.recipes (name, cuisine) values ('Soup', null) $$, 'no cuisine (Other) is accepted');
select throws_ok($$ insert into public.recipes (name, cuisine) values ('Gagh', 'klingon') $$, '23514', null, 'an unlisted cuisine is refused');

-- A recipe or step points only at a photo in its own folder.
select throws_ok(format($$ insert into public.recipes (name, photo_path) values ('Borrowed', %L) $$, pg_temp.path('famA')),
  '23514', null, 'a recipe cannot point at another recipe''s photo');
insert into public.recipes (id, name) values ('00000000-0000-4000-8000-0000000000c1', 'Own');
select is(pg_temp.affected($$ update public.recipes set photo_path = family_id::text || '/' || id::text || '/00000000-0000-4000-8000-00000000000a.jpg'
  where id = '00000000-0000-4000-8000-0000000000c1' $$), 1, 'a recipe points at a photo in its own folder');

select * from finish();
rollback;
