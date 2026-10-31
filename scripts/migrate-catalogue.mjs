import { resolve } from 'node:path';
import { Catalogue } from '../server/catalogue.mjs';
import { SupabaseStore } from '../server/supabase-store.mjs';
import { loadDeploymentEnv } from './deployment-env.mjs';
loadDeploymentEnv();
const local = new Catalogue(resolve(process.env.CATALOGUE_DB || 'private-data/catalogue.sqlite'));
try {
  const tables = local.snapshot();
  console.log(JSON.stringify({ tables: Object.fromEntries(Object.entries(tables).map(([key, rows]) => [key, rows.length])), published: local.publicListings().length, rawForumBodies: false }));
  if (process.argv.includes('--apply')) {
    const store = new SupabaseStore({ url: process.env.SUPABASE_URL, secretKey: process.env.SUPABASE_SECRET_KEY });
    const current = await store.request('rpc/load_catalogue', { method: 'POST', body: {} });
    if (Object.values(current.tables).some(rows => rows.length)) throw new Error('Shared catalogue is not empty. Use shared operator commands; do not overwrite it.');
    if (!(await store.request('rpc/commit_catalogue', { method: 'POST', body: { p_expected_version: current.version, p_tables: tables } }))) throw new Error('Catalogue changed; migration was not applied.');
    console.log('Reviewed catalogue migrated. No forum inbox or raw crawl files uploaded.');
  } else console.log('Dry run. Use --apply for the one-time migration to an empty shared catalogue.');
} finally { local.close(); }
