"""Bounded public-forum collection into a private review inbox."""
import argparse
import errno
import hashlib
import http.client
import json
import math
import re
import sqlite3
import socket
import ssl
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote, unquote, urljoin, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from xml.etree import ElementTree as ET
import requests

ROOT = Path(__file__).resolve().parents[1]
AGENT = requests.utils.default_user_agent()
VOZ_AGENT = 'NhaHaNoiBot/0.1 (public property reference research; no login)'
HOSTS = {"voz.vn", "www.otofun.net.vn", "www.otofun.net"}
KEYWORDS = ["ha noi", "ha dong", "cau giay", "tay ho", "long bien", "tu liem", "thanh xuan", "smart city", "ocean park", "mien bac"]
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


def now():
    return datetime.now(timezone.utc).isoformat()


def normalized(text):
    return "".join(c for c in unicodedata.normalize("NFD", text.lower().replace("đ", "d")) if not unicodedata.combining(c))


def public_url(url):
    parts = urlsplit(url)
    if parts.scheme != "https" or parts.hostname not in HOSTS or parts.username or parts.password or parts.port not in (None, 443):
        raise ValueError("URL outside the HTTPS forum allowlist")
    if any(ord(c) < 32 for c in unquote(parts.path)):
        raise ValueError("Control character in URL")
    return urlunsplit(("https", parts.hostname, quote(unquote(parts.path), safe="/._-~"), parts.query, ""))


def thread_url(url):
    parts = urlsplit(public_url(url))
    if not re.fullmatch(r"/(?:t|threads)/[^/]+\.\d+/(?:page-\d+)?", unquote(parts.path)):
        raise ValueError("Not a public thread/page route")
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


def thread_identity(url):
    parts = urlsplit(thread_url(url))
    source = "voz" if parts.hostname == "voz.vn" else "otofun"
    return source, re.search(r"\.(\d+)/", parts.path).group(1)


class Robots:
    """Merge matching groups; longest path match wins, with Allow on ties."""
    def __init__(self, text):
        self.groups = []
        agents, rules, delay, has_rules = [], [], 0, False
        for line in text.splitlines() + ["User-agent: __end__"]:
            key, sep, value = line.split("#", 1)[0].partition(":")
            if not sep:
                continue
            key, value = key.strip().lower(), value.strip()
            if key == "user-agent":
                if has_rules:
                    self.groups.append((agents, rules, delay))
                    agents, rules, delay, has_rules = [], [], 0, False
                agents.append(value.lower())
            elif agents and key in ("allow", "disallow", "crawl-delay"):
                has_rules = True
                if key == "crawl-delay":
                    try:
                        delay = max(delay, float(value))
                    except ValueError:
                        pass
                elif value:
                    rules.append((key == "allow", value))

    def policy(self, url, agent=AGENT):
        selected, specificity = [], -1
        for agents, rules, delay in self.groups:
            scores = [0 if item == "*" else len(item) for item in agents if item == "*" or item in agent.lower()]
            if not scores:
                continue
            score = max(scores)
            if score > specificity:
                selected, specificity = [], score
            if score == specificity:
                selected.append((rules, delay))
        path = urlsplit(url).path + ("?" + urlsplit(url).query if urlsplit(url).query else "")
        matches = []
        for rules, _ in selected:
            for allow, pattern in rules:
                anchor = pattern.endswith("$")
                raw = pattern[:-1] if anchor else pattern
                expression = "^" + ".*".join(re.escape(part) for part in raw.split("*")) + ("$" if anchor else "")
                if re.search(expression, path):
                    matches.append((len(raw.replace("*", "")), allow))
        allowed = max(matches, default=(0, True))[1]
        return allowed, max((delay for _, delay in selected), default=0)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class AccessStopped(Exception):
    def __init__(self, status, message):
        self.status = status
        super().__init__(message)


NETWORK_FAILURES = {'network-timeout', 'network-dns', 'network-tls', 'network-reset',
                    'network-refused', 'network-unreachable', 'network-other'}


