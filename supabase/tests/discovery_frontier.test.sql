begin;
select plan(20);
update public.collection_sources set scheduled=true,discovery_page=2;
select is(public.load_source_discovery('otofun')->>'next_page','2','new source starts at backfill page two');
select is(jsonb_array_length(public.load_source_discovery('otofun')->'threads'),0,'new frontier empty');
create temp table lease as select public.claim_daily_run('frontier-fixture') id;
select lives_ok($$select public.finish_discovery_run((select id from lease),'[]','completed',
 '{"attempted_sources":["otofun"],"source_states":{"otofun":"ok"}}',
 '[{"source_id":"otofun","next_page":4,"indexed":["https://www.otofun.net.vn/threads/known.42/","https://www.otofun.net.vn/threads/pending.43/"],"attempted":["https://www.otofun.net.vn/threads/known.42/"]}]')$$,'candidate finalization and frontier commit together');
select is((select discovery_page from public.collection_sources where id='otofun'),4,'backfill progress persisted');
select is((select count(*)::integer from public.discovery_threads),2,'unfetched opening survives run');
select ok((select attempted_at is null from public.discovery_threads where thread_id='43'),'unfetched opening not marked attempted');
select ok((select attempted_at=now() from public.discovery_threads where thread_id='42'),'successful opening has attempt timestamp');
select is((select (r->>'due')::boolean from jsonb_array_elements(public.load_source_discovery('otofun')->'threads') r where r->>'source_url' like '%known.42/'),false,'recent attempted noncandidate not fetched again');
select is((select (r->>'due')::boolean from jsonb_array_elements(public.load_source_discovery('otofun')->'threads') r where r->>'source_url' like '%pending.43/'),true,'pending opening remains due');
update public.discovery_threads set attempted_at=now()-interval '8 days' where thread_id='42';
select is((select (r->>'due')::boolean from jsonb_array_elements(public.load_source_discovery('otofun')->'threads') r where r->>'source_url' like '%known.42/'),true,'attempted noncandidate can be rechecked after seven days');
create temp table bad_lease as select public.claim_daily_run('frontier-invalid') id;
select throws_ok($$select public.finish_discovery_run((select id from bad_lease),'[]','completed',
 '{"attempted_sources":["otofun"],"source_states":{"otofun":"ok"}}',
 '[{"source_id":"otofun","next_page":6,"indexed":["https://evil.test/private"],"attempted":[]}]')$$,'P0001','Invalid discovery URL','unapproved URL cannot enter frontier');
select is((select outcome from public.ingestion_runs where id=(select id from bad_lease)),'running','validation failure does not complete lease');
select is((select discovery_page from public.collection_sources where id='otofun'),4,'invalid batch does not move cursor');
select lives_ok($$select public.finish_discovery_run((select id from bad_lease),'[]','partial',
 '{"attempted_sources":["voz"],"source_states":{"otofun":"cooldown","voz":"ok"}}','[]')$$,'cooling source does not block healthy source finalization');
select is((select discovery_page from public.collection_sources where id='otofun'),4,'cooldown does not move progress');
update public.discovery_threads set expires_at=now()-interval '1 second' where thread_id='42';
select is(jsonb_array_length(public.load_source_discovery('otofun')->'threads'),1,'expired frontier entries excluded on read');
select is(has_table_privilege('anon','public.discovery_threads','select'),false,'browser cannot read private frontier');
select is(has_function_privilege('anon','public.load_source_discovery(text)','execute'),false,'browser cannot inspect crawl progress');
select is(has_function_privilege('anon','public.finish_discovery_run(uuid,jsonb,text,jsonb,jsonb)','execute'),false,'browser cannot change progress');
select is((select count(*)::integer from public.catalogue_listing_offer),0,'progress never publishes listings');
select * from finish();
rollback;
