import test from 'node:test';
import assert from 'node:assert/strict';
import { searchProperties, compareProperties, comparisonHighlights, inventory } from './properties.mjs';

test('hard requirements exclude missing values and do not expand to near-matches', () => {
  const result = searchProperties({ maxPriceVnd: 4e9, minBedrooms: 2, minAreaM2: 65 });
  assert.ok(result.listings.length > 0);
  assert.ok(result.listings.every(p => p.priceVnd != null && p.priceVnd <= 4e9 && p.bedrooms >= 2 && p.areaM2 >= 65));
  assert.equal(result.listings.some(p => p.id === 'demo-09'), false);
  assert.equal(searchProperties({ maxPriceVnd: 1e9, minBedrooms: 3 }).total, 0);
});

test('comparison highlights expose exact price and net-area differences', () => {
  const { highlights } = compareProperties(['demo-05', 'demo-03']);
  assert.equal(highlights.priceSpreadVnd, 400e6);
  assert.equal(highlights.areaSpreadM2, 3);
  assert.deepEqual(highlights.lowestPriceIds, ['demo-05']);
  assert.deepEqual(highlights.largestAreaIds, ['demo-03']);
});

test('missing evidence cannot produce a cheapest or largest-home claim', () => {
  const { highlights } = compareProperties(['demo-01', 'demo-09']);
  assert.equal(highlights.priceSpreadVnd, null);
  assert.equal(highlights.areaSpreadM2, null);
  assert.deepEqual(highlights.lowestPriceIds, []);
  assert.deepEqual(highlights.largestAreaIds, []);
  assert.deepEqual(highlights.missingPriceIds, ['demo-09']);
});

test('comparison highlights preserve ties and reject incompatible area bases', () => {
  const records = [
    { id: 'a', priceVnd: 3e9, areaM2: 70, areaBasis: 'net' },
    { id: 'b', priceVnd: 3e9, areaM2: 70, areaBasis: 'net' },
  ];
  const tied = comparisonHighlights(records);
  assert.equal(tied.priceSpreadVnd, 0);
  assert.deepEqual(tied.lowestPriceIds, ['a', 'b']);
  assert.deepEqual(tied.largestAreaIds, ['a', 'b']);
  const mixed = comparisonHighlights([records[0], { ...records[1], areaBasis: 'gross' }]);
  assert.equal(mixed.areaComparable, false);
  assert.equal(mixed.areaSpreadM2, null);
});
test('Vietnamese area searches work without diacritics', () => {
  assert.deepEqual(searchProperties({ query: 'cau giay' }).listings.map(p => p.id), ['demo-01', 'demo-07']);
});
test('unavailable and out-of-scope properties leave active results', () => {
  const records = [
    { ...inventory[0], availability: 'unavailable' },
    { ...inventory[1], completed: false },
    { ...inventory[2], transaction: 'rent' },
  ];
  assert.equal(searchProperties({}, records).total, 0);
});
test('comparison preserves unknowns and rejects unknown or duplicate IDs', () => {
  const result = compareProperties(['demo-01', 'demo-09']);
  assert.equal(result.pricePerM2.find(p => p.id === 'demo-09').value, null);
  assert.equal(result.listings[1].priceVnd, null);
  assert.throws(() => compareProperties(['demo-01', 'missing']));
  assert.throws(() => compareProperties(['demo-01', 'demo-01']));
});
