import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Catalogue } from './catalogue.mjs';
import { setupCatalogue, approveCsv, csvFor, permittedSource } from './test-support/catalogue-fixture.mjs';
import { ProjectEvidence } from './project-evidence.mjs';
import { forumSource, officialSource, evidenceRecord } from './test-support/evidence-fixture.mjs';

test('real-mode HTTP/MCP use only approved records, follow updates and remove withdrawn selections', { timeout: 20000 }, async t => {
  const dir = mkdtempSync(join(tmpdir(), 'hanoi-integration-'));
  const path = join(dir, 'catalogue.sqlite');
  const catalogue = new Catalogue(path);
  setupCatalogue(catalogue);
  const child = spawn(process.execPath, ['server/index.mjs'], {
    env: { ...process.env, INVENTORY_MODE: 'real', CATALOGUE_DB: path, PORT: '0', HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stderr.on('data', data => { logs += data; });
  const client = new Client({ name: 'catalogue-test', version: '1.0.0' });
  t.after(async () => {
    await client.close();
    if (child.exitCode == null) { const stopped = once(child, 'exit'); child.kill(); await stopped; }
    catalogue.close(); rmSync(dir, { recursive: true, force: true });
  });
  const origin = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server did not start: ${logs}`)), 8000);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${logs}`)); });
    child.stdout.on('data', data => { const match = String(data).match(/http:\/\/localhost:(\d+)/); if (match) { clearTimeout(timer); resolve(`http://localhost:${match[1]}`); } });
  });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`)));
  const call = async (name, args = {}) => {
    const reply = await client.callTool({ name, arguments: args });
    if (reply.isError) throw new Error(reply.content?.[0]?.text || 'Tool failed');
    return reply.structuredContent;
  };
  const empty = await call('search_properties');
  assert.equal(empty.demo, false); assert.equal(empty.total, 0);
  assert.equal((await fetch(`${origin}/health`).then(response => response.json())).mode, 'real');
  const tools = await client.listTools();
  assert.equal(tools.tools.some(tool => /import|approve|withdraw|registry/.test(tool.name)), false);
  assert.ok(tools.tools.find(tool => tool.name === 'search_properties').description.includes('approved'));
  assert.equal((await fetch(`${origin}/private-data/catalogue.sqlite`)).status, 404);
  const today = new Date().toISOString().slice(0, 10);
  const dates = { priceConfirmedAt: today, availabilityConfirmedAt: today, sourceUpdatedAt: today };
  const first = approveCsv(catalogue, dates);
  const second = approveCsv(catalogue, { ...dates, supplierListingId: 'unit-b', areaM2: '80', priceVnd: '3900000000', priceOriginal: '3900000000 VND' });
  const gross = approveCsv(catalogue, { ...dates, supplierListingId: 'unit-gross', areaM2: '81', areaBasis: 'gross' });
  assert.equal((await call('search_properties', { minAreaM2: 70 })).listings.some(record => record.id === gross), false);
  const search = await call('show_property_explorer', { maxPriceVnd: 4e9, minBedrooms: 2, minAreaM2: 70 });
  assert.deepEqual(new Set(search.listings.map(record => record.id)), new Set([first, second]));
  assert.equal(JSON.stringify(search).includes('private-updater'), false);
  const session = search.explorerSessionId;
  await call('set_selected_properties', { explorerSessionId: session, ids: [first, second], focusedListingId: first, view: 'details' });
  const before = await call('get_explorer_context', { explorerSessionId: session });
  assert.equal(before.focusedListing.id, first);
  assert.deepEqual(before.selectedListingIds, [first, second]);
  assert.equal((await call('compare_properties', { ids: before.selectedListingIds })).highlights.priceSpreadVnd, 300e6);
  catalogue.putSource(forumSource, 'operator'); catalogue.putSource(officialSource, 'operator');
  const projectEvidence = new ProjectEvidence(catalogue);
  const forumItem = projectEvidence.stage(evidenceRecord(today), 'operator').item;
  const forumId = projectEvidence.approve(forumItem.id, 'reviewer', 'Synthetic source and scope checked').id;
  const officialItem = projectEvidence.stage(evidenceRecord(today, {
    sourceId: officialSource.id, sourceRecordId: 'official-report', kind: 'official', verification: 'documented',
    sourceUrl: 'https://authority.example.test/report', sourceLocator: 'Page 2', buildingId: null,
  }), 'operator').item;
  projectEvidence.approve(officialItem.id, 'reviewer', 'Synthetic official context');
  const contextWithEvidence = await call('get_explorer_context', { explorerSessionId: session });
  assert.ok(contextWithEvidence.revision > before.revision, 'Evidence changes refresh active explorers');
  const returnedEvidence = await call('get_project_evidence', { listingId: first });
  assert.equal(returnedEvidence.community[0].id, forumId);
  assert.equal(returnedEvidence.official[0].verification, 'documented');
  assert.equal(returnedEvidence.community[0].verification, 'unverified');
  assert.equal(returnedEvidence.buildingId, 'test-building');
  assert.equal(JSON.stringify(returnedEvidence).includes('private-item'), false);
  assert.deepEqual(contextWithEvidence.evidenceByListingId[first], returnedEvidence);
  const detail = await call('get_property', { id: first });
  assert.deepEqual(detail.evidence, returnedEvidence);
  const comparison = await call('compare_properties', { ids: [first, second] });
  assert.equal(comparison.evidenceByListingId[second].community.length, 1);
  const evidenceTool = tools.tools.find(tool => tool.name === 'get_project_evidence');
  assert.equal(evidenceTool.annotations.readOnlyHint, true);
  assert.ok(evidenceTool.outputSchema.properties.community);
  projectEvidence.withdraw(forumId, 'operator', 'Synthetic source removed');
  assert.equal((await call('get_project_evidence', { listingId: first })).community.length, 0);
  const updated = catalogue.importCsv('test-owner', csvFor({ ...dates, priceVnd: '3700000000', priceOriginal: '3700000000 VND' })).items[0];
  catalogue.approve(updated.id, 'reviewer', 'New asking price confirmed');
  const after = await call('get_explorer_context', { explorerSessionId: session });
  assert.ok(after.revision > before.revision);
  assert.equal(after.focusedListing.priceVnd, 3700000000);
  catalogue.withdraw(first, 'operator', 'Withdraw fixture');
  const withdrawn = await call('get_explorer_context', { explorerSessionId: session });
  assert.equal(withdrawn.focusedListing, null);
  assert.deepEqual(withdrawn.selectedListingIds, [second]);
  await assert.rejects(call('get_property', { id: first }), /Không tìm thấy/);
  const local = await fetch(`${origin}/api/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ explorerSessionId: session }) }).then(response => response.json());
  assert.deepEqual(local.listings.map(record => record.id), [second]);
  assert.equal(local.filters.maxPriceVnd, 4e9);
  await assert.rejects(call('get_project_evidence', { listingId: first }), /Không tìm thấy/);
  const resources = await client.readResource({ uri: 'ui://hanoi-home/explorer-v12.html' });
  assert.ok(resources.contents[0].mimeType.includes('mcp-app'));
  catalogue.putSource({ ...permittedSource, permission: 'revoked' }, 'operator');
  assert.equal((await call('search_properties')).total, 0);
  assert.equal((await call('get_explorer_context', { explorerSessionId: session })).selectedListingIds.length, 0);
});
