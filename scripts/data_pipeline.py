"""Private daily Hanoi candidate pipeline. Only bounded extracted metadata leaves the worker."""
import argparse
import hashlib
import json
import os
import re
import signal
import sys
import tempfile
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, build_opener

from forum_crawl import (AccessStopped, Fetcher, KEYWORDS, NETWORK_FAILURES, NoRedirect, ROOT, crawl, database,
                         marketplace, now, parse_thread, save_item, source_stopped, thread_identity, thread_url)
from forum_review import classify, revision

SOURCE_BUDGET_SECONDS = 120


class SourceBudgetExceeded(BaseException):
    """Control flow must escape source adapters' ordinary exception handlers."""


@contextmanager
def source_budget(seconds):
    # The private worker runs on macOS/Linux in its main thread, never inside MCP.
    previous_handler = signal.getsignal(signal.SIGALRM)
    previous_timer = signal.getitimer(signal.ITIMER_REAL)
    started = time.monotonic()
    def expire(_signum, _frame):
        raise SourceBudgetExceeded()
    signal.signal(signal.SIGALRM, expire)
    signal.setitimer(signal.ITIMER_REAL, seconds)
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous_handler)
        if previous_timer[0] > 0:
            signal.setitimer(signal.ITIMER_REAL, max(0.001, previous_timer[0] - (time.monotonic() - started)), previous_timer[1])


class Store:
    def __init__(self):
        self.origin = os.environ.get('SUPABASE_URL', '').rstrip('/')
        url = urlsplit(self.origin)
        if not ((url.scheme == 'https' or url.hostname in {'localhost', '127.0.0.1'}) and url.hostname
                and not url.username and not url.password and not url.query and not url.fragment and not url.path):
            raise ValueError('SUPABASE_URL is required')
        self.key = os.environ.get('SUPABASE_SECRET_KEY', '')
        if not self.key.startswith(('sb_secret_', 'eyJ')):
            raise ValueError('A server-only Supabase key is required')
        self.opener = build_opener(NoRedirect())

    def request(self, path, body=None):
        headers = {'apikey': self.key, 'Content-Type': 'application/json'}
        if self.key.startswith('eyJ'):
            headers['Authorization'] = 'Bearer ' + self.key
        req = Request(self.origin + '/rest/v1/' + path, headers=headers,
                      data=None if body is None else json.dumps(body).encode(), method='GET' if body is None else 'POST')
        try:
            with self.opener.open(req, timeout=20) as response:
                data = response.read(6_000_000)
                return json.loads(data) if data else None
        except (HTTPError, URLError, TimeoutError) as error:
            # Never expose service responses, credential-bearing headers or raw payloads to CI.
            raise ValueError('Shared data request failed; check credentials/schema and rerun') from error

    def rpc(self, name, **args):
        return self.request('rpc/' + name, args)


def projection(row, known_keys=()):
    item, raw = classify(row), json.loads(row['data'])
    actionable = (item['queue'] == 'sale-candidates' or 'offer-identity-and-completion-unconfirmed' in item['flags']
                  or (raw.get('post_role') == 'opening-ad' and item['queue'] == 'needs-context'
                      and any(item['fields'][key] for key in ('price_candidates','area_candidates','bedroom_candidates'))))
    if not actionable and row['id'] not in known_keys:
        return None
    if item['queue'] in {'excluded', 'community-insights', 'duplicates'}:

        # Refresh a known closed offer too: its new excluded status must reach review.
        if not any(reason in item['reasons'] for reason in ('source-indicates-closed-offer', 'rental-outside-resale-pilot')):
            return None
    payload = {key: item[key] for key in ('queue', 'reasons', 'flags', 'geography', 'projects', 'fields',
                                         'source_published_at', 'source_edited_at')}
    payload.update(format=item['format'], post_key=raw.get('key'), post_role=raw.get('post_role'), collection_role=raw.get('collection_role'), publication_ready=False)
    # Fields are our parser's short numeric expressions. Never send source titles/text/contact fields.
    return {'id': 'candidate-' + hashlib.sha256(row['id'].encode()).hexdigest()[:24],
            'source_id': row['source_id'], 'source_key': row['id'], 'source_url': item['source_url'],
            'fingerprint': revision(raw), 'payload': payload, 'checked_at': row['last_seen_at'], 'expires_at': row['expires_at']}


