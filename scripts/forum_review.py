"""Private crawl-to-review queues. No network access or catalogue publication."""
import argparse
import hashlib
import json
import os
import re
import sqlite3
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from forum_crawl import ROOT, database, normalized, now

VERSION = 3
QUEUES = ("sale-candidates", "community-insights", "needs-context", "excluded", "duplicates")
PROJECTS = {
    "vinhomes-smart-city": r"\b(?:smart\s*city|vinsmart|vsm)\b",
    "vinhomes-ocean-park": r"\b(?:ocean\s*park|ocp[123]?|op[123])\b",
    "samsora-van-phuc": r"\bsamsora\b",
    "my-dinh-ii-ct1adn1": r"\bct1adn1\b",
}
TARGET_PROJECTS = {"vinhomes-smart-city", "vinhomes-ocean-park"}
TOPICS = {
    "parking": r"\b(?:gui xe|do xe|cho de xe|bai xe|parking)\b",
    "management": r"\b(?:ban quan ly|bql|quan ly|van hanh)\b",
    "fees": r"\b(?:phi dich vu|phi quan ly|phi gui xe|phi bao tri)\b",
    "noise": r"\b(?:tieng on|on ao|cach am|karaoke)\b",
    "elevators": r"\b(?:thang may|thang cho hang)\b",
    "access": r"\b(?:giao thong|di lai|tac duong|ket xe|di chuyen)\b",
    "infrastructure": r"\b(?:ngap|truong hoc|benh vien|metro|quy hoach|duong xa)\b",
    "legal": r"\b(?:phap ly|so do|so hong|hdmb|giay phep)\b",
    "market": r"\b(?:gia|lai suat|giao dich|thanh khoan)\b",
}
HANOI = r"\b(?:ha noi|hn|ha dong|cau giay|tay ho|long bien|tu liem|thanh xuan|my dinh|nam tu liem|gia lam)\b"


def has(pattern, text):
    return bool(re.search(pattern, normalized(text)))


