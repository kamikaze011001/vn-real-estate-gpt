import { loadDeploymentEnv } from './deployment-env.mjs';

loadDeploymentEnv();
const ref = process.env.SUPABASE_PROJECT_REF;
if (!/^[a-z]{20}$/.test(ref || '') || !process.env.SUPABASE_ACCESS_TOKEN) throw new Error('Supabase project reference and CLI access token are required.');
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/database/pooler`, {
  headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` }, redirect: 'error', signal: AbortSignal.timeout(10000),
});
if (!response.ok) throw new Error(`Supabase IPv4 discovery failed (HTTP ${response.status}). The project-scoped CLI token needs Connection Pooling Read (database_pooling_config_read).`);
const poolers = await response.json();
if (!Array.isArray(poolers) || !poolers.some(pooler => pooler.db_host && Number(pooler.db_port) > 0)) throw new Error('No pooler is ready for this project yet.');
console.log('Supabase project-scoped IPv4 pooler discovery passed. No connection credentials were printed.');
