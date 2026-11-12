-- Spec 053 FR-019: the activity list pages by (created_at, key). Entries logged in one transaction
-- share a time; paging 20 at a time must still return each of them once.
begin;
select plan(4);

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', '', true);
  set local role authenticated;
end;
$$;
grant execute on function pg_temp.login(uuid) to public;
create temp table seen (page int, key uuid);
grant all on seen to public;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000053a', 'gabriel@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000053a');
select public.create_family('The Demanges', 'Gabriel');

-- 45 recipes in one transaction: 45 entries, all at the same time.
insert into public.recipes (name, serves) select 'Recipe ' || n, 4 from generate_series(1, 45) n;
select is((select count(distinct created_at)::int from public.activity_entries(p_limit => 100)), 1, 'the 45 entries share one time');

insert into seen select 1, key from public.activity_entries(p_limit => 20);
insert into seen select 2, e.key from public.activity_entries(p_limit => 20,
  p_before => (select created_at from public.activity_entries(p_limit => 20) order by created_at, key limit 1),
  p_before_key => (select key from seen where page = 1 order by key limit 1)) e;
insert into seen select 3, e.key from public.activity_entries(p_limit => 20,
  p_before => (select created_at from public.activity_entries(p_limit => 1)),
  p_before_key => (select key from seen where page = 2 order by key limit 1)) e;

select is((select count(*)::int from seen where page = 2), 20, 'the second page is full');
select is((select count(*)::int from seen where page = 3), 5, 'the third page has the last 5');
select is((select count(distinct key)::int from seen), 45, 'every entry comes once across the pages');

select * from finish();
rollback;
