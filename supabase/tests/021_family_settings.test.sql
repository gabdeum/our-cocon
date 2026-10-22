-- Spec 021: the family's settings (where you shop, round up to store sizes). One row per family,
-- read and changed by its members only, and every change goes live to the family.
begin;
select plan(15);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  reset role;
  if uid is null then
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    set local role authenticated;
  end if;
end;
$$;

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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000021a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000021b', 'alex@example.com'),
  ('00000000-0000-0000-0000-00000000021f', 'sam@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000021a');
select public.create_family('Spec 021 home', 'Gabriel');
select pg_temp.login('00000000-0000-0000-0000-00000000021f');
select public.create_family('Spec 021 others', 'Sam');
reset role;
insert into public.members (user_id, family_id, display_name, role, avatar_tone)
  values ('00000000-0000-0000-0000-00000000021b', (select family_id from public.members where user_id = '00000000-0000-0000-0000-00000000021a'), 'Alex', 'editor', 'sage');

-- A member saves the family's choice; the defaults fill the rest.
select pg_temp.login('00000000-0000-0000-0000-00000000021a');
insert into public.family_settings (store_profile) values ('eu');
select is((select round_to_packs from public.family_settings), true, 'round up is on by default');
select is((select family_id from public.family_settings), (select family_id from public.members where user_id = '00000000-0000-0000-0000-00000000021a'),
  'the row is the family''s, whatever the device sends');
select ok((select count(*) from realtime.messages where payload ->> 'table' = 'family_settings') > 0, 'the change goes live');

-- Another member of the family sees it and changes it.
select pg_temp.login('00000000-0000-0000-0000-00000000021b');
select is((select store_profile::text from public.family_settings), 'eu', 'everyone in the family reads it');
select is(pg_temp.affected($$ update public.family_settings set round_to_packs = false $$), 1, 'any member changes it');
select is((select updated_by from public.family_settings), '00000000-0000-0000-0000-00000000021b'::uuid, 'and is recorded as the author');
select throws_ok($$ insert into public.family_settings (store_profile) values ('us') $$, '23505', null, 'one row per family');
-- The app's upsert.
insert into public.family_settings (family_id, store_profile)
  select id, 'us' from public.families on conflict (family_id) do update set store_profile = excluded.store_profile;
select is((select store_profile::text from public.family_settings), 'us', 'an upsert changes the one row');

select throws_ok($$ delete from public.family_settings $$, '42501', null, 'members never delete the row (it is only saved)');

-- Other families and signed-out people.
select pg_temp.login('00000000-0000-0000-0000-00000000021f');
select is((select count(*)::int from public.family_settings), 0, 'another family reads nothing');
select is(pg_temp.affected($$ update public.family_settings set store_profile = 'eu' $$), 0, 'or changes nothing');
select throws_ok($$ delete from public.family_settings $$, '42501', null, 'or removes anything');
reset role;
select pg_temp.login('00000000-0000-0000-0000-00000000021f');
insert into public.family_settings (family_id, store_profile)
  values ((select family_id from public.members where user_id = '00000000-0000-0000-0000-00000000021a'), 'eu');
reset role;
select is((select store_profile::text from public.family_settings where family_id = (select family_id from public.members where user_id = '00000000-0000-0000-0000-00000000021a')), 'us',
  'writing another family''s id only makes a row for your own');
select pg_temp.login(null);
select throws_ok($$ select 1 from public.family_settings $$, '42501', null, 'signed out cannot read');
select throws_ok($$ update public.family_settings set store_profile = 'eu' $$, '42501', null, 'or write');

select * from finish();
rollback;
