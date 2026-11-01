"""Bounded facts-and-links discovery; no descriptions, contacts or photos persist."""
import hashlib
import json
import re
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from bs4 import BeautifulSoup
from forum_crawl import AccessStopped, Fetcher, database, normalized, now, source_stopped

SOURCE = 'alonhadat'
ORIGIN = 'https://alonhadat.com.vn'
CATEGORY = ORIGIN + '/can-ban-can-ho-chung-cu/ha-noi'
AD_PATH = re.compile(r'/[a-z0-9-]+-([0-9]{1,24})\.html')


def ad_url(value):
    url = urlsplit(value)
    match = AD_PATH.fullmatch(url.path)
    if url.scheme != 'https' or url.netloc != 'alonhadat.com.vn' or url.query or url.fragment or not match or len(value) > 600:
        raise ValueError('Invalid Alonhadat ad identity')
    return value, match[1]


def links(html):
    soup = BeautifulSoup(html, 'html.parser')
    result = []
    for anchor in soup.select('article.property-item a.link[href]'):
        try:
            url, _ = ad_url(urljoin(ORIGIN, anchor['href']))
            if url not in result:
                result.append(url)
        except ValueError:
            continue
    if not result:
        raise ValueError('Listing index selector returned no ads')
    return result[:100]


def number(value, maximum):
    text = str(value or '').strip().replace(',', '.')
    if not re.fullmatch(r'\d+(?:\.\d+)?', text):
        return None
    parsed = float(text)
    return parsed if 0 < parsed <= maximum else None


def label(value):
    text = ' '.join(value.split())
    return text if 0 < len(text) <= 80 and not re.search(r'[<>@]|\d{8,}', text) else None


def parse_ad(html, url):
    url, ident = ad_url(url)
    soup = BeautifulSoup(html, 'html.parser')
    article = soup.select_one('article.property')
    identity = soup.select_one('input#hddPropertyId[value]')
    if not article or not identity or identity['value'] != ident:
        raise ValueError('Exact scoped ad identity missing')
    pairs = {}
    for row in article.select('.moreinfor1 table tr'):
        cells = row.find_all('td', recursive=False)
        for i in range(0, len(cells)-1, 2):
            pairs[normalized(cells[i].get_text(' ', strip=True)).strip(': ')] = cells[i+1].get_text(' ', strip=True)
    demand = soup.select_one('input#hddDemand[value]')
    kind = soup.select_one('input#hddPropertyType[value]')
    title = article.select_one('header.title h1')
    title_text = normalized(title.get_text(' ', strip=True)) if title else ''
    address = article.select_one('address.current-address')
    region = address.select_one('[itemprop=addressRegion]') if address else None
    location = normalized(region.get_text(' ', strip=True)) if region else ''
    if location != 'ha noi' or not demand or demand['value'] != '1' or not kind or kind['value'] != '4':
        return None
    if re.search(r'\b(?:tap the|mini|phong tro|officetel|condotel|quy can|nha o xa hoi)\b', title_text):
        return None
    price_node = article.select_one('.more-info data[itemprop=price][value]')
    area_node = article.select_one('.more-info .area [itemprop=value]')
    raw_price = price_node.get_text(' ', strip=True) if price_node else ''
    currency=article.select_one('.more-info meta[itemprop=priceCurrency]')
    area_unit=article.select_one('.more-info .area [itemprop=unitCode]')
    unit=(area_unit.get('value') or area_unit.get('content') or area_unit.get_text(strip=True)) if area_unit else ''
    price = number(price_node.get('value'), 1e15) if price_node else None
    area = number(area_node.get('content', area_node.get_text(strip=True)), 5000) if area_node else None
    # A numeric attribute must not turn a rate, range or monthly rent into a total.
    if not currency or currency.get('content')!='VND' or unit.upper() not in {'SQM','M2','M²'} or not price or not price.is_integer() or not area or re.search(r'/|(?:den|thang|m2|m²)|\d\s*[-–]\s*\d', normalized(raw_price)):
        return None
    bedroom = pairs.get('so phong ngu', '')
    beds = int(bedroom) if re.fullmatch(r'\d{1,2}', bedroom) and 0 < int(bedroom) <= 20 else None
    project = article.select_one('.moreinfor1 .project a')
    project_label = label(project.get_text(' ', strip=True)) if project else None
    locality = address.select_one('[itemprop=addressLocality]') if address else None
    area_label = label(locality.get_text(' ', strip=True)) if locality else None
    date_node = article.select_one('header.title time.date[datetime]')
    displayed = (date_node.get('datetime', '')[:10] if date_node else '')
    try:
        date = datetime.strptime(displayed, '%Y-%m-%d').date()
        if date > datetime.now(timezone(timedelta(hours=7))).date():
            displayed = None
    except ValueError:
        displayed = None
    flags = ['source-date-semantics-unresolved']
    title_codes=set(re.findall(r'\b[a-z]{1,3}\d{1,3}[a-z]?\b',title_text))
    project_codes=set(re.findall(r'\b[a-z]{1,3}\d{1,3}[a-z]?\b',normalized(project_label or '')))
    if title_codes and project_codes and title_codes.isdisjoint(project_codes):
        flags.append('project-label-conflict')
    scoped_text = article.get_text(' ', strip=True)
    stated_areas = {number(x, 5000) for x in re.findall(r'(\d+(?:[.,]\d+)?)\s*m(?:2|²)\b', scoped_text, re.I)} - {None}
    if any(abs(value-area) > .1 for value in stated_areas):
        flags.append('area-discrepancy')
    if re.search(r'\b(?:het han|da ban|ngung ban)\b', title_text):
        flags.append('source-ad-marked-expired-not-proof-of-sale')
    payload = {'format':'public-ad','post_key':f'ad-{ident}','post_role':'opening-ad','collection_role':'minimal-ad-facts-and-links',
        'queue':'needs-context','reasons':['scope-and-availability-unverified'],'flags':flags,'geography':'hanoi-mentioned',
        'projects':[{'label':project_label}] if project_label else [],
        'fields':{'price_candidates':[{'raw':f'{int(price)} VND','basis':'unspecified','uncertain':True}],
            'area_candidates':[{'raw':f'{area:g} m2'}],'bedroom_candidates':[{'raw':f'{beds} phòng ngủ'}] if beds else [],
            'displayed_date':displayed,'area_label':area_label},
        'source_published_at':None,'source_edited_at':None,'publication_ready':False}
    key = f'alonhadat:{ident}:ad-{ident}'
    stamp = now()
    return {'id':'candidate-'+hashlib.sha256(key.encode()).hexdigest()[:24],'source_id':SOURCE,'source_key':key,'source_url':url,
        # Retrieval time and category position are not a content revision.
        'fingerprint':hashlib.sha256(json.dumps([1,payload],ensure_ascii=False,sort_keys=True).encode()).hexdigest(),
        'payload':payload,'checked_at':stamp,'expires_at':(datetime.now(timezone.utc)+timedelta(days=14)).isoformat()}


