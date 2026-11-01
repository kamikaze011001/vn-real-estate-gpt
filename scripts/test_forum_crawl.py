import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from forum_crawl import Robots, claims, database, parse_feed, parse_thread, public_url, redact, save_item, thread_url, Fetcher, AccessStopped, enrich, parse_marketplace, apartment_title, marketplace


class CrawlTests(unittest.TestCase):
    def test_publication_attribution_precedes_last_edit_timestamp(self):
        html = """<article data-content='post-1'><div class='message-attribution-main'><a>11:13 12/09/2026</a></div>
        <div class='bbWrapper'>TEST ONLY body</div><div class='message-lastEdit'><time datetime='2026-09-14T13:55:58+0700'></time></div></article>"""
        post = parse_thread(html, "https://www.otofun.net.vn/threads/test.1/")["posts"][0]
        self.assertEqual(post["posted_at"], "2026-09-12")
        self.assertEqual(post["source_edited_at"], "2026-09-14T13:55:58+0700")

    def test_marketplace_discovery_ignores_action_links_other_hosts_and_out_of_scope_titles(self):
        html = """<div class='structItem-title'><a href='/forums/test/?prefix=1'>Cần bán</a><a href='/threads/test.42/'>Căn hộ Hà Nội</a></div>
        <div class='structItem-title'><a href='https://evil.test/threads/test.3/'>Căn hộ</a></div>
        <a href='/threads/unrelated.99/'>Outside thread title</a>"""
        found = parse_marketplace(html, "https://www.otofun.net.vn/forums/cho-bat-dong-san.423/")
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]["title"], "Căn hộ Hà Nội")
        for title in ["Cần mua căn hộ Hà Nội", "Cho thuê chung cư Hà Nội", "Căn hộ Nha Trang", "Căn hộ Trust City Văn Giang", "Bán nhà phố Hà Nội"]:
            self.assertFalse(apartment_title(title), title)
        self.assertTrue(apartment_title("View thoáng căn 2PN 54,5m2"))

    def test_marketplace_fetch_is_bounded_and_never_samples_latest_replies(self):
        with tempfile.TemporaryDirectory() as directory:
            db = database(Path(directory) / "crawl.sqlite")
            base = "https://www.otofun.net.vn/forums/cho-bat-dong-san.423/"
            index = """<div class='structItem-title'><a href='/threads/a.42/'>Căn hộ Hà Nội</a></div>
            <div class='structItem-title'><a href='/threads/b.43/'>Căn hộ Hà Nội</a></div>"""
            html = """<h1 class='p-title-value'>TEST ONLY Cần bán căn hộ Hà Nội</h1><article data-content='post-1'><div class='bbWrapper'>TEST ONLY Căn hộ Hà Nội 72m2, cần bán 3,5 tỷ.</div></article><article data-content='post-2'><div class='bbWrapper'>TEST ONLY reply</div></article><div class='pageNav'><a href='/threads/a.42/page-99'>99</a></div>"""
            def get(url, html=False):
                return (index if url == base else globals_html, url)
            globals_html = html
            with patch.object(Fetcher, "get", side_effect=get) as request:
                result = marketplace(db, pages=1, max_threads=1)
            self.assertEqual(request.call_count, 2)
            self.assertEqual(result["apartment_title_candidates"], 2)
            self.assertEqual(result["opening_posts_attempted"], 1)
            self.assertEqual(result["records_observed"], 1)
            data = json.loads(db.execute("SELECT data FROM item").fetchone()[0])
            self.assertEqual(data["key"], "post-1")
            self.assertEqual(data["post_role"], "opening-ad")
            with self.assertRaises(ValueError):
                marketplace(db, pages=6)
            db.close()
    def test_enrichment_fetches_only_the_opening_post_and_links_the_excerpt(self):
        with tempfile.TemporaryDirectory() as directory:
            db = database(Path(directory) / "crawl.sqlite")
            url = "https://www.otofun.net.vn/threads/test.42/"
            post = {"key": "feed-excerpt", "text": "TEST ONLY cần bán căn hộ Hà Nội...", "source_url": url,
                    "posted_at": None, "format": "rss-excerpt", "truncated": False}
            save_item(db, "otofun", url, "TEST ONLY", post, "external-supplier-lead-discovery")
            html = """<h1 class='p-title-value'>TEST ONLY</h1><article data-content='post-1'>
            <div class='message-attribution-main'><a>21:50 06/10/2026</a></div><div class='bbWrapper'>TEST ONLY Chính chủ cần bán căn hộ Hà Nội 72m2, 2PN, 3,5 tỷ.</div></article>
            <article data-content='post-2'><div class='bbWrapper'>TEST ONLY unrelated reply</div></article>
            <div class='pageNav'><a href='/threads/test.42/page-999'>999</a></div>"""
            with patch.object(Fetcher, "get", return_value=(html, url)) as get:
                result = enrich(db, ["otofun:42:feed-excerpt"])
                get.assert_called_once_with(url, html=True)
            self.assertEqual(result["records_observed"], 1)
            self.assertEqual(result["resolved"][0]["post_item_id"], "otofun:42:post-1")
            self.assertEqual(result["resolved"][0]["posted_at"], "2026-10-06")
            self.assertEqual(db.execute("SELECT target_item_id FROM forum_enrichment").fetchone()[0], "otofun:42:post-1")
            self.assertIsNone(db.execute("SELECT id FROM item WHERE id='otofun:42:post-2'").fetchone())
            with patch.object(Fetcher, "get", return_value=(html, url)):
                self.assertEqual(enrich(db, ["otofun:42:feed-excerpt"])["new_observations"], 0)
            db.execute("DELETE FROM item WHERE id='otofun:42:post-1'")
            self.assertEqual(db.execute("SELECT count(*) FROM forum_enrichment").fetchone()[0], 0)
            db.close()

    def test_enrichment_rejects_unknown_items_redirects_and_missing_exact_posts(self):
        with tempfile.TemporaryDirectory() as directory:
            db = database(Path(directory) / "crawl.sqlite")
            with patch.object(Fetcher, "get") as get:
                with self.assertRaises(ValueError):
                    enrich(db, ["otofun:42:post-1"])
                get.assert_not_called()
            url = "https://voz.vn/t/test.42/"
            save_item(db, "voz", url, "TEST ONLY", {"key": "post-1", "text": "TEST ONLY", "source_url": url+'#post-1', "posted_at": None, "format": "public-post", "truncated": False}, "community")
            for html, final in [("<article data-content='post-2'><div class='bbWrapper'>TEST ONLY other</div></article>", url), ("TEST ONLY", "https://voz.vn/t/test.43/")]:
                with patch.object(Fetcher, "get", return_value=(html, final)):
                    result = enrich(db, ["voz:42:post-1"])
                self.assertEqual(result["outcome"], "failed")
                self.assertEqual(result["new_observations"], 0)
            db.close()

    def test_otofun_plain_attribution_date_is_preserved_without_inventing_timezone(self):
        html = """<article data-content='post-1'>
        <div class='message-attribution-main'><a class='u-concealed'>21:50 06/10/2026</a></div>
        <div class='bbWrapper'>TEST ONLY body <time datetime='2020-01-01T00:00:00Z'>quoted date</time></div>
        </article>"""
        post = parse_thread(html, "https://www.otofun.net.vn/threads/test.1/")["posts"][0]
        self.assertEqual(post["posted_at"], "2026-10-06")
        self.assertEqual(post["source_local_time"], "21:50")
        self.assertIsNone(post["source_timezone"])

    def test_robots_merges_repeated_groups_and_uses_specific_agents(self):
        policy = Robots("""
        User-agent: *
        Allow: /
        User-agent: GPTBot
        Disallow: /
        User-agent: *
        Disallow: /account/
        Disallow: /t/*/latest$
        Crawl-delay: 3
        """)
        self.assertFalse(policy.policy("https://voz.vn/t/a.1/", "GPTBot/1.0")[0])
        self.assertFalse(policy.policy("https://voz.vn/account/private")[0])
        self.assertFalse(policy.policy("https://voz.vn/t/a.1/latest")[0])
        self.assertTrue(policy.policy("https://voz.vn/t/a.1/")[0])
        self.assertEqual(policy.policy("https://voz.vn/t/a.1/")[1], 3)
        self.assertTrue(Robots("User-agent: *\nDisallow: /a\nAllow: /a").policy("https://voz.vn/a")[0])

    def test_only_known_public_thread_routes_are_accepted(self):
        self.assertEqual(thread_url("https://voz.vn/t/a.12/?utm_source=rss#post-1"), "https://voz.vn/t/a.12/")
        for url in ["http://voz.vn/t/a.1/", "https://evil.test/t/a.1/", "https://voz.vn@evil.test/t/a.1/", "https://voz.vn/account/", "https://voz.vn/t/a.1/latest", "https://voz.vn:8443/t/a.1/", "https://voz.vn/t/a.1/%0a"]:
            with self.assertRaises(ValueError, msg=url):
                thread_url(url)

    def test_post_parser_excludes_quotes_authors_signatures_and_contact_data(self):
        html = """<h1 class='p-title-value'>TEST ONLY Hà Nội</h1>
        <article class='message message--post' data-content='post-123'>
          <a class='username'>PrivateUser</a><time datetime='2026-10-20T12:00:00+0700'></time>
          <article class='message-body'><div class='bbWrapper'>Căn 72 m², 2PN, giá 3,5 tỷ.
            <blockquote>Copied quoted claim 9 tỷ</blockquote><a href='/members/1'>User Mention</a>
            <p>Liên hệ 0988 123 456 hoặc test@example.test</p><script>doBadThing()</script>
          </div></article><aside class='message-signature'>Signature personal data</aside>
        </article><div class='pageNav'><ul><li><a href='/threads/test.42/page-5'>5</a></li><li><a href='/threads/test.42/page-2'>2</a></li></ul></div>"""
        result = parse_thread(html, "https://www.otofun.net.vn/threads/test.42/")
        self.assertEqual(len(result["posts"]), 1)
        post = result["posts"][0]
        self.assertEqual(post["posted_at"], "2026-10-20T12:00:00+0700")
        self.assertTrue(post["source_url"].endswith("#post-123"))
        for removed in ["PrivateUser", "User Mention", "0988", "test@example", "Signature", "Copied quoted", "doBadThing"]:
            self.assertNotIn(removed, post["text"])
        self.assertIn("72 m²", post["text"])
        self.assertEqual(result["last_url"], "https://www.otofun.net.vn/threads/test.42/page-5")

    def test_feed_encoded_content_has_separate_activity_date_without_invented_post_date(self):
        xml = """<rss xmlns:content='http://purl.org/rss/1.0/modules/content/'><channel><item><title>Hà Nội</title><pubDate>Sun, 25 Oct 2026 12:00:00 GMT</pubDate><link>https://voz.vn/t/test.42/?utm_source=rss</link><author>Do not retain</author><content:encoded><![CDATA[<p>Giá 3,5 tỷ. 0988123456 test@example.test</p>]]></content:encoded></item><item><link>https://evil.test/</link></item></channel></rss>"""
        items = parse_feed(xml)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["url"], "https://voz.vn/t/test.42/")
        self.assertIn("3,5 tỷ", items[0]["excerpt"])
        self.assertNotIn("0988", items[0]["excerpt"])
        self.assertNotIn("author", items[0])
        with self.assertRaises(ValueError):
            parse_feed('<!DOCTYPE rss [<!ENTITY x "unsafe">]><rss/>')

    def test_ambiguous_prices_and_rental_buying_requests_remain_candidates(self):
        self.assertEqual(claims("Bán căn 72 m², 2PN, 3,5 tỷ", "external-supplier-lead-discovery")["price_candidates"][0]["value_vnd"], 3500000000)
        self.assertEqual(claims("Bán hoặc cho thuê căn 72 m²", "external-supplier-lead-discovery")["intent_hint"], "mixed-sale-rent")
        self.assertEqual(claims("Cần mua căn hộ", "external-supplier-lead-discovery")["intent_hint"], "buyer-request")
        for text in ["Giá 7đ", "Giá khoảng 3,5 tỷ", "Giá 3,5xx tỷ"]:
            data = claims(text, "external-supplier-lead-discovery")
            self.assertFalse(any(price["value_vnd"] is not None for price in data["price_candidates"]), text)
            self.assertEqual(data["availability"], "unknown")
        self.assertEqual(claims("Bán 3 tỷ/m²", "external-supplier-lead-discovery")["price_candidates"][0]["basis"], "per_m2")

    def test_duplicate_bumps_do_not_create_content_changes_and_expiry_is_enforced(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "crawl.sqlite"
            db = database(path)
            post = {"key": "post-1", "text": "TEST ONLY 72 m²", "posted_at": "2026-10-20", "source_url": "https://voz.vn/t/a.1/#post-1", "format": "public-post", "truncated": False}
            self.assertTrue(save_item(db, "voz", "https://voz.vn/t/a.1/", "TEST ONLY", post, "community", "old activity"))
            self.assertFalse(save_item(db, "voz", "https://voz.vn/t/a.1/", "TEST ONLY", post, "community", "new bump"))
            self.assertEqual(db.execute("SELECT count(*) FROM item").fetchone()[0], 1)
            self.assertEqual(db.execute("SELECT count(*) FROM observation").fetchone()[0], 1)
            self.assertEqual(json.loads(db.execute("SELECT data FROM item").fetchone()[0])["feed_activity_at"], "new bump")
            db.execute("UPDATE item SET expires_at='2000-01-01'"); db.execute("UPDATE observation SET expires_at='2000-01-01'"); db.commit(); db.close()
            db = database(path)
            self.assertEqual(db.execute("SELECT count(*) FROM item").fetchone()[0], 0)
            self.assertEqual(db.execute("SELECT count(*) FROM observation").fetchone()[0], 0)
            db.close()

    def test_robots_blocks_requests_before_any_thread_fetch(self):
        with tempfile.TemporaryDirectory() as directory:
            db = database(Path(directory) / "crawl.sqlite")
            fetcher = Fetcher(db)
            fetcher.robots["https://voz.vn"] = Robots("User-agent: *\nDisallow: /t/")
            with patch.object(fetcher, "request") as request:
                with self.assertRaises(AccessStopped):
                    fetcher.get("https://voz.vn/t/test.1/", html=True)
                request.assert_not_called()
            db.close()

    def test_access_block_stops_the_host_without_retrying_or_using_another_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            db = database(Path(directory) / "crawl.sqlite")
            fetcher = Fetcher(db)
            fetcher.robots["https://voz.vn"] = Robots("User-agent: *\nAllow: /")
            with patch.object(fetcher, "request", side_effect=HTTPError("https://voz.vn/t/a.1/", 403, "Forbidden", {}, None)) as request:
                for url in ["https://voz.vn/t/a.1/", "https://voz.vn/t/b.2/"]:
                    with self.assertRaises(AccessStopped):
                        fetcher.get(url, html=True)
                self.assertEqual(request.call_count, 1)
            db.close()

    def test_service_outage_stops_both_otofun_hosts_for_this_run_and_recovers_next_run(self):
        with tempfile.TemporaryDirectory() as directory:
            db = database(Path(directory) / 'crawl.sqlite')
            fetcher = Fetcher(db)
            failure = HTTPError('https://www.otofun.net.vn/robots.txt', 503, 'Unavailable', {}, None)
            with patch.object(fetcher, 'request', side_effect=failure) as request:
                for host in ['www.otofun.net.vn', 'www.otofun.net.vn', 'www.otofun.net']:
                    with self.assertRaises(AccessStopped):
                        fetcher.get(f'https://{host}/threads/test.1/', html=True)
                self.assertEqual(request.call_count, 1)
            recovered = Fetcher(db)
            with patch.object(recovered, 'request', side_effect=[(b'User-agent: *\nAllow: /', 'text/plain'),
                                                                 (b'<html>recovered</html>', 'text/html')]) as request:
                body, _ = recovered.get('https://www.otofun.net.vn/threads/test.1/', html=True)
                self.assertIn('recovered', body)
                self.assertEqual(request.call_count, 2)
            db.close()

    def test_network_timeout_is_classified_and_does_not_retry_policy_for_each_item(self):
        with tempfile.TemporaryDirectory() as directory:
            db = database(Path(directory) / 'crawl.sqlite')
            fetcher = Fetcher(db)
            with patch.object(fetcher.opener, 'open', side_effect=URLError(TimeoutError())) as request:
                for number in [1, 2, 3]:
                    with self.assertRaises(AccessStopped):
                        fetcher.get(f'https://www.otofun.net.vn/threads/test.{number}/', html=True)
                self.assertEqual(request.call_count, 1)
            self.assertEqual(db.execute('SELECT error FROM fetch_log').fetchone()[0], 'network-timeout')
            db.close()

    def test_service_outage_after_valid_robots_stops_later_post_requests(self):
        with tempfile.TemporaryDirectory() as directory:
            db = database(Path(directory) / 'crawl.sqlite')
            fetcher = Fetcher(db)
            fetcher.robots['https://www.otofun.net.vn'] = Robots('User-agent: *\nAllow: /')
            failure = HTTPError('https://www.otofun.net.vn/threads/test.1/', 503, 'Unavailable', {}, None)
            with patch.object(fetcher, 'request', side_effect=failure) as request:
                for number in [1, 2]:
                    with self.assertRaises(AccessStopped):
                        fetcher.get(f'https://www.otofun.net.vn/threads/test.{number}/', html=True)
                self.assertEqual(request.call_count, 1)
            db.close()

    def test_redirects_to_private_or_unrelated_hosts_are_not_followed(self):
        with tempfile.TemporaryDirectory() as directory:
            db = database(Path(directory) / "crawl.sqlite")
            fetcher = Fetcher(db)
            fetcher.robots["https://voz.vn"] = Robots("User-agent: *\nAllow: /")
            redirect = HTTPError("https://voz.vn/t/a.1/", 302, "Found", {"Location": "https://127.0.0.1/private"}, None)
            with patch.object(fetcher, "request", side_effect=redirect) as request:
                with self.assertRaises(ValueError):
                    fetcher.get("https://voz.vn/t/a.1/", html=True)
                self.assertEqual(request.call_count, 1)
            db.close()


if __name__ == "__main__":
    unittest.main()
