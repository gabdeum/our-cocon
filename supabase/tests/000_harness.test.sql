-- Proves the pgTAP harness runs (`supabase test db`). RLS tests per table follow the add-table skill.
begin;
select plan(2);
select has_schema('public');
select has_schema('auth');
select * from finish();
rollback;
