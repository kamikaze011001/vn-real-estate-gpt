-- Private, revision-bound identity review. This never publishes inventory or
-- clears quantity, availability, completion, or legal uncertainty.
create table public.candidate_context_reviews (
 candidate_id text not null references public.sale_candidates(id) on delete cascade,
 fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
 project_id text not null check (project_id ~ '^[a-z0-9-]{3,80}$'),
 building_id text check (building_id ~ '^[a-z0-9-]{3,80}$'),
 match_level text not null check (match_level in ('tentative-project','project','building')),
 reviewer text not null check (length(reviewer) between 1 and 100),
 evidence_ref text not null check (length(evidence_ref) between 1 and 2000),
 reviewed_at timestamptz not null default now(),
 review_due_at timestamptz not null,
 primary key (candidate_id,fingerprint),
 check ((match_level='building')=(building_id is not null)),
 check (review_due_at>reviewed_at and review_due_at<=reviewed_at+interval '30 days')
);
alter table public.candidate_context_reviews enable row level security;
revoke all on public.candidate_context_reviews from public,anon,authenticated;
grant select,insert,update,delete on public.candidate_context_reviews to service_role;

create function public.review_candidate_context(p_id text,p_fingerprint text,p_project_id text,p_building_id text,
 p_match_level text,p_reviewer text,p_evidence_ref text,p_review_due_at timestamptz) returns void
language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.sale_candidates where id=p_id and fingerprint=p_fingerprint and expires_at>now() for update;
 if not found then raise exception 'Candidate changed or expired. Reload before reviewing'; end if;
 insert into public.candidate_context_reviews(candidate_id,fingerprint,project_id,building_id,match_level,reviewer,evidence_ref,review_due_at)
 values(p_id,p_fingerprint,p_project_id,p_building_id,p_match_level,p_reviewer,p_evidence_ref,p_review_due_at)
 on conflict(candidate_id,fingerprint) do update set project_id=excluded.project_id,building_id=excluded.building_id,
 match_level=excluded.match_level,reviewer=excluded.reviewer,evidence_ref=excluded.evidence_ref,
 reviewed_at=now(),review_due_at=excluded.review_due_at;
end;
$$;
revoke all on function public.review_candidate_context(text,text,text,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.review_candidate_context(text,text,text,text,text,text,text,timestamptz) to service_role;
