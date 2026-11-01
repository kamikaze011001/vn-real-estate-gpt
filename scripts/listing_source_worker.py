"""Shared bounded source worker; adapters own publisher-specific identities and facts."""
import hashlib
import json
import tempfile
from datetime import datetime,timedelta,timezone
from pathlib import Path
from urllib.parse import urlsplit
from forum_crawl import AccessStopped,Fetcher,database,now,source_stopped

def run_listing_source(known, pages, threads, discovery=None, refresh_only=False, refresh_limit=4, *, source, category, ad_url, parse_ad, links, index_url):
    details = {'errors':0,'error_counts':{},'requests':0,'http_statuses':{},'network_errors':{},'records_observed':0,
               'refresh_records':0,'projected_candidates':0,'new_candidates':0,'classification_counts':{}}
    items, indexed, attempted, observed, errors = [], [], [], 0, []
    index_pages_read=0
    openings=0
    saved = discovery or {}
    next_page = saved.get('next_page', 2)
    frontier = None
    known_rows = [x for x in known if x['source_id']==source]
    known_keys = {x['source_key'] for x in known_rows}
    with tempfile.TemporaryDirectory(prefix=f'hanoi-{source}-') as tmp:
        db = database(Path(tmp)/'requests.sqlite')
        fetcher = Fetcher(db, 2)
        def read(url):
            nonlocal observed
            _, requested_id=ad_url(url)
            html, final = fetcher.get(url, html=True)
            if ad_url(final)[1] != requested_id:
                raise ValueError('Ad redirect changed identity')
            item = parse_ad(html, final)
            observed += 1
            if item:
                items.append(item)
            return item
        try:
            for row in known_rows[:refresh_limit]:
                if source_stopped(fetcher,source): break
                try:
                    item=read(row['source_url'])
                    if item: details['refresh_records'] += 1
                    elif row['source_key']:
                        # A previously retained ad moving out of scope leaves public research.
                        item={**row,'payload':{**row['payload'],'queue':'excluded'},'checked_at':now(),
                              'expires_at':(datetime.now(timezone.utc)+timedelta(days=14)).isoformat()}
                        item['fingerprint']=hashlib.sha256(json.dumps(item['payload'],sort_keys=True).encode()).hexdigest()
                        items.append(item)
                except (AccessStopped,ValueError) as error: errors.append(error)
            if not refresh_only and not source_stopped(fetcher,source):
                for page in [1]+list(range(next_page,min(101,next_page+pages-1))):
                    if source_stopped(fetcher,source): break
                    try:
                        html, final = fetcher.get(index_url(page),html=True)
                        if final != index_url(page): raise ValueError('Category redirect changed scope')
                        indexed.extend(links(html))
                        index_pages_read+=1
                        if page>1: next_page=2 if page>=100 else page+1
                    except (AccessStopped,ValueError) as error:
                        errors.append(error); break
                indexed=list(dict.fromkeys(indexed))[:500]
                pending=[row['source_url'] for row in saved.get('threads',[]) if row.get('due')]
                due_map={row['source_url']:row.get('due') for row in saved.get('threads',[])}
                candidates=list(dict.fromkeys(pending+indexed))
                for url in candidates:
                    if openings>=threads or source_stopped(fetcher,source): break
                    try:
                        _,ident=ad_url(url)
                        if f'{source}:{ident}:ad-{ident}' in known_keys or due_map.get(url) is False: continue
                        openings+=1
                        read(url); attempted.append(url)
                    except (AccessStopped,ValueError) as error:
                        errors.append(error)
                        if getattr(error,'status',None) in (404,410): attempted.append(url)
                if indexed or attempted:
                    frontier={'source_id':source,'next_page':next_page,'indexed':indexed,'attempted':attempted}
                details['discovery']={'index_pages_read':index_pages_read,
                                      'opening_posts_attempted':openings,'next_backfill_page':next_page}
            for error in errors:
                error_category='http-'+str(error.status) if getattr(error,'status',0) else 'network-or-parse-error'
                details['error_counts'][error_category]=details['error_counts'].get(error_category,0)+1
            details['errors']=len(errors)
            for _url,status,error in db.execute('select url,status,error from fetch_log'):
                details['requests']+=1
                code=str(status) if status else 'no-response'
                details['http_statuses'][code]=details['http_statuses'].get(code,0)+1
                if status==0 and error and error.startswith('network-'):
                    details['network_errors'][error]=details['network_errors'].get(error,0)+1
            details.update(records_observed=observed,projected_candidates=len(items),new_candidates=sum(x['source_key'] not in known_keys for x in items))
            if source in fetcher.retry_after: details['retry_after_seconds']=fetcher.retry_after[source]
            blocked=urlsplit(category).hostname in fetcher.blocked
            state='blocked' if blocked else ('partial' if items else 'failed') if errors else 'ok'
            return {'state':state,'items':items,'diagnostics':details,'discovery':frontier}
        finally:
            fetcher.close(); db.close()

