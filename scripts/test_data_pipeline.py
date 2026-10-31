import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from forum_crawl import database, save_item
from data_pipeline import projection, refresh, collect


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
