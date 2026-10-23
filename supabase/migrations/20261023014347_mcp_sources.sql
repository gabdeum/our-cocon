-- Spec 023 (032-later L1): name the assistant behind an MCP connection. Assistants register
-- themselves with Supabase's OAuth server (one client per connection), so a fixed row per
-- assistant in oauth_client_sources can't cover them. Instead the name comes from where the client
-- sends people back after they approve: only Claude can receive codes at claude.ai, so a client
-- whose every return address is Claude's is Claude. One foreign address and it's just 'mcp'.

-- The assistant a set of return addresses belongs to, or null when they aren't all one assistant's.
create function public._assistant_for_redirects(uris text) returns text
language sql immutable set search_path = '' as $$
  with hosts as (
    select lower(substring(trim(u) from '^https://([^/:?#]+)(?:[/?#]|$)')) as host
    from unnest(string_to_array(uris, ',')) as u
  ), named as (
    select case
      when host in ('claude.ai', 'claude.com') then 'claude'
      when host in ('chatgpt.com', 'chat.openai.com') then 'chatgpt'
      when host in ('gemini.google.com', 'vertexaisearch.cloud.google.com') then 'gemini'
    end as source
    from hosts
  )
  select case when count(*) > 0 and count(*) = count(source) and count(distinct source) = 1 then min(source) end
  from named;
$$;

-- As in spec 004, plus the return-address rule. An oauth_client_sources row still wins.
create or replace function public._request_source() returns text
language sql stable security definer set search_path = '' as $$
  select case
    when auth.jwt() ->> 'client_id' is null then 'app'
    else coalesce(
      (select source from public.oauth_client_sources where client_id = auth.jwt() ->> 'client_id'),
      (select public._assistant_for_redirects(c.redirect_uris) from auth.oauth_clients c
        where c.id::text = auth.jwt() ->> 'client_id' and c.deleted_at is null),
      'mcp')
  end;
$$;

-- The MCP server asks which assistant is calling, for its analytics (mcp_tool_called.assistant).
create function public.request_source() returns text
language sql stable security definer set search_path = '' as $$ select public._request_source(); $$;
revoke all on function public.request_source() from public, anon;
grant execute on function public.request_source() to authenticated;
