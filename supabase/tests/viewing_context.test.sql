begin;
select plan(10);
insert into public.sale_candidates(id,source_id,source_key,source_url,fingerprint,payload,checked_at,expires_at)
 values('candidate-cccccccccccccccccccccccc','otofun','otofun:43:post-1','https://www.otofun.net.vn/threads/test.43/#post-1',repeat('b',64),'{}',now(),now()+interval '1 day');
select is(has_table_privilege('anon','public.candidate_context_reviews','select'),false,'public cannot read review provenance');
select is(has_table_privilege('authenticated','public.candidate_context_reviews','insert'),false,'browser cannot create identity matches');
select is(has_function_privilege('anon','public.review_candidate_context(text,text,text,text,text,text,text,timestamptz)','execute'),false,'public cannot bind context');
select lives_ok($$select public.review_candidate_context('candidate-cccccccccccccccccccccccc',repeat('b',64),'ct36-metropolitan',null,'tentative-project','operator','private evidence',now()+interval '7 days')$$,'tentative family association can be reviewed');
select is((select match_level from public.candidate_context_reviews),'tentative-project','uncertain identity is retained');
select throws_ok($$select public.review_candidate_context('candidate-cccccccccccccccccccccccc',repeat('a',64),'ct36-metropolitan',null,'project','operator','private evidence',now()+interval '7 days')$$,'P0001','Candidate changed or expired. Reload before reviewing','changed revisions cannot be bound');
select throws_ok($$select public.review_candidate_context('candidate-cccccccccccccccccccccccc',repeat('b',64),'ct36-metropolitan',null,'building','operator','private evidence',now()+interval '7 days')$$,'23514',null,'building scope requires a building ID');
select throws_ok($$select public.review_candidate_context('candidate-cccccccccccccccccccccccc',repeat('b',64),'ct36-metropolitan',null,'tentative-project','operator','private evidence',now()-interval '1 second')$$,'23514',null,'expired new reviews rejected');
select is((select count(*)::integer from public.catalogue_listing_offer),0,'context review is not inventory publication');
update public.sale_candidates set expires_at=now()-interval '1 second' where id='candidate-cccccccccccccccccccccccc';
select throws_ok($$select public.review_candidate_context('candidate-cccccccccccccccccccccccc',repeat('b',64),'ct36-metropolitan',null,'tentative-project','operator','private evidence',now()+interval '7 days')$$,'P0001','Candidate changed or expired. Reload before reviewing','expired source cannot be reviewed');
select * from finish();
rollback;
