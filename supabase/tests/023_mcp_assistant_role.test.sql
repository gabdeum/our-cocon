-- Spec 023: an assistant's token can do only what the shipped MCP tools need, whatever API it
-- calls. Its own family's recipes, read-only; nothing else.
begin;
select plan(17);

-- As `role` with the claims an access token carries (`client` adds an assistant's client_id).
create function pg_temp.login(uid uuid, r text, client text default null) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',
    jsonb_strip_nulls(jsonb_build_object('sub', uid, 'role', r, 'client_id', client))::text, true);
  execute format('set local role %I', r);
end;
$$;
grant execute on function pg_temp.login(uuid, text, text) to public;
-- pgTAP itself, for the assistant role (this test only: everything rolls back).
grant usage on schema extensions to cocon_assistant;
grant execute on all functions in schema extensions to cocon_assistant;
create temp table ids (name text primary key, id uuid);
grant all on ids to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'sam@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'authenticated');
insert into ids values ('famA', public.create_family('The Demanges', 'Gabriel'));
with r as (insert into public.recipes (name) values ('Quiche') returning id) insert into ids select 'mine', id from r;
insert into public.grocery_items (name) values ('Leeks');
select pg_temp.login('00000000-0000-0000-0000-00000000000f', 'authenticated');
select public.create_family('The Others', 'Sam');
with r as (insert into public.recipes (name) values ('Soup') returning id) insert into ids select 'theirs', id from r;

-- The hook: only an assistant's token changes role.
reset role;
select is(public.access_token_hook('{"claims":{"role":"authenticated","client_id":"c1"}}') #>> '{claims,role}', 'cocon_assistant', 'an assistant token gets the assistant role');
select is(public.access_token_hook('{"claims":{"role":"authenticated"}}') #>> '{claims,role}', 'authenticated', 'the app keeps its role');
select is(public.password_attempt_hook('{"valid":true}') ->> 'decision', 'reject', 'no one signs in with a password');

select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'cocon_assistant', 'c1');
select is((select count(*)::int from public.recipes), 1, 'the assistant reads its member''s recipes, and only theirs');
select is((select name from public.recipes), 'Quiche', 'its own family''s recipe');
select is((select count(*)::int from public.members), 1, 'and its family''s members');
select ok((select count(*) from public.ingredient_facts) > 0, 'and the catalog');
select is(public.my_family_id(), (select id from ids where name = 'famA'), 'it knows its family');

select throws_ok($$ insert into public.recipes (name) values ('Sneaky') $$, '42501', null, 'it cannot add a recipe');
select throws_ok($$ update public.recipes set serves = 9 $$, '42501', null, 'it cannot change one');
select throws_ok($$ delete from public.recipes $$, '42501', null, 'it cannot remove one');
select throws_ok($$ select * from public.grocery_items $$, '42501', null, 'it cannot see the grocery list yet (spec 024)');
select throws_ok($$ select * from public.activity $$, '42501', null, 'or the activity log');
select throws_ok($$ select * from public.share_links $$, '42501', null, 'or share links');
select throws_ok($$ select public.delete_family() $$, '42501', null, 'it cannot delete the family');
select throws_ok($$ select public.create_invite() $$, '42501', null, 'or invite someone');
select throws_ok($$ select public.delete_my_account() $$, '42501', null, 'or delete the account');

select * from finish();
rollback;
