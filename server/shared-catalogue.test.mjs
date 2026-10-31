import test from 'node:test';
import assert from 'node:assert/strict';
import { Catalogue } from './catalogue.mjs';
import { setupCatalogue, approveCsv } from './test-support/catalogue-fixture.mjs';

test('snapshot round-trip preserves reviews, identity, observations, revocations and strict columns', () => {
  const first = new Catalogue(':memory:'); const second = new Catalogue(':memory:');
  try {
    setupCatalogue(first); const id = approveCsv(first);
    const snapshot = first.snapshot(); second.restore(snapshot);
    assert.deepEqual(second.publicListings(), first.publicListings());
    assert.deepEqual(second.history(id), first.history(id));
    second.withdraw(id, 'operator', 'Test withdrawal');
    first.restore(second.snapshot()); assert.deepEqual(first.publicListings(), []);
    const corrupt = structuredClone(snapshot); corrupt.source[0].injected = 'ignored';
    assert.throws(() => first.restore(corrupt), /Invalid catalogue row/);
    assert.deepEqual(first.publicListings(), [], 'failed restore rolls back completely');
  } finally { first.close(); second.close(); }
});
