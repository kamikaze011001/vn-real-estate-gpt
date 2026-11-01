import json
import unittest
from unittest.mock import patch
import requests
from listing_source_preflight import check, CATEGORY, ORIGIN

class Response:
    def __init__(self,status,body=''): self.status_code=status;self.body=body.encode()
    def __enter__(self): return self
    def __exit__(self,*args): pass
    def raise_for_status(self):
        if self.status_code>=400: raise requests.HTTPError('PRIVATE RESPONSE')
    def iter_content(self,*args): yield self.body

class Session:
    def __init__(self,responses): self.responses=responses;self.urls=[]
    def get(self,url,**kwargs): self.urls.append(url);return self.responses[url]
    def close(self): pass

class PreflightTests(unittest.TestCase):
    def test_worker_denial_stops_without_another_transport_or_leaking_response(self):
        session=Session({ORIGIN+'/robots.txt':Response(200,'User-agent: *\nAllow: /'),CATEGORY:Response(429,'PRIVATE BODY')})
        with patch('listing_source_preflight.requests.Session',return_value=session),patch('listing_source_preflight.time.sleep'):
            result=check()
        self.assertFalse(result['ok']);self.assertEqual(len(session.urls),2)
        self.assertNotIn('PRIVATE',json.dumps(result));self.assertEqual(result['recordsUploaded'],0)

    def test_probe_opens_only_two_exact_source_details_and_returns_counts(self):
        urls=[ORIGIN+f'/Ha-Noi/Test-only-c15-raovat-{i}.html' for i in range(123,126)]
        html=''.join(f'<a href="{url}">PRIVATE TITLE</a>' for url in urls)+'<a href="https://evil.test">ignore</a>'
        session=Session({ORIGIN+'/robots.txt':Response(200,'User-agent: *\nAllow: /'),CATEGORY:Response(200,html),**{url:Response(200,'PRIVATE BODY') for url in urls}})
        with patch('listing_source_preflight.requests.Session',return_value=session),patch('listing_source_preflight.time.sleep'):
            result=check()
        self.assertTrue(result['ok']);self.assertEqual(len(session.urls),4)
        self.assertEqual(result['discoveredAdLinks'],3);self.assertNotIn('PRIVATE',json.dumps(result))

if __name__=='__main__': unittest.main()
