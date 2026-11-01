-- Revision-bound operator assessments; never a public publication or buyer-contact API.
create table public.candidate_assessments (
 candidate_id text not null references public.sale_candidates(id) on delete cascade,
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 decision text not null check(decision in ('usable','needs-context')),
 facts jsonb not null default '{}' check(jsonb_typeof(facts)='object' and octet_length(facts::text)<4000),
 duplicate_group uuid,
 duplicate_status text not null default 'unchecked' check(duplicate_status in ('unchecked','distinct','suspected','confirmed')),
 reviewer text not null check(length(reviewer) between 1 and 100),
 evidence_ref text not null check(length(evidence_ref) between 1 and 2000),
 reviewed_at timestamptz not null default now(),
 primary key(candidate_id,fingerprint),
 check((duplicate_status in ('suspected','confirmed'))=(duplicate_group is not null))
);
create table public.candidate_assessment_events (
 id uuid primary key default gen_random_uuid(),candidate_id text not null references public.sale_candidates(id) on delete cascade,
 reviewer text not null,reviewed_at timestamptz not null default now(),review_seconds integer not null check(review_seconds between 0 and 3600)
);
alter table public.candidate_assessments enable row level security;
alter table public.candidate_assessment_events enable row level security;
revoke all on public.candidate_assessments,public.candidate_assessment_events from anon,authenticated;
grant select,insert,update,delete on public.candidate_assessments,public.candidate_assessment_events to service_role;

create function public.assess_sale_candidate(p_id text,p_fingerprint text,p_decision text,p_facts jsonb,p_duplicate_group uuid,
 p_duplicate_status text,p_reviewer text,p_evidence_ref text,p_review_seconds integer default 0) returns void
language plpgsql security invoker set search_path='' as $$
declare confirmed timestamptz; date_key text;
begin
 perform 1 from public.sale_candidates where id=p_id and fingerprint=p_fingerprint and expires_at>now() for update;
 if not found then raise exception 'Candidate changed or expired. Reload before assessing'; end if;
 if jsonb_typeof(p_facts) is distinct from 'object' or octet_length(p_facts::text)>=4000
  or exists(select 1 from jsonb_object_keys(p_facts) k where k not in ('projectId','projectLabel','hanoi','completedResale','totalAskingPriceVnd','areaM2','supplierConfirmedAt','supplierRole','sourcePublishedAt','sourceEditedAt'))
  then raise exception 'Invalid assessment facts'; end if;
 if p_decision='usable' then
  if coalesce(p_facts->>'projectId','') !~ '^[a-z0-9-]{3,80}$' or length(coalesce(p_facts->>'projectLabel','')) not between 1 and 120
   or p_facts->>'projectLabel' ~ '@|[0-9]{8,}' or p_facts->'hanoi' is distinct from 'true'::jsonb or p_facts->'completedResale' is distinct from 'true'::jsonb
   or jsonb_typeof(p_facts->'totalAskingPriceVnd') is distinct from 'number' or jsonb_typeof(p_facts->'areaM2') is distinct from 'number'
   then raise exception 'Usable assessment requires scoped coherent source facts'; end if;
  if (p_facts->>'totalAskingPriceVnd')::numeric<=0 or (p_facts->>'totalAskingPriceVnd')::numeric>1e15
   or mod((p_facts->>'totalAskingPriceVnd')::numeric,1)<>0 or (p_facts->>'areaM2')::numeric<=0 or (p_facts->>'areaM2')::numeric>5000
   then raise exception 'Invalid source quantities'; end if;
 end if;
 foreach date_key in array array['sourcePublishedAt','sourceEditedAt'] loop
  if p_facts->>date_key is not null then
   if p_facts->>date_key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (p_facts->>date_key)::date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Invalid genuine source date'; end if;
  end if;
 end loop;
 if p_facts->>'supplierConfirmedAt' is not null then
  confirmed:=(p_facts->>'supplierConfirmedAt')::timestamptz;
  if confirmed>now() or coalesce(p_facts->>'supplierRole','') not in ('owner','authorized-agency')
   then raise exception 'Invalid supplier confirmation'; end if;
 end if;
 insert into public.candidate_assessments(candidate_id,fingerprint,decision,facts,duplicate_group,duplicate_status,reviewer,evidence_ref)
 values(p_id,p_fingerprint,p_decision,p_facts,p_duplicate_group,p_duplicate_status,p_reviewer,p_evidence_ref)
 on conflict(candidate_id,fingerprint) do update set decision=excluded.decision,facts=excluded.facts,duplicate_group=excluded.duplicate_group,
 duplicate_status=excluded.duplicate_status,reviewer=excluded.reviewer,evidence_ref=excluded.evidence_ref,reviewed_at=now();
 insert into public.candidate_assessment_events(candidate_id,reviewer,review_seconds) values(p_id,p_reviewer,p_review_seconds);
end;
$$;
revoke all on function public.assess_sale_candidate(text,text,text,jsonb,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.assess_sale_candidate(text,text,text,jsonb,uuid,text,text,text,integer) to service_role;
