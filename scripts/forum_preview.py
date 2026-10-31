"""Loopback-only, read-only visual review of retained forum leads. Not an MCP server."""
import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from forum_crawl import ROOT, database, now, redact, thread_identity
from forum_review import load_queue, source_date

ASSETS = ROOT / "review-web"


def preview_data(path):
    if not Path(path).is_file():
        raise FileNotFoundError("Crawl inbox not found")
    db = database(path)
    try:
        queue = load_queue(db)
    finally:
        db.close()
    leads = []
    for item in queue:
        retained = item["decision"] == "kept" or (item["decision"] == "review-required" and (item.get("previous_decision") or {}).get("decision") == "kept")
        if not retained or item["format"] != "public-post" or item.get("post_role") == "thread-starter-update":
            continue
        url = item["source_url"]
        try:
            if thread_identity(url) != (item["source_id"], item["thread_id"]):
                url = None
        except ValueError:
            url = None
        related = [other for other in queue if other.get("post_role") == "thread-starter-update"
                   and other["source_id"] == item["source_id"] and other["thread_id"] == item["thread_id"]
                   and other.get("opening_post_key") == item["id"].split(":")[-1]]
        leads.append({"id": item["id"], "title": item["title"], "queue": item["queue"], "decision": item["decision"],
                      "publishedAt": item["source_published_at"], "editedAt": source_date(item.get("source_edited_at")),
                      "collectedAt": item["last_seen_at"], "expiresAt": item["expires_at"], "sourceUrl": url,
                      "flags": item["flags"], "reasons": item["reasons"], "fields": item["fields"],
                      "text": redact(item["text"]), "availability": "unknown", "publicationReady": False,
                      "updates": [{"publishedAt": other["source_published_at"], "text": redact(other["text"])[:700]}
                                  for other in sorted(related, key=lambda other: (other["source_published_at"] or "", other["id"]))[-3:]]})
    return {"privateReviewOnly": True, "generatedAt": now(), "leads": leads}


def handler_for(db_path):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass  # Do not write source text, IDs or query parameters to access logs.

        def end_headers(self):
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'")
            super().end_headers()

        def allowed(self):
            origins = {f"http://127.0.0.1:{self.server.server_port}", f"http://localhost:{self.server.server_port}"}
            return "http://" + self.headers.get("Host", "") in origins and self.headers.get("Origin", next(iter(origins))) in origins

        def send_bytes(self, status, data, content_type):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if not self.allowed():
                self.send_bytes(403, b"Local preview only", "text/plain; charset=utf-8")
                return
            path = urlsplit(self.path).path
            if path == "/api/leads":
                try:
                    payload = json.dumps(preview_data(db_path), ensure_ascii=False).encode()
                    self.send_bytes(200, payload, "application/json; charset=utf-8")
                except Exception:
                    self.send_bytes(503, b'{"error":"Private inbox unavailable"}', "application/json")
            elif path in {"/", "/review.js", "/review.css"}:
                name = "index.html" if path == "/" else path[1:]
                mime = {"index.html": "text/html", "review.js": "text/javascript", "review.css": "text/css"}[name]
                self.send_bytes(200, (ASSETS / name).read_bytes(), mime + "; charset=utf-8")
            elif path == "/favicon.ico":
                self.send_bytes(204, b"", "image/x-icon")
            else:
                self.send_bytes(404, b"Not found", "text/plain; charset=utf-8")

        def do_POST(self):
            self.send_bytes(405, b"Read-only preview", "text/plain; charset=utf-8")

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=str(ROOT / "private-data/forum-crawl.sqlite"))
    parser.add_argument("--port", type=int, default=8790)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("Use a port between 1 and 65535")
    if not Path(args.db).is_file():
        parser.error("Crawl inbox not found; collect and triage leads first")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler_for(args.db))
    print(f"Private lead review: http://127.0.0.1:{server.server_port} — no MCP, no publication", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
