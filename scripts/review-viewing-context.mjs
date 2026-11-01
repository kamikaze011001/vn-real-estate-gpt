// Operator-only input; no automatic title matching or fingerprint renewal.
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { loadDeploymentEnv } from './deployment-env.mjs';
import { SupabaseStore } from '../server/supabase-store.mjs';
import bundle from '../data/viewing-context.json' with { type: 'json' };

loadDeploymentEnv();
const schema = z.array(z.object({
  candidateId: z.string().regex(/^candidate-[a-f0-9]{24}$/), fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  projectId: z.string(), buildingId: z.string().nullable(), matchLevel: z.enum(['tentative-project','project','building']),
  reviewer: z.string().min(1).max(100), evidenceRef: z.string().min(1).max(2000), reviewDueAt: z.string().datetime({offset:true}),
}).strict()).min(1).max(20);
try {
  if (!process.argv[2]) throw new Error('Missing private file');
  const reviews = schema.parse(JSON.parse(readFileSync(process.argv[2], 'utf8')));
  const store = new SupabaseStore({url:process.env.SUPABASE_URL,secretKey:process.env.SUPABASE_SECRET_KEY});
  for (const review of reviews) {
    const project = bundle.projects.find(p=>p.id===review.projectId);
    if (!project || (review.matchLevel==='building' ? !project.buildingIds.includes(review.buildingId) : review.buildingId!==null)) throw new Error('Invalid scope');
    await store.request('rpc/review_candidate_context',{method:'POST',body:{
      p_id:review.candidateId,p_fingerprint:review.fingerprint,p_project_id:review.projectId,p_building_id:review.buildingId,
      p_match_level:review.matchLevel,p_reviewer:review.reviewer,p_evidence_ref:review.evidenceRef,p_review_due_at:review.reviewDueAt,
    }});
  }
  console.log(JSON.stringify({contextReviews:reviews.length,publishedInventory:0}));
} catch { throw new Error('Context review failed. Check the private input, current source revision and migration; private inputs were not logged.'); }