def network_failure(error):
    """Classify transport causes without retaining exception messages or URLs."""
    for _ in range(5):
        if isinstance(error, (TimeoutError, requests.Timeout)) or getattr(error, 'errno', None) == errno.ETIMEDOUT:
            return 'network-timeout'
        if isinstance(error, socket.gaierror):
            return 'network-dns'
        if isinstance(error, (ssl.SSLError, requests.exceptions.SSLError)):
            return 'network-tls'
        if isinstance(error, (ConnectionResetError, http.client.RemoteDisconnected)):
            return 'network-reset'
        if getattr(error, 'errno', None) == errno.ECONNREFUSED:
            return 'network-refused'
        if getattr(error, 'errno', None) in {errno.ENETUNREACH, errno.EHOSTUNREACH}:
            return 'network-unreachable'
        nested = getattr(error, 'reason', None) or error.__cause__ or error.__context__
        if not isinstance(nested, BaseException):
            nested = next((arg for arg in error.args if isinstance(arg, BaseException)), None)
        if not isinstance(nested, BaseException) or nested is error:
            break
        error = nested
    return 'network-other'


def publisher(host):
    return 'voz' if host == 'voz.vn' else 'otofun' if host in {'www.otofun.net.vn', 'www.otofun.net'} else None


def source_stopped(fetcher, source):
    return (source in getattr(fetcher, 'unavailable', {})
            or any(publisher(host) == source for host in fetcher.blocked))


def retry_after_seconds(value, stamp=None):
    if not isinstance(value, str) or not value:
        return None
    try:
        if re.fullmatch(r'[0-9]+', value.strip()):
            seconds = int(value)
        else:
            due = parsedate_to_datetime(value)
            if due.tzinfo is None:
                return None
            seconds = math.ceil((due - (stamp or datetime.now(timezone.utc))).total_seconds())
        return min(2147483647, max(0, seconds))
    except (TypeError, ValueError, OverflowError):
        return None


class Fetcher:
    def __init__(self, db, delay=2):
        self.db, self.delay = db, delay
        self.session = requests.Session()
        # Fixed, honest Python client identity; no ambient proxy/netrc credentials.
        self.session.trust_env = False
        self.opener = build_opener(NoRedirect())
        self.robots, self.last_request, self.blocked = {}, {}, set()
        # Transient outages stop this publisher for this run, including its aliases.
        # A fresh worker retries normally; no access restriction is cleared here.
        self.unavailable = {}
        self.retry_after = {}

    def close(self):
        self.session.close()
        self.session.cookies.clear()

    def download(self, url, limit):
        # Keep VOZ's previously working client/profile; no fallback after a failure.
        if publisher(urlsplit(url).hostname) == 'voz':
            with self.opener.open(Request(url, headers={'User-Agent': VOZ_AGENT,
                                  'Accept': 'text/html,application/rss+xml,text/plain;q=0.8'}), timeout=20) as response:
                body = response.read(limit + 1)
                if len(body) > limit:
                    raise AccessStopped(0, 'Response size limit exceeded')
                return body, response.status, response.headers.get('Content-Type', '')
        with self.session.get(url, timeout=(8, 20), allow_redirects=False, stream=True, verify=True) as response:
            if response.status_code >= 300:
                raise HTTPError(url, response.status_code, 'HTTP response', response.headers, None)
            body = bytearray()
            for chunk in response.iter_content(chunk_size=65536):
                body.extend(chunk)
                if len(body) > limit:
                    raise AccessStopped(0, 'Response size limit exceeded')
            return bytes(body), response.status_code, response.headers.get('Content-Type', '')

    def request(self, url, limit=2_000_000):
        host = urlsplit(url).hostname
        wait = self.delay - (time.monotonic() - self.last_request.get(host, 0))
        if wait > 0:
            time.sleep(wait)
        self.last_request[host] = time.monotonic()
        try:
            body, status, content_type = self.download(url, limit)
            self.log(url, status, None)
            return body, content_type
        except HTTPError as error:
            retry = retry_after_seconds((error.headers or {}).get('Retry-After'))
            if retry is not None:
                self.retry_after[publisher(host)] = retry
            self.log(url, error.code, "HTTP response")
            error.close()
            raise
        except (OSError, TimeoutError) as error:
            kind = network_failure(error)
            self.log(url, 0, kind)
            self.unavailable[publisher(host)] = {'status': 0, 'reason': kind}
            raise AccessStopped(0, "Network request failed") from error

    def log(self, url, status, error):
        self.db.execute("INSERT INTO fetch_log(url,status,error,fetched_at) VALUES(?,?,?,?)", (url, status, error, now()))
        self.db.commit()

    def get(self, url, html=False):
        url = public_url(url)
        requested_source = publisher(urlsplit(url).hostname)
        for _ in range(4):
            parts = urlsplit(url)
            source = publisher(parts.hostname)
            if source != requested_source:
                raise ValueError('Redirect left the selected publisher')
            origin = f"https://{parts.hostname}"
            if any(publisher(host) == source for host in self.blocked):
                raise AccessStopped(403, "Host stopped after an access/rate-limit response")
            if source in self.unavailable:
                raise AccessStopped(self.unavailable[source]['status'], "Source temporarily unavailable; wait for a later run")
            if origin not in self.robots:
                try:
                    body, _ = self.request(origin + "/robots.txt", 512_000)
                    self.robots[origin] = Robots(body.decode("utf-8", "replace"))
                except HTTPError as error:
                    if error.code == 404:
                        self.robots[origin] = Robots("")
                    else:
                        if error.code in (401, 403, 429):
                            self.blocked.add(parts.hostname)
                        elif 500 <= error.code <= 599:
                            self.unavailable[source] = {'status': error.code, 'reason': f'http-{error.code}'}
                        raise AccessStopped(error.code, "Cannot establish robots policy") from error
            allowed, delay = self.robots[origin].policy(url, VOZ_AGENT if source == 'voz' else AGENT)
            if not allowed:
                self.log(url, 0, "robots-disallowed")
                raise AccessStopped(0, "robots-disallowed")
            if delay > 60:
                raise AccessStopped(0, "robots crawl-delay exceeds the bounded run budget")
            self.delay = max(self.delay, delay)
            try:
                body, content_type = self.request(url)
            except HTTPError as error:
                if error.code in (301, 302, 303, 307, 308):
                    url = public_url(urljoin(url, error.headers.get("Location", "")))
                    continue
                if error.code in (401, 403, 429):
                    self.blocked.add(parts.hostname)
                elif 500 <= error.code <= 599:
                    self.unavailable[source] = {'status': error.code, 'reason': f'http-{error.code}'}
                raise AccessStopped(error.code, f"HTTP {error.code}; no bypass or automatic retry") from error
            text = body.decode("utf-8", "replace")
            if html and ("html" not in content_type or re.search(r"<title[^>]*>\s*(?:Just a moment|Access denied|Attention Required)", text, re.I)):
                self.blocked.add(parts.hostname)
                raise AccessStopped(403, "Challenge/unexpected page; no bypass")
            return text, url
        raise AccessStopped(0, "Redirect limit reached")


