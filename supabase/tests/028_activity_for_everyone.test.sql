-- Spec 028 FR-009 (extends 026): the family's own changes are in the activity log too, as the app's.
-- One action is one entry (a recipe and its rows, a burst of adds, ticks within 10 minutes); app
-- entries are never undone; "AI only" leaves them out; a private event's entry reads without its
-- title for the others, and a surprise's isn't read by the person it's kept from. Assistants can't
-- slip a write into an app entry.
begin;
select plan(25);

create function pg_temp.login(uid uuid, r text default 'authenticated', client text default null) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', jsonb_strip_nulls(jsonb_build_object('sub', uid, 'role', r, 'client_id', client))::text, true);
  perform set_config('request.headers', '', true);
  execute format('set local role %I', r);
end;
$$;
grant execute on function pg_temp.login(uuid, text, text) to public;
create function pg_temp.call(id uuid, tool text) returns void language sql as $$
  select set_config('request.headers', jsonb_build_object('x-cocon-call', id, 'x-cocon-tool', tool)::text, true);
$$;
grant execute on function pg_temp.call(uuid, text) to public;
grant usage on schema extensions to cocon_assistant;
grant execute on all functions in schema extensions to cocon_assistant;
create temp table ids (name text primary key, id uuid);
create temp table tokens (token text);
grant all on ids, tokens to public;
create function pg_temp.id(n text) returns uuid language sql as $$ select id from ids where name = n $$;
grant execute on function pg_temp.id(text) to public;
-- Moves everything logged so far back in time, as if minutes went by.
create function pg_temp.later(m int) returns void language sql security definer as $$
  update public.activity set created_at = created_at - make_interval(mins => m);
$$;
grant execute on function pg_temp.later(int) to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000028a', 'gabriel@example.com'),
  ('00000000-0000-0000-0000-00000000028b', 'eva@example.com');
insert into public.oauth_client_sources (client_id, source) values ('c28', 'claude');

select pg_temp.login('00000000-0000-0000-0000-00000000028a');
select public.create_family('The Demanges', 'Gabriel');
insert into tokens select public.create_invite();
select pg_temp.login('00000000-0000-0000-0000-00000000028b');
select public.accept_invite((select token from tokens), 'Eva');
reset role;
insert into ids select 'eva', id from public.members where user_id = '00000000-0000-0000-0000-00000000028b';

-- Recipes: an add and its edits right after are one entry; an edit later is another.
select pg_temp.login('00000000-0000-0000-0000-00000000028a');
with r as (insert into public.recipes (name, serves) values ('Leek quiche', 4) returning id) insert into ids select 'quiche', id from r;
update public.recipes set serves = 6 where id = pg_temp.id('quiche');
select results_eq($$ select kind, source, recipe_name, can_undo, can_restore from public.activity_entries() $$,
  $$ values ('recipe_created', 'app', 'Leek quiche', false, false) $$, 'adding a recipe and changing it at once: one app entry, no Undo');
select pg_temp.login('00000000-0000-0000-0000-00000000028b');
select is((select count(*)::int from public.activity_entries() where kind = 'recipe_created'), 1, 'Eva sees it too');
select pg_temp.later(11);
select pg_temp.login('00000000-0000-0000-0000-00000000028a');
update public.recipes set serves = 4 where id = pg_temp.id('quiche');
select is((select kind from public.activity_entries() order by created_at desc limit 1), 'recipe_edited', 'an edit 11 minutes later is an entry of its own');
update public.recipes set deleted_at = now() where id = pg_temp.id('quiche');
update public.recipes set deleted_at = null where id = pg_temp.id('quiche');
select results_eq($$ select kind from public.activity_entries() where kind in ('recipe_deleted', 'recipe_restored') order by kind $$,
  $$ values ('recipe_deleted'), ('recipe_restored') $$, 'a delete and a restore are entries of their own');
select is((select count(*)::int from public.activity where source = 'app' and payload ? 'before'), 0, 'app rows keep no copy of the row');

-- Groceries: a burst of adds is one entry, with the recipe they came from; ticks are another.
select pg_temp.later(11);
insert into public.grocery_items (name, recipe_id, from_recipe) values ('Leeks', pg_temp.id('quiche'), true);
insert into public.grocery_items (name, recipe_id, from_recipe) values ('Onion', pg_temp.id('quiche'), true);
select results_eq($$ select count, from_recipe_name from public.activity_entries() where kind = 'groceries_added' $$,
  $$ values (2, 'Leek quiche') $$, 'two adds, one entry: "added 2 items from Leek quiche"');
update public.grocery_items set checked = true where name = 'Leeks';
update public.grocery_items set checked = true where name = 'Onion';
select is((select count from public.activity_entries() where kind = 'groceries_ticked'), 2, 'ticks within 10 minutes are one entry');
update public.grocery_items set checked = false where name = 'Onion';
update public.grocery_items set checked = true where name = 'Onion';
select is((select count(*)::int from public.activity_entries() where kind = 'groceries_ticked'), 1, 'unticking isn''t logged');
update public.grocery_items set deleted_at = now() where checked;
select is((select count from public.activity_entries() where kind = 'groceries_cleared'), 2, 'clearing done items is an entry');

