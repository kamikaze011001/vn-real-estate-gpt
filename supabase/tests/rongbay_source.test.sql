begin;
select plan(10);
select throws_ok($$select public.load_source_discovery('rongbay')$$,'P0001','Unsupported or disabled discovery source','new source initially disabled');
update public.collection_sources set scheduled=true where id='rongbay';
select is((public.load_source_discovery('rongbay')->>'next_page')::integer,2,'new source has independent progress');
select ok(public.valid_discovery_url('rongbay','https://rongbay.com/Ha-Noi/Test-only-c15-raovat-12345678.html'),'allow exact publisher ad');
select is(public.valid_discovery_url('rongbay','https://rongbay.com/Ha-Noi/Test-only-c15-raovat-12345678.html?contact=x'),false,'reject query');
select is(public.valid_discovery_url('rongbay','https://www.otofun.net.vn/threads/test.123/'),false,'reject another publisher');
select public.claim_daily_run('test-rongbay') as lease \gset
select is(public.finish_discovery_run(:'lease',
 '[{"id":"candidate-aaaaaaaaaaaaaaaaaaaaaaab","source_id":"rongbay","source_key":"rongbay:12345678:ad-12345678","source_url":"https://rongbay.com/Ha-Noi/Test-only-c15-raovat-12345678.html","fingerprint":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","payload":{"format":"public-ad","publication_ready":false},"checked_at":"now","expires_at":"tomorrow"}]',
 'completed','{"attempted_sources":["rongbay"],"source_states":{"rongbay":"ok"}}',
 '[{"source_id":"rongbay","next_page":3,"indexed":["https://rongbay.com/Ha-Noi/Test-only-c15-raovat-12345678.html","https://rongbay.com/Ha-Noi/Test-only-c15-raovat-12345679.html"],"attempted":["https://rongbay.com/Ha-Noi/Test-only-c15-raovat-12345678.html"]}]'),1,'candidate and new-source frontier commit together');
select is((select count(*)::integer from public.discovery_threads where source_id='rongbay' and attempted_at is null),1,'pending ad survives opening quota');
select is((select discovery_page from public.collection_sources where id='rongbay'),3,'independent cursor advanced');
select is((select count(*)::integer from public.catalogue_listing_offer),0,'no approved inventory created');
select is(has_function_privilege('anon','public.load_source_discovery(text)','execute'),false,'frontier stays private');
select * from finish();
rollback;
