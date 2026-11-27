-- Spec 072: one grocery-list link per family, made by the database, ending on its own or when
-- stopped. The share endpoint (service role) reads and writes only that family's list, and only
-- while the link is live; writes need "Let people edit it".
begin;
select plan(58);

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

-- The share endpoint: the service role, nobody signed in.
create function pg_temp.as_endpoint() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role service_role;
end;
$$;
grant execute on function pg_temp.as_endpoint() to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'sam@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select public.create_family('The Others', 'Sam');
insert into public.grocery_items (id, name, quantity, unit) values ('00000000-0000-4000-8000-0000000000f1', 'Sam''s milk', 1, 'l');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.create_family('The Demanges', 'Gabriel');
insert into public.recipes (id, name, serves) values ('00000000-0000-4000-8000-000000000001', 'Secret soup', 4);
insert into public.grocery_items (id, name, catalog_key, quantity, unit, recipe_id) values
  ('00000000-0000-4000-8000-0000000000a1', 'Onions', 'onion', 2, null, null),
  ('00000000-0000-4000-8000-0000000000a2', 'Leeks', 'leek', 3, null, '00000000-0000-4000-8000-000000000001');

create temp table links (name text, token text);
grant all on links to public;

-- FR-001/002: the database makes the token; creating again returns the same link.
insert into links select 'first', token from public.share_groceries('today', now() + interval '3 hours', true);
select ok((select token ~ '^[A-Za-z0-9_-]{43}$' from links where name = 'first'), 'a 256-bit base64url token');
select is((select created from public.share_groceries('1h', now() + interval '1 hour', false)), false, 'creating again reuses the live link');
select is((select can_edit from public.grocery_share_links where stopped_at is null), true, 'and keeps its settings');
select throws_ok($$ insert into public.grocery_share_links (family_id, token, duration, expires_at) values (public.my_family_id(), repeat('a', 43), 'none', null) $$,
  '23505', null, 'one active link per family');
update public.grocery_share_links set token = repeat('a', 43);
select is((select token from public.grocery_share_links where stopped_at is null), (select token from links where name = 'first'), 'nobody can pick the token');
select throws_ok($$ delete from public.grocery_share_links $$, '42501', null, 'members can''t delete a link');
select throws_ok($$ update public.grocery_share_links set expires_at = now() - interval '1 minute' $$, '22023', 'bad_expiry', 'an end in the past is refused');
select throws_ok($$ update public.grocery_share_links set expires_at = now() + interval '9 days' $$, '22023', 'bad_expiry', 'and one more than 8 days away');
select throws_ok($$ update public.grocery_share_links set duration = 'none' $$, '23514', null, '"Until I stop" has no end, and only it');
update public.grocery_share_links set duration = 'week', expires_at = now() + interval '6 days', can_edit = true;
select is((select duration from public.grocery_share_links where stopped_at is null), 'week', 'members change the time of a live link');
update public.grocery_items set share_link_id = (select id from public.grocery_share_links), deleted_share_link_id = (select id from public.grocery_share_links);
select is((select count(*)::int from public.grocery_items where share_link_id is not null or deleted_share_link_id is not null), 0, 'members can''t mark rows as a guest''s');

-- Another family and signed-out people see nothing.
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select is((select count(*)::int from public.grocery_share_links), 0, 'another family sees no link');
update public.grocery_share_links set stopped_at = now();
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.grocery_share_links where stopped_at is null), 1, 'and can''t stop it');
select pg_temp.login(null);
select throws_ok($$ select count(*) from public.grocery_share_links $$, '42501', null, 'signed out: no access');
select ok(not has_function_privilege('anon', 'public.share_groceries(text, timestamptz, boolean)', 'execute'), 'signed out can''t share');
select ok(not has_function_privilege('anon', 'public._ingredient_packs(uuid)', 'execute'), 'nor read packs');

