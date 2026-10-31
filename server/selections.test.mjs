import test from 'node:test';
import assert from 'node:assert/strict';
import { newExplorerSession, readSelection, writeSelection, resolveFilters } from './selections.mjs';

test('a model reads the exact UI selections from the same explorer session', () => {
  const id = newExplorerSession();
  writeSelection(id, ['demo-05', 'demo-03']);
  assert.deepEqual(readSelection(id).selectedListingIds, ['demo-05', 'demo-03']);
  writeSelection(id, []);
  assert.deepEqual(readSelection(id).selectedListingIds, []);
});

test('focused property and UI-edited requirements reach the model without replacing comparison selection', () => {
  const id = newExplorerSession();
  writeSelection(id, ['demo-05', 'demo-03'], {
    focusedListingId: 'demo-01', filters: { maxPriceVnd: 4e9, minBedrooms: 2, query: 'Cầu Giấy' },
    savedListingIds: ['demo-08'], view: 'details',
  });
  const context = readSelection(id);
  assert.equal(context.focusedListingId, 'demo-01');
  assert.deepEqual(context.selectedListingIds, ['demo-05', 'demo-03']);
  assert.deepEqual(context.savedListingIds, ['demo-08']);
  assert.equal(context.filters.maxPriceVnd, 4e9);
  writeSelection(id, context.selectedListingIds, { focusedListingId: null, view: 'comparison' });
  assert.equal(readSelection(id).focusedListingId, null);
  assert.equal(readSelection(id).filters.query, 'Cầu Giấy');
});

test('chat refinements retain applied requirements and clear only explicitly removed fields', () => {
  const id = newExplorerSession();
  writeSelection(id, [], { filters: { maxPriceVnd: 4e9, minBedrooms: 2, query: 'Tây Hồ' } });
  assert.deepEqual(resolveFilters(id, { district: 'Cầu Giấy' }, ['query']), { maxPriceVnd: 4e9, minBedrooms: 2, district: 'Cầu Giấy' });
  assert.equal(readSelection(id).filters.query, 'Tây Hồ');
  assert.deepEqual(resolveFilters(newExplorerSession(), {}), {});
});

test('invalid focused or saved IDs cannot corrupt another session or overwrite its context', () => {
  const first = newExplorerSession();
  const second = newExplorerSession();
  writeSelection(first, [], { focusedListingId: 'demo-01', view: 'details' });
  assert.equal(readSelection(second).focusedListingId, null);
  assert.throws(() => writeSelection(first, ['demo-05'], { focusedListingId: 'invented' }));
  assert.throws(() => writeSelection(first, [], { savedListingIds: ['invented'] }));
  assert.equal(readSelection(first).focusedListingId, 'demo-01');
  assert.deepEqual(readSelection(first).selectedListingIds, []);
});

test('passive context reads leave the revision unchanged after another explorer updates filters', () => {
  const id = newExplorerSession();
  writeSelection(id, ['demo-05'], { filters: { maxPriceVnd: 4e9, minBedrooms: 2 } });
  const before = readSelection(id).revision;
  writeSelection(id, ['demo-05'], { filters: { maxPriceVnd: 3e9, minBedrooms: 2, district: 'Cầu Giấy' } });
  const current = readSelection(id);
  assert.ok(current.revision > before);
  assert.deepEqual(resolveFilters(id), current.filters);
  assert.equal(readSelection(id).revision, current.revision);
});
test('selections cannot leak between explorer sessions or accept invented IDs', () => {
  const first = newExplorerSession();
  const second = newExplorerSession();
  writeSelection(first, ['demo-01', 'demo-08']);
  assert.deepEqual(readSelection(second).selectedListingIds, []);
  assert.throws(() => writeSelection(second, ['missing']));
  assert.throws(() => writeSelection(second, ['demo-01', 'demo-01']));
  assert.throws(() => readSelection('missing-session'));
});
