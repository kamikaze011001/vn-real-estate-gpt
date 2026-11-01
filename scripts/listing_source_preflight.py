"""Read-only worker-origin check for the researched Rongbay fallback. No database."""
import json
import re
import time
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup
from forum_crawl import Robots

ORIGIN='https://rongbay.com'
CATEGORY=ORIGIN+'/Ha-Noi/Can-ho-chung-cu-Mua-Ban-nha-dat-c15-t5.html'
PATH=re.compile(r'^https://rongbay[.]com/Ha-Noi/[a-zA-Z0-9-]+-c15-raovat-[0-9]+[.]html$')

def check():
    session=requests.Session();session.trust_env=False
    observations=[]
    def get(url,limit=2_000_000):
        with session.get(url,timeout=(8,20),allow_redirects=False,stream=True,verify=True) as response:
            observations.append({'step':'robots' if url.endswith('/robots.txt') else 'category' if url==CATEGORY else 'detail','status':response.status_code})
            response.raise_for_status()
            if response.status_code!=200: raise ValueError('Unexpected redirect')
            body=bytearray()
            for chunk in response.iter_content(65536):
                body.extend(chunk)
                if len(body)>limit: raise ValueError('Size limit')
            text=body.decode('utf-8','replace')
            if re.search(r'<title[^>]*>\s*(Just a moment|Access denied|Attention Required)',text,re.I): raise ValueError('Access challenge')
            return text
    try:
        policy=Robots(get(ORIGIN+'/robots.txt',512_000))
        def allowed(url):
            yes,delay=policy.policy(url,requests.utils.default_user_agent())
            if not yes or delay>30: raise ValueError('Robots policy')
            time.sleep(max(2,delay))
        allowed(CATEGORY);html=get(CATEGORY)
        urls=list(dict.fromkeys(urljoin(ORIGIN,a['href']) for a in BeautifulSoup(html,'html.parser').select('a[href]') if PATH.fullmatch(urljoin(ORIGIN,a['href']))))
        for url in urls[:2]: allowed(url); get(url)
        return {'source':'rongbay','ok':len(urls)>0,'discoveredAdLinks':len(urls),'observations':observations,'recordsUploaded':0}
    except Exception:
        return {'source':'rongbay','ok':False,'observations':observations,'recordsUploaded':0}
    finally: session.close()

if __name__=='__main__':
    result=check();print(json.dumps(result));raise SystemExit(0 if result['ok'] else 1)
