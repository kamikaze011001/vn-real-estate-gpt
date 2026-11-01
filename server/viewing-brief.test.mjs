import test from 'node:test';
import assert from 'node:assert/strict';
import { buildViewingBrief, mergeRequirements, briefSchema } from './viewing-brief.mjs';
import { ResearchLinks } from './research-links.mjs';
import { researchFixture } from './test-support/research-fixture.mjs';
import { inOperation } from './operation-context.mjs';
const clock = Date.parse('2026-11-01T14:00:00Z');
const lead = { id: 'research-'+'a'.repeat(20), label: 'Source claim', sourceUrl: 'https://rongbay.com/Ha-Noi/test-c15-raovat-34423215.html', risks: [],
  collectedAt: new Date(clock-1000).toISOString(), expiresAt: new Date(clock+86400000).toISOString(), sourceStatus: 'unverified-ad',
  quality: { advertisedPriceVnd: null, advertisedAreaM2: null, availabilityConfirmed: false, supplierConfirmedAt: null } };
const review = { project_id:'oct3a-handiresco', match_level:'tentative-project', building_id:null, reviewed_at:'2026-11-01T13:00:00Z', review_due_at:'2026-11-08T13:00:00Z', evidence_ref:'PRIVATE REVIEW', fingerprint:'PRIVATE HASH' };
const item = (l=lead,r={},v=review,bundle) => buildViewingBrief([l],r,new Map(v?[[l.id,v]]:[]),clock,bundle).items[0];

