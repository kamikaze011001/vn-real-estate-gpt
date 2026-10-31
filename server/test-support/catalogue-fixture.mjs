import { csvColumns } from '../listing-import.mjs';

export const testDay = '2026-10-25';
export const permittedSource = {
  id: 'test-owner', name: 'TEST ONLY · Authorized fixture supplier', kind: 'direct',
  permission: 'granted', allowedUses: ['listing-display'], accessMethod: 'manual-submission',
  permissionReference: 'private-permission-test', updaterReference: 'private-updater-test',
};
export function setupCatalogue(catalogue) {
  catalogue.putSource(permittedSource, 'test');
  catalogue.putProject({ id: 'test-project', name: 'TEST ONLY · Project', district: 'Cầu Giấy' }, 'test');
  catalogue.putBuilding({ id: 'test-building', projectId: 'test-project', name: 'TEST ONLY · Building', address: 'TEST ONLY', completed: true, completionReference: 'private-completion-test' }, 'test');
}
export function csvFor(changes = {}) {
  const record = {
    supplierListingId: 'unit-a', buildingId: 'test-building', title: 'TEST ONLY · Fixture home',
    description: 'Synthetic test record, never pilot inventory.', transaction: 'resale', priceVnd: '3600000000',
    priceOriginal: '3600000000 VND', priceConfirmedAt: testDay, areaM2: '72', areaBasis: 'net',
    bedrooms: '2', direction: '', availability: 'available', availabilityConfirmedAt: testDay,
    sourceUpdatedAt: testDay, sourceUrl: '', ...changes,
  };
  const cell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return `${csvColumns.join(',')}\n${csvColumns.map(key => cell(record[key])).join(',')}\n`;
}
export function approveCsv(catalogue, changes = {}, options) {
  const { items } = catalogue.importCsv('test-owner', csvFor(changes));
  return catalogue.approve(items[0].id, 'test-reviewer', 'Synthetic fixture checked', options).id;
}
