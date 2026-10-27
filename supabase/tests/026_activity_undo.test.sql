-- Spec 026: the activity list and Undo. Members of the family list and undo its AI entries, through
-- RLS; assistants can't undo; an undo is done once and never undone itself (FR-003); Undo lasts 7
-- days (edge case); app writes are never logged (decision 33). Undoing each tool exactly (SC-001)
-- is in apps/mcp/tools/undo.integration.test.ts.
begin;
select plan(21);

create function pg_temp.login(uid uuid, r text, client text default null) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',
    jsonb_strip_nulls(jsonb_build_object('sub', uid, 'role', r, 'client_id', client))::text, true);
  execute format('set local role %I', r);
end;
$$;
grant execute on function pg_temp.login(uuid, text, text) to public;
-- The MCP server's labels for one tool call.
create function pg_temp.call(id uuid, tool text) returns void language sql as $$
  select set_config('request.headers', jsonb_build_object('x-cocon-call', id, 'x-cocon-tool', tool)::text, true);
$$;
grant execute on function pg_temp.call(uuid, text) to public;
grant usage on schema extensions to cocon_assistant;
grant execute on all functions in schema extensions to cocon_assistant;
create temp table tokens (token text);
grant all on tokens to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'alex@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'sam@example.com');
insert into public.oauth_client_sources (client_id, source) values ('c1', 'chatgpt');

select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'authenticated');
select public.create_family('The Demanges', 'Gabriel');
insert into tokens select public.create_invite();
select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'authenticated');
select public.accept_invite((select token from tokens), 'Alex');
select pg_temp.login('00000000-0000-0000-0000-00000000000f', 'authenticated');
select public.create_family('The Others', 'Sam');

select ok(has_function_privilege('authenticated', 'public.undo_ai_change(uuid, boolean)', 'execute'), 'members can undo');
select ok(not has_function_privilege('cocon_assistant', 'public.undo_ai_change(uuid, boolean)', 'execute'), 'assistants can''t undo');
select ok(not has_function_privilege('cocon_assistant', 'public.activity_entries(int, timestamptz, uuid, text)', 'execute'), 'assistants can''t read the activity list');
select ok(not has_function_privilege('anon', 'public.activity_entries(int, timestamptz, uuid, text)', 'execute'), 'signed out: no activity list');

-- Alex's ChatGPT adds two items in one call.
select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'cocon_assistant', 'c1');
select pg_temp.call('11111111-1111-4111-8111-111111111111', 'add_groceries');
insert into public.grocery_items (name) values ('Milk'), ('Bread');

-- Gabriel's own writes aren't logged.
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'authenticated');
select set_config('request.headers', '', true);
insert into public.grocery_items (name) values ('Rice');
select is((select count(*)::int from public.activity where action = 'insert'), 2, 'only the assistant''s writes are logged');

select results_eq($$ select key, kind, count, source, can_undo from public.activity_entries() $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'groceries_added', 2, 'chatgpt', true) $$,
  'one entry for the whole call, from ChatGPT');
select throws_ok($$ insert into public.activity (action, target_kind) values ('insert', 'grocery_items') $$, '42501', null,
  'members can''t write AI entries of their own');

-- Sam, in another family, sees nothing and can't undo it.
select pg_temp.login('00000000-0000-0000-0000-00000000000f', 'authenticated');
select is((select count(*)::int from public.activity_entries()), 0, 'other family: no entries');
select throws_ok($$ select public.undo_ai_change('11111111-1111-4111-8111-111111111111') $$, 'P0002', 'not_found', 'other family: can''t undo');

select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'authenticated');
select is(public.undo_ai_change('11111111-1111-4111-8111-111111111111') ->> 'done', '2', 'Undo clears both items');
select is((select count(*)::int from public.grocery_items where deleted_at is null), 1, 'Rice stays');
select results_eq($$ select undone_by, undo_action, can_undo from public.activity_entries() $$,
  $$ values ('00000000-0000-0000-0000-00000000000a'::uuid, 'undo', false) $$, 'the entry reads undone by Gabriel');
select throws_ok($$ select public.undo_ai_change('11111111-1111-4111-8111-111111111111') $$, '22023', 'already_undone', 'done once');
select throws_ok($$ select public.undo_ai_change((select id from public.activity where action = 'undo')) $$, 'P0002', 'not_found',
  'an undo isn''t undone');
select is((select count(*)::int from public.activity_entries() where key = (select id from public.activity where action = 'undo')), 0,
  'and isn''t listed as an entry');

-- A member can't mark an entry undone by hand, and an entry is undone once.
select throws_ok($$ insert into public.activity (action, target_kind, target_id) values ('undo', 'activity', '11111111-1111-4111-8111-111111111111') $$,
  '23505', null, 'one undo per entry');

-- The assistant reuses the undone call's id: its new write is an entry of its own, still undoable.
select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'cocon_assistant', 'c1');
select pg_temp.call('11111111-1111-4111-8111-111111111111', 'add_groceries');
insert into public.grocery_items (name) values ('Eggs');
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'authenticated');
select results_eq($$ select count, can_undo from public.activity_entries() where key <> '11111111-1111-4111-8111-111111111111' $$,
  $$ values (1, true) $$, 'a reused call id doesn''t join an undone entry');

-- An edit labelled as a delete is still an edit, with Undo.
with r as (insert into public.recipes (name, serves) values ('Pumpkin soup', 4) returning id) select 1 from r;
select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'cocon_assistant', 'c1');
select pg_temp.call('33333333-3333-4333-8333-333333333333', 'delete_recipe');
update public.recipes set serves = 6 where name = 'Pumpkin soup';
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'authenticated');
select results_eq($$ select kind, can_undo from public.activity_entries() where key = '33333333-3333-4333-8333-333333333333' $$,
  $$ values ('other', true) $$, 'a label alone doesn''t make a delete');
select is((select count(*)::int from public.activity where target_id = '33333333-3333-4333-8333-333333333333' and action = 'undo'), 0, 'not undone yet');

-- Eight days later, the entry stays without Undo.
select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'cocon_assistant', 'c1');
select pg_temp.call('22222222-2222-4222-8222-222222222222', 'add_groceries');
insert into public.grocery_items (name) values ('Butter');
reset role;
update public.activity set created_at = now() - interval '8 days' where payload ->> 'call_id' = '22222222-2222-4222-8222-222222222222';
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'authenticated');
select is((select can_undo from public.activity_entries() where key = '22222222-2222-4222-8222-222222222222'), false, 'after 7 days: no Undo');
select throws_ok($$ select public.undo_ai_change('22222222-2222-4222-8222-222222222222') $$, '22023', 'expired', 'and Undo is refused');

select * from finish();
rollback;
