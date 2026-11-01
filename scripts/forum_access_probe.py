"""One bounded, read-only source probe using the real crawler transport and parsers."""
import argparse
import json
import tempfile
import time
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree.ElementTree import ParseError
from bs4 import BeautifulSoup

from forum_crawl import (AccessStopped, Fetcher, NETWORK_FAILURES, ROOT, database, now, parse_feed,
                         parse_marketplace, parse_thread, thread_identity, thread_url)


def probe(source, thread=None):
    feeds = json.loads((ROOT / 'data/forum-feed-candidates.json').read_text())
    feed = next(f for f in feeds if f['sourceId'] == source
                and (source == 'voz' or f['role'] == 'external-supplier-lead-discovery'))
    url = feed['discoveryPage'] if source == 'otofun' else feed['feedUrl']
    if thread:
        url = thread_url(thread)
        if thread_identity(url)[0] != source:
            raise ValueError('Thread must belong to the selected source')
    started, parsed, failure = time.monotonic(), 0, None
    details = {}
    with tempfile.TemporaryDirectory(prefix='hanoi-source-probe-') as tmp:
        db = database(Path(tmp) / 'probe.sqlite')
        try:
            fetcher = Fetcher(db, 2)
            try:
                body, final = fetcher.get(url, html=bool(thread) or source == 'otofun')
                if thread:
                    if thread_url(final) != url:
                        raise ValueError('Thread redirected away from the selected source page')
                    original = parse_thread(body, final, 1, opening=True)
                    soup = BeautifulSoup(body, 'html.parser')
                    first = soup.select_one('article[data-content]')
                    parsed = len(original['posts'])
                    details = {'opening_post_key': original['posts'][0]['key'] if parsed else None,
                               'beautifulsoup_agrees': bool(parsed and first and first.get('data-content') == original['posts'][0]['key']),
                               'expired_label': 'hết hạn' in original['title'].lower()}
                    if not details['beautifulsoup_agrees']:
                        failure = {'kind': 'opening-post-parser-disagreement'}
                else:
                    parsed = len(parse_marketplace(body, final) if source == 'otofun' else parse_feed(body))
                if not parsed:
                    failure = {'kind': 'no-parsed-entries'}
            except (AccessStopped, ValueError, ParseError) as error:
                failure = {'kind': type(error).__name__, 'http_status': getattr(error, 'status', None)}
            requests = [{'stage': 'robots' if urlsplit(u).path == '/robots.txt' else 'thread' if thread else 'discovery',
                         'status': status, 'network_failure': error if error in NETWORK_FAILURES else None}
                        for u, status, error in db.execute('select url,status,error from fetch_log order by id')]
            return {'source': source, 'checked_at': now(), 'ok': failure is None,
                    'elapsed_seconds': round(time.monotonic() - started, 2), 'parsed_entries': parsed,
                    'failure': failure, 'requests': requests, 'unavailable': fetcher.unavailable.get(source), **details}
        finally:
            fetcher.close()
            db.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', choices=['otofun', 'voz'], default='otofun')
    parser.add_argument('--thread', help='Optional exact public thread URL; no shared writes')
    args = parser.parse_args()
    result = probe(args.source, args.thread)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result['ok'] else 1)
