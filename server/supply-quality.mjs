import { createHash } from 'node:crypto';
import { z } from 'zod';
const day=86400000;
const hash=value=>createHash('sha256').update(value).digest('hex').slice(0,24);
export const qualityFactsSchema=z.object({
  projectId:z.string().regex(/^[a-z0-9-]{3,80}$/),projectLabel:z.string().min(1).max(120).refine(x=>!/@|\d{8,}/.test(x)),
  hanoi:z.literal(true),completedResale:z.literal(true),
  totalAskingPriceVnd:z.number().int().positive().max(1e15),areaM2:z.number().positive().max(5000),
  sourcePublishedAt:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),sourceEditedAt:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  supplierConfirmedAt:z.string().datetime({offset:true}).nullable().optional(),supplierRole:z.enum(['owner','authorized-agency']).nullable().optional(),
}).strict();
const reasons=z.enum(['source-expired','source-stale','old-ad','source-date-missing','review-needed','possible-duplicate']);
export const qualitySchema=z.object({state:z.enum(['usable','needs-context','archive']),reasons:z.array(reasons),clusterId:z.string(),
  duplicateStatus:z.enum(['unchecked','distinct','suspected','confirmed']),duplicateCount:z.number().int().positive(),
  projectId:z.string().nullable(),projectLabel:z.string().nullable(),advertisedPriceVnd:z.number().nullable(),advertisedAreaM2:z.number().nullable(),
  supplierConfirmedAt:z.string().nullable(),availabilityConfirmed:z.boolean()}).strict();
export const countsSchema=z.object({collected:z.number().int(),usableAds:z.number().int(),usableGroups:z.number().int(),projects:z.number().int(),
  needsContext:z.number().int(),archive:z.number().int(),supplierConfirmed:z.number().int(),targetAds:z.literal(100),targetProjects:z.literal(10)});
const sourceDay=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value))return NaN;
  const d=value.slice(0,10),stamp=Date.parse(d+'T00:00:00Z');
  return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===d?stamp:NaN;
};
export function applySupplyPolicy(leads,assessments=new Map(),clock=Date.now()) {
  const today=Date.parse(new Date(clock+7*3600000).toISOString().slice(0,10)+'T00:00:00Z');
  const decorated=leads.map(lead=>{
    const assessment=assessments.get(lead.id), parsed=qualityFactsSchema.safeParse(assessment?.facts);
    const facts=assessment?.decision==='usable'&&parsed.success?parsed.data:null;
    const confirmed=Date.parse(facts?.supplierConfirmedAt), confirmationFresh=!!facts?.supplierRole&&Number.isFinite(confirmed)&&confirmed<=clock&&confirmed>=clock-7*day;
    const published=sourceDay(facts?.sourcePublishedAt??lead.publishedAt), edited=sourceDay(facts?.sourceEditedAt??lead.editedAt);
    const sourceStamp=Math.max(Number.isFinite(published)?published:-Infinity,Number.isFinite(edited)?edited:-Infinity);
    const check=Date.parse(lead.collectedAt), why=[];
    if(lead.sourceStatus==='source-expired')why.push('source-expired');
    if(!Number.isFinite(check)||check>clock+60000||check<clock-3*day)why.push('source-stale');
    if(!confirmationFresh){
      if(!Number.isFinite(sourceStamp))why.push('source-date-missing');
      else if(sourceStamp>today||sourceStamp<today-30*day)why.push('old-ad');
    }
    const archived=why.length>0;
    if(!facts)why.push('review-needed');
    const status=['distinct','suspected','confirmed'].includes(assessment?.duplicate_status)?assessment.duplicate_status:'unchecked';
    const group=/^[0-9a-f-]{36}$/.test(assessment?.duplicate_group||'')?assessment.duplicate_group:null;
    const automatic=facts&&status==='unchecked'?`similar:${facts.projectId}:${facts.totalAskingPriceVnd}:${facts.areaM2}`:null;
    const clusterId='cluster-'+hash(group&&status!=='distinct'?'review:'+group:automatic||lead.id);
    const risks=facts?(lead.risks||[]).filter(r=>!['project-identity-unresolved','quantity-context-unresolved','price-unresolved','area-unit-unresolved','location-unresolved'].includes(r)):lead.risks;
    return {...lead,risks,quality:{state:archived?'archive':facts?'usable':'needs-context',reasons:why,clusterId,
      duplicateStatus:status,duplicateCount:1,projectId:facts?.projectId??null,projectLabel:facts?.projectLabel??null,
      advertisedPriceVnd:facts?.totalAskingPriceVnd??null,advertisedAreaM2:facts?.areaM2??null,
      supplierConfirmedAt:confirmationFresh?facts.supplierConfirmedAt:null,availabilityConfirmed:confirmationFresh&&!!facts}};
  });
  const sizes=new Map();for(const lead of decorated)sizes.set(lead.quality.clusterId,(sizes.get(lead.quality.clusterId)||0)+1);
  return decorated.map(lead=>{
    const quality=lead.quality, duplicateCount=sizes.get(quality.clusterId);
    const suspected=duplicateCount>1&&quality.duplicateStatus!=='confirmed'&&quality.duplicateStatus!=='distinct';
    return {...lead,quality:{...quality,duplicateCount,duplicateStatus:suspected?'suspected':quality.duplicateStatus,
      reasons:suspected?[...quality.reasons,'possible-duplicate']:quality.reasons}};
  });
}
export function supplyCounts(leads){
  const usable=leads.filter(x=>x.quality?.state==='usable');
  return {collected:leads.length,usableAds:usable.length,usableGroups:new Set(usable.map(x=>x.quality.clusterId)).size,
    projects:new Set(usable.map(x=>x.quality.projectId)).size,needsContext:leads.filter(x=>x.quality?.state==='needs-context').length,
    archive:leads.filter(x=>x.quality?.state==='archive').length,supplierConfirmed:usable.filter(x=>x.quality.availabilityConfirmed).length,targetAds:100,targetProjects:10};
}
