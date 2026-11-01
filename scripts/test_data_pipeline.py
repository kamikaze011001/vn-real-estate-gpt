import json
import io
import sqlite3
import tempfile
import time
import unittest
from contextlib import redirect_stdout, redirect_stderr
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

from forum_crawl import database, save_item
from data_pipeline import projection, refresh, collect, main, run_source


class MemoryStore:
    def __init__(self, sources=None):
        self.sources = sources if sources is not None else [{'id': 'otofun'}, {'id': 'voz'}]
        self.finished = []
        self.queries = []

    def request(self, path):
        self.queries.append(path)
        return self.sources if path.startswith('collection_sources') else []

    def rpc(self, name, **args):
        if name == 'claim_daily_run':
            return 'lease'
        if name in {'finish_daily_run', 'finish_discovery_run'}:
            self.finished.append(args)
            return len(args['p_items'])


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = database(Path(self.tmp.name) / 'test.sqlite')
        self.db.row_factory = sqlite3.Row

    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def item(self, text='Cần bán căn hộ Hà Nội 72 m2 2 phòng ngủ giá 4 tỷ'):
        save_item(self.db, 'otofun', 'https://www.otofun.net.vn/threads/test.1234/', ('[Đã bán] ' if text == 'Đã bán' else '') + 'Private title 0901234567',
                  {'key': 'post-5678', 'text': text + ' liên hệ owner@example.com 0901234567',
                   'source_url': 'https://www.otofun.net.vn/threads/test.1234/#post-5678', 'posted_at': '2026-10-20',
                   'format': 'public-post', 'post_role': 'opening-ad', 'collection_role': 'external-supplier-lead-discovery'},
                  'external-supplier-lead-discovery')
        return self.db.execute('select * from item').fetchone()

    def test_refresh_does_not_consume_the_new_discovery_slot(self):
        base = 'https://www.otofun.net.vn/forums/cho-bat-dong-san.423/'
        index = "<div class='structItem-title'><a href='/threads/known.42/'>Căn hộ Hà Nội</a></div><div class='structItem-title'><a href='/threads/new.43/'>Căn hộ Hà Nội</a></div>"
        page = "<h1 class='p-title-value'>Cần bán căn hộ Hà Nội</h1><article data-content='post-1'><div class='bbWrapper'>Cần bán căn hộ Hà Nội 72m2 2 phòng ngủ giá 4 tỷ.</div></article>"
        known = [{'source_id':'otofun','source_key':'otofun:42:post-1','source_url':'https://www.otofun.net.vn/threads/known.42/#post-1','payload':{}}]
        def refreshed(db, *_args, **_kwargs):
            save_item(db, 'otofun', 'https://www.otofun.net.vn/threads/known.42/', 'Cần bán căn hộ Hà Nội',
                      {'key':'post-1','text':'Cần bán căn hộ Hà Nội 72m2 2 phòng ngủ giá 4 tỷ.',
                       'source_url':known[0]['source_url'],'format':'public-post','post_role':'opening-ad'}, 'external-supplier-lead-discovery')
            return 0
        def get(url, **_kwargs):
            return (index if '/forums/' in url else page, url)
        with patch('data_pipeline.refresh', side_effect=refreshed), patch('forum_crawl.Fetcher.get', side_effect=get) as requests:
            result = run_source('otofun', known, 1, 1)
        self.assertEqual({item['source_key'] for item in result['items']}, {'otofun:42:post-1','otofun:43:post-1'})
        self.assertNotIn('https://www.otofun.net.vn/threads/known.42/', [call.args[0] for call in requests.call_args_list])

    def test_projection_keeps_unknowns_and_excludes_private_content(self):
        result = projection(self.item())
        encoded = json.dumps(result)
        for private in ('Private title', 'owner@example.com', '0901234567', '"text"', '"title"'):
            self.assertNotIn(private, encoded)
        self.assertIsNone(result['payload']['fields']['price_vnd'])
        self.assertIsNone(result['payload']['fields']['bedrooms'])
        self.assertFalse(result['payload']['publication_ready'])

    def test_price_rate_remains_rate_and_source_changes_have_a_new_revision(self):
        first = projection(self.item('Cần bán căn hộ Hà Nội 72 m2 2 phòng ngủ giá 78 triệu/m2'))
        rate = first['payload']['fields']['price_candidates'][0]
        self.assertEqual(rate['basis'], 'per_m2')
        second = projection(self.item('Cần bán căn hộ Hà Nội 72 m2 2 phòng ngủ giá 79 triệu/m2'))
        self.assertEqual(first['id'], second['id'])
        self.assertNotEqual(first['fingerprint'], second['fingerprint'])
        third = projection(self.item('Cần bán căn hộ Hà Nội 72 m2 2 phòng ngủ giá 79 triệu/m2'))
        self.assertEqual(second['fingerprint'], third['fingerprint'])

    def test_closed_offer_reaches_review_without_becoming_confirmed_inventory(self):
        row = self.item('Đã bán')
        item = projection(row, {row['id']})
        self.assertIsNotNone(item)
        self.assertEqual(item['payload']['queue'], 'excluded')
        self.assertFalse(item['payload']['publication_ready'])

    def test_shared_access_stop_prevents_refresh_using_another_otofun_host(self):
        class Fetch:
            blocked = {'www.otofun.net.vn'}
            def get(self, *_args, **_kwargs):
                raise AssertionError('Stopped source must not be requested')
        count = refresh(self.db, Fetch(), [{'source_id': 'otofun', 'source_url': 'https://www.otofun.net/threads/test.1234/'}], {'otofun'})
        self.assertEqual(count, 0)

    def test_failure_closes_lease_without_uploading_partial_private_data(self):
        class Store:
            calls = []
            def request(self, path):
                if path.startswith('collection_sources'):
                    return [{'id': 'otofun'}]
                raise ValueError('Simulated unavailable database')
            def rpc(self, name, **args):
                self.calls.append((name, args))
                return 'lease' if name == 'claim_daily_run' else 0
        store = Store()
        with self.assertRaises(ValueError):
            collect(store, 'test')
        self.assertEqual(store.calls[-1][0], 'finish_daily_run')
        self.assertEqual(store.calls[-1][1]['p_items'], [])
        self.assertEqual(store.calls[-1][1]['p_outcome'], 'failed')

    def test_source_failure_has_safe_diagnostics_without_tainting_other_source(self):
        class Store:
            def request(self, path):
                return [{'id': 'otofun'}, {'id': 'voz'}] if path.startswith('collection_sources') else []
            def rpc(self, name, **args):
                return 'lease' if name == 'claim_daily_run' else None

        def failed_marketplace(db, **_kwargs):
            db.execute("INSERT INTO fetch_log(url,status,error,fetched_at) VALUES(?,503,?,?)",
                       ('https://www.otofun.net.vn/robots.txt', 'private details must not escape', '2026-11-01'))
            return {'errors': [{'url': 'https://www.otofun.net.vn/private-sensitive-path',
                                'error': 'Cannot establish robots policy'}]}

        with patch('data_pipeline.marketplace', side_effect=failed_marketplace), \
             patch('data_pipeline.crawl', return_value={'errors': []}):
            result = collect(Store(), 'test')
        self.assertEqual(result['source_states'], {'otofun': 'failed', 'voz': 'ok'})
        self.assertEqual(result['source_diagnostics']['otofun']['http_statuses'], {'503': 1})
        self.assertEqual(result['source_diagnostics']['otofun']['error_counts'], {'robots-policy-unavailable': 1})
        self.assertEqual(result['source_diagnostics']['voz']['errors'], 0)
        self.assertEqual(result['outcome'], 'partial')
        self.assertNotIn('private', json.dumps(result))

    def test_adapter_crash_preserves_other_source_data_and_does_not_leak_exception(self):
        store = MemoryStore()
        def healthy_voz(db, *_args, **_kwargs):
            save_item(db, 'voz', 'https://voz.vn/t/test.200/', 'Cần bán căn hộ Hà Nội',
                      {'key': 'post-201', 'text': 'Cần bán căn hộ Hà Nội 72m2 2 phòng ngủ giá 4 tỷ',
                       'source_url': 'https://voz.vn/t/test.200/#post-201', 'posted_at': '2026-10-20',
                       'format': 'public-post', 'post_role': 'opening-ad'}, 'external-supplier-lead-discovery')
            return {'errors': []}
        with patch('data_pipeline.marketplace', side_effect=RuntimeError('private owner@example.com')), \
             patch('data_pipeline.crawl', side_effect=healthy_voz):
            result = collect(store, 'test')
        self.assertEqual(result['outcome'], 'partial')
        self.assertEqual(result['source_states'], {'otofun': 'failed', 'voz': 'ok'})
        self.assertEqual([x['source_id'] for x in store.finished[0]['p_items']], ['voz'])
        self.assertFalse(store.finished[0]['p_items'][0]['payload']['publication_ready'])
        self.assertNotIn('owner@example.com', json.dumps(result))
        self.assertEqual(len(store.finished), 1)

    def test_cooldown_skips_only_failed_source_and_does_not_disable_it(self):
        future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        store = MemoryStore([{'id': 'otofun', 'retry_after': future, 'failure_count': 2}, {'id': 'voz'}])
        with patch('data_pipeline.marketplace') as market, patch('data_pipeline.crawl', return_value={'errors': []}) as voz:
            result = collect(store, 'test')
        market.assert_not_called()
        voz.assert_called_once()
        self.assertEqual(result['source_states'], {'otofun': 'cooldown', 'voz': 'ok'})
        self.assertEqual(result['attempted_sources'], ['voz'])
        self.assertEqual(result['outcome'], 'partial')
        self.assertEqual(store.finished[0]['p_summary']['enabled_sources'], ['otofun', 'voz'])

    def test_all_cooled_sources_defer_without_requests_or_counter_updates(self):
        future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        store = MemoryStore([{'id': 'otofun', 'retry_after': future}, {'id': 'voz', 'retry_after': future}])
        with patch('data_pipeline.marketplace') as market, patch('data_pipeline.crawl') as voz:
            result = collect(store, 'test')
        market.assert_not_called()
        voz.assert_not_called()
        self.assertEqual(result['outcome'], 'deferred')
        self.assertEqual(result['attempted_sources'], [])
        self.assertEqual(result['requests'], 0)
        self.assertFalse(any(q.startswith('sale_candidates') for q in store.queries))

    def test_all_sources_failing_is_a_real_failed_run(self):
        store = MemoryStore()
        with patch('data_pipeline.marketplace', side_effect=RuntimeError('private')), \
             patch('data_pipeline.crawl', side_effect=RuntimeError('private')):
            result = collect(store, 'test')
        self.assertEqual(result['outcome'], 'failed')
        self.assertEqual(result['source_states'], {'otofun': 'failed', 'voz': 'failed'})

    def test_slow_source_hits_its_budget_and_next_source_still_runs(self):
        store = MemoryStore()
        def worker(source, *_args):
            if source == 'otofun':
                time.sleep(2)
            return {'state': 'ok', 'items': [], 'diagnostics': {
                'errors': 0, 'error_counts': {}, 'requests': 0, 'records_observed': 0,
                'http_statuses': {}, 'network_errors': {}}}
        with patch('data_pipeline.SOURCE_BUDGET_SECONDS', 0.03), patch('data_pipeline.run_source', side_effect=worker):
            result = collect(store, 'test')
        self.assertEqual(result['outcome'], 'partial')
        self.assertEqual(result['source_states'], {'otofun': 'failed', 'voz': 'ok'})
        self.assertEqual(result['source_diagnostics']['otofun']['error_counts'], {'source-time-budget': 1})

    def test_refresh_sweep_has_its_own_quota_and_never_runs_discovery(self):
        rows=[{'source_id':'otofun','source_key':f'otofun:{i}:post-1','source_url':f'https://www.otofun.net.vn/threads/test.{i}/#post-1','payload':{}} for i in range(20)]
        class Store(MemoryStore):
            def request(self,path):
                return super().request(path) if path.startswith('collection_sources') else rows
        store=Store()
        with patch('data_pipeline.refresh',return_value=0) as refreshed, patch('data_pipeline.marketplace') as market, patch('data_pipeline.crawl') as voz:
            result=collect(store,'refresh-test',refresh_only=True,refresh_limit=12)
        self.assertEqual(len(refreshed.call_args.args[2]),12)
        market.assert_not_called();voz.assert_not_called()
        self.assertEqual(result['attempted_sources'],['otofun'])
        self.assertEqual(result['source_states']['voz'],'idle')
        self.assertEqual(store.finished[0]['p_discovery'],[])
        self.assertEqual(result['outcome'],'completed')

    def test_refresh_prioritizes_current_reviews_and_skips_expired_ads(self):
        rows=[{'id':f'candidate-{i}','fingerprint':str(i),'source_id':'otofun','source_key':f'otofun:{i}:post-1','source_url':f'https://www.otofun.net.vn/threads/test.{i}/#post-1','payload':{}} for i in range(5)]
        rows[0]['payload']['flags']=['source-ad-marked-expired-not-proof-of-sale']
        class Store(MemoryStore):
            def request(self,path):
                if path.startswith('collection_sources'): return self.sources
                if path.startswith('candidate_assessments'): return [{'candidate_id':'candidate-4','fingerprint':'4'},{'candidate_id':'candidate-3','fingerprint':'OLD'}]
                return rows
        with patch('data_pipeline.refresh',return_value=0) as refreshed:
            collect(Store(),'priority-test',refresh_only=True,refresh_limit=2)
        self.assertEqual([row['id'] for row in refreshed.call_args.args[2]],['candidate-4','candidate-1'])

    def test_partial_cli_succeeds_and_emits_a_ci_warning(self):
        out, err = io.StringIO(), io.StringIO()
        with patch('data_pipeline.Store'), patch('data_pipeline.collect', return_value={'outcome': 'partial'}), \
             patch('sys.argv', ['pipeline', 'collect', '--apply']), \
             patch.dict('os.environ', {'GITHUB_ACTIONS': 'true'}), redirect_stdout(out), redirect_stderr(err):
            main()
        self.assertEqual(json.loads(out.getvalue())['outcome'], 'partial')
        self.assertIn('::warning', err.getvalue())

    def test_recent_usable_run_is_found_beyond_five_failed_runs(self):
        stamp = datetime.now(timezone.utc).isoformat()
        out = io.StringIO()
        def history(path):
            if 'outcome=in.' in path:
                return [{'outcome': 'completed', 'completed_at': stamp}]
            if path.startswith('collection_sources'):
                return []
            return [{'outcome': 'failed', 'completed_at': stamp} for _ in range(5)]
        with patch('data_pipeline.Store') as store, patch('sys.argv', ['pipeline', 'status']), redirect_stdout(out):
            store.return_value.request.side_effect = history
            main()
        result = json.loads(out.getvalue())
        self.assertFalse(result['stale'])
        self.assertFalse(result['healthy'])

    def test_recent_success_does_not_hide_latest_failed_run(self):
        stamp = datetime.now(timezone.utc).isoformat()
        runs = [{'outcome': 'failed', 'completed_at': stamp, 'summary': {}},
                {'outcome': 'completed', 'completed_at': stamp, 'summary': {}}]
        out = io.StringIO()
        with patch('data_pipeline.Store') as store, patch('sys.argv', ['pipeline', 'status']), redirect_stdout(out):
            store.return_value.request.return_value = runs
            main()
        result = json.loads(out.getvalue())
        self.assertFalse(result['stale'])
        self.assertFalse(result['healthy'])
        self.assertEqual(result['latest_outcome'], 'failed')

    def test_otofun_outage_stops_refresh_and_discovery_but_voz_continues(self):
        class Store:
            def request(self, path):
                if path.startswith('collection_sources'):
                    return [{'id': 'otofun'}, {'id': 'voz'}]
                return [{'source_id': 'otofun', 'source_url': f'https://www.otofun.net.vn/threads/test.{i}/'}
                        for i in range(1, 8)]
            def rpc(self, name, **args):
                return 'lease' if name == 'claim_daily_run' else None

        failure = HTTPError('https://www.otofun.net.vn/robots.txt', 503, 'Unavailable', {}, None)
        with patch('forum_crawl.Fetcher.request', side_effect=failure) as request, \
             patch('data_pipeline.marketplace') as market, \
             patch('data_pipeline.crawl', return_value={'errors': []}) as voz:
            result = collect(Store(), 'test')
        self.assertEqual(request.call_count, 1)
        market.assert_not_called()
        voz.assert_called_once()
        self.assertEqual(result['source_states'], {'otofun': 'failed', 'voz': 'ok'})
        self.assertEqual(result['source_errors'], 1)

    def test_status_distinguishes_healthy_partial_stale_and_empty_history(self):
        stamp = datetime.now(timezone.utc).isoformat()
        for runs, healthy, stale in [
            ([{'outcome': 'completed', 'completed_at': stamp}], True, False),
            ([{'outcome': 'partial', 'completed_at': stamp}], False, False),
            ([{'outcome': 'completed', 'completed_at': '2000-01-01T00:00:00+00:00'}], False, True),
            ([], False, True),
        ]:
            with self.subTest(runs=runs):
                out = io.StringIO()
                with patch('data_pipeline.Store') as store, patch('sys.argv', ['pipeline', 'status']), redirect_stdout(out):
                    store.return_value.request.return_value = runs
                    main()
                result = json.loads(out.getvalue())
                self.assertEqual(result['healthy'], healthy)
                self.assertEqual(result['stale'], stale)
