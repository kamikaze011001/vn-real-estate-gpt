-- Only the MCP backend can access these tables. No browser/database access is
-- granted to anon/authenticated; source payloads are minimal reviewed projections.
create table public.app_sessions (
  namespace text not null check (namespace in ('explorer', 'research')),
  id uuid not null,
  state jsonb not null check (jsonb_typeof(state) = 'object' and octet_length(state::text) < 32768),
  version bigint not null default 1,
  expires_at timestamptz not null,
  primary key (namespace, id)
);
create index app_sessions_expiry on public.app_sessions (expires_at);
alter table public.app_sessions enable row level security;
revoke all on public.app_sessions from anon, authenticated;
grant select, insert, update, delete on public.app_sessions to service_role;

create table public.research_sources (
  id text primary key check (id ~ '^research-[a-f0-9]{20}$'),
  position integer not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id and octet_length(payload::text) < 16384),
  expires_at timestamptz not null
);
alter table public.research_sources enable row level security;
revoke all on public.research_sources from anon, authenticated;
grant select, insert, update, delete on public.research_sources to service_role;

create function public.commit_app_session(p_namespace text, p_id uuid, p_expected_version bigint, p_state jsonb, p_expires_at timestamptz)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed integer;
begin
  if p_expires_at <= now() or p_expires_at > now() + interval '61 minutes' then
    raise exception 'Invalid session expiry';
  end if;
  if p_expected_version is null then
    -- Bound incidental cleanup; logical expiry is enforced on every load/update.
    delete from public.app_sessions where (namespace, id) in (
      select namespace, id from public.app_sessions where expires_at <= now() limit 100
    );
    insert into public.app_sessions(namespace, id, state, expires_at)
      values(p_namespace, p_id, p_state, p_expires_at) on conflict do nothing;
  else
    update public.app_sessions set state = p_state, version = version + 1, expires_at = p_expires_at
      where namespace = p_namespace and id = p_id and version = p_expected_version and expires_at > now();
  end if;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;
revoke all on function public.commit_app_session(text,uuid,bigint,jsonb,timestamptz) from public, anon, authenticated;
grant execute on function public.commit_app_session(text,uuid,bigint,jsonb,timestamptz) to service_role;

create function public.replace_research_sources(p_leads jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare changed integer;
begin
  if jsonb_typeof(p_leads) <> 'array' or jsonb_array_length(p_leads) > 50 then
    raise exception 'Invalid research batch';
  end if;
  perform pg_advisory_xact_lock(72106011);
  delete from public.research_sources where id like 'research-%';
  insert into public.research_sources(id, position, payload, expires_at)
    select item->>'id', ordinality::integer, item, (item->>'expiresAt')::timestamptz
      from jsonb_array_elements(p_leads) with ordinality as source(item, ordinality);
  get diagnostics changed = row_count;
  return changed;
end;
$$;
revoke all on function public.replace_research_sources(jsonb) from public, anon, authenticated;
grant execute on function public.replace_research_sources(jsonb) to service_role;