-- App entries aren't undone, and "AI only" leaves them out.
select throws_ok(format($$ select public.undo_ai_change('%s') $$, (select key from public.activity_entries() where kind = 'groceries_cleared')),
  'P0002', 'not_found', 'an app entry can''t be undone');
select is((select count(*)::int from public.activity_entries(p_source => 'ai')), 0, 'AI only: nothing yet');
select is((select count(*)::int from public.activity_entries(p_source => 'app')), (select count(*)::int from public.activity_entries()), 'every entry so far is the app''s');

-- An assistant can't join an app entry by naming its key.
reset role;
insert into ids select 'ticks', public._activity_key(payload, id) from public.activity where payload ->> 'kind' = 'groceries_ticked' limit 1;
select pg_temp.login('00000000-0000-0000-0000-00000000028a', 'cocon_assistant', 'c28');
select pg_temp.call(pg_temp.id('ticks'), 'add_groceries');
insert into public.grocery_items (name) values ('Milk');
select pg_temp.login('00000000-0000-0000-0000-00000000028a');
select results_eq($$ select source, count from public.activity_entries() where key = pg_temp.id('ticks') $$,
  $$ values ('app', 2) $$, 'the app entry stays as it was');
select is((select count(*)::int from public.activity_entries(p_source => 'ai')), 1, 'the assistant''s write is an entry of its own');
select lives_ok($$ select public.undo_ai_change((select key from public.activity_entries(p_source => 'ai'))) $$, 'Gabriel undoes it');
select is((select count(*)::int from public.activity_entries() where kind = 'groceries_cleared' and source = 'app'), 1,
  'what Undo puts back isn''t logged again as his own change');

-- Events: an event and who it's for are one entry. Eva's private one reads without its title for Gabriel.
select pg_temp.login('00000000-0000-0000-0000-00000000028b');
insert into ids select 'private', public.save_event(
  '{"title":"Therapist","starts_on":"2026-11-03","ends_on":"2026-11-03","time_type":"slot","slots":["afternoon"],"visibility":"private"}',
  jsonb_build_array(pg_temp.id('eva')));
select results_eq($$ select kind, event_name, event_when ->> 'starts_on' from public.activity_entries() where event_id = pg_temp.id('private') $$,
  $$ values ('event_created', 'Therapist', '2026-11-03') $$, 'Eva''s event: one entry, with its title and date');
select pg_temp.login('00000000-0000-0000-0000-00000000028a');
select results_eq($$ select kind, event_name, event_when from public.activity_entries() where event_id = pg_temp.id('private') $$,
  $$ values ('event_created', null::text, null::jsonb) $$, 'Gabriel sees that Eva added a private event, not what');
select is((select count(*)::int from public.activity where payload ->> 'event_id' = pg_temp.id('private')::text and payload ? 'name'), 0,
  'the log never holds the private event''s title');

-- Gabriel's surprise for Eva: his to see, never hers.
insert into ids select 'dinner', public.save_event(
  '{"title":"Eva''s surprise dinner","starts_on":"2026-11-07","ends_on":"2026-11-07","time_type":"slot","slots":["evening"],"visibility":"surprise"}',
  jsonb_build_array(pg_temp.id('eva')), null,
  jsonb_build_object('hidden_from', jsonb_build_array(pg_temp.id('eva')), 'cover_title', 'Dinner out'));
select is((select event_name from public.activity_entries() where event_id = pg_temp.id('dinner')), 'Eva''s surprise dinner', 'Gabriel sees his surprise''s entry');
select pg_temp.login('00000000-0000-0000-0000-00000000028b');
select is((select count(*)::int from public.activity where payload ->> 'event_id' = pg_temp.id('dinner')::text), 0, 'Eva can''t read her surprise''s log');
select pg_temp.login('00000000-0000-0000-0000-00000000028a');
update public.events set visibility = 'private' where id = pg_temp.id('dinner');
select pg_temp.login('00000000-0000-0000-0000-00000000028b');
select is((select count(*)::int from public.activity where payload ->> 'event_id' = pg_temp.id('dinner')::text and payload ? 'surprise'), 0,
  'made private later, what was logged while it was her surprise stays hidden from Eva');
select is((select count(*)::int from public.activity where payload ->> 'event_id' = pg_temp.id('dinner')::text), 1, 'only the change to private shows, as a private event');
select pg_temp.login('00000000-0000-0000-0000-00000000028a', 'cocon_assistant', 'c28');
select throws_ok($$ select count(*) from public.activity_entries() $$, '42501', null, 'assistants can''t read the activity list');
select pg_temp.login('00000000-0000-0000-0000-00000000028b');
update public.events set deleted_at = now() where id = pg_temp.id('private');
select is((select count(*)::int from public.activity_entries() where kind = 'event_deleted'), 1, 'deleting an event is an entry');

select * from finish();
rollback;
