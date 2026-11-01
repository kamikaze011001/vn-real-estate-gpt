import { readFileSync,writeFileSync,existsSync,mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { loadDeploymentEnv } from './deployment-env.mjs';
import { SupabaseStore } from '../server/supabase-store.mjs';
import { qualityFactsSchema,supplyCounts } from '../server/supply-quality.mjs';
import { fingerprint } from '../server/research-links.mjs';
loadDeploymentEnv();
const command=process.argv[2]||'report';
if(!['report','queue','assess'].includes(command))throw new Error('Use supply report, queue, or assess PRIVATE_JSON_FILE');
const store=new SupabaseStore({url:process.env.SUPABASE_URL,secretKey:process.env.SUPABASE_SECRET_KEY});
try {
 if(command==='assess'){
  if(!process.argv[3])throw new Error('Provide a private assessment JSON file');
  const schema=z.object({candidateId:z.string().regex(/^candidate-[a-f0-9]{24}$/),fingerprint:z.string().regex(/^[a-f0-9]{64}$/),
   decision:z.enum(['usable','needs-context']),facts:z.record(z.string(),z.unknown()),duplicateGroup:z.string().uuid().nullable(),
   duplicateStatus:z.enum(['unchecked','distinct','suspected','confirmed']),reviewer:z.string().min(1).max(100),
   evidenceRef:z.string().min(1).max(2000),reviewSeconds:z.number().int().min(0).max(3600)}).strict();
  const input=schema.parse(JSON.parse(readFileSync(resolve(process.argv[3]),'utf8')));
  if(input.decision==='usable')qualityFactsSchema.parse(input.facts);
  await store.request('rpc/assess_sale_candidate',{method:'POST',body:{p_id:input.candidateId,p_fingerprint:input.fingerprint,p_decision:input.decision,p_facts:input.facts,
   p_duplicate_group:input.duplicateGroup,p_duplicate_status:input.duplicateStatus,p_reviewer:input.reviewer,p_evidence_ref:input.evidenceRef,p_review_seconds:input.reviewSeconds}});
  console.log(JSON.stringify({assessed:input.candidateId,publishedListings:0}));
 }else{
  const records=await store.researchRecords();
  if(command==='queue'){
   const rows=await store.request('sale_candidates?select=id,source_key,fingerprint&expires_at=gt.'+encodeURIComponent(new Date().toISOString())+'&limit=500');
   const queue=records.filter(x=>x.quality.state==='needs-context').slice(0,30).map(lead=>{
    const row=rows.find(r=>'research-'+fingerprint(r.source_key).slice(0,20)===lead.id);
    return {candidateId:row?.id,fingerprint:row?.fingerprint,label:lead.label,sourceUrl:lead.sourceUrl,sourceDate:lead.publishedAt,checkedAt:lead.collectedAt,
      priceExpressions:lead.priceExpressions,areaExpressions:lead.areaExpressions,reasons:lead.quality.reasons};
   });
   console.log(JSON.stringify({dailyReviewBudgetMinutes:15,queue},null,2));
  }else{
   const since=new Date(Date.now()-7*86400000).toISOString();
   const events=await store.request('candidate_assessment_events?select=review_seconds&reviewed_at=gte.'+encodeURIComponent(since)+'&limit=1000');
   const result={at:new Date().toISOString(),counts:supplyCounts(records),measuredReviewSeconds7Days:events.reduce((sum,x)=>sum+x.review_seconds,0),
     timedReviews7Days:events.filter(x=>x.review_seconds>0).length,untimedReviews7Days:events.filter(x=>x.review_seconds===0).length,
     reviewBudgetMinutesPerDay:15,workingCheckpoint:'2026-11-08',workingTargetDate:'2026-11-29',readerCap:500};
   const baselinePath='private-data/supply-baseline.json';
   if(process.argv.includes('--save-baseline')){mkdirSync('private-data',{recursive:true});writeFileSync(baselinePath,JSON.stringify(result,null,2),{mode:0o600});}
   if(existsSync(baselinePath)){const baseline=JSON.parse(readFileSync(baselinePath,'utf8'));result.baseline={at:baseline.at,counts:baseline.counts};}
   console.log(JSON.stringify(result,null,2));
  }
 }
}catch{throw new Error('Supply operation failed. Check the schema/current revision or private assessment file; private inputs were not logged.');}
