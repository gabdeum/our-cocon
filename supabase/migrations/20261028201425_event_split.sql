-- Spec 041: "All future events" of a repeating event. The old series ends the day before
-- (`p_before`, from @cocon/calendar's `splitSeries`) and a new series is saved from `p_from` with
-- the changes, in one go. Runs as the caller, so every policy and trigger applies: only someone
-- who may change the event can split it. The new series is a new row (its creator is whoever split
-- it), so only the creator may split a private or surprise event, and nobody else may change who
-- can see it. The old series' exceptions from `p_from` on move to the new one, so a cancelled date
-- stays cancelled. Checklist items are copied (new ids, unticked).
create or replace function public.split_event(p_id uuid, p_from date, p_before jsonb, p_event jsonb, p_members jsonb,
  p_surprise jsonb default null, p_checklist jsonb default null)
returns uuid
language plpgsql set search_path = '' as $$
declare
  old public.events;
  eid uuid;
begin
  select * into old from public.events
    where id = p_id and deleted_at is null and recurrence is not null and starts_on < p_from
    for update;
  if old.id is null then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;
  if old.created_by is distinct from auth.uid()
    and (old.visibility <> 'family' or coalesce(p_event ->> 'visibility', 'family') <> 'family') then
    raise exception 'only_creator_changes_visibility' using errcode = '42501';
  end if;
  -- The old series must end before the new one starts, or the two would overlap.
  if p_before #>> '{ends,type}' is distinct from 'on' or (p_before #>> '{ends,date}')::date >= p_from then
    raise exception 'split_overlaps' using errcode = '22023';
  end if;
  update public.events set recurrence = p_before where id = old.id;
  eid := public.save_event(p_event, p_members, null, p_surprise,
    (select coalesce(jsonb_agg(jsonb_build_object('label', x ->> 'label')), '[]') from jsonb_array_elements(coalesce(p_checklist, '[]')) x));
  update public.event_exceptions set event_id = eid where event_id = old.id and occurrence_date >= p_from;
  return eid;
end;
$$;

revoke execute on function public.split_event(uuid, date, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.split_event(uuid, date, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
