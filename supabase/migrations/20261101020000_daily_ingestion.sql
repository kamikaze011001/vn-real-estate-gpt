-- Minimal extracted candidates only: no post bodies, contacts, replies or photos.
create table public.collection_sources (
 id text primary key check (id in ('voz','otofun')),
 scheduled boolean not null default false,
 checked_at timestamptz,
 access_status text not null default 'unprobed' check (access_status in ('unprobed','ok','partial','blocked','failed'))
);
insert into public.collection_sources(id,scheduled) values('voz',true),('otofun',true);
create table public.ingestion_runs (
 id uuid primary key default gen_random_uuid(),
 run_key text not null check (length(run_key) between 1 and 100),
 started_at timestamptz not null default now(),
 lease_until timestamptz not null default now()+interval '15 minutes',
 completed_at timestamptz,
 outcome text not null default 'running' check(outcome in ('running','completed','partial','failed','interrupted')),
 summary jsonb not null default '{}'
);
create index ingestion_recent on public.ingestion_runs(started_at desc);
create table public.sale_candidates (
 id text primary key check(id ~ '^candidate-[a-f0-9]{24}$'),
 source_id text not null references public.collection_sources(id),
 source_key text not null,
 source_url text not null check(source_url ~ '^https://(voz\.vn|www\.otofun\.net\.vn|www\.otofun\.net)/(t|threads)/'),
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<16000),
 first_seen_at timestamptz not null default now(),
 checked_at timestamptz not null,
 expires_at timestamptz not null,
 unique(source_id,source_key)
);
create index candidate_refresh on public.sale_candidates(checked_at,id);
create table public.candidate_observations (
 candidate_id text not null references public.sale_candidates(id) on delete cascade,
 fingerprint text not null,
 payload jsonb not null,
 observed_at timestamptz not null,
 primary key(candidate_id,fingerprint)
);
create table public.candidate_reviews (
 candidate_id text not null references public.sale_candidates(id) on delete cascade,
 fingerprint text not null,
 decision text not null check(decision in ('keep','reject','needs-context')),
 reviewer text not null check(length(reviewer) between 1 and 100),
 note text not null check(length(note) between 1 and 1000),
 reviewed_at timestamptz not null default now(),
 primary key(candidate_id,fingerprint)
);
alter table public.collection_sources enable row level security;
revoke all on public.collection_sources from anon,authenticated;
grant select,insert,update,delete on public.collection_sources to service_role;
alter table public.ingestion_runs enable row level security;
revoke all on public.ingestion_runs from anon,authenticated;
grant select,insert,update,delete on public.ingestion_runs to service_role;
alter table public.sale_candidates enable row level security;
revoke all on public.sale_candidates from anon,authenticated;
grant select,insert,update,delete on public.sale_candidates to service_role;
alter table public.candidate_observations enable row level security;
revoke all on public.candidate_observations from anon,authenticated;
grant select,insert,update,delete on public.candidate_observations to service_role;
alter table public.candidate_reviews enable row level security;
revoke all on public.candidate_reviews from anon,authenticated;
grant select,insert,update,delete on public.candidate_reviews to service_role;

create function public.claim_daily_run(p_run_key text) returns uuid language plpgsql security invoker set search_path='' as $$
declare run_id uuid;
begin
 perform pg_advisory_xact_lock(72106012);
 if exists(select 1 from public.ingestion_runs where outcome='running' and lease_until>now()) then return null; end if;
 update public.ingestion_runs set outcome='interrupted',completed_at=now() where outcome='running' and lease_until<=now();
 delete from public.sale_candidates where expires_at<=now();
 delete from public.candidate_observations where observed_at<now()-interval '14 days';
 delete from public.ingestion_runs where started_at<now()-interval '60 days';
 insert into public.ingestion_runs(run_key) values(p_run_key) returning id into run_id;
 return run_id;
end;
$$;

create function public.finish_daily_run(p_run_id uuid,p_items jsonb,p_outcome text,p_summary jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
declare item jsonb; total integer:=0;
begin
 perform 1 from public.ingestion_runs where id=p_run_id and outcome='running' and lease_until>now() for update;
 if not found then raise exception 'Missing or expired ingestion lease'; end if;
 if p_outcome not in ('completed','partial','failed') or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>100
    or octet_length(p_summary::text)>8000 then raise exception 'Invalid ingestion result'; end if;
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
 update public.collection_sources set checked_at=now(),access_status=coalesce(p_summary->'source_states'->>id,'failed')
  where scheduled and (p_summary->'enabled_sources') ? id;
 update public.ingestion_runs set outcome=p_outcome,summary=p_summary,completed_at=now() where id=p_run_id;
 return total;
end;
$$;

create function public.review_sale_candidate(p_id text,p_fingerprint text,p_decision text,p_reviewer text,p_note text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.sale_candidates where id=p_id and fingerprint=p_fingerprint and expires_at>now() for update;
 if not found then raise exception 'Candidate changed or expired. Reload before reviewing'; end if;
 insert into public.candidate_reviews(candidate_id,fingerprint,decision,reviewer,note) values(p_id,p_fingerprint,p_decision,p_reviewer,p_note);
 -- A keep decision prepares intake only. No catalogue/listing/publication writes.
end;
$$;
revoke all on function public.claim_daily_run(text) from public,anon,authenticated;
revoke all on function public.finish_daily_run(uuid,jsonb,text,jsonb) from public,anon,authenticated;
revoke all on function public.review_sale_candidate(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.claim_daily_run(text) to service_role;
grant execute on function public.finish_daily_run(uuid,jsonb,text,jsonb) to service_role;
grant execute on function public.review_sale_candidate(text,text,text,text,text) to service_role;