def run(known, pages, threads, discovery=None, refresh_only=False, refresh_limit=4):
    details = {'errors':0,'error_counts':{},'requests':0,'http_statuses':{},'network_errors':{},'records_observed':0,
               'refresh_records':0,'projected_candidates':0,'new_candidates':0,'classification_counts':{}}
    items, indexed, attempted, observed, errors = [], [], [], 0, []
    index_pages_read=0
    openings=0
    saved = discovery or {}
    next_page = saved.get('next_page', 2)
    frontier = None
    known_rows = [x for x in known if x['source_id']==SOURCE]
    known_keys = {x['source_key'] for x in known_rows}
    with tempfile.TemporaryDirectory(prefix='hanoi-alonhadat-') as tmp:
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
                if source_stopped(fetcher,SOURCE): break
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
            if not refresh_only and not source_stopped(fetcher,SOURCE):
                for page in [1]+list(range(next_page,min(101,next_page+pages-1))):
                    if source_stopped(fetcher,SOURCE): break
                    try:
                        html, final = fetcher.get(CATEGORY+(f'/trang-{page}' if page>1 else ''),html=True)
                        if final != CATEGORY+(f'/trang-{page}' if page>1 else ''): raise ValueError('Category redirect changed scope')
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
                    if openings>=threads or source_stopped(fetcher,SOURCE): break
                    try:
                        _,ident=ad_url(url)
                        if f'alonhadat:{ident}:ad-{ident}' in known_keys or due_map.get(url) is False: continue
                        openings+=1
                        read(url); attempted.append(url)
                    except (AccessStopped,ValueError) as error:
                        errors.append(error)
                        if getattr(error,'status',None) in (404,410): attempted.append(url)
                if indexed or attempted:
                    frontier={'source_id':SOURCE,'next_page':next_page,'indexed':indexed,'attempted':attempted}
                details['discovery']={'index_pages_read':index_pages_read,
                                      'opening_posts_attempted':openings,'next_backfill_page':next_page}
            for error in errors:
                category='http-'+str(error.status) if getattr(error,'status',0) else 'network-or-parse-error'
                details['error_counts'][category]=details['error_counts'].get(category,0)+1
            details['errors']=len(errors)
            for _url,status,error in db.execute('select url,status,error from fetch_log'):
                details['requests']+=1
                code=str(status) if status else 'no-response'
                details['http_statuses'][code]=details['http_statuses'].get(code,0)+1
                if status==0 and error and error.startswith('network-'):
                    details['network_errors'][error]=details['network_errors'].get(error,0)+1
            details.update(records_observed=observed,projected_candidates=len(items),new_candidates=sum(x['source_key'] not in known_keys for x in items))
            if SOURCE in fetcher.retry_after: details['retry_after_seconds']=fetcher.retry_after[SOURCE]
            blocked='alonhadat.com.vn' in fetcher.blocked
            state='blocked' if blocked else ('partial' if items else 'failed') if errors else 'ok'
            return {'state':state,'items':items,'diagnostics':details,'discovery':frontier}
        finally:
            fetcher.close(); db.close()


if __name__=='__main__':
    result=run([],1,3)
    print(json.dumps({'state':result['state'],'diagnostics':result['diagnostics'],'samples':[
        {'sourceUrl':x['source_url'],'projects':x['payload']['projects'],'fields':x['payload']['fields'],'flags':x['payload']['flags']}
        for x in result['items']]},ensure_ascii=False,indent=2))
