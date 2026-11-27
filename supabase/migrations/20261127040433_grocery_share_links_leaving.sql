-- Spec 072: a member who stopped the grocery link can still delete their account. Deleting them
-- nulls their id in `stopped_by` and `created_by` (on delete set null); like spec 019's and 042's
-- links (032-later L71), the rules let those updates through while `delete_my_account` runs,
-- instead of refusing a change to a stopped link.
create or replace function public._stamp_grocery_share_link() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and public._leaving() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
      new.stopped_at := null;
      new.stopped_by := null;
      new.stopped_source := null;
    end if;
  else
    new.token := old.token;
    new.stopped_source := old.stopped_source;
    if old.stopped_at is not null then
      raise exception 'link_stopped' using errcode = 'P0001';
    end if;
    if new.stopped_at is not null then
      new.stopped_at := now();
      new.stopped_by := auth.uid();
      new.stopped_source := public._request_source();
      -- Stopping an ended link keeps its end as it was.
      return new;
    end if;
  end if;
  if new.expires_at is not null and (tg_op = 'INSERT' or new.expires_at is distinct from old.expires_at)
    and (new.expires_at <= now() or new.expires_at > now() + interval '8 days') then
    raise exception 'bad_expiry' using errcode = '22023';
  end if;
  return new;
end;
$$;
