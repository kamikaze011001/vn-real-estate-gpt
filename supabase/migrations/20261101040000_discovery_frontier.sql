-- Private progress metadata only; no source titles, bodies, contacts or public grants.
alter table public.collection_sources add column discovery_page integer not null default 2 check(discovery_page between 2 and 100);
-- The established dataset already sampled the first three marketplace pages.
update public.collection_sources set discovery_page=4 where id='otofun' and access_status='ok'
 and exists(select 1 from public.sale_candidates where source_id='otofun');

create table public.discovery_threads (
 source_id text not null references public.collection_sources(id),
 thread_id text not null check(thread_id ~ '^[0-9]{1,24}$'),
 source_url text not null check(length(source_url)<=600 and source_url ~ '^https://www[.]otofun[.]net([.]vn)?/threads/[^/?#]+[.][0-9]+/$'),
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 attempted_at timestamptz,
 expires_at timestamptz not null default now()+interval '14 days',
 primary key(source_id,thread_id),
 check(source_id='otofun')
);
alter table public.discovery_threads enable row level security;
revoke all on public.discovery_threads from anon,authenticated;
grant select,insert,update,delete on public.discovery_threads to service_role;

create function public.load_source_discovery(p_source text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare page integer; rows jsonb;
begin
 select discovery_page into page from public.collection_sources where id=p_source and scheduled;
 if not found or p_source<>'otofun' then raise exception 'Unsupported or disabled discovery source'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('source_url',source_url,'due',attempted_at is null or attempted_at<now()-interval '7 days') order by (attempted_at is not null),first_seen_at,thread_id),'[]') into rows
 from (select * from public.discovery_threads where source_id=p_source and expires_at>now() order by (attempted_at is not null),first_seen_at,thread_id limit 5000) d;
 return jsonb_build_object('next_page',page,'threads',rows);
end;
$$;

create function public.finish_discovery_run(p_run_id uuid,p_items jsonb,p_outcome text,p_summary jsonb,p_discovery jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
declare state jsonb; url text; ident text; page integer; total integer;
begin
 if jsonb_typeof(p_discovery) is distinct from 'array' or jsonb_array_length(p_discovery)>1
  or octet_length(p_discovery::text)>700000 then raise exception 'Invalid discovery result'; end if;
 -- Validate everything before finalizing the lease. Any failure rolls back the whole RPC.
 for state in select value from jsonb_array_elements(p_discovery) loop
  if state->>'source_id' is distinct from 'otofun' or not coalesce((p_summary->'attempted_sources') ? 'otofun',false)
   or jsonb_typeof(state->'indexed') is distinct from 'array' or jsonb_array_length(state->'indexed')>500
   or jsonb_typeof(state->'attempted') is distinct from 'array' or jsonb_array_length(state->'attempted')>20
   or jsonb_typeof(state->'next_page') is distinct from 'number' then raise exception 'Invalid discovery source'; end if;
  page:=(state->>'next_page')::integer;
  if page not between 2 and 100 then raise exception 'Invalid discovery page'; end if;
  for url in select jsonb_array_elements_text(state->'indexed') union select jsonb_array_elements_text(state->'attempted') loop
   if url is null or length(url)>600 or url !~ '^https://www[.]otofun[.]net([.]vn)?/threads/[^/?#]+[.][0-9]+/$'
    then raise exception 'Invalid discovery URL'; end if;
  end loop;
 end loop;
 total:=public.finish_daily_run(p_run_id,p_items,p_outcome,p_summary);
 delete from public.discovery_threads where expires_at<=now();
 for state in select value from jsonb_array_elements(p_discovery) loop
  if not exists(select 1 from public.collection_sources where id='otofun' and scheduled) then raise exception 'Discovery source disabled'; end if;
  for url in select distinct jsonb_array_elements_text(state->'indexed') loop
   ident:=substring(url from '[.]([0-9]+)/$');
   insert into public.discovery_threads(source_id,thread_id,source_url) values('otofun',ident,url)
    on conflict(source_id,thread_id) do update set source_url=excluded.source_url,last_seen_at=now(),expires_at=now()+interval '14 days';
  end loop;
  for url in select distinct jsonb_array_elements_text(state->'attempted') loop
   ident:=substring(url from '[.]([0-9]+)/$');
   insert into public.discovery_threads(source_id,thread_id,source_url,attempted_at) values('otofun',ident,url,now())
    on conflict(source_id,thread_id) do update set attempted_at=now(),expires_at=now()+interval '14 days';
  end loop;
  update public.collection_sources set discovery_page=(state->>'next_page')::integer where id='otofun';
 end loop;
 return total;
end;
$$;
revoke all on function public.load_source_discovery(text) from public,anon,authenticated;
revoke all on function public.finish_discovery_run(uuid,jsonb,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.load_source_discovery(text) to service_role;
grant execute on function public.finish_discovery_run(uuid,jsonb,text,jsonb,jsonb) to service_role;
