import { spawnSync } from 'node:child_process';
import { loadDeploymentEnv } from './deployment-env.mjs';
import { crawlerPython } from './crawl-python.mjs';
loadDeploymentEnv();
const result = spawnSync(crawlerPython, ['scripts/data_pipeline.py', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
process.exitCode = result.status ?? 1;