-- FR-003 / SC-001: only the endpoint reads and writes a shared list.
select ok(not has_function_privilege('anon', 'public.shared_groceries(text)', 'execute'), 'signed out can''t read it directly');
select ok(not has_function_privilege('authenticated', 'public.shared_groceries(text)', 'execute'), 'nor can members');
select ok(not has_function_privilege('anon', 'public.shared_grocery_add(text, text, numeric, text, text, text)', 'execute'), 'signed out can''t add directly');
select ok(not has_function_privilege('authenticated', 'public.shared_grocery_clear(text, uuid[])', 'execute'), 'members can''t clear through it');
select ok(not has_function_privilege('authenticated', 'public.shared_grocery_add(text, text, numeric, text, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.shared_grocery_check(text, uuid[], boolean)', 'execute')
  and not has_function_privilege('authenticated', 'public.shared_grocery_restore(text, uuid[])', 'execute'), 'nor add, tick or restore through it');
select ok(not has_function_privilege('authenticated', 'public._grocery_share_link(text, boolean)', 'execute')
  and not has_function_privilege('anon', 'public._grocery_share_link(text, boolean)', 'execute'), 'nobody resolves a token but the endpoint''s functions');
select ok(not has_function_privilege('cocon_assistant', 'public.shared_groceries(text)', 'execute')
  and not has_table_privilege('cocon_assistant', 'public.grocery_share_links', 'select'), 'assistants neither read links nor the shared list');
select pg_temp.as_endpoint();
create temp table shared as select public.shared_groceries((select token from links where name = 'first')) as j;
select is((select array_agg(k order by k) from shared, jsonb_object_keys(j) k), array['can_edit', 'expires_at', 'family_name', 'items', 'packs', 'settings'], 'the list, the link and the family''s settings');
select is((select array_agg(k order by k) from shared, jsonb_object_keys(j -> 'items' -> 0) k),
  array['aisle', 'catalog_key', 'checked', 'id', 'name', 'quantity', 'recipe_detail', 'unit'], 'items without who added or ticked them, or their recipe');
select is((select jsonb_array_length(j -> 'items') from shared), 2, 'this family''s items only');
select is((select j ->> 'family_name' from shared), 'The Demanges', 'with the family''s name');
select ok((select j -> 'packs' ? 'onion' and j -> 'packs' -> 'onion' ? 'facts' and j -> 'packs' -> 'onion' -> 'packs' ? 'us' from shared), 'and the packs of what''s listed');
select is((select j -> 'settings' ->> 'store_profile' from shared), 'us', 'the defaults when the family has no settings');
select is(public.shared_groceries(repeat('a', 43)), null, 'an unknown token reads nothing');
select is(public.shared_groceries('short'), null, 'nor a malformed one');

-- FR-004: a guest's add is a new row, matched for the family, marked as through the link.
select ok((public.shared_grocery_add((select token from links where name = 'first'), '  Onions ', 1, null, 'onions', 'onions') ->> 'matched')::boolean, 'a guest adds, matched to the catalog');
select is((select count(*)::int from public.grocery_items where name = 'Onions' and source = 'link' and created_by is null and share_link_id is not null
  and family_id = (select family_id from public.members where user_id = '00000000-0000-0000-0000-00000000000a')), 1, 'a new row, from the link, with nobody as its author');
select is((select aisle::text from public.grocery_items where source = 'link' and name = 'Onions' and family_id = (select family_id from public.members where user_id = '00000000-0000-0000-0000-00000000000a')), 'produce', 'in its aisle');
select throws_ok($$ select public.shared_grocery_add((select token from links where name = 'first'), 'Stuff', 1, 'bucket', 'stuff', 'stuff') $$, '22P02', null, 'an unknown unit is refused');
select throws_ok($$ select public.shared_grocery_add((select token from links where name = 'first'), '', null, null, '', '') $$, '23514', null, 'so is an empty name');

-- FR-005: tick, clear and restore, only this family's items.
select is(public.shared_grocery_check((select token from links where name = 'first'),
  array['00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000f1']::uuid[], true), 1, 'a guest ticks this family''s item, not another''s');
select is((select checked from public.grocery_items where id = '00000000-0000-4000-8000-0000000000f1'), false, 'the other family''s item stays as it was');
select is((select checked_by from public.grocery_items where id = '00000000-0000-4000-8000-0000000000a1'), null, 'ticked by nobody');
select is((select updated_by from public.grocery_items where id = '00000000-0000-4000-8000-0000000000a1'), null, 'and not changed in a member''s name');
select is(public.shared_grocery_clear((select token from links where name = 'first'),
  array['00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000f1']::uuid[]), 1, 'a guest removes this family''s item only');
