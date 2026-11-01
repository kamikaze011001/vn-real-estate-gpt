import test from 'node:test';
import assert from 'node:assert/strict';
import {applySupplyPolicy,supplyCounts} from './supply-quality.mjs';
const clock=Date.parse('2026-11-01T12:00:00Z');
const lead=(id='one',changes={})=>({id,label:'Test source',sourceStatus:'unverified-ad',publishedAt:'2026-10-20',editedAt:null,collectedAt:'2026-11-01T01:00:00Z',...changes});
const assessment=(changes={})=>({decision:'usable',facts:{projectId:'test-project',projectLabel:'Test Project',hanoi:true,completedResale:true,totalAskingPriceVnd:4e9,areaM2:72},duplicate_status:'unchecked',...changes});
test('source freshness, actual ad dates and supplier evidence are separate gates',()=>{
 const cases=[
  [lead(),null,'needs-context'],[lead(),assessment(),'usable'],
  [lead('one',{sourceStatus:'source-expired'}),assessment(),'archive'],
  [lead('one',{collectedAt:'2026-10-28T01:00:00Z'}),assessment(),'archive'],
  [lead('one',{publishedAt:'2026-07-01'}),assessment(),'archive'],
  [lead('one',{publishedAt:null}),assessment(),'archive'],
  [lead('one',{publishedAt:'2026-07-01'}),assessment({facts:{...assessment().facts,supplierConfirmedAt:'2026-10-31T12:00:00Z',supplierRole:'owner'}}),'usable'],
  [lead('one',{publishedAt:'2026-07-01'}),assessment({facts:{...assessment().facts,supplierConfirmedAt:'2026-10-20T12:00:00Z',supplierRole:'owner'}}),'archive'],
 ];
 for(const [record,review,state] of cases){const [result]=applySupplyPolicy([record],new Map(review?[['one',review]]:[]),clock);assert.equal(result.quality.state,state);}
});
test('similar quantities group suspected reposts without merging records or exposing review notes',()=>{
 const inputs=[lead('one'),lead('two')],reviews=new Map(inputs.map(x=>[x.id,{...assessment(),reviewer:'PRIVATE',evidence_ref:'PRIVATE CONTACT'}]));
 const records=applySupplyPolicy(inputs,reviews,clock),counts=supplyCounts(records);
 assert.equal(records.length,2);assert.equal(counts.usableAds,2);assert.equal(counts.usableGroups,1);
 assert.equal(records[0].quality.duplicateStatus,'suspected');assert.ok(!JSON.stringify(records).includes('PRIVATE'));
 reviews.set('two',assessment({duplicate_status:'distinct'}));
 assert.equal(supplyCounts(applySupplyPolicy(inputs,reviews,clock)).usableGroups,2,'operator can resolve genuinely different apartments');
});
test('confirmed duplicate group counts once even when source facts differ',()=>{
 const group='11111111-1111-4111-8111-111111111111';
 const records=applySupplyPolicy([lead('one'),lead('two')],new Map([['one',assessment({duplicate_status:'confirmed',duplicate_group:group})],['two',assessment({duplicate_status:'confirmed',duplicate_group:group,facts:{...assessment().facts,totalAskingPriceVnd:4.1e9}})]]),clock);
 assert.equal(supplyCounts(records).usableGroups,1);assert.equal(records[1].quality.advertisedPriceVnd,4.1e9);
});
