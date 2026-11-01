"""Synthetic multi-run recovery check against this project's isolated local API only."""
import hashlib
import json
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit
from unittest.mock import patch

import requests
from data_pipeline import Store, collect
from forum_crawl import save_item
from test_alonhadat_source import detail as synthetic_ad


def check():
    origin = urlsplit(os.environ.get('SUPABASE_URL', ''))
    if origin.hostname not in {'localhost', '127.0.0.1'} or origin.port != 54821:
        raise ValueError('Source integration requires this project local test API on port 54821')
    store = Store()
    transport = requests.Session()
    transport.trust_env = False
    headers = {'apikey': store.key, 'Content-Type': 'application/json'}
    if store.key.startswith('eyJ'):
        headers['Authorization'] = 'Bearer ' + store.key

    def mutate(method, path, body=None):
        with transport.request(method, store.origin + '/rest/v1/' + path, headers=headers, json=body,
                               timeout=20, allow_redirects=False) as response:
            if response.status_code >= 300:
                raise ValueError('Local source fixture mutation failed')

    original = store.request('collection_sources?select=*')
    run_prefix = 'resilience-integration-' + uuid.uuid4().hex
    source_key = 'voz:999000111:post-999000222'
    candidate_id = 'candidate-' + hashlib.sha256(source_key.encode()).hexdigest()[:24]
    frontier_threads = ['999000333', '999000334', '999000335']
    frontier_ids = ['candidate-' + hashlib.sha256(f'otofun:{key}:post-999000444'.encode()).hexdigest()[:24] for key in frontier_threads]
    portal_id='candidate-'+hashlib.sha256(b'alonhadat:12345678:ad-12345678').hexdigest()[:24]

    def healthy_voz(db, *_args, **_kwargs):
        save_item(db, 'voz', 'https://voz.vn/t/resilience-test.999000111/', 'TEST ONLY Cần bán căn hộ Hà Nội',
                  {'key': 'post-999000222', 'text': 'TEST ONLY Cần bán căn hộ Hà Nội 72m2 2 phòng ngủ giá 4 tỷ',
                   'source_url': 'https://voz.vn/t/resilience-test.999000111/#post-999000222',
                   'format': 'public-post', 'post_role': 'opening-ad', 'posted_at': '2026-11-01'},
                  'external-supplier-lead-discovery')
        return {'errors': []}

    def unavailable_otofun(db, **_kwargs):
        db.execute("INSERT INTO fetch_log(url,status,error,fetched_at) VALUES(?,503,'HTTP response',?)",
                   ('https://www.otofun.net.vn/threads/resilience-test.999000333/', datetime.now(timezone.utc).isoformat()))
        return {'errors': [{'error': 'HTTP 503; no retry'}]}

    def states():
        return {row['id']: row for row in store.request('collection_sources?select=*')}

    try:
        mutate('PATCH', 'collection_sources?id=in.(otofun,voz)',
               {'scheduled': True, 'failure_count': 0, 'retry_after': None, 'access_status': 'unprobed'})
        # No public source network call is allowed by this integration fixture.
        with patch('data_pipeline.refresh', return_value=0), \
             patch('forum_crawl.Fetcher.get', side_effect=AssertionError('External source requests forbidden')), \
             patch('data_pipeline.marketplace', side_effect=unavailable_otofun), \
             patch('data_pipeline.crawl', side_effect=healthy_voz):
            first = collect(store, run_prefix + '-partial')
        assert first['outcome'] == 'partial' and first['stored_candidate_records'] == 1
        rows = store.request('sale_candidates?id=eq.' + candidate_id + '&select=payload,checked_at')
        assert len(rows) == 1 and rows[0]['payload']['publication_ready'] is False
        after_failure = states()['otofun']
        assert after_failure['failure_count'] == 1 and after_failure['retry_after']

        with patch('data_pipeline.refresh', return_value=0), \
             patch('forum_crawl.Fetcher.get', side_effect=AssertionError('External source requests forbidden')), \
             patch('data_pipeline.marketplace') as down_source, patch('data_pipeline.crawl', side_effect=healthy_voz):
            second = collect(store, run_prefix + '-cooldown')
            down_source.assert_not_called()
        assert second['outcome'] == 'partial' and second['source_states']['otofun'] == 'cooldown'
        unchanged = states()['otofun']
        assert all(unchanged[key] == after_failure[key] for key in ['failure_count', 'retry_after', 'checked_at'])

        mutate('PATCH', 'collection_sources?id=eq.otofun',
               {'retry_after': (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()})
        with patch('data_pipeline.refresh', return_value=0), \
             patch('forum_crawl.Fetcher.get', side_effect=AssertionError('External source requests forbidden')), \
             patch('data_pipeline.marketplace', return_value={'errors': []}), \
             patch('data_pipeline.crawl', side_effect=healthy_voz):
            recovery = collect(store, run_prefix + '-recovery')
        recovered = states()['otofun']
        assert recovery['outcome'] == 'completed'
        assert recovered['failure_count'] == 0 and recovered['retry_after'] is None and recovered['last_success_at']

        # Exercise real discovery/parser/projection + actual RPC across cold temporary inboxes.
        index = ''.join(f"<div class='structItem-title'><a href='/threads/frontier-test.{key}/'>TEST ONLY Căn hộ Hà Nội</a></div>" for key in frontier_threads)
        opening = "<h1 class='p-title-value'>TEST ONLY Cần bán căn hộ Hà Nội</h1><article data-content='post-999000444'><div class='bbWrapper'>TEST ONLY Cần bán căn hộ Hà Nội 72m2 2 phòng ngủ giá 4 tỷ.</div></article>"
        def synthetic_get(url, **_kwargs):
            if '/forums/cho-bat-dong-san.423/' in url:
                return index, url
            if any(f'/frontier-test.{key}/' in url for key in frontier_threads):
                return opening, url
            raise AssertionError('Unexpected external source URL')
        with patch('data_pipeline.refresh', return_value=0), \
             patch('forum_crawl.Fetcher.get', side_effect=synthetic_get), \
             patch('data_pipeline.crawl', side_effect=healthy_voz):
            discover_first = collect(store, run_prefix + '-discover-first', pages=2, threads=1)
            saved = store.rpc('load_source_discovery', p_source='otofun')
            assert saved['next_page'] == 3 and sum(row['due'] for row in saved['threads']) == 2
            discover_second = collect(store, run_prefix + '-discover-second', pages=2, threads=1)
        saved = store.rpc('load_source_discovery', p_source='otofun')
        assert saved['next_page'] == 4 and sum(row['due'] for row in saved['threads']) == 1
        assert all(run['source_diagnostics']['otofun']['new_candidates'] == 1 for run in [discover_first, discover_second])
        actual = store.request('sale_candidates?id=in.(' + ','.join(frontier_ids) + ')&select=id')
        assert len(actual) == 2, 'unfetched source must survive to the next worker without refetching the previous candidate'

        future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        mutate('PATCH', 'collection_sources?id=in.(otofun,voz)', {'retry_after': future})
        with patch('data_pipeline.run_source') as source:
            deferred = collect(store, run_prefix + '-deferred')
            source.assert_not_called()
        assert deferred['outcome'] == 'deferred' and deferred['requests'] == 0
        assert len(store.request('sale_candidates?id=eq.' + candidate_id + '&select=id')) == 1

        # A healthy portal must persist actual parsed facts beside a failed forum.
        mutate('PATCH','collection_sources?id=eq.voz',{'scheduled':False})
        mutate('PATCH','collection_sources?id=in.(otofun,alonhadat)',{'scheduled':True,'retry_after':None})
        portal_url='https://alonhadat.com.vn/test-only-12345678.html'
        def portal_get(url,**kwargs):
            if '/can-ban-can-ho-chung-cu/ha-noi' in url:
                return f'<article class="property-item"><a class="link" href="{portal_url}">TEST ONLY</a></article>',url
            if url==portal_url: return synthetic_ad(),url
            raise AssertionError('Unexpected source request')
        with patch('data_pipeline.refresh',return_value=0),patch('forum_crawl.Fetcher.get',side_effect=portal_get),patch('data_pipeline.marketplace',side_effect=unavailable_otofun):
            portal_run=collect(store,run_prefix+'-portal',pages=1,threads=1)
        assert portal_run['outcome']=='partial' and portal_run['source_states']['alonhadat']=='ok'
        assert portal_run['source_states']['otofun']=='failed'
        portal=store.request('sale_candidates?id=eq.'+portal_id+'&select=payload')
        assert len(portal)==1 and portal[0]['payload']['format']=='public-ad'
        assert 'PRIVATE' not in json.dumps(portal) and '0901234567' not in json.dumps(portal)
        print('Local source HTTP/RPC integration passed: partial data, cooldown, recovery, deferred run, persistent discovery, Alonhadat intake beside a failed forum.')
    finally:
        mutate('DELETE', 'sale_candidates?id=in.(' + ','.join([candidate_id,portal_id] + frontier_ids) + ')')
        mutate('DELETE','discovery_threads?source_id=eq.alonhadat&thread_id=eq.12345678')
        mutate('DELETE', 'discovery_threads?source_id=eq.otofun&thread_id=in.(' + ','.join(frontier_threads) + ')')
        mutate('DELETE', 'ingestion_runs?run_key=like.' + run_prefix + '*')
        for row in original:
            mutate('PATCH', 'collection_sources?id=eq.' + row['id'],
                   {key: row[key] for key in ['scheduled', 'checked_at', 'access_status', 'failure_count', 'retry_after', 'last_success_at', 'discovery_page']})
        transport.close()


if __name__ == '__main__':
    try:
        check()
    except Exception:
        # Credentials and REST payloads never appear in a failed CI log.
        raise SystemExit('Local source resilience integration failed; inspect fixture assertions without logging credentials')