def record_error(diagnostics, source, error):
    # Only fixed categories leave the worker. Exception strings can contain source content.
    message = str(error)
    status = getattr(error, 'status', None)
    http = re.search(r'\bHTTP ([1-5][0-9]{2})\b', message)
    reason = ('robots-policy-unavailable' if message == 'Cannot establish robots policy' else
              'robots-disallowed' if message == 'robots-disallowed' else
              'network-error' if message == 'Network request failed' else
              'http-' + str(status) if status else
              'http-' + http[1] if http else
              'parse-or-policy-error')
    details = diagnostics[source]
    details['errors'] += 1
    details['error_counts'][reason] = details['error_counts'].get(reason, 0) + 1


def request_diagnostics(db, diagnostics):
    for url, status, error in db.execute('select url,status,error from fetch_log'):
        host = urlsplit(url).hostname
        source = 'voz' if host == 'voz.vn' else 'otofun' if host in {'www.otofun.net.vn', 'www.otofun.net'} else None
        if source not in diagnostics:
            continue
        details = diagnostics[source]
        details['requests'] += 1
        code = str(status) if 100 <= status <= 599 else 'no-response'
        details['http_statuses'][code] = details['http_statuses'].get(code, 0) + 1
        if status == 0 and error in NETWORK_FAILURES | {'TimeoutError', 'URLError', 'OSError', 'SSLError', 'ConnectionResetError'}:
            details['network_errors'][error] = details['network_errors'].get(error, 0) + 1


def refresh(db, fetcher, known, enabled, diagnostics=None):
    errors = 0
    for item in known:
        if item['source_id'] not in enabled:
            continue
        if source_stopped(fetcher, item['source_id']):
            continue
        try:
            url = thread_url(item['source_url'])
            html, final = fetcher.get(url, html=True)
            if thread_url(final) != url:
                raise ValueError('Refresh left the exact source page')
            parsed = parse_thread(html, final, 100, opening=True)
            key = item['payload'].get('post_key')
            is_feed = item['payload'].get('format') == 'rss-excerpt'
            post = next(iter(parsed['posts']), None) if is_feed else next((post for post in parsed['posts'] if post['key'] == key), None)
            if not post:
                raise ValueError('Exact post missing; do not infer sold/withdrawn')
            source, thread = thread_identity(url)
            expected = f"{source}:{thread}:feed-excerpt" if is_feed else f"{source}:{thread}:{post['key']}"
            if item['source_key'] != expected:
                raise ValueError('Source identity changed')
            post.update(post_role=item['payload'].get('post_role') or 'opening-post', collection_role=item['payload'].get('collection_role') or 'property-discussion-and-lead-discovery')
            save_item(db, source, url, parsed['title'], post, 'external-supplier-lead-discovery')
        except (AccessStopped, ValueError) as error:
            errors += 1
            if diagnostics is not None:
                record_error(diagnostics, item['source_id'], error)
    return errors


def empty_diagnostics():
    return {'errors': 0, 'error_counts': {}, 'requests': 0, 'http_statuses': {},
            'network_errors': {}, 'records_observed': 0}


def source_error(details, category):
    details['errors'] += 1
    details['error_counts'][category] = details['error_counts'].get(category, 0) + 1


