import json
import tempfile
import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path

from forum_crawl import database, save_item
from forum_review import decide, load_queue
from forum_preview import handler_for, preview_data


class PreviewTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / "crawl.sqlite"
        self.db = database(self.path)
        self.url = "https://www.otofun.net.vn/threads/test.42/"
        self.save("TEST ONLY Chính chủ cần bán căn hộ Smart City 72m2, 2PN, 3,5 tỷ.")
        item = load_queue(self.db)[0]
        decide(self.db, item["id"], item["revision"], "kept", "SECRET OPERATOR NOTE")

    def tearDown(self):
        self.db.close()
        self.directory.cleanup()

    def save(self, text, key="post-1", **metadata):
        save_item(self.db, "otofun", self.url, "TEST ONLY Smart City", {"key": key, "text": text, "source_url": self.url + "#" + key,
                  "posted_at": "2026-01-01", "format": "public-post", "truncated": False, **metadata}, "external-supplier-lead-discovery")

    def test_projection_excludes_operator_notes_and_keeps_related_updates_separate(self):
        self.save("TEST ONLY reply from visible account", key="post-2", post_role="thread-starter-update", opening_post_key="post-1")
        packet = preview_data(self.path)
        self.assertTrue(packet["privateReviewOnly"])
        self.assertEqual(len(packet["leads"]), 1)
        lead = packet["leads"][0]
        self.assertEqual(len(lead["updates"]), 1)
        self.assertNotIn("SECRET OPERATOR NOTE", json.dumps(packet))
        self.assertNotIn("previous_decision", lead)
        self.assertIsNone(lead["fields"]["price_vnd"])
        self.assertEqual(lead["availability"], "unknown")
        self.assertFalse(lead["publicationReady"])

    def test_changed_content_reopens_retained_lead_and_expired_leads_disappear(self):
        self.save("TEST ONLY Chính chủ cần bán căn hộ Smart City 72m2, 2PN, 3,6 tỷ.")
        packet = preview_data(self.path)
        self.assertEqual(packet["leads"][0]["decision"], "review-required")
        self.assertIn("3,6 tỷ", packet["leads"][0]["text"])
        self.db.execute("UPDATE item SET expires_at='2000-01-01'")
        self.db.commit()
        self.assertEqual(preview_data(self.path)["leads"], [])
        with self.assertRaises(FileNotFoundError):
            preview_data(Path(self.directory.name) / "missing.sqlite")

    def test_http_serves_only_preview_assets_and_rejects_cross_origin_and_mutations(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler_for(self.path))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            def request(method, path, headers=None):
                client = HTTPConnection("127.0.0.1", server.server_port)
                client.request(method, path, headers=headers or {})
                response = client.getresponse()
                result = response.status, dict(response.getheaders()), response.read()
                client.close()
                return result
            status, headers, body = request("GET", "/api/leads")
            self.assertEqual(status, 200)
            self.assertEqual(len(json.loads(body)["leads"]), 1)
            self.assertEqual(headers["Cache-Control"], "no-store")
            self.assertNotIn("Access-Control-Allow-Origin", headers)
            self.assertIn("frame-ancestors 'none'", headers["Content-Security-Policy"])
            self.assertEqual(request("GET", "/")[0], 200)
            self.assertEqual(request("GET", "/api/leads", {"Host": "evil.test"})[0], 403)
            self.assertEqual(request("GET", "/api/leads", {"Origin": "https://evil.test"})[0], 403)
            self.assertEqual(request("POST", "/api/leads")[0], 405)
            for path in ("/mcp", "/private-data/forum-crawl.sqlite", "/../private-data/catalogue.sqlite"):
                self.assertEqual(request("GET", path)[0], 404)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
