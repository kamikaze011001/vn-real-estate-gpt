import test from 'node:test';
import assert from 'node:assert/strict';
import { HostedRuntime } from './hosted-runtime.mjs';
import { newExplorerSession, readSelection, writeSelection, resolveFilters } from './selections.mjs';
import { ResearchLinks } from './research-links.mjs';
import { researchFixture } from './test-support/research-fixture.mjs';

class SharedStore {
  rows = new Map(); records = []; conflicts = 0;
  async load(kind, id) { return structuredClone(this.rows.get(`${kind}:${id}`) ?? null); }
  async commit(kind, id, version, state) {
    const key = `${kind}:${id}`, previous = this.rows.get(key);
    if (this.conflicts-- > 0 || (previous?.version ?? null) !== version) return false;
    this.rows.set(key, { state: structuredClone(state), version: (version ?? 0) + 1 }); return true;
  }
  async researchRecords() { return structuredClone(this.records); }
}

test('independent hosted runtimes share exact selections, focus and hard requirements', async () => {
  const db = new SharedStore(), first = new HostedRuntime(db), second = new HostedRuntime(db);
  const id = await first.run('explorer', {}, newExplorerSession);
  await second.run('explorer', { explorerSessionId: id }, () => writeSelection(id, ['demo-05', 'demo-03'], { focusedListingId: 'demo-01', filters: { maxPriceVnd: 4e9, minBedrooms: 2 }, view: 'details' }));
  const context = await new HostedRuntime(db).run('explorer', { explorerSessionId: id }, () => readSelection(id));
  assert.deepEqual(context.selectedListingIds, ['demo-05', 'demo-03']); assert.equal(context.focusedListingId, 'demo-01');
  assert.deepEqual(await first.run('explorer', { explorerSessionId: id }, () => resolveFilters(id, { district: 'Cầu Giấy' })), { maxPriceVnd: 4e9, minBedrooms: 2, district: 'Cầu Giấy' });
  assert.throws(() => readSelection(id), /hết hạn/, 'hosted state never contaminates the local singleton');
});

test('concurrent hosted operations rebase conflicting writes without losing unrelated context', async () => {
  const db = new SharedStore(), a = new HostedRuntime(db), b = new HostedRuntime(db);
  const id = await a.run('explorer', {}, newExplorerSession);
  await Promise.all([
    a.run('explorer', { explorerSessionId: id }, () => writeSelection(id, ['demo-05'], { filters: { maxPriceVnd: 3e9 } })),
    b.run('explorer', { explorerSessionId: id }, () => writeSelection(id, ['demo-05'], { savedListingIds: ['demo-08'] })),
  ]);
  const result = await a.run('explorer', { explorerSessionId: id }, () => readSelection(id));
  assert.equal(result.filters.maxPriceVnd, 3e9); assert.deepEqual(result.savedListingIds, ['demo-08']);
  const before = db.rows.get(`explorer:${id}`).version;
  await a.run('explorer', { explorerSessionId: id }, () => readSelection(id));
  assert.equal(db.rows.get(`explorer:${id}`).version, before, 'passive reads do not rewrite sessions');
});

test('hosted research survives instance replacement and withdraws changed source selections', async () => {
  const fixture = researchFixture();
  try {
    const db = new SharedStore(); db.records = new ResearchLinks(fixture).localRecords();
    const r1 = new ResearchLinks({}), r2 = new ResearchLinks({}), a = new HostedRuntime(db), b = new HostedRuntime(db);
    const initial = await a.run('research', {}, () => r1.show()), sid = initial.researchSessionId;
    const ids = initial.leads.slice(0, 2).map(lead => lead.id);
    await b.run('research', { researchSessionId: sid }, () => r2.write(sid, ids, { view: 'comparison' }));
    assert.deepEqual((await a.run('research', { researchSessionId: sid }, () => r1.compare({ researchSessionId: sid }))).leads.map(x => x.id), ids);
    db.records.shift();
    const withdrawn = await b.run('research', { researchSessionId: sid }, () => r2.context(sid));
    assert.deepEqual(withdrawn.selectedLeadIds, [ids[1]]); assert.equal(withdrawn.view, 'list');
    await assert.rejects(b.run('explorer', { explorerSessionId: sid }, () => readSelection(sid)), /hết hạn/);
  } finally { fixture.cleanup(); }
});

test('storage failures and retry exhaustion never report unsaved selections as successful', async () => {
  const db = new SharedStore(), runtime = new HostedRuntime(db);
  db.conflicts = 10;
  await assert.rejects(runtime.run('explorer', {}, newExplorerSession), /Hãy thử lại/);
  assert.equal(db.rows.size, 0);
  db.load = async () => { throw new Error('database unavailable'); };
  await assert.rejects(runtime.run('explorer', { explorerSessionId: crypto.randomUUID() }, () => assert.fail('must not run')), /unavailable/);
});
