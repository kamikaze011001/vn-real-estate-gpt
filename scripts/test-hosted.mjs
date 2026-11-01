import { execFileSync, spawnSync } from 'node:child_process';
import { SupabaseStore } from '../server/supabase-store.mjs';
import { crawlerPython } from './crawl-python.mjs';

// Never print CLI status: its JSON contains local database/API credentials.
let status;
try { status = JSON.parse(execFileSync('node_modules/.bin/supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })); }
catch { throw new Error('Start the local Supabase stack before running test:hosted.'); }
const origin = new URL(status.API_URL);
if (!['127.0.0.1', 'localhost'].includes(origin.hostname)) throw new Error('Hosted integration tests require the isolated local Supabase project.');
// A database reset can finish before PostgREST exposes newly created RPCs.
// Gate on the real read API instead of starting tests against a stale schema.
const store = new SupabaseStore({ url: origin.origin, secretKey: status.SECRET_KEY || status.SERVICE_ROLE_KEY });
let ready = false;
for (let attempt = 0; attempt < 50; attempt += 1) {
  try {
    await store.request('rpc/load_catalogue', { method: 'POST', body: {} });
    await store.request('collection_sources?select=failure_count,retry_after&limit=1');
    await store.request('rpc/load_source_discovery', { method:'POST', body:{p_source:'otofun'} });
    ready = true; break;
  }
  catch { await new Promise(resolve => setTimeout(resolve, 100)); }
}
if (!ready) throw new Error('Local Supabase catalogue API did not become ready after reset.');
const result = spawnSync(process.execPath, ['--test', 'server/hosted-server.integration.test.mjs', 'server/shared-catalogue.integration.test.mjs'], { stdio: 'inherit', env: {
  ...process.env, HOSTED_INTEGRATION_TEST: '1', SUPABASE_URL: origin.origin,
  SUPABASE_SECRET_KEY: status.SECRET_KEY || status.SERVICE_ROLE_KEY,
} });
process.exitCode = result.status ?? 1;
if (result.status === 0) {
  const recovery = spawnSync(crawlerPython, ['scripts/source_resilience_integration.py'], { stdio: 'inherit', env: {
    ...process.env, SUPABASE_URL: origin.origin, SUPABASE_SECRET_KEY: status.SECRET_KEY || status.SERVICE_ROLE_KEY,
  } });
  process.exitCode = recovery.status ?? 1;
}
