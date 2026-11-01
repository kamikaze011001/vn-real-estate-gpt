import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const localPython = fileURLToPath(new URL('../.venv-crawl/bin/python', import.meta.url));
export const crawlerPython = process.env.CRAWL_PYTHON || (existsSync(localPython) ? localPython : 'python3');

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = spawnSync(crawlerPython, process.argv.slice(2), { stdio: 'inherit', env: process.env });
  process.exitCode = result.status ?? 1;
}
