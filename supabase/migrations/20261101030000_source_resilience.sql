-- Independent source recovery state. Existing service-only grants/RLS remain in force.
alter table public.collection_sources
 add column failure_count integer not null default 0 check(failure_count between 0 and 1000000),
 add column retry_after timestamptz,
 add column last_success_at timestamptz;

update public.collection_sources s set last_success_at=(
 select max(r.completed_at) from public.ingestion_runs r
 where r.summary->'source_states'->>s.id='ok');
update public.collection_sources set failure_count=1,
 retry_after=checked_at+case when access_status='blocked' then interval '24 hours' else interval '15 minutes' end
 where access_status in ('failed','blocked') and checked_at is not null;

alter table public.ingestion_runs drop constraint ingestion_runs_outcome_check;
alter table public.ingestion_runs add constraint ingestion_runs_outcome_check
 check(outcome in ('running','completed','partial','failed','interrupted','deferred'));

create or replace function public.finish_daily_run(p_run_id uuid,p_items jsonb,p_outcome text,p_summary jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
declare item jsonb; total integer:=0; attempted jsonb; source_row record; source_state text;
 failures integer; cooldown_seconds numeric; header_seconds numeric;
begin
 perform 1 from public.ingestion_runs where id=p_run_id and outcome='running' and lease_until>now() for update;
 if not found then raise exception 'Missing or expired ingestion lease'; end if;
 if p_outcome not in ('completed','partial','failed','deferred') or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>100
    or octet_length(p_summary::text)>8000 then raise exception 'Invalid ingestion result'; end if;
 attempted:=coalesce(p_summary->'attempted_sources',p_summary->'enabled_sources','[]'::jsonb);
 if jsonb_typeof(attempted)<>'array' or (p_outcome='deferred' and
    (jsonb_array_length(attempted)<>0 or jsonb_array_length(p_items)<>0)) then
  raise exception 'Invalid attempted source result';
 end if;
 for item in select value from jsonb_array_elements(p_items) loop
  if not exists(select 1 from public.collection_sources where id=item->>'source_id' and scheduled) then raise exception 'Source scheduling is disabled'; end if;
  if (item->>'expires_at')::timestamptz>now()+interval '15 days' or (item->>'expires_at')::timestamptz<=now()
     or (item->>'checked_at')::timestamptz>now()+interval '1 minute'
     or jsonb_typeof(item->'payload') is distinct from 'object'
     or exists(select 1 from jsonb_object_keys(item->'payload') k where k not in
        ('format','post_key','post_role','collection_role','queue','reasons','flags','geography','projects','fields','source_published_at','source_edited_at','publication_ready'))
     or coalesce((item->'payload'->>'publication_ready')::boolean,true) then raise exception 'Invalid candidate projection'; end if;
  insert into public.sale_candidates(id,source_id,source_key,source_url,fingerprint,payload,checked_at,expires_at)
   values(item->>'id',item->>'source_id',item->>'source_key',item->>'source_url',item->>'fingerprint',item->'payload',(item->>'checked_at')::timestamptz,(item->>'expires_at')::timestamptz)
   on conflict(id) do update set source_url=excluded.source_url,fingerprint=excluded.fingerprint,payload=excluded.payload,checked_at=excluded.checked_at,expires_at=excluded.expires_at
   where public.sale_candidates.checked_at<=excluded.checked_at;
  insert into public.candidate_observations(candidate_id,fingerprint,payload,observed_at)
   values(item->>'id',item->>'fingerprint',item->'payload',(item->>'checked_at')::timestamptz) on conflict do nothing;
  if item->'payload'->>'format'='public-post' then
   update public.sale_candidates set expires_at=now() where source_id=item->>'source_id' and id<>item->>'id'
    and split_part(source_key,':',2)=split_part(item->>'source_key',':',2) and payload->>'format'='rss-excerpt';
  end if;
  total:=total+1;
 end loop;
 -- A skipped source retains its previous check, failure count and retry deadline.
 for source_row in select * from public.collection_sources where scheduled and attempted ? id for update loop
  source_state:=coalesce(p_summary->'source_states'->>source_row.id,'failed');
  if source_state not in ('ok','partial','failed','blocked') then raise exception 'Invalid source state'; end if;
  if source_state='ok' then
   update public.collection_sources set checked_at=now(),access_status='ok',failure_count=0,
    retry_after=null,last_success_at=now() where id=source_row.id;
  else
   failures:=least(source_row.failure_count+1,1000000);
   cooldown_seconds:=case when source_state='blocked' then 86400
    else least(86400,900*power(2::numeric,least(failures-1,7))) end;
   header_seconds:=0;
   if jsonb_typeof(p_summary->'source_diagnostics'->source_row.id->'retry_after_seconds')='number' then
    header_seconds:=least(2147483647,greatest(0,
      (p_summary->'source_diagnostics'->source_row.id->>'retry_after_seconds')::numeric));
   end if;
   cooldown_seconds:=greatest(cooldown_seconds,header_seconds);
   update public.collection_sources set checked_at=now(),access_status=source_state,failure_count=failures,
    retry_after=now()+make_interval(secs=>cooldown_seconds::double precision) where id=source_row.id;
  end if;
 end loop;
 update public.ingestion_runs set outcome=p_outcome,summary=p_summary,completed_at=now() where id=p_run_id;
 return total;
end;
$$;

revoke all on function public.finish_daily_run(uuid,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.finish_daily_run(uuid,jsonb,text,jsonb) to service_role;
