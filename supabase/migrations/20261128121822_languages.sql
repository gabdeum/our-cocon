-- Spec 076: the language each person reads the app in, and the one each phone was set to, so
-- the notifier writes to people in their language.

-- FR-005: per person, synced across devices. 'automatic' follows the device or browser.
alter table public.members
  add column language text not null default 'automatic' check (language in ('automatic', 'en', 'fr', 'es'));

-- Members can't update their own row directly (spec 003); like their name, through a function.
create function public.set_my_language(language text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.members set language = set_my_language.language where user_id = public._require_user();
  if not found then
    raise exception 'not_in_family' using errcode = '42501';
  end if;
end;
$$;
grant execute on function public.set_my_language(text) to authenticated;

-- FR-012: a phone also says which language it's in, for people on Automatic.
create or replace function public._push_prefs_ok(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
    and not exists (
      select 1 from jsonb_each(p) e
      where not (
        (e.key in ('timers_live', 'timers_alert', 'reminders_on', 'todo_on', 'clock_24h') and jsonb_typeof(e.value) = 'boolean')
        or (e.key = 'reminders_scope' and e.value in ('"mine"', '"all"'))
        or (e.key = 'lang' and e.value in ('"en"', '"fr"', '"es"'))
      )
    )
$$;
