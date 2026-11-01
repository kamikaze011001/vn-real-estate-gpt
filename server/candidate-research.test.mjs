import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateResearch } from './candidate-research.mjs';
import { fingerprint } from './research-links.mjs';

function row(overrides={}) {
  return {id:'candidate-'+'a'.repeat(24),source_id:'otofun',source_key:'otofun:1234:post-5678',fingerprint:'b'.repeat(64),
    source_url:'https://www.otofun.net.vn/threads/test.1234/#post-5678',checked_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),
    payload:{format:'public-post',post_role:'opening-ad',post_key:'post-5678',queue:'needs-context',publication_ready:false,geography:'unresolved',flags:['source-ad-marked-expired-not-proof-of-sale'],
      fields:{price_candidates:[{raw:'6ty 850tr vnd',uncertain:true},{raw:'78 triệu',basis:'per_m2'},{raw:'phone PRIVATE BODY 0901234567',basis:'unspecified'}],
        area_candidates:[{raw:'96m'},{raw:'1000m2'},{raw:'owner@example.com'}],bedroom_candidates:[{raw:'3PN'},{raw:'PRIVATE CONTACT'}]},
      text:'PRIVATE BODY',author:'PRIVATE AUTHOR',contacts:'PRIVATE CONTACT',source_published_at:'2026-10-22',source_edited_at:null},...overrides};
}

test('daily projection keeps uncertainty, historical source identity and only numeric expressions',()=>{
  const candidate=row(), [lead]=candidateResearch([candidate]);
  assert.equal(lead.id,'research-'+fingerprint(candidate.source_key).slice(0,20));
  assert.equal(lead.sourceStatus,'source-expired'); assert.equal(lead.priceVnd,null); assert.equal(lead.inventoryEligible,false);
  assert.deepEqual(lead.priceExpressions.map(x=>x.raw),['6ty 850tr vnd','78 triệu']);
  assert.deepEqual(lead.areaExpressions,['96m','1000m2']); assert.deepEqual(lead.bedroomExpressions,['3PN']);
  assert.ok(lead.risks.includes('quantity-context-unresolved')); assert.ok(lead.risks.includes('location-unresolved'));
  for (const privateField of ['PRIVATE','owner@','fingerprint','source_key','value_vnd']) assert.ok(!JSON.stringify(lead).includes(privateField));
});

test('expired, closed, rejected revisions and forged identities leave the public feed',()=>{
  const candidate=row();
  const rejected=[{candidate_id:candidate.id,fingerprint:candidate.fingerprint,decision:'reject'}];
  assert.equal(candidateResearch([candidate],[],rejected).length,0);
  assert.equal(candidateResearch([row({fingerprint:'c'.repeat(64)})],[],rejected).length,1,'old rejection does not reject a changed revision');
  for (const change of [
    {expires_at:'2000-01-01T00:00:00Z'}, {checked_at:'2000-01-01T00:00:00Z'},
    {payload:{...candidate.payload,queue:'excluded'}}, {source_id:'voz'},
    {source_url:'https://evil.test/threads/test.1234/#post-5678'},
    {source_url:'https://www.otofun.net.vn/threads/test.9999/#post-5678'},
    {payload:{...candidate.payload,post_role:'thread-starter-update'}},
  ]) assert.equal(candidateResearch([row(change)]).length,0);
});

test('curated labels never resurrect removed records or replace live dates and expressions',()=>{
  const candidate=row(), [lead]=candidateResearch([candidate]);
  const curated={...lead,sourceUrl:lead.sourceUrl.replace('otofun.net.vn','otofun.net'),label:'Our historical label',collectedAt:'2000-01-01T00:00:00Z',priceExpressions:[{raw:'1 tỷ',basis:'unspecified',uncertain:false}]};
  const [current]=candidateResearch([candidate],[curated]);
  assert.equal(current.label,curated.label); assert.equal(current.collectedAt,candidate.checked_at);
  assert.equal(current.priceExpressions[0].raw,'6ty 850tr vnd'); assert.deepEqual(candidateResearch([],[curated]),[]);
});

test('Alonhadat ads project only scoped numeric facts, an own label and separately uncertain displayed date',()=>{
  const candidate=row({source_id:'alonhadat',source_key:'alonhadat:12345678:ad-12345678',source_url:'https://alonhadat.com.vn/test-apartment-12345678.html'});
  candidate.payload={...candidate.payload,format:'public-ad',post_key:'ad-12345678',flags:['source-date-semantics-unresolved'],geography:'hanoi-mentioned',
    source_published_at:null,source_edited_at:null,projects:[{label:'TEST ONLY Project'}],fields:{...candidate.payload.fields,displayed_date:'2026-11-01',area_label:'Cầu Giấy'}};
  const leads=candidateResearch([candidate]);
  assert.equal(leads.length,1);assert.equal(leads[0].source,'ALONHADAT');assert.equal(leads[0].displayedAt,'2026-11-01');
  assert.equal(leads[0].publishedAt,null);assert.match(leads[0].label,/TEST ONLY Project/);assert.match(leads[0].label,/Cầu Giấy/);
  assert.equal(leads[0].inventoryEligible,false);assert.equal(leads[0].priceVnd,null);
  for(const bad of [candidate.source_url+'?phone=123',candidate.source_url.replace('12345678.html','99999999.html'),candidate.source_url.replace('alonhadat.com.vn','evil.test')])
    assert.deepEqual(candidateResearch([{...candidate,source_url:bad}]),[]);
  assert.ok(!JSON.stringify(leads).includes('PRIVATE'));
});
