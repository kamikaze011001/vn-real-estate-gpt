import json
import unittest
from unittest.mock import patch
from rongbay_source import parse_ad,links,run,CATEGORY
from forum_crawl import AccessStopped

URL='https://rongbay.com/Ha-Noi/Test-only-c15-raovat-34423215.html'
def detail(ident='34423215',title='TEST ONLY Bán căn hộ chung cư',price='4,9 tỷ',area='56m<sup>2</sup>'):
 return f'''<div id="detail_popup_{ident}"><div class="sub_detail_popup"><div class="header"><h1>{title}</h1><div class="info_item_popup"><span class="note_gera">Mã tin: <span>{ident}</span></span><span class="note_gera">Thời gian: <span>01/11/2026</span></span></div></div><div class="box_infor_ct"><ul><li>Giá :<span>{price}</span></li><li class="icon_dientich"><span>{area}</span></li><li>Số phòng ngủ: 2</li><li>Dự án:<b>TEST ONLY Project</b></li></ul><p>PRIVATE BODY owner@example.test 0901234567</p></div></div></div><div class="related"><span>999 tỷ 999m2</span></div>'''

class RongbayTests(unittest.TestCase):
 def test_exact_ad_scoped_facts_preserve_date_uncertainty_and_exclude_private_content(self):
  x=parse_ad(detail(),URL);p=x['payload']
  self.assertEqual(p['fields']['price_candidates'][0]['raw'],'4,9 tỷ');self.assertEqual(p['fields']['area_candidates'][0]['raw'],'56 m2')
  self.assertEqual(p['fields']['displayed_date'],'2026-11-01');self.assertIsNone(p['source_published_at']);self.assertFalse(p['publication_ready'])
  self.assertNotIn('PRIVATE',json.dumps(x));self.assertNotIn('999',json.dumps(x));self.assertNotIn('0901234567',json.dumps(x))
 def test_non_apartment_vip_rent_rates_ranges_and_identity_conflicts_are_rejected(self):
  for title in ['TEST ONLY Bán nhà đất','TEST ONLY Cho thuê căn hộ','TEST ONLY Bán chung cư mini']:
   self.assertIsNone(parse_ad(detail(title=title),URL))
  for price in ['78 triệu/m²','4-5 tỷ','0 tỷ','giá thương lượng']:
   self.assertIsNone(parse_ad(detail(price=price),URL))
  with self.assertRaises(ValueError): parse_ad(detail(ident='99999999'),URL)
  with self.assertRaises(ValueError): parse_ad(detail(),URL.replace('rongbay.com','evil.test'))
 def test_scoped_index_and_persistent_worker_use_the_correct_source_identity(self):
  index=f'<section class="subCateBDS"><a class="ad_item_id" item_id="34423215" href="{URL}">TEST</a></section><a href="https://evil.test">ignore</a>'
  self.assertEqual(links(index),[URL])
  with patch('listing_source_worker.Fetcher.get',side_effect=lambda url,**kwargs:(index if url==CATEGORY else detail(),url)):
   result=run([],1,1)
  self.assertEqual(result['diagnostics']['new_candidates'],1);self.assertEqual(result['discovery']['source_id'],'rongbay')
  self.assertEqual(result['items'][0]['source_key'],'rongbay:34423215:ad-34423215')
 def test_access_denial_preserves_blocked_state_and_later_source_cooldown(self):
  def deny(fetcher,url,**kwargs):
   fetcher.blocked.add('rongbay.com');raise AccessStopped(429,'PRIVATE')
  with patch('listing_source_worker.Fetcher.get',autospec=True,side_effect=deny): result=run([],1,1)
  self.assertEqual(result['state'],'blocked')
  self.assertNotIn('PRIVATE',json.dumps(result))

if __name__=='__main__': unittest.main()