class Node:
    def __init__(self, tag="root", attrs=None, parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs or []), parent, []

    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk()

    def has(self, token):
        return token in self.attrs.get("class", "").split()


class Document(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        if len(self.stack) > 100:
            raise ValueError("HTML nesting limit exceeded")
        node = Node(tag, attrs, self.stack[-1])
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                self.stack = self.stack[:index]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def clean_text(node):
    if isinstance(node, str):
        return node
    if node.tag in {"script", "style", "blockquote", "form", "iframe", "button"} or node.has("message-signature") or node.has("bbCodeBlock--quote"):
        return ""
    if node.has("username") or (node.tag == "a" and node.attrs.get("href", "").startswith(("mailto:", "tel:", "/u/", "/members/"))):
        return " [liên hệ/người dùng đã ẩn] "
    text = "".join(clean_text(child) for child in node.children)
    return text + ("\n" if node.tag in {"br", "p", "div", "li"} else "")


def redact(text):
    text = re.sub(r"[\u200b-\u200f\ufeff\u00ad]", "", text)
    text = re.sub(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", "[email đã ẩn]", text, flags=re.I)
    text = re.sub(r"(?<!\w)(?:\+?84|0)(?:[\s().-]*\d){8,10}(?!\w)", "[điện thoại đã ẩn]", text)
    return re.sub(r"\n\s*\n+", "\n", re.sub(r"[^\S\n]+", " ", text)).strip()


def post_date(children):
    def in_class(node, token):
        parent = node.parent
        while parent:
            if parent.has(token):
                return True
            parent = parent.parent
        return False

    def outside_body(node):
        parent = node.parent
        while parent:
            if parent.has("bbWrapper") or parent.has("bbCodeBlock--quote") or parent.has("message-signature"):
                return False
            parent = parent.parent
        return True

    times = [node for node in children if node.tag == "time" and node.attrs.get("datetime") and outside_body(node)]
    edited = next((node.attrs["datetime"] for node in times if in_class(node, "message-lastEdit")), None)
    extra = {"date_extraction_version": 2, **({"source_edited_at": edited} if edited else {})}
    publication_times = [node for node in times if not in_class(node, "message-lastEdit")]
    for node in publication_times:
        if in_class(node, "message-attribution-main"):
            return {"posted_at": node.attrs["datetime"], "timestamp_basis": "post-attribution-datetime", **extra}
    # OTOFUN renders a literal local date in an attribution link, without a
    # machine-readable datetime or zone. Retain the date and local clock
    # separately instead of assigning an invented UTC offset.
    for node in children:
        if not node.has("message-attribution-main"):
            continue
        value = re.sub(r"\s+", " ", clean_text(node)).strip()
        match = re.fullmatch(r"(?:(\d{1,2}):(\d{2})\s+)?(\d{1,2})/(\d{1,2})/(\d{4})", value)
        if not match:
            continue
        hour, minute, day, month, year = match.groups()
        try:
            local = datetime(int(year), int(month), int(day), int(hour or 0), int(minute or 0))
        except ValueError:
            continue
        return {"posted_at": local.date().isoformat(), "posted_at_precision": "date",
                "source_local_time": local.strftime("%H:%M") if hour is not None else None,
                "source_timezone": None, "timestamp_basis": "post-attribution-text", **extra}
    if publication_times:
        return {"posted_at": publication_times[0].attrs["datetime"], "timestamp_basis": "post-datetime-fallback", **extra}
    return {"posted_at": None, **extra}


def parse_thread(html, url, max_posts=5, opening=False):
    root = Document(html).root
    nodes = list(root.walk())
    title_node = next((node for node in nodes if node.has("p-title-value")), None)
    title = redact(clean_text(title_node)) if title_node else ""
    posts = []
    for article in nodes:
        post_id = re.fullmatch(r"post-(\d+)", article.attrs.get("data-content", ""))
        if article.tag != "article" or not post_id:
            continue
        children = list(article.walk())
        body = next((node for node in children if node.has("bbWrapper")), None)
        stamp = post_date(children)
        if body:
            text = redact(clean_text(body))
            if text:
                posts.append({"key": "post-" + post_id.group(1), "text": text[:4000], "truncated": len(text) > 4000,
                              "source_url": url.split("#")[0] + "#post-" + post_id.group(1), **stamp, "format": "public-post"})
    last = None
    for node in nodes:
        if node.tag != "a" or not node.attrs.get("href"):
            continue
        ancestor = node.parent
        in_navigation = False
        while ancestor:
            if any(token.startswith("pageNav") for token in ancestor.attrs.get("class", "").split()):
                in_navigation = True
                break
            ancestor = ancestor.parent
        if in_navigation:
            candidate = urljoin(url, node.attrs["href"])
            try:
                if thread_identity(candidate) == thread_identity(url):
                    page = re.search(r"/page-(\d+)$", candidate)
                    if page and (last is None or int(page.group(1)) > last[0]):
                        last = int(page.group(1)), thread_url(candidate)
            except ValueError:
                pass
    return {"title": title, "posts": posts[:max_posts] if opening else posts[-max_posts:], "last_url": last[1] if last else None}


def parse_feed(xml):
    if "<!DOCTYPE" in xml.upper() or "<!ENTITY" in xml.upper():
        raise ValueError("DTD/entity declarations are not accepted")
    root = ET.fromstring(xml)
    if root.tag != "rss":
        raise ValueError("Expected RSS 2.0")
    items = []
    for item in root.findall("./channel/item")[:50]:
        try:
            url = thread_url(item.findtext("link", ""))
        except ValueError:
            continue
        encoded = item.findtext("{http://purl.org/rss/1.0/modules/content/}encoded", "") or item.findtext("description", "")
        excerpt = redact(clean_text(Document(encoded).root))
        items.append({"url": url, "title": redact(item.findtext("title", "")), "feed_activity_at": item.findtext("pubDate"),
                      "excerpt": excerpt[:4000], "truncated": len(excerpt) > 4000})
    return items


def parse_marketplace(html, url):
    """Read thread titles only; never follow profiles, ads or action links."""
    result = {}
    for node in Document(html).root.walk():
        if not node.has("structItem-title"):
            continue
        for link in node.walk():
            if link.tag != "a" or not link.attrs.get("href"):
                continue
            try:
                target = thread_url(urljoin(url, link.attrs["href"]))
                identity = thread_identity(target)
                if identity[0] != "otofun":
                    continue
                result.setdefault(identity, {"url": target, "title": redact(clean_text(link)).strip()})
            except ValueError:
                continue
    return list(result.values())


def apartment_title(title):
    value = normalized(title)
    apartment = re.search(r"\b(?:can ho|chung cu|studio|penthouse|penhouse|\d\s*pn|can\s+\d\s*n)\b", value)
    exclusion = re.search(r"\b(?:cho thue|can thue|tim thue|can mua|tim mua|can tim|condotel|nha trang|da nang|hung yen|van giang|phung cong|hai phong|sai gon|tp\s*hcm|ocean park\s*[23])\b", value)
    return bool(apartment and not exclusion)


def claims(text, role):
    value = normalized(text)
    sale = bool(re.search(r"\b(ban|chuyen nhuong)\b", value))
    rent = bool(re.search(r"\b(cho thue|can thue|tim thue)\b", value))
    buyer = bool(re.search(r"\b(can mua|tim mua)\b", value))
    intent = "community" if role != "external-supplier-lead-discovery" else "buyer-request" if buyer else "mixed-sale-rent" if sale and rent else "rent" if rent else "sale-lead" if sale else "unknown"
    prices = []
    for match in re.finditer(r"(?<![\d.,])(\d{1,3}(?:[.,]\d{1,2})?)\s*(tỷ|tỉ|triệu|trieu|vnd|đồng|đ)(?!\w)", text, re.I):
        unit = normalized(match.group(2))
        amount = float(match.group(1).replace(",", ".")) * (1e9 if unit in {"ty", "ti"} else 1e6 if unit == "trieu" else 1)
        context = normalized(text[max(0, match.start() - 18):match.end() + 20])
        uncertain = bool(re.search(r"\b(khoang|tam|hon|tu)\b|[~?]|\d\s*x", context)) or amount < 100_000_000
        prices.append({"raw": match.group(0), "value_vnd": None if uncertain else round(amount), "uncertain": uncertain,
                       "basis": "per_m2" if re.search(r"/\s*m[²2]", context) else "per_month" if re.search(r"/\s*thang", context) else "unspecified", "verified": False})
    return {"intent_hint": intent, "price_candidates": prices[:8],
            "area_candidates": [match.group(0) for match in re.finditer(r"\b\d{1,4}(?:[.,]\d{1,2})?\s*m[²2]\b", text, re.I)][:8],
            "bedroom_candidates": [match.group(0) for match in re.finditer(r"\b\d{1,2}\s*(?:pn\b|phòng\s*ngủ|ngủ\b)", text, re.I)][:5],
            "availability": "unknown", "legal_status": "unknown", "review_status": "pending", "untrusted_source_text": True}


def database(path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    db = sqlite3.connect(path)
    path.chmod(0o600)
    db.executescript("""
      CREATE TABLE IF NOT EXISTS item(id TEXT PRIMARY KEY, source_id TEXT, thread_id TEXT, item_key TEXT, data TEXT, first_seen_at TEXT, last_seen_at TEXT, expires_at TEXT);
      CREATE TABLE IF NOT EXISTS observation(id INTEGER PRIMARY KEY, item_id TEXT, digest TEXT, data TEXT, observed_at TEXT, expires_at TEXT, UNIQUE(item_id,digest));
      CREATE TABLE IF NOT EXISTS fetch_log(id INTEGER PRIMARY KEY, url TEXT, status INTEGER, error TEXT, fetched_at TEXT);
      CREATE TABLE IF NOT EXISTS crawl_run(id INTEGER PRIMARY KEY, started_at TEXT, completed_at TEXT, summary TEXT);
      CREATE TABLE IF NOT EXISTS forum_enrichment(source_item_id TEXT PRIMARY KEY, target_item_id TEXT NOT NULL, checked_at TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS purge_forum_enrichment AFTER DELETE ON item
        BEGIN DELETE FROM forum_enrichment WHERE source_item_id=OLD.id OR target_item_id=OLD.id; END;
    """)
    db.execute("DELETE FROM observation WHERE expires_at < ?", (now(),))
    db.execute("DELETE FROM item WHERE expires_at < ?", (now(),))
    db.execute("DELETE FROM fetch_log WHERE fetched_at < ?", ((datetime.now(timezone.utc) - timedelta(days=14)).isoformat(),))
    db.commit()
    return db


def save_item(db, source, url, title, post, role, feed_date=None):
    source_id, thread_id = thread_identity(url)
    if source_id != source:
        raise ValueError("Source and thread publisher mismatch")
    identity = f"{source}:{thread_id}:{post['key']}"
    data = {**post, "title": title, "thread_url": url, "feed_activity_at": feed_date, "claims": claims(title + "\n" + post["text"], role)}
    encoded = json.dumps(data, ensure_ascii=False, sort_keys=True)
    digest = hashlib.sha256(json.dumps({key: value for key, value in data.items() if key != "feed_activity_at"}, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    stamp = now()
    expires = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
    before = db.total_changes
    db.execute("INSERT OR IGNORE INTO observation(item_id,digest,data,observed_at,expires_at) VALUES(?,?,?,?,?)", (identity, digest, encoded, stamp, expires))
    changed = db.total_changes > before
    db.execute("INSERT INTO item VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,last_seen_at=excluded.last_seen_at,expires_at=excluded.expires_at", (identity, source, thread_id, post["key"], encoded, stamp, stamp, expires))
    db.commit()
    return changed


def crawl(db, selected, max_threads, max_posts, delay, keywords, fetcher=None):
    fetcher = fetcher or Fetcher(db, delay)
    run_id = db.execute("INSERT INTO crawl_run(started_at) VALUES(?)", (now(),)).lastrowid
    db.commit()
    feeds = json.loads((ROOT / "data/forum-feed-candidates.json").read_text(encoding="utf-8"))
    watchlist = json.loads((ROOT / "data/evidence-watchlist.json").read_text(encoding="utf-8"))
    queue, errors, saved, observed = {}, [], 0, 0
    enabled_sources = {feed["sourceId"] for feed in feeds if feed.get("collectionEnabled") and feed["sourceId"] in selected}
    for feed in feeds:
        if feed["sourceId"] not in selected or not feed.get("collectionEnabled"):
            continue
        if source_stopped(fetcher, feed['sourceId']):
            continue
        try:
            xml, _ = fetcher.get(feed["feedUrl"])
            for item in parse_feed(xml):
                if not any(keyword in normalized(item["title"] + " " + item["excerpt"]) for keyword in keywords):
                    continue
                identity = thread_identity(item["url"])
                queue.setdefault(identity, {**item, "source": feed["sourceId"], "role": feed["role"]})
                if item["excerpt"]:
                    post = {"key": "feed-excerpt", "text": item["excerpt"], "truncated": item["truncated"], "source_url": item["url"], "posted_at": None, "format": "rss-excerpt"}
                    saved += save_item(db, feed["sourceId"], item["url"], item["title"], post, feed["role"], item["feed_activity_at"])
                    observed += 1
        except (AccessStopped, ValueError, ET.ParseError) as error:
            errors.append({"url": feed["feedUrl"], "error": str(error)})
    # Explicit pilot watchlist first, then geographically relevant feed discoveries.
    threads = []
    for item in watchlist:
        if item["sourceId"] in enabled_sources:
            identity = thread_identity(item["url"])
            threads.append(queue.pop(identity, {"url": item["url"], "title": item["title"], "source": item["sourceId"], "role": "project-community-discovery", "feed_activity_at": None}))
    threads.extend(queue.values())
    for item in threads[:max_threads]:
        if source_stopped(fetcher, item['source']):
            continue
        try:
            html, final = fetcher.get(item["url"], html=True)
            parsed = parse_thread(html, final, max_posts)
            if parsed["last_url"] and parsed["last_url"] != final:
                latest, latest_url = fetcher.get(parsed["last_url"], html=True)
                parsed = parse_thread(latest, latest_url, max_posts)
            for post in parsed["posts"]:
                saved += save_item(db, item["source"], item["url"], parsed["title"] or item["title"], post, item["role"], item["feed_activity_at"])
                observed += 1
        except (AccessStopped, ValueError) as error:
            errors.append({"url": item["url"], "error": str(error)})
    summary = {"outcome": "completed" if not errors else "partial" if observed else "failed", "records_observed": observed, "new_observations": saved, "stored_items": db.execute("SELECT count(*) FROM item").fetchone()[0], "thread_candidates": len(threads), "html_threads_attempted": min(len(threads), max_threads), "errors": errors, "published_listings": 0, "published_evidence": 0}
    db.execute("UPDATE crawl_run SET completed_at=?,summary=? WHERE id=?", (now(), json.dumps(summary, ensure_ascii=False), run_id))
    db.commit()
    return summary


def enrich(db, item_ids, delay=2):
    """Fetch an RSS candidate's opening post or an existing exact post page."""
    item_ids = list(dict.fromkeys(item_ids))
    if not 1 <= len(item_ids) <= 10:
        raise ValueError("enrich requires between one and ten --id values")
    feeds = json.loads((ROOT / "data/forum-feed-candidates.json").read_text(encoding="utf-8"))
    enabled = {feed["sourceId"] for feed in feeds if feed.get("collectionEnabled")}
    targets = []
    for ident in item_ids:
        row = db.execute("SELECT source_id,data FROM item WHERE id=? AND expires_at>=?", (ident, now())).fetchone()
        if not row:
            raise ValueError("Unknown or expired source item: " + ident)
        source, data = row[0], json.loads(row[1])
        if source not in enabled:
            raise ValueError("Collection is disabled for source: " + source)
        url = thread_url(data["thread_url"] if data["format"] == "rss-excerpt" else data["source_url"])
        if thread_identity(url) != (source, ident.split(":")[1]):
            raise ValueError("Source item and thread identity mismatch")
        if data["format"] == "rss-excerpt":
            url = re.sub(r"page-\d+$", "", url)
        targets.append((ident, source, data, url))
    fetcher, cache, resolved, errors, changed = Fetcher(db, delay), {}, [], [], 0
    run_id = db.execute("INSERT INTO crawl_run(started_at) VALUES(?)", (now(),)).lastrowid
    db.commit()
    for ident, source, data, url in targets:
        try:
            if url not in cache:
                html, final = fetcher.get(url, html=True)
                if thread_url(final) != url:
                    raise ValueError("Enrichment redirected away from the exact requested thread page")
                cache[url] = parse_thread(html, final, 100, opening=True)
            parsed = cache[url]
            if data["format"] == "rss-excerpt":
                post = next(iter(parsed["posts"]), None)
            else:
                post = next((post for post in parsed["posts"] if post["key"] == data["key"]), None)
            if not post:
                raise ValueError("The exact source post was not found; no replacement or withdrawal inferred")
            role = "external-supplier-lead-discovery" if data.get("claims", {}).get("intent_hint") in {"sale-lead", "rent", "mixed-sale-rent", "buyer-request"} else "project-community-discovery"
            changed += save_item(db, source, data["thread_url"], parsed["title"] or data["title"], post, role)
            _, thread_id = thread_identity(url)
            post_id = f"{source}:{thread_id}:{post['key']}"
            if data["format"] == "rss-excerpt":
                db.execute("INSERT INTO forum_enrichment VALUES(?,?,?) ON CONFLICT(source_item_id) DO UPDATE SET target_item_id=excluded.target_item_id,checked_at=excluded.checked_at", (ident, post_id, now()))
                db.commit()
            resolved.append({"source_item_id": ident, "post_item_id": post_id, "source_url": post["source_url"], "posted_at": post["posted_at"], "truncated": post["truncated"]})
        except (AccessStopped, ValueError) as error:
            errors.append({"id": ident, "url": url, "error": str(error)})
    result = {"kind": "enrichment", "outcome": "completed" if not errors else "partial" if resolved else "failed",
              "records_observed": len(resolved), "new_observations": changed,
              "stored_items": db.execute("SELECT count(*) FROM item").fetchone()[0],
              "resolved": resolved, "errors": errors, "published_listings": 0, "published_evidence": 0}
    db.execute("UPDATE crawl_run SET completed_at=?,summary=? WHERE id=?", (now(), json.dumps(result, ensure_ascii=False), run_id))
    db.commit()
    return result


def marketplace(db, pages=3, max_threads=12, delay=2, fetcher=None):
    """Bounded apartment-title discovery from the configured OTOFUN marketplace."""
    if not 1 <= pages <= 5 or not 1 <= max_threads <= 20:
        raise ValueError("marketplace supports 1–5 index pages and 1–20 opening posts")
    feeds = json.loads((ROOT / "data/forum-feed-candidates.json").read_text(encoding="utf-8"))
    feed = next((feed for feed in feeds if feed["sourceId"] == "otofun" and feed["role"] == "external-supplier-lead-discovery"), None)
    if not feed or not feed.get("collectionEnabled"):
        raise ValueError("OTOFUN marketplace collection is disabled")
    base = public_url(feed["discoveryPage"])
    if not re.fullmatch(r"/forums/cho-bat-dong-san\.423/", urlsplit(base).path):
        raise ValueError("Unexpected marketplace index route")
    fetcher, threads, errors, resolved, changed = fetcher or Fetcher(db, delay), {}, [], [], 0
    discovered, pages_read = 0, 0
    run_id = db.execute("INSERT INTO crawl_run(started_at) VALUES(?)", (now(),)).lastrowid
    db.commit()
    for page in range(1, pages + 1):
        url = base if page == 1 else base + f"page-{page}"
        try:
            html, final = fetcher.get(url, html=True)
            if public_url(final) != url:
                raise ValueError("Marketplace index redirected away from requested page")
            found = parse_marketplace(html, final)
            pages_read += 1
            discovered += len(found)
            for item in found:
                if apartment_title(item["title"]):
                    threads.setdefault(thread_identity(item["url"]), item)
        except (AccessStopped, ValueError) as error:
            errors.append({"url": url, "error": str(error)})
            break
    for item in list(threads.values())[:max_threads]:
        if source_stopped(fetcher, 'otofun'):
            break
        try:
            html, final = fetcher.get(item["url"], html=True)
            if thread_url(final) != item["url"]:
                raise ValueError("Opening post redirected away from requested thread")
            parsed = parse_thread(html, final, 1, opening=True)
            if not parsed["posts"]:
                raise ValueError("No opening post found; no availability conclusion")
            post = {**parsed["posts"][0], "post_role": "opening-ad", "collection_role": feed["role"]}
            changed += save_item(db, "otofun", item["url"], parsed["title"] or item["title"], post, feed["role"])
            _, thread_id = thread_identity(item["url"])
            ident = f"otofun:{thread_id}:{post['key']}"
            rss_id = f"otofun:{thread_id}:feed-excerpt"
            if db.execute("SELECT id FROM item WHERE id=?", (rss_id,)).fetchone():
                db.execute("INSERT INTO forum_enrichment VALUES(?,?,?) ON CONFLICT(source_item_id) DO UPDATE SET target_item_id=excluded.target_item_id,checked_at=excluded.checked_at", (rss_id, ident, now()))
                db.commit()
            resolved.append({"id": ident, "title": parsed["title"] or item["title"], "source_url": post["source_url"], "posted_at": post["posted_at"]})
        except (AccessStopped, ValueError) as error:
            errors.append({"url": item["url"], "error": str(error)})
    result = {"kind": "marketplace", "outcome": "completed" if not errors else "partial" if resolved else "failed",
              "index_pages_read": pages_read, "thread_titles_observed": discovered, "apartment_title_candidates": len(threads),
              "opening_posts_attempted": min(len(threads), max_threads), "records_observed": len(resolved), "new_observations": changed,
              "stored_items": db.execute("SELECT count(*) FROM item").fetchone()[0], "resolved": resolved, "errors": errors,
              "published_listings": 0, "published_evidence": 0}
    db.execute("UPDATE crawl_run SET completed_at=?,summary=? WHERE id=?", (now(), json.dumps(result, ensure_ascii=False), run_id))
    db.commit()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["run", "enrich", "marketplace", "status", "review"])
    parser.add_argument("--db", default=str(ROOT / "private-data/forum-crawl.sqlite"))
    parser.add_argument("--sources", choices=["all", "voz", "otofun"], default="all")
    parser.add_argument("--max-threads", type=int, choices=range(1, 21), default=6)
    parser.add_argument("--max-posts", type=int, choices=range(1, 11), default=5)
    parser.add_argument("--delay", type=float, default=2)
    parser.add_argument("--keyword", action="append")
    parser.add_argument("--id", action="append", default=[])
    parser.add_argument("--pages", type=int, choices=range(1, 6), default=3)
    args = parser.parse_args()
    if args.delay < 1 or args.delay > 60:
        parser.error("--delay must be 1–60 seconds")
    db = database(args.db)
    try:
        if args.command == "run":
            result = crawl(db, {"voz", "otofun"} if args.sources == "all" else {args.sources}, args.max_threads, args.max_posts, args.delay, [normalized(value) for value in args.keyword] if args.keyword else KEYWORDS)
        elif args.command == "enrich":
            result = enrich(db, args.id, args.delay)
        elif args.command == "marketplace":
            result = marketplace(db, args.pages, args.max_threads, args.delay)
        elif args.command == "review":
            result = [{"id": row[0], **json.loads(row[1])} for row in db.execute("SELECT id,data FROM item ORDER BY last_seen_at DESC LIMIT 100")]
        else:
            last_run = db.execute("SELECT summary FROM crawl_run ORDER BY id DESC LIMIT 1").fetchone()
            result = {"items_by_source": dict(db.execute("SELECT source_id,count(*) FROM item GROUP BY source_id")), "observations": db.execute("SELECT count(*) FROM observation").fetchone()[0], "last_run": json.loads(last_run[0]) if last_run and last_run[0] else None}
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if args.command in {"run", "enrich", "marketplace"} and result["outcome"] == "failed":
            raise SystemExit(1)
    except ValueError as error:
        parser.exit(1, str(error) + "\n")
    finally:
        db.close()


if __name__ == "__main__":
    main()
