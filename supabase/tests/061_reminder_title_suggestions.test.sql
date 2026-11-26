-- Suggested reminder titles (2026-11-25, as spec 053 FR-002 for events): starts-with before a word
-- match, used often and lately first, one row per title whatever its case; never a deleted
-- reminder, another family's, or anything for an assistant.
begin;
select plan(9);

create function pg_temp.login(uid uuid, client text default null) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', jsonb_strip_nulls(jsonb_build_object('sub', uid, 'role', 'authenticated', 'client_id', client))::text, true);
  set local role authenticated;
end;
$$;
grant execute on function pg_temp.login(uuid, text) to public;
create function pg_temp.rem(t text, days_ago int, has_time boolean default false) returns uuid language sql as $$
  insert into public.reminders (family_id, title, due_at, has_time, rollover)
  values ((select family_id from public.members where user_id = auth.uid()), t, now() - make_interval(days => days_ago), has_time, 'day')
  returning id;
$$;
grant execute on function pg_temp.rem(text, int, boolean) to public;
create function pg_temp.titles(q text) returns text[] language sql as $$
  select coalesce(array_agg(title), '{}') from public.suggest_reminder_titles(q);
$$;
grant execute on function pg_temp.titles(text) to public;
create temp table ids (name text primary key, id uuid);
grant all on ids to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000061a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000061b', 'other@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000061b');
select public.create_family('The Others', 'Olga');
select pg_temp.rem('Bins out', 1);

select pg_temp.login('00000000-0000-0000-0000-00000000061a');
select public.create_family('The Demanges', 'Gabriel');
-- "Pay rent" three times lately (once with a time), "Pay the nanny" long ago, "pay" mid-title once.
select pg_temp.rem('Pay rent', 30);
select pg_temp.rem('pay rent', 60);
insert into ids select 'latest', pg_temp.rem('Pay rent', 2, true);
select pg_temp.rem('Pay the nanny', 400);
select pg_temp.rem('Do not pay late', 5);
select pg_temp.rem('50% off coupon', 3);
insert into ids select 'gone', pg_temp.rem('Pay parking', 1);
update public.reminders set deleted_at = now() where id = (select id from ids where name = 'gone');

select is(pg_temp.titles('pa'), array['Pay rent', 'Pay the nanny', 'Do not pay late'],
  'starts-with first, the often and lately used one on top, one row whatever its case; then a word match');
select is((select last_reminder_id from public.suggest_reminder_titles('pay r')), (select id from ids where name = 'latest'), 'it fills from the latest reminder of that title');
select is((select has_time from public.suggest_reminder_titles('pay r')), true, 'with that reminder''s time');
select is(pg_temp.titles('pay p'), '{}'::text[], 'never a deleted reminder');
select is(pg_temp.titles('bins'), '{}'::text[], 'never another family''s');
select is(pg_temp.titles(''), '{}'::text[], 'nothing for no text');
select is(pg_temp.titles('50%'), array['50% off coupon'], 'a typed % is matched as text');

select pg_temp.login('00000000-0000-0000-0000-00000000061a', 'c61');
select is(pg_temp.titles('pa'), '{}'::text[], 'nothing for an assistant');

reset role;
select ok(not has_function_privilege('anon', 'public.suggest_reminder_titles(text, int)', 'execute')
  and not has_function_privilege('cocon_assistant', 'public.suggest_reminder_titles(text, int)', 'execute'), 'signed out and assistants can''t call it');

select * from finish();
rollback;
