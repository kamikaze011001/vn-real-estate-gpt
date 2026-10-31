import { ResearchLinks } from '../server/research-links.mjs';
import { SupabaseStore } from '../server/supabase-store.mjs';
import { loadDeploymentEnv } from './deployment-env.mjs';

loadDeploymentEnv();

const records = new ResearchLinks({ dbPath: process.env.RESEARCH_DB || 'private-data/forum-crawl.sqlite', manifestPath: process.env.RESEARCH_LINKS_MANIFEST || 'private-data/research-links.json' }).localRecords();
const store = new SupabaseStore({ url: process.env.SUPABASE_URL, secretKey: process.env.SUPABASE_SECRET_KEY });
if (!process.argv.includes('--apply')) {
  console.log(`Validated ${records.length} minimal source projections. Nothing uploaded. Use --apply to replace the hosted research batch.`);
} else {
  const count = await store.replaceResearch(records);
  console.log(`Synced ${count} minimal source projections. No private crawl bodies, contacts or replies uploaded.`);
}
