import test from 'node:test';
import assert from 'node:assert/strict';
import { ResearchLinks, fingerprint } from './research-links.mjs';
import { researchFixture } from './test-support/research-fixture.mjs';


test('research exposes only a curated source projection, preserving unknowns and rate basis', () => {
  const f = researchFixture();
  try {
    const r = new ResearchLinks(f), data = r.search();
    assert.equal(data.total, 3); assert.equal(data.mode, 'research');
    const lead = data.leads[0];
    assert.equal(lead.priceVnd, null); assert.equal(lead.areaM2, null); assert.equal(lead.bedrooms, null);
    assert.equal(lead.availability, 'unknown'); assert.equal(lead.inventoryEligible, false); assert.equal(lead.requirementsVerified, false);
    assert.equal(lead.priceExpressions[0].basis, 'per_m2');
    assert.equal(lead.publishedAt, '2026-01-01'); assert.equal(lead.editedAt, '2026-01-02');
    const encoded = JSON.stringify(data);
    for (const secret of ['PRIVATE BODY', 'PRIVATE AUTHOR', 'CONTACT SECRET', 'fingerprint', 'sourceItemId']) assert.ok(!encoded.includes(secret));
    assert.equal(r.search({ query: 'my dinh 2' }).total, 1);
    assert.equal(r.search({ scope: 'expired' }).total, 1);
  } finally { f.cleanup(); }
});

test('research sessions isolate selections, preserve query and support comparison without typed IDs', () => {
  const f = researchFixture();
  try {
    let clock = Date.now(); const r = new ResearchLinks({ ...f, clock: () => clock });
    const a = r.show(), b = r.show(), ids = a.leads.slice(0, 2).map(lead => lead.id);
    r.write(a.researchSessionId, ids, { focusedLeadId: ids[0], view: 'details' });
    assert.deepEqual(r.compare({ researchSessionId: a.researchSessionId }).leads.map(lead => lead.id), ids);
    assert.deepEqual(r.context(b.researchSessionId).selectedLeadIds, []);
    r.show({ researchSessionId: a.researchSessionId, query: '3', view: 'list', focusedLeadId: null });
    assert.equal(r.context(a.researchSessionId).total, 1);
    assert.equal(r.context(a.researchSessionId).contextLeads.length, 2);
    assert.equal(r.search({ researchSessionId: a.researchSessionId }).query, '3');
    assert.throws(() => r.write(a.researchSessionId, [ids[0], ids[0]]));
    assert.throws(() => r.write(a.researchSessionId, ['demo-01']));
    assert.deepEqual(r.context(a.researchSessionId).selectedLeadIds, ids);
    clock += 3600001;
    assert.throws(() => r.context(a.researchSessionId), /hết hạn/);
  } finally { f.cleanup(); }
});

test('changed, expired or withdrawn source links leave results and temporary selections', () => {
  const f = researchFixture();
  try {
    const r = new ResearchLinks(f), data = r.show(), ids = data.leads.slice(0, 2).map(lead => lead.id);
    r.write(data.researchSessionId, ids, { view: 'comparison' });
    const raw = JSON.parse(f.db.prepare('SELECT data FROM item WHERE id=?').get('otofun:1:post-1').data);
    raw.text = 'CHANGED PRIVATE BODY';
    f.db.prepare('UPDATE item SET data=? WHERE id=?').run(JSON.stringify(raw), 'otofun:1:post-1');
    const context = r.context(data.researchSessionId);
    assert.deepEqual(context.selectedLeadIds, [ids[1]]); assert.equal(context.view, 'list');
    assert.equal(r.records().length, 2);
    f.db.prepare('UPDATE item SET expires_at=?').run('2000-01-01T00:00:00Z');
    assert.equal(r.records().length, 0);
    f.manifest.expiresAt = '2000-01-01T00:00:00Z'; f.save();
    assert.equal(r.search().total, 0);
  } finally { f.cleanup(); }
});

test('research rejects forged source URLs and extra private manifest fields', () => {
  const f = researchFixture();
  try {
    const r = new ResearchLinks(f);
    const raw = JSON.parse(f.db.prepare('SELECT data FROM item WHERE id=?').get('otofun:1:post-1').data);
    raw.source_url = 'https://evil.test/threads/test.1/#post-1';
    const encoded = JSON.stringify(raw);
    f.db.prepare('UPDATE item SET data=? WHERE id=?').run(encoded, 'otofun:1:post-1');
    f.manifest.entries[0].fingerprint = fingerprint(encoded); f.save();
    assert.throws(() => r.records(), /Invalid research source/);
    f.manifest.entries[0].description = 'SHOULD NEVER BE PUBLIC'; f.save();
    assert.throws(() => r.records());
  } finally { f.cleanup(); }
});
