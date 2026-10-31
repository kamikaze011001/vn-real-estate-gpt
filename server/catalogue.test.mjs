import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Catalogue } from './catalogue.mjs';
import { parseCsv } from './listing-import.mjs';
import { setupCatalogue, csvFor, approveCsv, permittedSource, testDay } from './test-support/catalogue-fixture.mjs';

function fixture(t) {
  let now = Date.parse(`${testDay}T12:00:00Z`);
  const catalogue = new Catalogue(':memory:', { now: () => now });
  t.after(() => catalogue.close());
  setupCatalogue(catalogue);
  return { catalogue, advance: days => { now += days * 86400000; } };
}
test('import is staged, retry-safe, and publishes only a reviewed public projection', t => {
  const { catalogue } = fixture(t);
  const first = catalogue.importCsv('test-owner', csvFor({ description: 'Quoted, text\nwith "details"' }));
  assert.equal(catalogue.publicListings().length, 0);
  const retry = catalogue.importCsv('test-owner', csvFor({ description: 'Quoted, text\nwith "details"' }));
  assert.equal(retry.runId, first.runId);
  assert.equal(retry.reused, true);
  const { id } = catalogue.approve(first.items[0].id, 'reviewer', 'Checked original submission');
  const [record] = catalogue.publicListings();
  assert.equal(record.id, id);
  assert.equal(record.demo, false);
  assert.equal(record.description, 'Quoted, text\nwith "details"');
  assert.equal(record.lat, null);
  assert.equal(record.availability, 'available');
  assert.equal(record.priceStatus, 'confirmed');
  assert.equal(JSON.stringify(record).includes('private-'), false);
  assert.throws(() => catalogue.approve(first.items[0].id, 'reviewer', 'Retry'), /already decided/);
  assert.equal(catalogue.history(id).observations.length, 1);
});
test('pending, expired, revoked and forum permissions fail closed', t => {
  const { catalogue } = fixture(t);
  catalogue.putSource({ ...permittedSource, permission: 'pending' }, 'test');
  const pending = catalogue.importCsv('test-owner', csvFor()).items[0];
  assert.ok(pending.errors.some(error => error.includes('permission')));
  assert.throws(() => catalogue.approve(pending.id, 'reviewer', 'No grant yet'), /permission/);
  catalogue.putSource(permittedSource, 'test');
  // Corrected registry evidence is checked at decision time, without duplicating the import.
  const { id } = catalogue.approve(pending.id, 'reviewer', 'Grant independently checked');
  catalogue.putSource({ ...permittedSource, permission: 'revoked' }, 'test');
  assert.equal(catalogue.publicListings().length, 0);
  catalogue.putSource(permittedSource, 'test');
  assert.equal(catalogue.publicListings().length, 0, 'Restoring a grant does not silently republish');
  const changed = catalogue.importCsv('test-owner', csvFor({ title: 'TEST ONLY · New revision' })).items[0];
  catalogue.putSource({ ...permittedSource, permissionExpiresAt: '2026-10-24' }, 'test');
  assert.throws(() => catalogue.approve(changed.id, 'reviewer', 'Expired'), /expired/);
  catalogue.putSource({ ...permittedSource, kind: 'forum' }, 'test');
  assert.throws(() => catalogue.approve(changed.id, 'reviewer', 'Forum offer'), /cannot publish/);
  assert.equal(catalogue.history(id).observations.length, 1);
});
test('ambiguous prices, invalid dates, missing evidence and rent never pass review', t => {
  const { catalogue } = fixture(t);
  for (const changes of [
    { priceVnd: '7đ' }, { priceVnd: '7' }, { priceVnd: '3.6 tỷ' },
    { sourceUpdatedAt: '2026-02-30' }, { sourceUpdatedAt: '2099-01-01' },
    { transaction: 'rent' }, { buildingId: 'unknown' },
    { availabilityConfirmedAt: '' }, { priceConfirmedAt: '' },
  ]) {
    const item = catalogue.importCsv('test-owner', csvFor(changes)).items[0];
    assert.ok(item.errors.length, JSON.stringify(changes));
    assert.throws(() => catalogue.approve(item.id, 'reviewer', 'Must be blocked'), JSON.stringify(changes));
  }
  assert.equal(catalogue.publicListings().length, 0);
});
test('unknown values remain unknown and confirmations expire without changing history', t => {
  const { catalogue, advance } = fixture(t);
  const id = approveCsv(catalogue);
  advance(8);
  const [record] = catalogue.publicListings();
  assert.equal(record.availability, 'unknown');
  assert.equal(record.priceStatus, 'stale');
  assert.equal(record.availabilityConfirmedAt, testDay);
  assert.equal(catalogue.history(id).observations[0].data.availability, 'available');
  const second = approveCsv(catalogue, { supplierListingId: 'unknown-values', priceVnd: '', priceOriginal: '', priceConfirmedAt: '', areaM2: '', areaBasis: 'unknown', bedrooms: '', availability: 'unknown', availabilityConfirmedAt: '' });
  const unknown = catalogue.publicListings().find(record => record.id === second);
  assert.equal(unknown.priceVnd, null);
  assert.equal(unknown.areaM2, null);
  assert.equal(unknown.bedrooms, null);
});
test('updates preserve stable identity and observations; older snapshots cannot roll back dates', t => {
  const { catalogue } = fixture(t);
  const id = approveCsv(catalogue, { priceVnd: '3500000000', priceOriginal: '3500000000 VND', sourceUpdatedAt: '2026-10-24', priceConfirmedAt: '2026-10-24', availabilityConfirmedAt: '2026-10-24' });
  assert.equal(approveCsv(catalogue), id);
  assert.deepEqual(catalogue.history(id).observations.map(row => row.data.priceVnd), [3500000000, 3600000000]);
  const stale = catalogue.importCsv('test-owner', csvFor({ title: 'TEST ONLY · Older', sourceUpdatedAt: '2026-10-23' })).items[0];
  assert.throws(() => catalogue.approve(stale.id, 'reviewer', 'Older snapshot'), /roll back/);
  assert.equal(catalogue.publicListings()[0].priceVnd, 3600000000);
});
test('similar units require a duplicate decision, and repeated IDs in one CSV are rejected', t => {
  const { catalogue } = fixture(t);
  const first = approveCsv(catalogue);
  const item = catalogue.importCsv('test-owner', csvFor({ supplierListingId: 'unit-b' })).items[0];
  assert.throws(() => catalogue.approve(item.id, 'reviewer', 'Check duplicate'), /potential duplicates/);
  const second = catalogue.approve(item.id, 'reviewer', 'Different units confirmed from original supplier', { acknowledgeDuplicates: true });
  assert.notEqual(second.id, first);
  assert.deepEqual(second.duplicateCandidates, [first]);
  const csv = csvFor({ supplierListingId: 'unit-c' });
  const duplicated = catalogue.importCsv('test-owner', csv + csv.split('\n')[1] + '\n');
  assert.ok(duplicated.items.every(item => item.errors.some(error => error.includes('Duplicate supplierListingId'))));
  assert.throws(() => catalogue.approve(duplicated.items[0].id, 'reviewer', 'Blocked'), /duplicate IDs/);
});
test('withdrawals suppress pending versions, and registry changes require another review', t => {
  const { catalogue } = fixture(t);
  const id = approveCsv(catalogue);
  const pending = catalogue.importCsv('test-owner', csvFor({ title: 'TEST ONLY · Pending edit' })).items[0];
  catalogue.withdraw(id, 'operator', 'Seller withdrew');
  assert.equal(catalogue.publicListings().length, 0);
  assert.throws(() => catalogue.approve(pending.id, 'reviewer', 'Stale queued edit'), /already decided/);
  assert.equal(catalogue.history(id).events.at(-1).action, 'offer-withdrawn');
  approveCsv(catalogue, { title: 'TEST ONLY · Explicit new offer' });
  catalogue.putProject({ id: 'test-project', name: 'TEST ONLY · Renamed project', district: 'Tây Hồ' }, 'operator');
  assert.equal(catalogue.publicListings().length, 0);
});
test('file persistence survives restart and an empty store contains no fixture inventory', t => {
  const dir = mkdtempSync(join(tmpdir(), 'hanoi-catalogue-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'catalogue.sqlite');
  let catalogue = new Catalogue(path, { now: () => Date.parse(`${testDay}T12:00:00Z`) });
  assert.deepEqual(catalogue.publicListings(), []);
  setupCatalogue(catalogue); const id = approveCsv(catalogue); catalogue.close();
  catalogue = new Catalogue(path, { now: () => Date.parse(`${testDay}T12:00:00Z`) });
  assert.equal(catalogue.publicListings()[0].id, id);
  assert.equal(catalogue.history(id).observations.length, 1);
  catalogue.close();
});
test('CSV structure rejects silent column loss or malformed quotes', () => {
  assert.throws(() => parseCsv('title,title\na,b\n'), /columns/);
  assert.throws(() => parseCsv(csvFor().replace('"unit-a"', '"unit-a"junk')), /Malformed/);
  assert.throws(() => parseCsv(csvFor().replace('"unit-a"', '"unit-a')), /Malformed|Unclosed/);
});
