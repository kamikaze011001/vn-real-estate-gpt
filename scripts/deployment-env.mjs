import { existsSync, readFileSync } from 'node:fs';

// Decode the wizard template's literal KEY='value' format without evaluating a
// shell file. This also preserves apostrophes in generated database passwords.
export function parseDeploymentEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) throw new Error('Invalid deployment settings format');
    let value = match[2];
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1).replaceAll("'\\''", "'");
    else if (value.startsWith('"') && value.endsWith('"')) {
      try { value = JSON.parse(value); } catch { throw new Error('Invalid deployment settings format'); }
    }
    values[match[1]] = value;
  }
  return values;
}
export function loadDeploymentEnv(path = '.env.deployment') {
  if (!existsSync(path)) return;
  for (const [key, value] of Object.entries(parseDeploymentEnv(readFileSync(path, 'utf8')))) if (process.env[key] === undefined) process.env[key] = value;
}
