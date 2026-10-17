-- Spec 003 SC-002: a non-member gets no rows from any table. Checks every table in public, so
-- tables added by later specs are covered too (each spec still tests its own policies).
begin;
select plan(9);

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

-- Rows visible in every public table the current role can select from.
create function pg_temp.visible_rows() returns bigint language plpgsql as $$
declare
  t record;
  n bigint;
  total bigint := 0;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    if has_table_privilege(format('public.%I', t.tablename), 'select') then
      execute format('select count(*) from public.%I', t.tablename) into n;
      total := total + n;
    end if;
  end loop;
  return total;
end;
$$;

select is(
  (select array_agg(tablename::text) from pg_tables where schemaname = 'public' and not rowsecurity),
  null, 'every public table has row-level security on');

-- New functions aren't callable by default (accounts_family migration); test helpers are.
grant execute on function pg_temp.login(uuid), pg_temp.visible_rows() to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'stranger@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.create_family('The Demanges', 'Gabriel');
select public.create_invite();

select ok(pg_temp.visible_rows() > 0, 'a member sees their family''s rows');
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select is(pg_temp.visible_rows(), 0::bigint, 'a signed-in non-member sees no rows');
select pg_temp.login(null);
select is(pg_temp.visible_rows(), 0::bigint, 'a signed-out visitor sees no rows');

-- Only the API is callable: helpers never, and only invite_status while signed out.
reset role;
select ok(not has_function_privilege('anon', 'public.create_invite()', 'execute'), 'signed out cannot create invites');
select ok(has_function_privilege('anon', 'public.invite_status(text)', 'execute'), 'signed out can preview an invite');
select ok(not has_function_privilege('authenticated', 'public._open_invite(text, boolean)', 'execute'), 'helpers are not callable');
select ok(not has_function_privilege('authenticated', 'public._require_owner()', 'execute'), 'helpers are not callable (owner check)');
create function public.later_spec_function() returns int language sql as 'select 1';
select ok(not has_function_privilege('anon', 'public.later_spec_function()', 'execute'), 'functions added later start uncallable');

select * from finish();
rollback;
