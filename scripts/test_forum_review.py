import json
import os
import tempfile
import unittest
from pathlib import Path

from forum_crawl import database, save_item
from forum_review import decide, handoff, load_queue, summary, write_packet, source_date


class ForumReviewTests(unittest.TestCase):
    def test_source_date_accepts_a_date_without_fabricating_a_timestamp(self):
        self.assertEqual(source_date("2026-10-06"), "2026-10-06")
        self.assertIsNone(source_date("2026-02-30"))
        self.assertIsNone(source_date("2026-10-06T21:50:00"))

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / "crawl.sqlite"
        self.db = database(self.path)

    def tearDown(self):
        self.db.close()
        self.directory.cleanup()

    def add(self, text, title="TEST ONLY Smart City", key="post-1", thread=42,
            date="2026-01-01T12:00:00+0700", feed=False, source="otofun", activity=None):
        host, route = ("voz.vn", "t") if source == "voz" else ("www.otofun.net.vn", "threads")
        url = f"https://{host}/{route}/test.{thread}/"
        post = {"key": key, "text": text, "posted_at": date, "source_url": url if feed else url + "#" + key,
                "format": "rss-excerpt" if feed else "public-post", "truncated": False}
        save_item(self.db, source, url, title, post, "project-community-discovery", activity)
        return f"{source}:{thread}:{key}"

    def test_apartment_offer_preserves_candidates_without_promoting_facts(self):
        ident = self.add("TEST ONLY Chính chủ cần bán căn hộ Smart City, 72 m², 2PN, giá 3,5 tỷ.")
        item = load_queue(self.db)[0]
        self.assertEqual(item["id"], ident)
        self.assertEqual(item["queue"], "sale-candidates")
        self.assertEqual(item["fields"]["price_candidates"][0]["value_vnd"], 3500000000)
        self.assertEqual(item["fields"]["area_candidates"][0]["value_m2"], 72)
        for field in ("price_vnd", "area_m2", "bedrooms"):
            self.assertIsNone(item["fields"][field])
        self.assertEqual(item["fields"]["availability"], "unknown")
        self.assertEqual(item["fields"]["legal_status"], "unknown")
        self.assertFalse(handoff(item)["catalogue_importable"])
        self.assertIsNone(item["project_id"])

    def test_real_source_patterns_keep_shorthand_unresolved_and_per_m2_separate(self):
        self.add("TEST ONLY Em chính chủ cần bán căn hộ Samsora 96m xây dựng, thông thuỷ 91,5m, 3PN2VS. Giá bán 6ty 850tr vnd.", title="TEST ONLY Samsora Vạn Phúc Hà Đông")
        item = load_queue(self.db)[0]
        self.assertEqual(item["fields"]["bedroom_candidates"][0]["value"], 3)
        self.assertEqual(item["fields"]["price_candidates"][0]["raw"], "6ty 850tr vnd")
        self.assertIsNone(item["fields"]["price_candidates"][0]["value_vnd"])
        self.assertEqual(len(item["fields"]["area_candidates"]), 2)
        self.assertTrue(all(candidate["value_m2"] is None for candidate in item["fields"]["area_candidates"]))
        self.assertIn("price-expression-unresolved", item["flags"])
        self.assertIn("area-unit-unresolved", item["flags"])
        self.assertEqual(item["projects"][0]["candidate"], "samsora-van-phuc")
        ident = self.add("TEST ONLY Chính chủ cần bán căn hộ CT1ADN1 Mỹ Đình II. Diện tích sử dụng: 68.68 m2, 2 phòng ngủ. Giá: 78 triệu/m².", key="post-2")
        item = next(item for item in load_queue(self.db) if item["id"] == ident)
        self.assertEqual(item["fields"]["price_candidates"][0]["basis"], "per_m2")
        self.assertEqual(item["fields"]["price_candidates"][0]["value_vnd"], 78000000)
        self.assertIsNone(item["fields"]["price_vnd"])
        self.assertIn("per-m2-rate-is-not-a-total-asking-price", item["flags"])

    def test_enriched_excerpt_is_replaced_by_exact_post_and_reopens_when_post_changes(self):
        feed_id = self.add("TEST ONLY Chính chủ cần bán căn hộ Hà Nội...", key="feed-excerpt", feed=True, date=None)
        text = "TEST ONLY Chính chủ cần bán căn hộ Hà Nội 72m2, 2PN, giá 3,5 tỷ."
        post_id = self.add(text)
        self.db.execute("INSERT INTO forum_enrichment VALUES(?,?,?)", (feed_id, post_id, "2026-10-30"))
        self.db.commit()
        item = next(item for item in load_queue(self.db) if item["id"] == feed_id)
        self.assertEqual(item["duplicate_of"], post_id)
        self.assertIn("rss-replaced-by-original-post", item["reasons"])
        decide(self.db, feed_id, item["revision"], "dismissed", "TEST ONLY use original post")
        self.add(text.replace("3,5", "3,6"))
        item = next(item for item in load_queue(self.db) if item["id"] == feed_id)
        self.assertEqual(item["decision"], "review-required")

    def test_rent_buyer_land_and_other_phases_do_not_enter_apartment_queue(self):
        for index, (title, body, reason) in enumerate([
            ("Cho thuê chung cư Hà Nội", "TEST ONLY 72m2 cho thuê 12 triệu/tháng", "rental-outside-resale-pilot"),
            ("Cần tìm studio Smart City", "TEST ONLY muốn mua để ở", "buyer-request-not-an-offer"),
            ("Chính chủ bán đất Hà Nội", "TEST ONLY đất cần bán 60m2, 4 tỷ", "non-apartment-offer"),
            ("Ocean Park 2", "TEST ONLY giá Ocean Park 2 tại Hưng Yên đang được thảo luận.", "ocean-park-phase-2-or-3-outside-first-pilot"),
            ("Bán căn hộ Hà Nội", "Đã xong", "source-indicates-closed-offer"),
        ]):
            ident = self.add(body, title, key="feed-excerpt", thread=index + 100, feed=True, date=None)
            item = next(item for item in load_queue(self.db) if item["id"] == ident)
            self.assertEqual(item["queue"], "excluded", title)
            self.assertIn(reason, item["reasons"])

    def test_mixed_offer_and_ambiguous_prices_remain_unresolved(self):
        self.add("TEST ONLY Bán hoặc cho thuê căn hộ Smart City 72m2 giá khoảng 3,5 tỷ hoặc 7đ, tham khảo 6.250 tỷ.", feed=True)
        item = load_queue(self.db)[0]
        self.assertEqual(item["queue"], "needs-context")
        prices = item["fields"]["price_candidates"]
        self.assertEqual(len(prices), 3)
        self.assertTrue(all(price["value_vnd"] is None for price in prices))

    def test_community_context_uses_body_topics_and_never_makes_a_summary(self):
        self.add("TEST ONLY Phí dịch vụ và chỗ để xe ở khu này cần hỏi ban quản lý, mỗi tòa có thể khác nhau. Cần kiểm tra lại trước khi quyết định.")
        item = load_queue(self.db)[0]
        self.assertEqual(item["queue"], "community-insights")
        self.assertIn("project-inferred-only-from-thread-title", item["flags"])
        self.assertIn("fees", item["topics"])
        template = handoff(item)["template"]
        self.assertEqual(template["summary"], "")
        self.assertEqual(template["permissionReference"], "")
        self.assertEqual(template["checkedAt"], "")
        self.assertEqual(template["projectId"], "")
        self.assertEqual(template["sourcePublishedAt"], "2026-01-01")

    def test_thread_sale_title_does_not_turn_a_reply_into_a_listing(self):
        self.add("TEST ONLY Bán hết nhà đi rồi mua lại sau cụ ơi", "Bán căn hộ Smart City giá 3 tỷ")
        self.assertNotEqual(load_queue(self.db)[0]["queue"], "sale-candidates")

    def test_apartment_offer_with_unknown_or_conflicting_location_needs_context(self):
        first_id = self.add("TEST ONLY Chính chủ cần bán căn hộ 72m2, 2PN, 3,5 tỷ.", title="TEST ONLY Cần bán căn hộ")
        second_id = self.add("TEST ONLY Chính chủ cần bán căn hộ Văn Giang, Hưng Yên. Văn phòng môi giới Hà Nội. 72m2, 3,5 tỷ.", title="TEST ONLY Căn hộ", key="post-2")
        items = {item["id"]: item for item in load_queue(self.db)}
        self.assertEqual(items[first_id]["queue"], "needs-context")
        self.assertIn("hanoi-location-needs-confirmation", items[first_id]["reasons"])
        self.assertEqual(items[second_id]["queue"], "needs-context")
        self.assertIn("multiple-geographies-needs-location-review", items[second_id]["reasons"])

    def test_closed_paused_and_expired_ads_never_appear_as_current_sale_candidates(self):
        text = "TEST ONLY Chính chủ cần bán căn hộ Hà Nội 72m2, 2PN, 3,5 tỷ."
        closed = self.add(text, title="[Đã xong] Căn hộ Hà Nội")
        expired = self.add(text, title="Hết hạn Căn hộ Hà Nội", key="post-2", thread=43)
        paused = self.add("TEST ONLY Em tạm dừng giao dịch ạ", title="[Cần bán] Căn hộ Hà Nội", key="post-3")
        items = {item["id"]: item for item in load_queue(self.db)}
        self.assertEqual(items[closed]["queue"], "excluded")
        self.assertEqual(items[paused]["queue"], "excluded")
        self.assertEqual(items[expired]["queue"], "needs-context")
        self.assertIn("expired-ad-needs-reconfirmation", items[expired]["reasons"])
        for item in items.values():
            self.assertEqual(item["fields"]["availability"], "unknown")

    def test_secondary_property_location_does_not_establish_apartment_location(self):
        self.add("TEST ONLY Em cần bán căn hộ Xuân Mai Yên Nghĩa 80m2. Bán được căn này em bán cả shophouse bên Bắc Giang.", title="TEST ONLY Cần bán căn hộ")
        item = load_queue(self.db)[0]
        self.assertEqual(item["queue"], "needs-context")
        self.assertIn("mixed-property-types", item["reasons"])

    def test_related_author_update_cannot_become_another_apartment_offer(self):
        ident = self.add("TEST ONLY Cần bán căn hộ Hà Nội 72m2, 2PN, 3,5 tỷ.")
        data=json.loads(self.db.execute("SELECT data FROM item WHERE id=?",(ident,)).fetchone()[0])
        data.update(post_role="thread-starter-update",opening_post_key="post-0",relationship_basis="matching-public-post-author-marker")
        self.db.execute("UPDATE item SET data=? WHERE id=?",(json.dumps(data),ident));self.db.commit()
        item=load_queue(self.db)[0]
        self.assertEqual(item["queue"],"needs-context")
        self.assertIn("thread-starter-update-not-a-separate-offer",item["reasons"])
        self.assertEqual(item["opening_post_key"],"post-0")
        self.assertEqual(item["fields"]["availability"],"unknown")

    def test_price_discussion_and_finance_promotion_are_not_apartment_offers(self):
        self.add("TEST ONLY E đọc báo thấy dữ liệu giá bán chung cư sắp bàn giao, Ocean Park có nhiều tin giá bán thay đổi.", feed=True)
        first = load_queue(self.db)[0]
        self.assertEqual(first["queue"], "needs-context")
        self.assertIn("secondary-news-needs-original-source", first["reasons"])
        self.assertIn("completion-and-resale-scope-needs-review", first["flags"])
        self.add("TEST ONLY Vinsmart có giao dịch. Bác nào cần vay qua ngân hàng bên tôi, lãi suất khoảng 9%, LH tôi để được tư vấn thêm.", key="post-2")
        item = next(item for item in load_queue(self.db) if item["id"].endswith("post-2"))
        self.assertEqual(item["queue"], "needs-context")
        self.assertIn("commercial-promotion", item["reasons"])

    def test_rss_dates_and_short_replies_require_context(self):
        self.add("TEST ONLY Bác có không cho em xin thông tin nhé", date=None, feed=True, activity="Sun, 25 Oct 2026 12:00:00 GMT")
        item = load_queue(self.db)[0]
        self.assertEqual(item["queue"], "needs-context")
        self.assertIsNone(item["source_published_at"])
        self.assertIn("exact-post-date-missing-or-invalid", item["flags"])
        self.assertIn("rss-excerpt-needs-exact-post", item["flags"])

    def test_exact_same_thread_excerpt_is_grouped_but_cross_thread_is_only_flagged(self):
        text = "TEST ONLY Phí dịch vụ ở Smart City cần đối chiếu đúng tòa nhà, ban quản lý và thời điểm áp dụng trước khi sử dụng thông tin này."
        self.add(text, key="feed-excerpt", feed=True, date=None)
        primary = self.add(text, key="post-20")
        other = self.add(text, key="post-30", thread=43)
        items = {item["id"]: item for item in load_queue(self.db)}
        self.assertEqual(items["otofun:42:feed-excerpt"]["duplicate_of"], primary)
        self.assertEqual(items["otofun:42:feed-excerpt"]["queue"], "duplicates")
        self.assertIsNone(items[other]["duplicate_of"])
        self.assertIn(other, items[primary]["possible_repeats"])

    def test_decision_is_bound_to_revision_not_feed_bumps_and_changed_text_reopens(self):
        text = "TEST ONLY Chính chủ cần bán căn hộ Smart City 72m2, 2PN, 3,5 tỷ."
        ident = self.add(text, activity="old")
        item = load_queue(self.db)[0]
        decide(self.db, ident, item["revision"], "kept", "TEST ONLY intake follow-up needed")
        self.add(text, activity="new")
        self.assertEqual(load_queue(self.db)[0]["decision"], "kept")
        self.add(text.replace("3,5", "3,6"), activity="new")
        changed = load_queue(self.db)[0]
        self.assertEqual(changed["decision"], "review-required")
        with self.assertRaisesRegex(ValueError, "Content changed"):
            decide(self.db, ident, item["revision"], "kept", "TEST ONLY")
        self.assertFalse(changed["publication_ready"])

    def test_distinct_accents_and_primary_expiry_do_not_preserve_a_duplicate_decision(self):
        text = "TEST ONLY Phí dịch vụ ở Smart City cần đối chiếu đúng tòa nhà và thời điểm áp dụng trước khi sử dụng thông tin này."
        feed_id = self.add(text, key="feed-excerpt", feed=True, date=None)
        primary_id = self.add(text, key="post-2")
        self.add(text.replace("Phí", "Phi"), key="post-3")
        items = {item["id"]: item for item in load_queue(self.db)}
        self.assertIsNone(items["otofun:42:post-3"]["duplicate_of"])
        decide(self.db, feed_id, items[feed_id]["revision"], "dismissed", "TEST ONLY duplicate")
        self.db.execute("DELETE FROM item WHERE id=?", (primary_id,))
        self.db.commit()
        item = next(item for item in load_queue(self.db) if item["id"] == feed_id)
        self.assertIsNone(item["duplicate_of"])
        self.assertEqual(item["decision"], "review-required")

    def test_expiry_removes_live_items_and_decision_notes_even_from_crawler_open(self):
        ident = self.add("TEST ONLY Chính chủ cần bán căn hộ Smart City 72m2, 2PN, 3,5 tỷ.")
        item = load_queue(self.db)[0]
        decide(self.db, ident, item["revision"], "kept", "TEST ONLY")
        self.db.execute("UPDATE item SET expires_at='2000-01-01'")
        self.db.commit()
        self.assertEqual(load_queue(self.db), [])
        self.assertEqual(self.db.execute("SELECT count(*) FROM forum_review_decision").fetchone()[0], 0)
        with self.assertRaisesRegex(ValueError, "expired"):
            decide(self.db, ident, item["revision"], "kept", "TEST ONLY")
        self.db.close()
        self.db = database(self.path)
        self.assertEqual(self.db.execute("SELECT count(*) FROM item").fetchone()[0], 0)
        ident = self.add("TEST ONLY Chính chủ cần bán căn hộ Smart City 72m2, 2PN, 3,5 tỷ.", key="post-2")
        item = load_queue(self.db)[0]
        decide(self.db, ident, item["revision"], "kept", "TEST ONLY private note")
        self.db.execute("UPDATE item SET expires_at='2000-01-01'")
        self.db.commit()
        self.db.close()
        # The crawler's database open purges expired items; the trigger also
        # removes the associated decision without running the review module.
        self.db = database(self.path)
        self.assertEqual(self.db.execute("SELECT count(*) FROM forum_review_decision").fetchone()[0], 0)

    def test_private_export_contains_no_publication_action_and_cannot_clobber_files(self):
        self.add("TEST ONLY Cần mua căn hộ Smart City để ở.", feed=True)
        items = load_queue(self.db)
        with self.assertRaisesRegex(ValueError, "Excluded"):
            decide(self.db, items[0]["id"], items[0]["revision"], "kept", "TEST ONLY")
        output = Path(self.directory.name) / "packet.json"
        write_packet(output, items)
        packet = json.loads(output.read_text())
        self.assertTrue(packet["private_review_only"])
        self.assertEqual(os.stat(output).st_mode & 0o777, 0o600)
        self.assertEqual(packet["summary"]["publication_ready"], 0)
        with self.assertRaises(FileExistsError):
            write_packet(output, items)
        symlink = Path(self.directory.name) / "link.json"
        symlink.symlink_to(output)
        with self.assertRaises(FileExistsError):
            write_packet(symlink, items)
        self.assertEqual(summary(items)["records"], 1)

    def test_intake_claims_trace_to_exact_source_spans_and_leave_publication_fields_unset(self):
        self.add("TEST ONLY Chính chủ cần bán căn hộ Smart City 72 m², 2PN, 3,5 tỷ.")
        item = load_queue(self.db)[0]
        intake = handoff(item)["intake"]
        self.assertEqual(len(intake["sourceClaims"]), 3)
        for claim in intake["sourceClaims"]:
            loc = claim["locator"]
            self.assertEqual(item[loc["field"]][loc["start"]:loc["end"]], claim["raw"])
            self.assertEqual(loc["revision"], item["revision"])
            self.assertEqual(claim["verification"], "unverified-source-claim")
        for field in ("sourceUpdatedAt", "supplierListingId", "priceVnd", "priceConfirmedAt", "areaM2", "bedrooms", "projectId", "buildingId", "permissionReference", "updaterReference", "lat", "lng"):
            self.assertIsNone(intake[field], field)
        self.assertEqual(intake["availability"], "unknown")
        self.assertEqual(intake["permission"], "pending")
        self.assertEqual(intake["sourcePublishedAt"], "2026-01-01")

    def test_markdown_intake_neutralizes_source_markup_and_retains_expiry(self):
        self.add("TEST ONLY Chính chủ cần bán căn hộ Hà Nội 72m2, 2PN, 3,5 tỷ.", title="TEST ONLY ![image](https://evil.test/) <script>bad()</script> | title")
        item = load_queue(self.db)[0]
        output = Path(self.directory.name) / "intake.md"
        write_packet(output, [item])
        report = output.read_text()
        self.assertNotIn("![image]", report)
        self.assertNotIn("<script>", report)
        self.assertNotRegex(report, r"(?<!\\)\| title")
        self.assertIn(item["expires_at"].split("T")[0], report)
        self.assertIn("chưa được xác minh", report)
        self.assertEqual(os.stat(output).st_mode & 0o777, 0o600)


if __name__ == "__main__":
    unittest.main()
