import { execFileSync, spawnSync } from 'node:child_process';

// Never print CLI status: its JSON contains local database/API credentials.
let status;
try { status = JSON.parse(execFileSync('node_modules/.bin/supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })); }
catch { throw new Error('Start the local Supabase stack before running test:hosted.'); }
const origin = new URL(status.API_URL);
if (!['127.0.0.1', 'localhost'].includes(origin.hostname)) throw new Error('Hosted integration tests require the isolated local Supabase project.');
const result = spawnSync(process.execPath, ['--test', 'server/hosted-server.integration.test.mjs'], { stdio: 'inherit', env: {
  ...process.env, HOSTED_INTEGRATION_TEST: '1', SUPABASE_URL: origin.origin,
  SUPABASE_SECRET_KEY: status.SECRET_KEY || status.SERVICE_ROLE_KEY,
} });
process.exitCode = result.status ?? 1;
