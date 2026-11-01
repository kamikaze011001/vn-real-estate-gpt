begin;
select plan(14);
insert into public.sale_candidates(id,source_id,source_key,source_url,fingerprint,payload,checked_at,expires_at)
 values('candidate-aaaaaaaaaaaaaaaaaaaaaaaa','otofun','otofun:42:post-1','https://www.otofun.net.vn/threads/test.42/#post-1',repeat('b',64),'{}',now(),now()+interval '1 day');
select throws_ok($$select public.assess_sale_candidate('candidate-aaaaaaaaaaaaaaaaaaaaaaaa',repeat('b',64),'usable','{}',null,'unchecked','operator','private evidence',60)$$,
 'P0001','Usable assessment requires scoped coherent source facts','unknown values cannot be called usable');
select lives_ok($$select public.assess_sale_candidate('candidate-aaaaaaaaaaaaaaaaaaaaaaaa',repeat('b',64),'usable',
 '{"projectId":"test-project","projectLabel":"TEST ONLY Project","hanoi":true,"completedResale":true,"totalAskingPriceVnd":4000000000,"areaM2":72}',null,'distinct','operator','private evidence',60)$$,'scoped source facts can be reviewed');
select is((select decision from public.candidate_assessments),'usable','assessment saved');
select is((select sum(review_seconds)::integer from public.candidate_assessment_events),60,'actual review effort saved');
select throws_ok($$select public.assess_sale_candidate('candidate-aaaaaaaaaaaaaaaaaaaaaaaa',repeat('c',64),'usable','{}',null,'unchecked','operator','private evidence',60)$$,
 'P0001','Candidate changed or expired. Reload before assessing','stale revision cannot be reviewed');
select throws_ok($$select public.assess_sale_candidate('candidate-aaaaaaaaaaaaaaaaaaaaaaaa',repeat('b',64),'needs-context','{"phone":"private"}',null,'unchecked','operator','private evidence',60)$$,
 'P0001','Invalid assessment facts','contact fields cannot enter public facts');
select throws_ok($$select public.assess_sale_candidate('candidate-aaaaaaaaaaaaaaaaaaaaaaaa',repeat('b',64),'needs-context','{}',null,'suspected','operator','private evidence',60)$$,
 '23514',null,'suspected duplicates require an explicit group');
select is((select count(*)::integer from public.candidate_assessment_events),1,'failed write does not record review time');
select is(has_table_privilege('anon','public.candidate_assessments','select'),false,'browser cannot read private evidence');
select is(has_table_privilege('authenticated','public.candidate_assessment_events','select'),false,'browser cannot read reviewer activity');
select is(has_function_privilege('anon','public.assess_sale_candidate(text,text,text,jsonb,uuid,text,text,text,integer)','execute'),false,'public cannot approve usable ads');
select is((select count(*)::integer from public.catalogue_listing_offer),0,'source assessment is not catalogue publication');
update public.sale_candidates set expires_at=now()-interval '1 second';
select throws_ok($$select public.assess_sale_candidate('candidate-aaaaaaaaaaaaaaaaaaaaaaaa',repeat('b',64),'needs-context','{}',null,'unchecked','operator','private evidence',0)$$,
 'P0001','Candidate changed or expired. Reload before assessing','expired candidate cannot be assessed');
select is((select count(*)::integer from public.candidate_assessment_events),1,'expired review does not change effort history');
select * from finish();
rollback;
