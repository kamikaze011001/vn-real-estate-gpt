import { spawnSync } from 'node:child_process';
import { loadDeploymentEnv } from './deployment-env.mjs';
loadDeploymentEnv();
const result = spawnSync('python3', ['scripts/data_pipeline.py', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
process.exitCode = result.status ?? 1;
