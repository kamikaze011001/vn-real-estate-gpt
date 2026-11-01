-- Additional factual-reference source; no listing-content or supplier publication grant.
alter table public.collection_sources drop constraint collection_sources_id_check;
alter table public.collection_sources add constraint collection_sources_id_check check(id in ('voz','otofun','alonhadat'));
insert into public.collection_sources(id,scheduled) values('alonhadat',false);

alter table public.sale_candidates drop constraint sale_candidates_source_url_check;
alter table public.sale_candidates add constraint sale_candidates_source_url_check check(
 (source_id in ('voz','otofun') and source_url ~ '^https://(voz[.]vn|www[.]otofun[.]net[.]vn|www[.]otofun[.]net)/(t|threads)/')
 or (source_id='alonhadat' and source_key ~ '^alonhadat:[0-9]+:ad-[0-9]+$'
  and split_part(source_key,':',3)='ad-'||split_part(source_key,':',2)
  and source_url ~ '^https://alonhadat[.]com[.]vn/[a-z0-9-]+-[0-9]+[.]html$'
  and substring(source_url from '-([0-9]+)[.]html$')=split_part(source_key,':',2)));

create function public.valid_discovery_url(source text,url text) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(case source
  when 'otofun' then url ~ '^https://www[.]otofun[.]net([.]vn)?/threads/[^/?#]+[.][0-9]+/$'
  when 'alonhadat' then url ~ '^https://alonhadat[.]com[.]vn/[a-z0-9-]+-[0-9]+[.]html$'
  else false end,false);
$$;
revoke all on function public.valid_discovery_url(text,text) from public,anon,authenticated;
grant execute on function public.valid_discovery_url(text,text) to service_role;
alter table public.discovery_threads drop constraint discovery_threads_source_url_check;
alter table public.discovery_threads drop constraint discovery_threads_source_id_check;
alter table public.discovery_threads add constraint discovery_threads_source_url_check check(length(source_url)<=600 and public.valid_discovery_url(source_id,source_url));

create or replace function public.load_source_discovery(p_source text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare page integer; rows jsonb;
begin
 select discovery_page into page from public.collection_sources where id=p_source and scheduled;
 if not found or p_source not in ('otofun','alonhadat') then raise exception 'Unsupported or disabled discovery source'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('source_url',source_url,'due',attempted_at is null or attempted_at<now()-interval '7 days') order by (attempted_at is not null),first_seen_at,thread_id),'[]') into rows
 from (select * from public.discovery_threads where source_id=p_source and expires_at>now() order by (attempted_at is not null),first_seen_at,thread_id limit 5000) d;
 return jsonb_build_object('next_page',page,'threads',rows);
end;
$$;

create or replace function public.finish_discovery_run(p_run_id uuid,p_items jsonb,p_outcome text,p_summary jsonb,p_discovery jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
declare state jsonb; url text; ident text; page integer; total integer;
begin
 if jsonb_typeof(p_discovery) is distinct from 'array' or jsonb_array_length(p_discovery)>2
  or octet_length(p_discovery::text)>700000 then raise exception 'Invalid discovery result'; end if;
 -- Validate everything before finalizing the lease. Any failure rolls back the whole RPC.
 for state in select value from jsonb_array_elements(p_discovery) loop
  if coalesce(state->>'source_id','') not in ('otofun','alonhadat') or not coalesce((p_summary->'attempted_sources') ? (state->>'source_id'),false)
   or jsonb_typeof(state->'indexed') is distinct from 'array' or jsonb_array_length(state->'indexed')>500
   or jsonb_typeof(state->'attempted') is distinct from 'array' or jsonb_array_length(state->'attempted')>20
   or jsonb_typeof(state->'next_page') is distinct from 'number' then raise exception 'Invalid discovery source'; end if;
  page:=(state->>'next_page')::integer;
  if page not between 2 and 100 then raise exception 'Invalid discovery page'; end if;
  for url in select jsonb_array_elements_text(state->'indexed') union select jsonb_array_elements_text(state->'attempted') loop
   if url is null or length(url)>600 or not public.valid_discovery_url(state->>'source_id',url)
    then raise exception 'Invalid discovery URL'; end if;
  end loop;
 end loop;
 total:=public.finish_daily_run(p_run_id,p_items,p_outcome,p_summary);
 delete from public.discovery_threads where expires_at<=now();
 for state in select value from jsonb_array_elements(p_discovery) loop
  if not exists(select 1 from public.collection_sources where id=state->>'source_id' and scheduled) then raise exception 'Discovery source disabled'; end if;
  for url in select distinct jsonb_array_elements_text(state->'indexed') loop
   ident:=case when state->>'source_id'='otofun' then substring(url from '[.]([0-9]+)/$') else substring(url from '-([0-9]+)[.]html$') end;
   insert into public.discovery_threads(source_id,thread_id,source_url) values(state->>'source_id',ident,url)
    on conflict(source_id,thread_id) do update set source_url=excluded.source_url,last_seen_at=now(),expires_at=now()+interval '14 days';
  end loop;
  for url in select distinct jsonb_array_elements_text(state->'attempted') loop
   ident:=case when state->>'source_id'='otofun' then substring(url from '[.]([0-9]+)/$') else substring(url from '-([0-9]+)[.]html$') end;
   insert into public.discovery_threads(source_id,thread_id,source_url,attempted_at) values(state->>'source_id',ident,url,now())
    on conflict(source_id,thread_id) do update set attempted_at=now(),expires_at=now()+interval '14 days';
  end loop;
  update public.collection_sources set discovery_page=(state->>'next_page')::integer where id=state->>'source_id';
 end loop;
 return total;
end;
$$;