def run_source(source, known, pages, threads):
    """One publisher owns its temporary inbox, transport and error boundary."""
    details, items, processed = empty_diagnostics(), [], 0
    with tempfile.TemporaryDirectory(prefix=f'hanoi-{source}-') as tmp:
        db = database(Path(tmp) / 'inbox.sqlite')
        fetcher = None
        try:
            fetcher = Fetcher(db, 2)
            try:
                refresh(db, fetcher, known, {source}, {source: details})
                if not source_stopped(fetcher, source):
                    if source == 'otofun':
                        result = marketplace(db, pages=pages, max_threads=threads, fetcher=fetcher)
                    elif source == 'voz':
                        result = crawl(db, {'voz'}, 4, 2, 2, KEYWORDS, fetcher=fetcher)
                    else:
                        raise ValueError('Unsupported source adapter')
                    for error in result.get('errors', []):
                        record_error({source: details}, source, error.get('error', ''))
            except Exception:
                # Source text and exception messages never enter shared logs.
                source_error(details, 'source-worker-error')
            db.row_factory = __import__('sqlite3').Row
            known_keys = {item['source_key'] for item in known if item['source_id'] == source}
            for row in db.execute('select * from item order by id'):
                try:
                    item = projection(row, known_keys)
                    processed += 1
                    if item and item['source_id'] == source:
                        items.append(item)
                except Exception:
                    source_error(details, 'projection-error')
            originals = {item['source_key'].rsplit(':', 1)[0] for item in items if item['payload']['format'] == 'public-post'}
            items = [item for item in items if item['payload']['format'] != 'rss-excerpt'
                     or item['source_key'].rsplit(':', 1)[0] not in originals]
            request_diagnostics(db, {source: details})
            details['records_observed'] = db.execute('select count(*) from item').fetchone()[0]
            if source in fetcher.retry_after:
                details['retry_after_seconds'] = fetcher.retry_after[source]
            blocked = any(('voz' if host == 'voz.vn' else 'otofun') == source for host in fetcher.blocked)
            state = 'blocked' if blocked else ('partial' if processed else 'failed') if details['errors'] else 'ok'
            return {'state': state, 'items': items, 'diagnostics': details}
        finally:
            if fetcher is not None:
                fetcher.close()
            db.close()


def cooldown_active(source, stamp):
    value = source.get('retry_after')
    if not isinstance(value, str) or not value:
        return False
    try:
        due = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return due.tzinfo is not None and due > stamp
    except (TypeError, ValueError):
        return False