select ok((select deleted_at is not null from public.grocery_items where id = '00000000-0000-4000-8000-0000000000a1'), 'cleared, kept for Undo');
select is(public.shared_grocery_restore((select token from links where name = 'first'), array['00000000-0000-4000-8000-0000000000a1']::uuid[]), 1, 'Undo brings it back');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.grocery_items set deleted_at = now() where id = '00000000-0000-4000-8000-0000000000a2';
select pg_temp.as_endpoint();
select is(public.shared_grocery_restore((select token from links where name = 'first'), array['00000000-0000-4000-8000-0000000000a2']::uuid[]), 0, 'a guest can''t restore what a member cleared');
select is(public.shared_grocery_clear((select token from links where name = 'first'), array['00000000-0000-4000-8000-0000000000a2']::uuid[]), 0, 'nor clear it again');

-- FR-004's caps.
reset role;
insert into public.grocery_items (family_id, name, source, share_link_id)
  select g.family_id, 'Extra ' || n, 'link', g.id from public.grocery_share_links g, generate_series(1, 59) n where g.stopped_at is null;
select pg_temp.as_endpoint();
select throws_ok($$ select public.shared_grocery_add((select token from links where name = 'first'), 'Lemons', 2, null, 'lemons', 'lemons') $$, 'P0001', 'too_many', 'at most 60 adds per link an hour');

-- US3: editing off refuses every write, and the page knows.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.grocery_share_links set can_edit = false where stopped_at is null;
select pg_temp.as_endpoint();
select is((select (public.shared_groceries(token) ->> 'can_edit')::boolean from links where name = 'first'), false, 'view only says so');
select throws_ok($$ select public.shared_grocery_check((select token from links where name = 'first'), array['00000000-0000-4000-8000-0000000000a1']::uuid[], false) $$, 'P0001', 'read_only', 'and refuses ticks');
select throws_ok($$ select public.shared_grocery_clear((select token from links where name = 'first'), array['00000000-0000-4000-8000-0000000000a1']::uuid[]) $$, 'P0001', 'read_only', 'and removes');

-- US4: an ended link reads nothing and refuses writes; creating again stops it and makes a new one.
reset role;
alter table public.grocery_share_links disable trigger grocery_share_links_rules;
update public.grocery_share_links set expires_at = now() - interval '1 minute', can_edit = true where stopped_at is null;
alter table public.grocery_share_links enable trigger grocery_share_links_rules;
select pg_temp.as_endpoint();
select is((select public.shared_groceries(token) from links where name = 'first'), null, 'an ended link reads nothing');
select throws_ok($$ select public.shared_grocery_check((select token from links where name = 'first'), array['00000000-0000-4000-8000-0000000000a1']::uuid[], false) $$, 'P0001', 'not_shared', 'and refuses writes');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into links select 'second', token from public.share_groceries('none', null, true);
select isnt((select token from links where name = 'second'), (select token from links where name = 'first'), 'creating after the end makes a new link');
select is((select count(*)::int from public.grocery_share_links where stopped_at is not null), 1, 'and stops the ended one');

-- US4: stopping is one-way and recorded.
update public.grocery_share_links set stopped_at = '2000-01-01' where stopped_at is null;
select ok((select stopped_at > now() - interval '1 minute' and stopped_by = '00000000-0000-0000-0000-00000000000a' from public.grocery_share_links where token = (select token from links where name = 'second')), 'stopping records when and who');
select throws_ok($$ update public.grocery_share_links set stopped_at = null $$, 'P0001', 'link_stopped', 'a stopped link stays stopped');
select pg_temp.as_endpoint();
select is((select public.shared_groceries(token) from links where name = 'second'), null, 'a stopped link reads nothing');

-- A member who stopped a link can still delete their account: their id leaves `stopped_by`.
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000b', 'alex@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into links select 'invite', public.create_invite();
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.accept_invite((select token from links where name = 'invite'), 'Alex');
insert into links select 'alex', token from public.share_groceries('1h', now() + interval '1 hour', true);
update public.grocery_share_links set stopped_at = now() where stopped_at is null;
select lives_ok($$ select public.delete_my_account() $$, 'a member who stopped a link deletes their account');
reset role;
select is((select stopped_by from public.grocery_share_links where token = (select token from links where name = 'alex')), null, 'the stopped link stays, without their id');

select * from finish();
rollback;
