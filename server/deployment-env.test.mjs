import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDeploymentEnv } from '../scripts/deployment-env.mjs';

test('deployment credentials preserve literal shell characters and quoted passwords without evaluation', () => {
  const values = parseDeploymentEnv("# local settings\nSUPABASE_DB_PASSWORD='a'\\''b$()`${literal}'\nSUPABASE_PROJECT_REF='abcdefghijklmnopqrst'\n");
  assert.equal(values.SUPABASE_DB_PASSWORD, "a'b$()`${literal}");
  assert.equal(values.SUPABASE_PROJECT_REF, 'abcdefghijklmnopqrst');
  assert.throws(() => parseDeploymentEnv('export TOKEN=unexpected'));
});
