import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadDeploymentEnv } from './deployment-env.mjs';

loadDeploymentEnv();

const [platform, ...args] = process.argv.slice(2);
if (!['vercel', 'supabase'].includes(platform)) throw new Error('Expected vercel or supabase');
if (platform === 'vercel' && process.env.VERCEL_TOKEN && !args.some(arg => arg === '--token' || arg.startsWith('--token='))) args.push('--token', process.env.VERCEL_TOKEN);
const browser = fileURLToPath(new URL('./open-brave.sh', import.meta.url));
const child = spawn(fileURLToPath(new URL(`../node_modules/.bin/${platform}`, import.meta.url)), args, { stdio: 'inherit', env: { ...process.env, BROWSER: browser, GH_BROWSER: browser } });
child.on('error', () => { console.error(`Cannot start the pinned ${platform} CLI. Run npm ci.`); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
