import json
import unittest
from unittest.mock import patch
from alonhadat_source import parse_ad, links, run, CATEGORY
from forum_crawl import AccessStopped

URL='https://alonhadat.com.vn/test-only-12345678.html'
def detail(ident='12345678',price='6,5 tỷ',value='6500000000',region='Hà Nội',kind='4'):
    return f'''<input id="hddPropertyId" value="{ident}"><input id="hddDemand" value="1"><input id="hddPropertyType" value="{kind}">
    <article class="property"><header class="title"><h1>TEST ONLY căn hộ 72m2</h1><time class="date" datetime="2026-11-01">Ngày đăng</time></header>
    <div class="more-info"><meta itemprop="priceCurrency" content="VND"><data itemprop="price" value="{value}">{price}</data><div class="area"><span itemprop="value">72</span><data itemprop="unitCode" value="SQM">m²</data></div></div>
    <address class="current-address"><span itemprop="addressLocality">Cầu Giấy</span><span itemprop="addressRegion">{region}</span></address>
    <div class="moreinfor1"><table><tr><td>Số phòng ngủ</td><td>2</td></tr></table><div class="project"><a>TEST ONLY Project</a></div></div>
    <p>PRIVATE BODY owner@example.test 0901234567</p></article>
    <article class="property-item"><data itemprop="price" value="999999">UNRELATED</data><span itemprop="value">999</span></article>'''

class AlonhadatTests(unittest.TestCase):
    def test_scoped_facts_exclude_related_cards_and_all_private_text(self):
        item=parse_ad(detail(),URL)
        self.assertEqual(item['payload']['fields']['price_candidates'][0]['raw'],'6500000000 VND')
        self.assertEqual(item['payload']['fields']['area_candidates'],[{'raw':'72 m2'}])
        self.assertEqual(item['payload']['fields']['displayed_date'],'2026-11-01')
        self.assertIsNone(item['payload']['source_published_at'])
        self.assertFalse(item['payload']['publication_ready'])
        for private in ['PRIVATE','owner@','0901234567','UNRELATED','description','6500000000 VND VND']:
            self.assertNotIn(private,json.dumps(item))
        self.assertEqual(item['fingerprint'],parse_ad(detail(),URL)['fingerprint'])

    def test_identity_scope_rates_ranges_and_unknowns_do_not_become_individual_sale_totals(self):
        with self.assertRaises(ValueError): parse_ad(detail(ident='99999999'),URL)
        for args in [dict(price='78 triệu/m²'),dict(price='6-7 tỷ'),dict(value='0'),dict(region='Hưng Yên'),dict(kind='2')]:
            self.assertIsNone(parse_ad(detail(**args),URL))
        for bad in [URL+'?contact=x',URL+'#x',URL.replace('alonhadat.com.vn','evil.test')]:
            with self.assertRaises(ValueError): parse_ad(detail(),bad)
        self.assertIsNone(parse_ad(detail().replace('content="VND"','content="USD"'),URL))
        self.assertIsNone(parse_ad(detail().replace('value="SQM"','value="SQF"'),URL))

    def test_index_links_are_scoped_and_future_source_date_stays_unknown(self):
        html=f'<article class="property-item"><a class="link" href="{URL}">TEST</a></article><a class="link" href="https://evil.test">ignore</a>'
        self.assertEqual(links(html),[URL])
        self.assertIsNone(parse_ad(detail().replace('2026-11-01','2099-01-01'),URL)['payload']['fields']['displayed_date'])

    def test_pending_links_survive_quota_and_next_run_discovers_another_ad(self):
        second=URL.replace('12345678','12345679')
        html=f'<article class="property-item"><a class="link" href="{URL}">one</a></article><article class="property-item"><a class="link" href="{second}">two</a></article>'
        def get(url,**kwargs):
            return (html if '/can-ban-' in url else detail(ident='12345679' if url==second else '12345678'),url)
        with patch('alonhadat_source.Fetcher.get',side_effect=get):
            first=run([],1,1)
            saved={'next_page':2,'threads':[{'source_url':second,'due':True},{'source_url':URL,'due':False}]}
            again=run(first['items'],1,1,saved,refresh_limit=1)
        self.assertEqual(first['diagnostics']['new_candidates'],1)
        self.assertEqual(again['diagnostics']['new_candidates'],1)
        self.assertEqual(again['discovery']['attempted'],[second])
        self.assertEqual(len(again['items']),2)

    def test_refresh_only_skips_index_and_source_failure_returns_safe_diagnostics(self):
        known=[parse_ad(detail(),URL)]
        with patch('alonhadat_source.Fetcher.get',return_value=(detail(),URL)) as get:
            result=run(known,5,20,refresh_only=True,refresh_limit=12)
        self.assertEqual(get.call_count,1); self.assertIsNone(result['discovery'])
        with patch('alonhadat_source.Fetcher.get',side_effect=AccessStopped(503,'PRIVATE SOURCE TEXT')):
            result=run([],1,1)
        self.assertEqual(result['state'],'failed')
        self.assertNotIn('PRIVATE',json.dumps(result))

    def test_renamed_url_keeps_ad_identity_and_cannot_count_as_new_supply(self):
        known=[parse_ad(detail(),URL)]
        renamed=URL.replace('test-only','renamed-test-only')
        index=f'<article class="property-item"><a class="link" href="{renamed}">same ad</a></article>'
        def get(url,**kwargs): return (index,url) if url==CATEGORY else (detail(),renamed)
        with patch('alonhadat_source.Fetcher.get',side_effect=get): result=run(known,1,20)
        self.assertEqual(result['diagnostics']['new_candidates'],0)
        self.assertEqual(len(result['items']),1)
        self.assertEqual(result['items'][0]['id'],known[0]['id'])

if __name__=='__main__': unittest.main()
