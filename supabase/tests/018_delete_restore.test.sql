-- Spec 018: any member deletes and restores their family's recipes, for 30 days; after that only the
-- nightly job (service role) removes them, children included, and grocery items stay.
begin;
select plan(24);

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
grant execute on function pg_temp.login(uuid) to public;

-- The database itself, with no one signed in (the nightly job's view).
create function pg_temp.as_server() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;
grant execute on function pg_temp.as_server() to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'mia@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'sam@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.create_family('The Demanges', 'Gabriel');
create temp table tokens (token text);
grant all on tokens to authenticated;
insert into tokens select public.create_invite();
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.accept_invite((select token from tokens), 'Mia');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into public.recipes (id, name) values
  ('00000000-0000-4000-8000-000000000001', 'Quiche'),
  ('00000000-0000-4000-8000-000000000002', 'Old soup'),
  ('00000000-0000-4000-8000-000000000003', 'Recent stew');
insert into public.recipe_steps (recipe_id, position, body) values ('00000000-0000-4000-8000-000000000002', 0, 'Simmer.');
insert into public.recipe_variants (recipe_id, position, name, kind) values ('00000000-0000-4000-8000-000000000002', 0, 'Spicy', 'option');
insert into public.grocery_items (name, recipe_id) values ('Leeks', '00000000-0000-4000-8000-000000000002');
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select public.create_family('The Others', 'Sam');

-- US1: Mia deletes Gabriel's recipe; the database stamps who and when.
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
update public.recipes set deleted_at = '2000-01-01' where id = '00000000-0000-4000-8000-000000000001';
select is((select deleted_by from public.recipes where id = '00000000-0000-4000-8000-000000000001'),
  '00000000-0000-0000-0000-00000000000b'::uuid, 'any member can delete, and it records who');
select ok((select deleted_at > now() - interval '1 minute' from public.recipes where id = '00000000-0000-4000-8000-000000000001'),
  'the time is the database''s, not the one sent');
select is((select count(*)::int from public.recipes where id = '00000000-0000-4000-8000-000000000001'), 1,
  'the family still sees it, for Recently deleted');

-- Someone in another family can't see, delete or restore it.
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select is((select count(*)::int from public.recipes where deleted_at is not null), 0, 'another family sees none of the deleted recipes');
update public.recipes set deleted_at = null where id = '00000000-0000-4000-8000-000000000001';
update public.recipes set deleted_at = now() where id = '00000000-0000-4000-8000-000000000003';
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select ok((select deleted_at is not null from public.recipes where id = '00000000-0000-4000-8000-000000000001'), 'another family can''t restore it');
select ok((select deleted_at is null from public.recipes where id = '00000000-0000-4000-8000-000000000003'), 'or delete one');

-- US2: Gabriel restores it.
update public.recipes set deleted_at = null where id = '00000000-0000-4000-8000-000000000001';
select is((select (deleted_at, deleted_by)::text from public.recipes where id = '00000000-0000-4000-8000-000000000001'), '(,)',
  'any member can restore it');

-- Old soup was deleted 31 days ago, Recent stew 2 days ago.
select pg_temp.as_server();
update public.recipes set deleted_at = now() - interval '31 days', deleted_by = '00000000-0000-0000-0000-00000000000a'
  where id = '00000000-0000-4000-8000-000000000002';
update public.recipes set deleted_at = now() - interval '2 days', deleted_by = '00000000-0000-0000-0000-00000000000a'
  where id = '00000000-0000-4000-8000-000000000003';

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok($$ update public.recipes set deleted_at = null where id = '00000000-0000-4000-8000-000000000002' $$,
  '22023', 'This recipe was deleted more than 30 days ago', 'after 30 days it can''t be restored');

-- Nobody can move the time of a recipe already deleted, to keep it longer or purge it sooner.
update public.recipes set deleted_at = now() where id = '00000000-0000-4000-8000-000000000002';
select ok((select deleted_at < now() - interval '30 days' from public.recipes where id = '00000000-0000-4000-8000-000000000002'),
  'the deletion time can''t be moved');

-- No photo goes into a deleted recipe's folder; a folder with no recipe yet (a new one) stays open.
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('recipe-photos', %L) $$,
  (select family_id::text from public.recipes where id = '00000000-0000-4000-8000-000000000003') || '/00000000-0000-4000-8000-000000000003/' || gen_random_uuid() || '.jpg'),
  '42501', null, 'no new photo for a deleted recipe');
select lives_ok(format($$ insert into storage.objects (bucket_id, name) values ('recipe-photos', %L) $$,
  (select family_id::text from public.recipes where id = '00000000-0000-4000-8000-000000000001') || '/' || gen_random_uuid() || '/' || gen_random_uuid() || '.jpg'),
  'a new recipe''s photo can still be stored before its first Save');

-- Only the server runs the nightly job.
select throws_ok($$ select * from public.recipes_due_for_purge() $$, '42501', null, 'a member calling it is refused');
select throws_ok($$ select public.purge_deleted_recipes(array[]::uuid[]) $$, '42501', null, 'so is a member purging');
select ok(not has_function_privilege('authenticated', 'public.recipes_due_for_purge()', 'execute'), 'members can''t list what is due');
select ok(not has_function_privilege('anon', 'public.recipes_due_for_purge()', 'execute'), 'nor can anyone signed out');
select ok(not has_function_privilege('authenticated', 'public.purge_deleted_recipes(uuid[])', 'execute'), 'members can''t purge');
select ok(not has_function_privilege('anon', 'public.purge_deleted_recipes(uuid[])', 'execute'), 'nor can anyone signed out');
select ok(has_function_privilege('service_role', 'public.purge_deleted_recipes(uuid[])', 'execute'), 'the server can');

select pg_temp.as_server();
select is((select array_agg(id::text) from public.recipes_due_for_purge()), array['00000000-0000-4000-8000-000000000002'],
  'only the recipe deleted more than 30 days ago is due');
select is(public.purge_deleted_recipes(array['00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000001']::uuid[]), 1, 'the purge removes only what is due, whatever it is sent');
select is((select count(*)::int from public.recipes where id = '00000000-0000-4000-8000-000000000002'), 0, 'the old recipe is gone');
select is((select count(*)::int from public.recipe_steps where recipe_id = '00000000-0000-4000-8000-000000000002')
  + (select count(*)::int from public.recipe_variants where recipe_id = '00000000-0000-4000-8000-000000000002'), 0,
  'with its steps and variants');
select is((select recipe_id from public.grocery_items where name = 'Leeks'), null, 'its grocery items stay on the list');
select is((select count(*)::int from public.recipes where id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003')), 2,
  'the others are untouched');

select * from finish();
rollback;