def revision(data):
    # Feed bumps and retrieval times do not change a content review. Classifier
    # changes do: never silently carry an old decision across new interpretation.
    content = {key: value for key, value in data.items() if key != "feed_activity_at"}
    return hashlib.sha256(json.dumps([VERSION, content], ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def source_date(value):
    if not value:
        return None
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            parsed = datetime.fromisoformat(value).date()
            return parsed.isoformat() if parsed <= datetime.now(timezone.utc).date() else None
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.date().isoformat() if parsed.tzinfo and parsed <= datetime.now(timezone.utc) else None
    except (ValueError, TypeError):
        return None


def extract_fields(text):
    """Retain independent expressions; never pair a price with an area/unit."""
    prices = []
    for match in re.finditer(r"(?<![\w.,])(\d{1,3}(?:[.,]\d{1,3})?)\s*(tỷ|tỉ|triệu|trieu|đồng|đ)(?!\w)", text, re.I):
        expression, unit = match.group(1), normalized(match.group(2))
        context = normalized(text[max(0, match.start() - 20):match.end() + 20])
        approximate = bool(re.search(r"\b(?:khoang|tam|hon|gan|duoi|tren|tu|den)\b|[~?]|\d\s*x", context))
        ambiguous = approximate or bool(re.search(r"[.,]\d{3}$", expression)) or unit not in {"ty", "ti", "trieu"}
        basis = "per_m2" if re.search(r"/\s*m[²2]", context) else "per_month" if re.search(r"/\s*thang", context) else "unspecified"
        prices.append({"raw": match.group(), "value_vnd": None if ambiguous else round(float(expression.replace(",", ".")) * (1e6 if unit == "trieu" else 1e9)), "basis": basis, "uncertain": ambiguous, "verified": False})
    areas = [{"raw": match.group(), "value_m2": float(match.group(1).replace(",", ".")), "basis": "unknown", "verified": False}
             for match in re.finditer(r"\b(\d{1,4}(?:[.,]\d{1,2})?)\s*m(?:²|2)(?!\w)", text, re.I)]
    # Retain common source shorthand without treating 'm' as confirmed m² or
    # an unaccented ty/tr as a verified total asking price.
    for match in re.finditer(r"\b\d{1,3}\s*ty\s*\d{1,3}\s*tr(?:\s*vnd)?\b", text, re.I):
        prices.append({"raw": match.group(), "value_vnd": None, "basis": "unspecified", "uncertain": True, "reason": "shorthand-needs-interpretation", "verified": False})
    for match in re.finditer(r"\b\d{1,4}(?:[.,]\d{1,2})?\s*m(?![\w²])", text, re.I):
        areas.append({"raw": match.group(), "value_m2": None, "basis": "unknown", "uncertain": True, "reason": "m-shorthand-not-confirmed-square-metres", "verified": False})
    beds = [{"raw": match.group(), "value": int(match.group(1)), "verified": False}
            for match in re.finditer(r"\b(\d{1,2})\s*(?:pn(?=\b|\d{1,2}(?:vs|wc)\b)|phòng\s*ngủ\b|ngủ\b)", text, re.I)]
    return {"price_candidates": prices[:12], "area_candidates": areas[:12], "bedroom_candidates": beds[:8],
            "price_vnd": None, "area_m2": None, "bedrooms": None,
            "area_basis": "unknown", "availability": "unknown", "legal_status": "unknown"}


def classify(row):
    data = json.loads(row["data"])
    title, body = data.get("title", ""), data.get("text", "")
    feed = data.get("format") == "rss-excerpt"
    opening_ad = data.get("post_role") == "opening-ad" and data.get("collection_role") == "external-supplier-lead-discovery"
    own = (title + "\n" + body) if feed else body
    projects = []
    for key, pattern in PROJECTS.items():
        if has(pattern, body) or has(pattern, title):
            projects.append({"candidate": key, "basis": "post-text" if has(pattern, body) else "feed-title" if feed else "thread-title", "verified": False})
    phase_other = has(r"\b(?:(?:ocean\s*park|ocp|op)\s*[23])\b", own)
    topics = [key for key, pattern in TOPICS.items() if has(pattern, body)]
    apartment = has(r"\b(?:can ho|chung cu|apartment|penthouse|penhouse|studio)\b", own)
    non_apartment = has(r"\b(?:ban dat|ban nha|biet thu|lien ke|shophouse|dinh thu|nha nguyen can)\b", own)
    buyer = has(r"\b(?:can mua|tim mua|muon mua|can tim|dang tim mua|nhu cau tim)\b", own)
    rental = has(r"\b(?:cho thue|can thue|tim thue)\b", own)
    # Explicit offer language rather than any occurrence of 'bán' in a discussion.
    sale = (has(r"\b(?:can ban|ban gap|ban can ho|ban chung cu|ban hoac cho thue|chuyen nhuong|chinh chu ban)\b", own)
            or (feed and has(r"\bban\b", title))
            or (data.get("claims", {}).get("intent_hint") == "sale-lead" and has(r"\bgia ban\b", own)))
    supplier = has(r"\b(?:quy can|bang hang|gio hang)\b", own)
    secondary_news = has(r"\b(?:doc bao|bao viet|nguon bao|theo bao)\b", body)
    commercial = has(r"\b(?:vay|ngan hang|lai suat)\b", body) and has(r"\b(?:ben toi|lh toi|lien he toi)\b", body)
    closed = (has(r"^(?:da xong|da ban|da giao dich|ngung ban)[.!\s]*$", body.strip())
              or has(r"^\s*\[\s*(?:da xong|da ban|ngung ban)\s*\]", title)
              or has(r"\b(?:tam dung giao dich|ngung giao dich)\b", body))
    expired_ad = has(r"^\s*het han\b", title)
    fields = extract_fields(own)
    if opening_ad and has(r"\bcan ban\b", title) and len(body) >= 60 and any(fields[key + "_candidates"] for key in ("price", "area", "bedroom")):
        sale = True
    targeted = any(project["candidate"] in TARGET_PROJECTS for project in projects)
    geo_text = title + "\n" + body if opening_ad else own
    geography = "target-project-candidate" if targeted else "hanoi-mentioned" if has(HANOI, geo_text) else "unresolved"
    outside = has(r"\b(?:tp\.?\s*hcm|sai gon|da nang|hung yen|bac ninh|hai phong|nha trang|van giang|phung cong|vinh phuc|phu tho|bac giang)\b", geo_text)
    reasons = []
    if closed:
        queue, reasons = "excluded", ["source-indicates-closed-offer"]
    elif data.get("post_role") == "thread-starter-update":
        queue, reasons = "needs-context", ["thread-starter-update-not-a-separate-offer"]
    elif buyer:
        queue, reasons = "excluded", ["buyer-request-not-an-offer"]
    elif sale and rental:
        queue, reasons = "needs-context", ["mixed-sale-and-rental"]
    elif rental and (feed or sale or not projects):
        queue, reasons = "excluded", ["rental-outside-resale-pilot"]
    elif phase_other:
        queue, reasons = "excluded", ["ocean-park-phase-2-or-3-outside-first-pilot"]
    elif sale and apartment and non_apartment:
        queue, reasons = "needs-context", ["mixed-property-types"]
    elif outside and not has(HANOI, geo_text) and not projects:
        queue, reasons = "excluded", ["outside-hanoi-mentioned"]
    elif outside and has(HANOI, geo_text):
        queue, reasons = "needs-context", ["multiple-geographies-needs-location-review"]
    elif sale and non_apartment:
        queue, reasons = "excluded", ["non-apartment-offer"]
    elif commercial or secondary_news:
        queue, reasons = "needs-context", ["commercial-promotion"] if commercial else ["secondary-news-needs-original-source"]
    elif expired_ad:
        queue, reasons = "needs-context", ["expired-ad-needs-reconfirmation"]
    elif sale and apartment and geography == "unresolved":
        queue, reasons = "needs-context", ["hanoi-location-needs-confirmation"]
    elif sale and apartment:
        queue, reasons = "sale-candidates", ["explicit-apartment-offer-candidate"]
    elif supplier:
        queue, reasons = "needs-context", ["supplier-promotion-without-a-specific-offer"]
    elif projects and topics and len(body) >= 80:
        queue, reasons = "community-insights", ["project-topic-discussion-candidate"]
    else:
        queue, reasons = "needs-context", ["insufficient-specific-project-or-claim-context"]
    flags = ["publication-use-unresolved", "project-and-building-not-canonicalized", "source-text-untrusted"]
    date = source_date(data.get("posted_at"))
    if not date:
        flags.append("exact-post-date-missing-or-invalid")
    if data.get("posted_at_precision") == "date":
        flags.append("source-time-zone-unknown")
    if feed:
        flags.append("rss-excerpt-needs-exact-post")
    if data.get("truncated"):
        flags.append("source-text-truncated")
    if expired_ad:
        flags.append("source-ad-marked-expired-not-proof-of-sale")
    if has(r"\b(?:sap ban giao|dang xay dung|mo ban)\b", own):
        flags.append("completion-and-resale-scope-needs-review")
    if any(project["basis"] == "thread-title" for project in projects):
        flags.append("project-inferred-only-from-thread-title")
    if any(project["candidate"] == "vinhomes-ocean-park" for project in projects):
        flags.append("ocean-park-phase-needs-review")
    if len(projects) > 1 or (outside and has(HANOI, own)):
        flags.append("multiple-projects-or-geographies")
    if "?" in body or has(r"\b(?:cho em hoi|xin hoi|co lo|the nao roi)\b", body):
        flags.append("may-be-a-question-not-an-experience")
    if sale and apartment and queue != "excluded":
        flags.extend(["offer-identity-and-completion-unconfirmed", "availability-unconfirmed", "asking-price-not-a-transaction"])
        for key in ("price", "area", "bedroom"):
            if not fields[key + "_candidates"]:
                flags.append(key + "-missing")
        if fields["price_candidates"] and not any(candidate["value_vnd"] is not None for candidate in fields["price_candidates"]):
            flags.append("price-expression-unresolved")
        if fields["area_candidates"] and not any(candidate["value_m2"] is not None for candidate in fields["area_candidates"]):
            flags.append("area-unit-unresolved")
        if any(candidate["basis"] == "per_m2" for candidate in fields["price_candidates"]):
            flags.append("per-m2-rate-is-not-a-total-asking-price")
        if len(fields["price_candidates"]) > 1 or len(fields["area_candidates"]) > 1:
            flags.append("multiple-expressions-do-not-pair-automatically")
    return {"id": row["id"], "revision": revision(data), "source_id": row["source_id"], "thread_id": row["thread_id"],
            "queue": queue, "reasons": reasons, "flags": flags, "priority": 0 if targeted else 1 if geography == "hanoi-mentioned" else 2,
            "title": title, "text": body, "source_url": data.get("source_url"), "thread_url": data.get("thread_url"),
            "format": data.get("format"), "source_published_at": date, "source_timestamp": data.get("posted_at"),
            "source_edited_at": data.get("source_edited_at"),
            "post_role": data.get("post_role"), "opening_post_key": data.get("opening_post_key"),
            "relationship_basis": data.get("relationship_basis"),
            "source_local_time": data.get("source_local_time"), "source_timezone": data.get("source_timezone"),
            "timestamp_basis": data.get("timestamp_basis"), "feed_activity_at": data.get("feed_activity_at"), "first_seen_at": row["first_seen_at"], "last_seen_at": row["last_seen_at"],
            "expires_at": row["expires_at"], "projects": projects, "project_id": None, "building_id": None,
            "geography": geography, "topics": topics, "fields": fields, "duplicate_of": None, "possible_repeats": [],
            "decision": "pending", "previous_decision": None, "publication_ready": False}


def body_key(item):
    # Preserve Vietnamese accents, numbers and punctuation: similar wording is
    # not sufficient evidence of a duplicate source record.
    text, title = (unicodedata.normalize("NFC", item[key]).casefold().strip() for key in ("text", "title"))
    title = re.sub(r"^(?:\[[^]]+\]\s*|hn\s+)+", "", title)
    if title and text.endswith(title):
        text = text[:-len(title)]
    return re.sub(r"\s+", " ", text).strip()


def load_queue(db):
    """Rebuild derived queues from current, unexpired items on every read."""
    db.row_factory = sqlite3.Row
    stamp = now()
    db.execute("""CREATE TABLE IF NOT EXISTS forum_review_decision(
        item_id TEXT PRIMARY KEY, revision TEXT NOT NULL, decision TEXT NOT NULL,
        note TEXT NOT NULL, decided_at TEXT NOT NULL)""")
    db.execute("""CREATE TRIGGER IF NOT EXISTS purge_forum_review_decision AFTER DELETE ON item
        BEGIN DELETE FROM forum_review_decision WHERE item_id = OLD.id; END""")
    db.execute("DELETE FROM forum_review_decision WHERE item_id NOT IN (SELECT id FROM item WHERE expires_at >= ?)", (stamp,))
    db.commit()
    items = [classify(row) for row in db.execute("SELECT * FROM item WHERE expires_at >= ? ORDER BY id", (stamp,))]
    groups = defaultdict(list)
    for item in items:
        key = body_key(item)
        if len(key) >= 60:
            groups[key].append(item)
    for group in groups.values():
        by_thread = defaultdict(list)
        for item in group:
            by_thread[(item["source_id"], item["thread_id"])].append(item)
        for same_thread in by_thread.values():
            same_thread.sort(key=lambda item: (not bool(item["source_published_at"]), item["format"] == "rss-excerpt", item["id"]))
            for item in same_thread[1:]:
                item.update(queue="duplicates", duplicate_of=same_thread[0]["id"], reasons=["same-thread-identical-body"])
        if len(by_thread) > 1:
            for item in group:
                item["possible_repeats"] = [other["id"] for other in group if (other["source_id"], other["thread_id"]) != (item["source_id"], item["thread_id"])]
                item["flags"].append("identical-text-in-other-threads-not-independent-corroboration")
    decisions = {row["item_id"]: dict(row) for row in db.execute("SELECT * FROM forum_review_decision")}
    by_id = {item["id"]: item for item in items}
    for link in db.execute("SELECT * FROM forum_enrichment"):
        source, target = by_id.get(link["source_item_id"]), by_id.get(link["target_item_id"])
        if source and target and source["format"] == "rss-excerpt" and target["format"] == "public-post" and (source["source_id"], source["thread_id"]) == (target["source_id"], target["thread_id"]):
            source.update(queue="duplicates", duplicate_of=target["id"], reasons=["rss-replaced-by-original-post"])
    original_revisions = {item["id"]: item["revision"] for item in items}
    for item in items:
        item["revision"] = hashlib.sha256(json.dumps([item["revision"], item["queue"], item["flags"], item["duplicate_of"], original_revisions.get(item["duplicate_of"]), item["possible_repeats"]], sort_keys=True).encode()).hexdigest()
        if item["id"] in decisions:
            decision = decisions[item["id"]]
            item["previous_decision"] = decision
            item["decision"] = decision["decision"] if decision["revision"] == item["revision"] else "review-required"
    return sorted(items, key=lambda item: (item["priority"], QUEUES.index(item["queue"]), item["id"]))


def decide(db, item_id, expected_revision, decision, note):
    item = next((item for item in load_queue(db) if item["id"] == item_id), None)
    if not item:
        raise ValueError("Unknown or expired source item")
    if item["revision"] != expected_revision:
        raise ValueError("Content changed; show and review the current revision first")
    if decision not in {"kept", "dismissed", "pending"} or not note.strip() or len(note) > 800:
        raise ValueError("Use kept/dismissed/pending and a nonempty note of at most 800 characters")
    if decision == "kept" and item["queue"] in {"duplicates", "excluded"}:
        raise ValueError("Excluded/duplicate items cannot be kept; correct the classification rules or review the original")
    db.execute("INSERT INTO forum_review_decision VALUES(?,?,?,?,?) ON CONFLICT(item_id) DO UPDATE SET revision=excluded.revision,decision=excluded.decision,note=excluded.note,decided_at=excluded.decided_at",
               (item_id, expected_revision, decision, note.strip(), now()))
    db.commit()
    return {"id": item_id, "decision": decision, "publication_ready": False}


def handoff(item):
    if item["queue"] == "sale-candidates":
        claims = []
        for group in ("price", "area", "bedroom"):
            for candidate in item["fields"][group + "_candidates"]:
                raw = candidate["raw"]
                field = next((field for field in ("text", "title") if raw in item[field]), None)
                if field is None:
                    continue
                start = item[field].index(raw)
                claims.append({"kind": group, "raw": raw, "interpretation": candidate, "verification": "unverified-source-claim",
                               "locator": {"itemId": item["id"], "revision": item["revision"], "sourceUrl": item["source_url"],
                                           "sourcePublishedAt": item["source_published_at"], "field": field, "start": start, "end": start + len(raw)}})
        return {"kind": "external-sale-lead", "next_step": "Resolve a specific resale apartment and the owner/authorized supplier; complete the existing listing intake and review workflow.",
                "source_kind": "forum", "catalogue_importable": False,
                "intake": {"status": "draft", "sourceItemId": item["id"], "sourceRevision": item["revision"],
                           "sourceUrl": item["source_url"], "sourcePublishedAt": item["source_published_at"],
                           "sourceEditedAt": source_date(item.get("source_edited_at")),
                           "collectedAt": item["last_seen_at"], "expiresAt": item["expires_at"],
                           "projectNameCandidates": item["projects"], "sourceClaims": claims,
                           "supplierListingId": None, "supplierRole": "unknown", "sourceUpdatedAt": None,
                           "projectId": None, "buildingId": None, "completed": "unknown", "completionReference": None,
                           "priceVnd": None, "priceConfirmedAt": None, "areaM2": None, "areaBasis": "unknown", "bedrooms": None,
                           "availability": "unknown", "availabilityConfirmedAt": None,
                           "legalStatus": "unknown", "permission": "pending", "permissionReference": None,
                           "updaterReference": None, "lat": None, "lng": None,
                           "checks": [
                               {"key": "identity", "status": "unresolved", "question": "Đối chiếu đúng căn, tòa nhà và vai trò người cung cấp; không tự gộp các tin giống nhau."},
                               {"key": "completion", "status": "unresolved", "question": "Có nguồn xác nhận đúng tòa đã hoàn thành và căn thuộc phạm vi chuyển nhượng không?"},
                               {"key": "price-area", "status": "unresolved", "question": "Xác nhận tổng giá chào, cách hiểu đơn vị viết tắt và diện tích thông thủy/tim tường; giá trên m² giữ riêng."},
                               {"key": "availability", "status": "unresolved", "question": "Ai xác nhận căn còn bán, vào ngày nào? Ngày đọc bài không thay cho xác nhận còn bán."},
                               {"key": "use-and-updates", "status": "unresolved", "question": "Ghi căn cứ cho phép hiển thị từng phần và người phụ trách cập nhật/rút tin; không tự công khai liên hệ."},
                           ]},
                "required": ["offer-identity", "canonical-project-building", "completion-evidence", "source-display-use-basis", "actual-source-date", "price-and-area-meaning"]}
    if item["queue"] == "community-insights":
        return {"kind": "community-reference-draft", "catalogue_importable": False,
                "template": {"sourceId": item["source_id"], "sourceRecordId": "crawl-" + hashlib.sha256(item["id"].encode()).hexdigest()[:20],
                             "projectId": "", "buildingId": None, "kind": "community", "topic": item["topics"][0] if len(item["topics"]) == 1 else "other",
                             "verification": "unverified", "summary": "", "question": "", "sourceScope": "", "reportingPeriod": None,
                             "sourceUrl": item["source_url"], "sourceLocator": item["id"].split(":")[-1] if item["format"] == "public-post" else "",
                             "sourcePublishedAt": item["source_published_at"] or "", "sourceEditedAt": None,
                             "checkedAt": "", "reviewDueAt": "", "permissionReference": ""},
                "next_step": "Review the exact dated post, its actual scope, wording and intended use before completing and staging this template."}
    return {"kind": "context-needed", "catalogue_importable": False, "next_step": "Resolve the classification/context flags before preparing a listing or evidence item."}


def summary(items):
    return {"records": len(items), "by_source": dict(Counter(item["source_id"] for item in items)),
            "queues": {queue: sum(item["queue"] == queue for item in items) for queue in QUEUES},
            "decisions": dict(Counter(item["decision"] for item in items)),
            "target_project_candidates": dict(Counter(project["candidate"] for item in items if item["queue"] != "duplicates" for project in item["projects"] if project["candidate"] in TARGET_PROJECTS)),
            "missing_exact_post_date": sum(not item["source_published_at"] for item in items),
            "publication_ready": 0, "classifier_version": VERSION}


def write_packet(path, items):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    # Never overwrite another file or follow an existing symlink. Private exports
    # carry source text and expire separately from the live SQLite inbox.
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    packet = {"generated_at": now(), "private_review_only": True, "classifier_version": VERSION,
              "retention": "Delete by each item expires_at; exports do not refresh or auto-delete. Re-export from the live inbox before use.",
              "summary": summary(items), "items": [{**item, "handoff": handoff(item)} for item in items]}
    with os.fdopen(descriptor, "w", encoding="utf-8") as output:
        if path.suffix.lower() == ".md":
            output.write(markdown_packet(packet))
        else:
            json.dump(packet, output, ensure_ascii=False, indent=2)
            output.write("\n")
    return {"path": str(path), "records": len(items), "publication_ready": 0}


def markdown_packet(packet):
    def escaped(value):
        # Source text must not turn into images, HTML, links or report structure.
        return re.sub(r"([\\`*_{}\[\]()#+.!|<>])", r"\\\1", re.sub(r"\s+", " ", str(value))).strip()

    lines = ["# Phiếu tiếp nhận tin căn hộ — nội bộ", "", "Các tin dưới đây chưa được xác minh hoặc duyệt xuất bản. `kept` chỉ có nghĩa giữ lại để kiểm tra tiếp.", "",
             "Dữ liệu trong phiếu hết hạn theo từng tin; phiếu không tự cập nhật hoặc tự xóa. Tạo lại từ hộp tiếp nhận trước khi sử dụng.", ""]
    for item in packet["items"]:
        lines.extend(["## " + escaped(item["title"]), "", "- Mã nguồn: " + escaped(item["id"]),
                      "- Ngày bài gốc: " + escaped(item["source_published_at"] or "chưa rõ"),
                      "- Ngày sửa bài theo nguồn: " + escaped(source_date(item.get("source_edited_at")) or "chưa rõ"),
                      "- Ngày thu thập: " + escaped(item["last_seen_at"]),
                      "- Hết hạn lưu phiếu: " + escaped(item["expires_at"]),
                      "- Trạng thái phân loại: " + escaped(item["queue"]) + "; quyết định: " + escaped(item["decision"]), ""])
        # Print the URL as escaped text. It remains traceable without introducing
        # an active source-controlled Markdown destination into the report.
        lines.extend(["Nguồn: " + escaped(item["source_url"]), ""])
        intake = item["handoff"].get("intake")
        if intake:
            lines.extend(["| Loại lời chào | Nguyên văn nguồn | Trạng thái |", "| --- | --- | --- |"])
            names = {"price": "Giá/đơn giá", "area": "Diện tích", "bedroom": "Phòng ngủ"}
            for claim in intake["sourceClaims"]:
                candidate = claim["interpretation"]
                state = "Chưa xác minh"
                if claim["kind"] == "price" and candidate.get("basis") == "per_m2":
                    state += "; đơn giá trên m², không phải tổng giá"
                if candidate.get("uncertain"):
                    state += "; cần làm rõ cách ghi/đơn vị"
                lines.append("| " + names[claim["kind"]] + " | " + escaped(claim["raw"]) + " | " + state + " |")
            lines.extend(["", "Các giá trị dùng để xuất bản vẫn chưa được chốt; còn bán, giấy tờ, quyền dùng và tọa độ đều chưa xác nhận.", "", "Cần kiểm tra:", ""])
            lines.extend("- " + escaped(check["question"]) for check in intake["checks"])
            lines.append("")
        lines.extend(["Cờ cần xử lý: " + ", ".join(escaped(flag) for flag in item["flags"]), ""])
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["status", "list", "show", "decide", "export"])
    parser.add_argument("--db", default=str(ROOT / "private-data/forum-crawl.sqlite"))
    parser.add_argument("--queue", choices=QUEUES)
    parser.add_argument("--project", choices=PROJECTS)
    parser.add_argument("--decision", choices=["pending", "kept", "dismissed", "review-required"])
    parser.add_argument("--id")
    parser.add_argument("--revision")
    parser.add_argument("--note")
    parser.add_argument("--out")
    args = parser.parse_args()
    if not Path(args.db).is_file():
        parser.error("Crawl inbox not found; run the crawler first")
    db = database(args.db)
    try:
        items = load_queue(db)
        if args.command == "decide":
            if not all((args.id, args.revision, args.decision, args.note)):
                raise ValueError("decide requires --id, --revision, --decision and --note")
            result = decide(db, args.id, args.revision, args.decision, args.note)
        elif args.command == "show":
            result = next((item for item in items if item["id"] == args.id), None)
            if result is None:
                raise ValueError("Use --id with a current source item ID")
            result = {**result, "handoff": handoff(result)}
        else:
            filtered = [item for item in items if (not args.queue or item["queue"] == args.queue)
                        and (not args.project or any(project["candidate"] == args.project for project in item["projects"]))
                        and (not args.decision or item["decision"] == args.decision)]
            if args.command == "status":
                result = summary(filtered)
            elif args.command == "export":
                if not args.out:
                    raise ValueError("export requires --out private-data/NEW-FILE.json")
                result = write_packet(args.out, filtered)
            else:
                result = [{key: item[key] for key in ("id", "revision", "queue", "decision", "title", "projects", "topics", "reasons", "flags", "duplicate_of")} for item in filtered]
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (ValueError, OSError) as error:
        parser.exit(1, str(error) + "\n")
    finally:
        db.close()


if __name__ == "__main__":
    main()
