"""Rongbay advertisement facts and original links; displayed dates are not publication proof."""
import hashlib
import json
import re
from datetime import datetime,timedelta,timezone
from urllib.parse import urljoin,urlsplit
from bs4 import BeautifulSoup
from forum_crawl import normalized,now
from alonhadat_source import label,number
from listing_source_worker import run_listing_source

SOURCE='rongbay'
ORIGIN='https://rongbay.com'
CATEGORY=ORIGIN+'/Ha-Noi/Can-ho-chung-cu-Mua-Ban-nha-dat-c15-t5.html'
PATH=re.compile(r'/Ha-Noi/[a-zA-Z0-9-]+-c15-raovat-([0-9]{1,24})\.html')

def ad_url(value):
    u=urlsplit(value);match=PATH.fullmatch(u.path)
    if u.scheme!='https' or u.netloc!='rongbay.com' or u.query or u.fragment or not match or len(value)>600:
        raise ValueError('Invalid Rongbay ad identity')
    return value,match[1]

def links(html):
    result=[]
    for a in BeautifulSoup(html,'html.parser').select('section.subCateBDS a.ad_item_id[item_id][href]'):
        try:
            url,ident=ad_url(urljoin(ORIGIN,a['href']))
            if ident==a['item_id'] and url not in result: result.append(url)
        except ValueError: continue
    if not result: raise ValueError('Listing index selector returned no ads')
    return result[:100]

def parse_ad(html,url):
    url,ident=ad_url(url)
    root=BeautifulSoup(html,'html.parser').select_one(f'#detail_popup_{ident} > .sub_detail_popup')
    if not root: raise ValueError('Exact scoped ad identity missing')
    title=root.select_one('.header h1')
    title_text=normalized(title.get_text(' ',strip=True)) if title else ''
    if not re.search(r'\b(?:can ho|chung cu)\b',title_text) or re.search(r'\b(?:cho thue|can mua|tap the|mini|phong tro|quy can|nha o xa hoi|officetel|condotel)\b',title_text): return None
    displayed=None;matched=False
    for node in root.select('.header .info_item_popup span.note_gera'):
        text=normalized(node.get_text(' ',strip=True))
        if 'ma tin:' in text:
            match=re.search(r'ma tin:\s*(\d+)',text)
            matched=bool(match and match[1]==ident)
        if 'thoi gian:' in text:
            match=re.search(r'(\d{2}/\d{2}/\d{4})',text)
            if match:
                try:
                    date=datetime.strptime(match[1],'%d/%m/%Y').date()
                    if date<=datetime.now(timezone(timedelta(hours=7))).date(): displayed=date.isoformat()
                except ValueError: pass
    if not matched: raise ValueError('Advertised ID does not match URL')
    price_raw=None;area=None;beds=None;project=None
    for item in root.select('.box_infor_ct > ul > li'):
        text=item.get_text(' ',strip=True);norm=normalized(text)
        if re.match(r'^gia\s*:',norm):
            for span in item.find_all('span'):
                raw=span.get_text(' ',strip=True)
                match=re.fullmatch(r'\s*(\d+(?:[.,]\d+)?)\s*(tỷ|triệu)\s*',raw,re.I)
                if match and number(match[1],1e6): price_raw=raw.strip();break
        if 'icon_dientich' in item.get('class',[]):
            for span in item.find_all('span'):
                match=re.fullmatch(r'(\d+(?:[.,]\d+)?)\s*m(?:2|²)',span.get_text('',strip=True),re.I)
                if match: area=number(match[1],5000)
        if re.match(r'^so phong ngu\s*:',norm):
            match=re.search(r':\s*(\d{1,2})\b',norm)
            if match and 0<int(match[1])<=20: beds=int(match[1])
        if re.match(r'^du an\s*:',norm):
            node=item.find('b');project=label(node.get_text(' ',strip=True)) if node else None
    if not price_raw or not area: return None
    flags=['source-date-semantics-unresolved']
    if re.search(r'\b(?:da ban|het han|ngung ban)\b',title_text): flags.append('source-ad-marked-expired-not-proof-of-sale')
    stated={number(x,5000) for x in re.findall(r'(\d+(?:[.,]\d+)?)\s*m(?:2|²)\b',root.get_text(' ',strip=True),re.I)}-{None}
    if any(abs(x-area)>.1 for x in stated): flags.append('area-discrepancy')
    key=f'rongbay:{ident}:ad-{ident}'
    payload={'format':'public-ad','post_key':f'ad-{ident}','post_role':'opening-ad','collection_role':'minimal-ad-facts-and-links','queue':'needs-context',
        'reasons':['scope-and-availability-unverified'],'flags':flags,'geography':'hanoi-mentioned','projects':[{'label':project}] if project else [],
        'fields':{'price_candidates':[{'raw':price_raw,'basis':'unspecified','uncertain':True}],'area_candidates':[{'raw':f'{area:g} m2'}],
            'bedroom_candidates':[{'raw':f'{beds} phòng ngủ'}] if beds else [],'displayed_date':displayed,'area_label':None},
        'source_published_at':None,'source_edited_at':None,'publication_ready':False}
    return {'id':'candidate-'+hashlib.sha256(key.encode()).hexdigest()[:24],'source_id':SOURCE,'source_key':key,'source_url':url,
        'fingerprint':hashlib.sha256(json.dumps([1,payload],ensure_ascii=False,sort_keys=True).encode()).hexdigest(),'payload':payload,'checked_at':now(),
        'expires_at':(datetime.now(timezone.utc)+timedelta(days=14)).isoformat()}

def run(known,pages,threads,discovery=None,refresh_only=False,refresh_limit=4):
    return run_listing_source(known,pages,threads,discovery,refresh_only,refresh_limit,source=SOURCE,category=CATEGORY,ad_url=ad_url,parse_ad=parse_ad,links=links,
        index_url=lambda page:CATEGORY if page==1 else CATEGORY.removesuffix('.html')+f'-trang{page}.html?ft=1')

if __name__=='__main__':
    result=run([],1,3);print(json.dumps({'state':result['state'],'diagnostics':result['diagnostics'],'samples':[
        {'sourceUrl':x['source_url'],'projects':x['payload']['projects'],'fields':x['payload']['fields']} for x in result['items']]},ensure_ascii=False,indent=2))