test('partial brief preserves unknowns, gives a useful next step and at most three reasoned questions', () => {
  const result=item(lead,{maxPriceVnd:4e9,minAreaM2:70,minBedrooms:2,areas:['Cầu Giấy']},null);
  assert.equal(result.action,'ask-first'); assert.equal(result.association,'unresolved');
  assert.equal(result.context.length,0); assert.equal(result.questions.length,3);
  assert.ok(result.checks.filter(c=>c.status==='unknown').length>=7);
  assert.ok(result.questions.every(q=>q.why.length>10));
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
test('tentative project context never attaches exact-building operations, parking or readiness', () => {
  const result=item();
  assert.equal(result.association,'tentative-project');
  assert.deepEqual(result.context.map(x=>x.id),['oct3a-identity']);
  assert.equal(result.action,'ask-first');
  assert.equal(result.checks.find(c=>c.key==='identity').status,'unknown');
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  const wrong=item(lead,{}, {...review,match_level:'building',building_id:'oct3b'});
  assert.equal(wrong.context.length,0);
  const exact=item(lead,{}, {...review,match_level:'building',building_id:'oct3a'});
  assert.equal(exact.context.length,3); assert.equal(exact.context[1].effectivePeriod,'2024-01-01–2026-12-31');
  assert.equal(exact.context[2].publishedAt,null); assert.equal(exact.checks.find(c=>c.key==='fees').status,'unknown');
});
test('expired, future or missing reviews remove context; old project reports stay historical',()=>{
  for(const v of [null,{...review,review_due_at:'2026-10-31T00:00:00Z'},{...review,reviewed_at:'2026-11-02T00:00:00Z'},{...review,project_id:'wrong-project'}]) assert.equal(item(lead,{},v).context.length,0);
  const ct=item(lead,{}, {...review,project_id:'ct36-metropolitan'});
  assert.equal(ct.context.length,3); assert.ok(ct.context.every(n=>n.timeBasis==='historical'&&n.publishedAt==='2018-05-24'));
  assert.equal(ct.checks.find(c=>c.key==='completion').status,'unknown');
});
test('set aside requires a fresh coherent supported conflict, never missing or inconsistent data',()=>{
  const reviewed={...lead,quality:{...lead.quality,advertisedPriceVnd:5e9,advertisedAreaM2:80}};
  assert.equal(item(reviewed,{maxPriceVnd:4e9}).action,'set-aside');
  assert.equal(item(lead,{maxPriceVnd:4e9}).action,'ask-first');
  for(const changed of [{...reviewed,risks:['area-discrepancy']},{...reviewed,collectedAt:'2026-10-01T00:00:00Z'},{...reviewed,sourceStatus:'source-expired'}]) assert.equal(item(changed,{maxPriceVnd:4e9}).action,'ask-first');
  assert.equal(item(reviewed,{minAreaM2:90}).checks.find(c=>c.key==='minAreaM2').status,'unknown','area basis is not reviewed');
});
test('consider viewing requires exact building, all recorded must-haves, completion evidence and recent supplier availability',()=>{
  const note={id:'future-reviewed-completion',topic:'completion',scope:'building',buildingId:'oct3a',text:'A reviewed building source reports handover.',url:'https://handiresco.com/example',publisher:'Example',authorType:'developer',publishedAt:'2026-01-01',effectivePeriod:null,timeBasis:'historical',checkedAt:'2026-11-01T13:00:00Z',reviewDueAt:'2026-11-08T13:00:00Z',locator:'Example',limitation:'Not legal certification'};
  const bundle={projects:[{id:'oct3a-handiresco',label:'OCT3A',buildingIds:['oct3a'],notes:[note]}]};
  const available={...lead,quality:{advertisedPriceVnd:3e9,advertisedAreaM2:80,availabilityConfirmed:true,supplierConfirmedAt:'2026-11-01T12:00:00Z'}};
  const exact={...review,match_level:'building',building_id:'oct3a'};
  assert.equal(item(available,{maxPriceVnd:4e9},exact,bundle).action,'consider-viewing');
  assert.equal(item(available,{},exact,bundle).action,'ask-first');
  assert.equal(item(available,{maxPriceVnd:4e9,minBedrooms:2},exact,bundle).action,'ask-first');
  assert.equal(item({...available,quality:{...available.quality,supplierConfirmedAt:'2026-10-01T00:00:00Z'}},{maxPriceVnd:4e9},exact,bundle).action,'ask-first');
  assert.equal(item(available,{maxPriceVnd:4e9},exact,{projects:[{...bundle.projects[0],notes:[]}]}).action,'ask-first');
});
test('requirements inherit unless explicitly replaced or cleared, reject nulls and extra claims',()=>{
  assert.deepEqual(mergeRequirements({maxPriceVnd:4e9,minBedrooms:2},{minAreaM2:70}),{maxPriceVnd:4e9,minBedrooms:2,minAreaM2:70});
  assert.deepEqual(mergeRequirements({maxPriceVnd:4e9,minBedrooms:2},{},['maxPriceVnd']),{minBedrooms:2});
  assert.throws(()=>mergeRequirements({}, {maxPriceVnd:null}));
  assert.throws(()=>mergeRequirements({}, {availability:true}));
});
test('brief captures its subjects without replacing comparison selections and survives filtering; withdrawals are removed',()=>{
  const f=researchFixture();
  try {
    const r=new ResearchLinks(f), start=r.show({scope:'all',requirements:{maxPriceVnd:4e9,minBedrooms:2}}), sid=start.researchSessionId;
    const ids=start.leads.slice(0,2).map(x=>x.id);
    r.write(sid,ids,{focusedLeadId:ids[0],view:'details'});
    const result=r.showBrief({researchSessionId:sid,ids:[ids[0]],requirements:{minAreaM2:70}});
    assert.deepEqual(result.selectedLeadIds,ids); assert.equal(result.view,'brief');
    assert.equal(result.viewingBrief.items.length,1); assert.deepEqual(r.brief({researchSessionId:sid}).viewingBrief.items.map(x=>x.leadId),[ids[0]],'active brief refinements retain its captured subject'); assert.equal(result.viewingBrief.requirements.maxPriceVnd,4e9);
    assert.ok(briefSchema.safeParse(result.viewingBrief).success);
    r.show({researchSessionId:sid,query:'no-results',view:'list'});
    assert.deepEqual(r.context(sid).briefLeadIds,[ids[0]]);
    assert.deepEqual(r.brief({researchSessionId:sid}).viewingBrief.items.map(x=>x.leadId),[ids[0]],'browsing elsewhere does not replace prepared subjects');
    assert.throws(()=>r.showBrief({researchSessionId:sid,ids:['demo-01']}));
    assert.throws(()=>r.showBrief({researchSessionId:sid,ids:[ids[0],ids[0]]}));
    r.showBrief({researchSessionId:sid,ids:[ids[0]],clearRequirements:['maxPriceVnd']});
    assert.equal(r.context(sid).requirements.maxPriceVnd,undefined);
    f.db.prepare('DELETE FROM item WHERE id=?').run('otofun:1:post-1');
    const removed=r.context(sid); assert.equal(removed.view,'list'); assert.equal(removed.viewingBrief,undefined);
  } finally { f.cleanup(); }
});
test('brief context only uses private operation snapshot, not model text or source labels',async()=>{
  const r=new ResearchLinks({clock:()=>clock}); r.records=()=>[lead];
  const start=r.show({scope:'all'});
  const data=await inOperation({sessions:new Map([['research',r.localSessions]]),contextReviews:new Map([[lead.id,review]])},()=>r.showBrief({researchSessionId:start.researchSessionId,ids:[lead.id]}));
  assert.equal(data.viewingBrief.items[0].context.length,1);
  assert.equal(r.context(start.researchSessionId).viewingBrief.items[0].context.length,0);
});
