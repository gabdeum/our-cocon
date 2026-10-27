-- Spec 027: the family's cooking defaults and a recipe's own exceptions. Members of the family read
-- and change both; nobody else does, and assistants only read a recipe's.
begin;
select plan(12);

create function pg_temp.login(uid uuid, r text default 'authenticated') returns void language plpgsql as $$
begin
  reset role;
  if uid is null then
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', r, 'client_id', 'c1')::text, true);
    execute format('set local role %I', r);
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
grant execute on function pg_temp.login(uuid, text), pg_temp.affected(text) to public;
-- pgTAP itself, for the assistant role (this test only: everything rolls back).
grant usage on schema extensions to cocon_assistant;
grant execute on all functions in schema extensions to cocon_assistant;
create temp table ids (name text primary key, id uuid);
grant all on ids to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000027a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000027f', 'sam@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000027f');
select public.create_family('Spec 027 others', 'Sam');
select pg_temp.login('00000000-0000-0000-0000-00000000027a');
select public.create_family('Spec 027 home', 'Gabriel');
with r as (insert into public.recipes (name) values ('Quiche') returning id) insert into ids select 'quiche', id from r;

-- The family's defaults: all on, metric, until someone changes them.
insert into public.family_settings (has_thermometer) values (false);
select is((select (keep_awake, has_scale, units::text) from public.family_settings), (true, true, 'metric'::text), 'the other defaults stay on, in metric');
select is((select has_thermometer from public.family_settings), false, 'a member turns the thermometer off for the family');
select throws_ok($$ update public.family_settings set units = 'cups' $$, '22P02', null, 'units are metric or imperial');

-- A recipe follows the family until it has its own setting.
select is((select (keep_awake, has_scale, has_thermometer, units) is null from public.recipes where id = (select id from ids where name = 'quiche')), true,
  'a new recipe has no exceptions');
select is(pg_temp.affected($$ update public.recipes set has_thermometer = true, units = 'imperial' where name = 'Quiche' $$), 1, 'a member sets the recipe''s own');
select is(pg_temp.affected($$ update public.recipes set has_thermometer = null where name = 'Quiche' $$), 1, 'and resets it');

-- Other families, signed-out people and assistants.
select pg_temp.login('00000000-0000-0000-0000-00000000027f');
select is(pg_temp.affected($$ update public.recipes set units = 'metric' $$), 0, 'another family changes no recipe');
select is((select count(*)::int from public.family_settings), 0, 'or reads the family''s defaults');
select pg_temp.login(null);
select throws_ok($$ update public.recipes set units = 'metric' $$, '42501', null, 'signed out cannot write');
select pg_temp.login('00000000-0000-0000-0000-00000000027a', 'cocon_assistant');
select is((select units::text from public.recipes where name = 'Quiche'), 'imperial', 'an assistant reads the recipe''s units');
select throws_ok($$ update public.recipes set units = 'metric' $$, '42501', null, 'but cannot change them');
select throws_ok($$ update public.family_settings set units = 'imperial' $$, '42501', null, 'or the family''s defaults');

select * from finish();
rollback;
