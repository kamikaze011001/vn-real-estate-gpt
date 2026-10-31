import test from 'node:test';
import assert from 'node:assert/strict';
import { Catalogue } from './catalogue.mjs';
import { ProjectEvidence } from './project-evidence.mjs';
import { setupCatalogue, approveCsv } from './test-support/catalogue-fixture.mjs';
import { forumSource, officialSource, evidenceRecord } from './test-support/evidence-fixture.mjs';
import { renderProjectEvidence } from '../web/project-evidence.js';

function fixture(t) {
  let now = Date.parse('2026-10-25T12:00:00Z');
  const catalogue = new Catalogue(':memory:', { now: () => now });
  t.after(() => catalogue.close()); setupCatalogue(catalogue);
  catalogue.putSource(forumSource, 'test'); catalogue.putSource(officialSource, 'test');
  const listingId = approveCsv(catalogue);
  const evidence = new ProjectEvidence(catalogue);
  return { catalogue, evidence, listing: catalogue.publicListings().find(item => item.id === listingId), advance: days => { now += days * 86400000; } };
}
test('evidence needs review and projects only scoped public fields', t => {
  const { catalogue, evidence, listing } = fixture(t);
  const staged = evidence.stage(evidenceRecord(), 'operator');
  assert.equal(evidence.stage(evidenceRecord(), 'operator').item.id, staged.item.id);
  assert.equal(evidence.publicItems().length, 0);
  const approved = evidence.approve(staged.item.id, 'reviewer', 'Source, exact post, scope, wording and use checked');
  const data = evidence.forListing(listing);
  assert.equal(data.community.length, 1); assert.equal(data.official.length, 0);
  assert.equal(data.community[0].id, approved.id);
  assert.equal(data.community[0].verification, 'unverified');
  assert.equal(JSON.stringify(data).includes('private-item'), false);
  assert.equal(JSON.stringify(data).includes('reviewer'), false);
  assert.equal(catalogue.publicListings()[0].priceVnd, 3600000000, 'Community text cannot overwrite listing facts');
  assert.throws(() => evidence.approve(staged.item.id, 'reviewer', 'Repeat decision'), /Pending/);
});
test('building notes do not spread to other buildings or similarly named projects', t => {
  const { catalogue, evidence, listing } = fixture(t);
  catalogue.putBuilding({ id: 'building-b', projectId: 'test-project', name: 'TEST ONLY B', address: 'TEST ONLY', completed: true, completionReference: 'test' }, 'test');
  const building = evidence.stage(evidenceRecord(), 'operator').item;
  evidence.approve(building.id, 'reviewer', 'Building A only');
  const project = evidence.stage(evidenceRecord('2026-10-25', { sourceRecordId: 'project-wide', buildingId: null }), 'operator').item;
  evidence.approve(project.id, 'reviewer', 'Project scope checked');
  assert.equal(evidence.forListing(listing).community.length, 2);
  assert.equal(evidence.forListing({ ...listing, buildingId: 'building-b' }).community.length, 1);
  assert.equal(evidence.forListing({ ...listing, projectId: 'unrelated-project' }).community.length, 0);
  const wrong = evidence.stage(evidenceRecord('2026-10-25', { sourceRecordId: 'wrong', projectId: 'missing' }), 'operator').item;
  assert.throws(() => evidence.approve(wrong.id, 'reviewer', 'Wrong project'), /Unknown project|does not belong/);
});
test('reference, summary and per-item permission evidence are required; source kind/domain cannot be spoofed', t => {
  const { catalogue, evidence } = fixture(t);
  for (const source of [
    { ...forumSource, permission: 'pending' },
    { ...forumSource, allowedUses: ['reference-display'] },
    { ...forumSource, permissionExpiresAt: '2026-10-24' },
  ]) {
    catalogue.putSource(source, 'operator');
    const item = evidence.stage(evidenceRecord('2026-10-25', { sourceRecordId: `case-${source.permission}-${source.allowedUses.length}-${source.permissionExpiresAt || 'none'}` }), 'operator').item;
    assert.throws(() => evidence.approve(item.id, 'reviewer', 'Must fail'));
  }
  catalogue.putSource(forumSource, 'operator');
  for (const changes of [{ kind: 'official', verification: 'documented' }, { sourceUrl: 'https://spoof.example.test/post' }]) {
    const item = evidence.stage(evidenceRecord('2026-10-25', changes), 'operator').item;
    assert.throws(() => evidence.approve(item.id, 'reviewer', 'Must fail'), /kind|domain/);
  }
  assert.throws(() => evidence.stage(evidenceRecord('2026-10-25', { permissionReference: '' }), 'operator'));
});
test('community accounts stay unverified/disputed and exact dates are enforced', t => {
  const { evidence } = fixture(t);
  for (const changes of [
    { verification: 'documented' }, { checkedAt: '2026-02-30' },
    { sourcePublishedAt: '2026-10-26' }, { reviewDueAt: '2026-11-02' },
    { sourceEditedAt: '2026-10-24' }, { sourceEditedAt: '2026-10-26' },
    { sourceUrl: 'javascript:alert(1)' }, { sourceUrl: 'https://secret:password@forum.example.test/post' },
  ]) assert.throws(() => evidence.stage(evidenceRecord('2026-10-25', changes), 'operator'));
  const future = evidence.stage(evidenceRecord('2026-10-26', { sourceRecordId: 'future' }), 'operator').item;
  assert.throws(() => evidence.approve(future.id, 'reviewer', 'Future check'), /future/);
});
test('review expiry and source revocation remove serving evidence; restored grants do not republish', t => {
  const { catalogue, evidence, advance } = fixture(t);
  const first = evidence.stage(evidenceRecord(), 'operator').item;
  evidence.approve(first.id, 'reviewer', 'Checked today');
  advance(1); assert.equal(evidence.publicItems().length, 0);
  const next = evidence.stage(evidenceRecord('2026-10-26'), 'operator').item;
  evidence.approve(next.id, 'reviewer', 'Rechecked original source');
  assert.equal(evidence.publicItems().length, 1);
  catalogue.putSource({ ...forumSource, permission: 'revoked' }, 'operator');
  assert.equal(evidence.publicItems().length, 0);
  catalogue.putSource(forumSource, 'operator'); assert.equal(evidence.publicItems().length, 0);
});
test('withdrawal cancels queued revisions and rejections never publish', t => {
  const { evidence } = fixture(t);
  const first = evidence.stage(evidenceRecord(), 'operator').item;
  const { id } = evidence.approve(first.id, 'reviewer', 'Checked');
  const queued = evidence.stage(evidenceRecord('2026-10-25', { summary: 'TEST ONLY · revised wording' }), 'operator').item;
  evidence.withdraw(id, 'operator', 'Source removed the post');
  assert.equal(evidence.publicItems().length, 0);
  assert.throws(() => evidence.approve(queued.id, 'reviewer', 'Old queue'), /Pending/);
  const rejected = evidence.stage(evidenceRecord('2026-10-25', { sourceRecordId: 'reject-me' }), 'operator').item;
  evidence.reject(rejected.id, 'reviewer', 'Scope unconfirmed');
  assert.throws(() => evidence.approve(rejected.id, 'reviewer', 'Already rejected'), /Pending/);
});
test('official facts keep their labels and unsafe content is escaped in the UI', t => {
  const { evidence, listing } = fixture(t);
  const item = evidence.stage(evidenceRecord('2026-10-25', {
    sourceId: 'test-authority', sourceRecordId: 'report', kind: 'official', verification: 'documented',
    sourceUrl: 'https://authority.example.test/report', sourceLocator: 'Report, page 2',
    summary: '<img src=x onerror=alert(1)> TEST ONLY', question: '<script>test</script>',
  }), 'operator').item;
  evidence.approve(item.id, 'reviewer', 'Escaping fixture only');
  const html = renderProjectEvidence(evidence.forListing(listing));
  assert.ok(html.includes('&lt;img')); assert.equal(html.includes('<img'), false);
  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes('Theo tài liệu')); assert.ok(html.includes('2026-10-25'));
  assert.ok(html.includes('Report, page 2'));
  assert.ok(renderProjectEvidence(null).includes('Chưa tải được'));
  const unsafe = renderProjectEvidence({ official: [{ ...evidence.publicItems()[0], sourceUrl: 'javascript:alert(1)' }], community: [], notice: '' });
  assert.equal(unsafe.includes('href="javascript:'), false);
});
test('citywide market reporting keeps its own geography and period beside the matching project', t => {
  const { evidence, listing } = fixture(t);
  const report = { sourceId: 'test-authority', sourceRecordId: 'market-report', kind: 'official', topic: 'market', verification: 'documented', sourceUrl: 'https://authority.example.test/report', sourceScope: 'TEST ONLY · Hà Nội, citywide sample', buildingId: null };
  assert.throws(() => evidence.stage(evidenceRecord('2026-10-25', report), 'operator'), /reportingPeriod/);
  const staged = evidence.stage(evidenceRecord('2026-10-25', { ...report, reportingPeriod: 'TEST ONLY · Q3 2026' }), 'operator').item;
  evidence.approve(staged.id, 'reviewer', 'Citywide context only, not a unit valuation');
  const result = evidence.forListing(listing);
  assert.equal(result.official[0].sourceScope, 'TEST ONLY · Hà Nội, citywide sample');
  assert.equal(result.official[0].reportingPeriod, 'TEST ONLY · Q3 2026');
  const html = renderProjectEvidence(result);
  assert.ok(html.includes('Phạm vi nguồn: TEST ONLY · Hà Nội, citywide sample'));
  assert.ok(html.includes('Q3 2026'));
});