def collect(store, run_key, pages=3, threads=12):
    feeds = json.loads((ROOT / 'data/forum-feed-candidates.json').read_text())
    configured = {f['sourceId'] for f in feeds if f.get('collectionEnabled') and f.get('scheduledCollectionEnabled')}
    # select=* is compatible with a worker starting before the additive migration.
    allowed = store.request('collection_sources?select=*&scheduled=eq.true')
    sources = {row['id']: row for row in allowed if row['id'] in configured}
    enabled = set(sources)
    if not enabled:
        raise ValueError('No scheduled collection sources enabled')
    run_id = store.rpc('claim_daily_run', p_run_key=run_key)
    if not run_id:
        return {'outcome': 'skipped', 'reason': 'another-run-holds-lease'}
    try:
        stamp = datetime.now(timezone.utc)
        cooled = {source for source in enabled if cooldown_active(sources[source], stamp)}
        due = sorted(enabled - cooled, key=lambda s: (sources[s].get('access_status') in {'blocked', 'failed', 'partial'}, s))
        known = store.request('sale_candidates?' + urlencode({'select': 'source_id,source_key,source_url,payload',
                              'expires_at': 'gt.' + now(), 'order': 'checked_at.asc,id.asc', 'limit': '10'})) if due else []
        states = {source: 'cooldown' for source in cooled}
        diagnostics = {source: {**empty_diagnostics(), 'retry_after': sources[source]['retry_after']} for source in cooled}
        items = []
        for source in due:
            try:
                with source_budget(SOURCE_BUDGET_SECONDS):
                    result = run_source(source, known, pages, threads)
            except SourceBudgetExceeded:
                details = empty_diagnostics()
                source_error(details, 'source-time-budget')
                result = {'state': 'failed', 'items': [], 'diagnostics': details}
            except Exception:
                details = empty_diagnostics()
                source_error(details, 'source-worker-error')
                result = {'state': 'failed', 'items': [], 'diagnostics': details}
            states[source], diagnostics[source] = result['state'], result['diagnostics']
            items.extend(result['items'])
        usable = sorted(source for source, state in states.items() if state in {'ok', 'partial'})
        outcome = 'deferred' if not due else 'completed' if all(state == 'ok' for state in states.values()) else 'partial' if usable else 'failed'
        summary = {'source_states': dict(sorted(states.items())), 'candidate_records': len(items),
                   'requests': sum(d['requests'] for d in diagnostics.values()),
                   'source_errors': sum(d['errors'] for d in diagnostics.values()),
                   'source_diagnostics': dict(sorted(diagnostics.items())), 'usable_sources': usable,
                   'attempted_sources': sorted(due), 'enabled_sources': sorted(enabled),
                   'published_listings': 0, 'raw_bodies_uploaded': False}
        stored = store.rpc('finish_daily_run', p_run_id=run_id, p_items=items, p_outcome=outcome, p_summary=summary)
        return {'outcome': outcome, **summary, 'stored_candidate_records': stored}
    except Exception:
        try:
            store.rpc('finish_daily_run', p_run_id=run_id, p_items=[], p_outcome='failed', p_summary={'error': 'worker-failed', 'raw_bodies_uploaded': False})
        except ValueError:
            pass
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    run = sub.add_parser('collect')
    run.add_argument('--apply', action='store_true')
    run.add_argument('--pages', type=int, choices=range(1, 6), default=3)
    run.add_argument('--threads', type=int, choices=range(1, 21), default=12)
    sub.add_parser('status')
    sub.add_parser('candidates')
    review = sub.add_parser('review')
    for key in ('id', 'fingerprint', 'decision', 'reviewer', 'note'):
        review.add_argument(key, choices=('keep', 'reject', 'needs-context') if key == 'decision' else None)
    args = parser.parse_args()
    if args.command == 'collect' and not args.apply:
        print(json.dumps({'dry_run': True, 'scope': 'Hanoi resale apartment candidates across budgets', 'pages': args.pages, 'threads': args.threads,
                          'note': 'Use --apply to collect into the private shared review inbox. No public catalogue publication.'}))
        return
    store = Store()
    if args.command == 'collect':
        result = collect(store, os.environ.get('GITHUB_RUN_ID', datetime.now(timezone.utc).isoformat()), args.pages, args.threads)
    elif args.command == 'status':
        runs = store.request('ingestion_runs?select=id,started_at,completed_at,outcome,summary&order=started_at.desc&limit=5')
        history = store.request('ingestion_runs?select=outcome,completed_at&outcome=in.(completed,partial)&order=completed_at.desc&limit=1')
        latest = next((r for r in history if r['outcome'] in ('completed', 'partial')), None)
        stale = not latest or (datetime.now(timezone.utc) - datetime.fromisoformat(latest['completed_at'].replace('Z', '+00:00'))).total_seconds() > 30 * 3600
        latest_outcome = runs[0]['outcome'] if runs else None
        result = {'runs': runs, 'stale': stale, 'healthy': not stale and latest_outcome == 'completed',
                  'operational': not stale and latest_outcome in ('completed', 'partial'),
                  'degraded': latest_outcome != 'completed', 'latest_outcome': latest_outcome,
                  'sources': [{key: row.get(key) for key in ('id', 'access_status', 'checked_at', 'last_success_at', 'failure_count', 'retry_after')}
                              for row in store.request('collection_sources?select=*') if row.get('id') in {'otofun', 'voz'}]}
    elif args.command == 'candidates':
        result = store.request('sale_candidates?' + urlencode({'select': '*', 'expires_at': 'gt.' + now(), 'order': 'checked_at.desc,id.asc', 'limit': '100'}))
        reviews = store.request('candidate_reviews?select=candidate_id,fingerprint,decision')
        by_revision = {(r['candidate_id'], r['fingerprint']): r['decision'] for r in reviews}
        for item in result:
            item['decision'] = by_revision.get((item['id'], item['fingerprint']), 'pending')
    else:
        store.rpc('review_sale_candidate', p_id=args.id, p_fingerprint=args.fingerprint, p_decision=args.decision, p_reviewer=args.reviewer, p_note=args.note)
        result = {'reviewed': args.id, 'decision': args.decision, 'published_listings': 0}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if args.command == 'collect':
        if result['outcome'] in ('partial', 'deferred') and os.environ.get('GITHUB_ACTIONS') == 'true':
            print('::warning title=Data collection degraded::Some sources are unavailable or cooling down; inspect source_states and pipeline status.', file=sys.stderr)
        if result['outcome'] == 'failed':
            raise SystemExit(1)


if __name__ == '__main__':
    try:
        main()
    except ValueError as error:
        raise SystemExit(str(error))
