import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SupabaseStore } from './supabase-store.mjs';
import { withSharedCatalogue } from './shared-catalogue.mjs';
import { Catalogue } from './catalogue.mjs';
import { setupCatalogue, approveCsv, csvFor } from './test-support/catalogue-fixture.mjs';

test('shared reviewed catalogue survives cold starts; CAS and withdrawal govern hosted real MCP', { skip: process.env.HOSTED_INTEGRATION_TEST !== '1', timeout: 45000 }, async t => {
  assert.ok(['127.0.0.1','localhost'].includes(new URL(process.env.SUPABASE_URL).hostname));
  const store = new SupabaseStore({ url: process.env.SUPABASE_URL, secretKey: process.env.SUPABASE_SECRET_KEY });
  const clients = [], children = [];
  t.after(async () => {
    await Promise.all(clients.map(c => c.close()));
    await Promise.all(children.map(async child => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const stopped = once(child, 'exit'); child.kill(); await stopped;
    }));
    await withSharedCatalogue(store, c => { const empty = new Catalogue(':memory:'); try { c.restore(empty.snapshot()); } finally { empty.close(); } }, { write: true });
  });
  const today = new Date().toISOString().slice(0,10);
  const dates = { priceConfirmedAt: today, availabilityConfirmedAt: today, sourceUpdatedAt: today };
  const ids = await withSharedCatalogue(store, c => {
    setupCatalogue(c);
    const first = approveCsv(c, dates);
    const second = approveCsv(c, { ...dates, supplierListingId: 'unit-b', areaM2: '75', priceVnd: '3900000000' });
    c.importCsv('test-owner', csvFor({ ...dates, supplierListingId: 'pending-offer' }));
    return [first,second];
  }, { write: true });
  const runId = await store.request('rpc/claim_daily_run', { method: 'POST', body: { p_run_key: 'local-integration' } });
  const candidate = {
    id: 'candidate-bbbbbbbbbbbbbbbbbbbbbbbb', source_id: 'otofun', source_key: 'otofun:1234:post-5678',
    source_url: 'https://www.otofun.net.vn/threads/test.1234/#post-5678', fingerprint: 'b'.repeat(64),
    payload: { format: 'public-post', publication_ready: false, fields: { price_vnd: null } },
    checked_at: new Date().toISOString(), expires_at: new Date(Date.now()+86400000).toISOString(),
  };
  await store.request('rpc/finish_daily_run', { method: 'POST', body: { p_run_id: runId, p_items: [candidate], p_outcome: 'completed', p_summary: {} } });
  await store.request('rpc/review_sale_candidate', { method: 'POST', body: {
    p_id: candidate.id, p_fingerprint: candidate.fingerprint, p_decision: 'keep', p_reviewer: 'test', p_note: 'Intake only',
  } });
  assert.equal((await withSharedCatalogue(store,c=>c.publicListings())).length, 2, 'kept candidate does not publish');
  const changedRun = await store.request('rpc/claim_daily_run', { method: 'POST', body: { p_run_key: 'changed-local-integration' } });
  await store.request('rpc/finish_daily_run', { method: 'POST', body: { p_run_id: changedRun, p_items: [{ ...candidate, fingerprint: 'c'.repeat(64) }], p_outcome: 'completed', p_summary: {} } });
  assert.equal((await store.request('candidate_observations?candidate_id=eq.'+candidate.id)).length,2);
  await assert.rejects(store.request('rpc/review_sale_candidate', { method: 'POST', body: {
    p_id: candidate.id, p_fingerprint: candidate.fingerprint, p_decision: 'keep', p_reviewer: 'test', p_note: 'Old version',
  } }));
  const stale = await store.request('rpc/load_catalogue', { method: 'POST', body: {} });
  await withSharedCatalogue(store, c => c.audit('test', 'test', 'operator', 'new version'), { write: true });
  assert.equal(await store.request('rpc/commit_catalogue', { method: 'POST', body: { p_expected_version: stale.version, p_tables: stale.tables } }), false);
  async function start() {
    const child = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, SESSION_BACKEND: 'supabase', INVENTORY_MODE: 'real', VERCEL: '1', RESEARCH_LINKS_ENABLED: '0', PORT: '0', HOST: '127.0.0.1' }, stdio: ['ignore','pipe','pipe'] }); children.push(child);
    const origin = await new Promise((resolve,reject) => {
      const timer = setTimeout(() => reject(new Error('Real hosted server did not start')),5000);
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Real hosted server exited')); });
      child.stdout.on('data', data => { const m = String(data).match(/http:\/\/localhost:(\d+)/); if(m){ clearTimeout(timer); resolve(`http://127.0.0.1:${m[1]}`); } });
    });
    const client = new Client({name:'shared-catalogue-test',version:'1'}); clients.push(client);
    await client.connect(new StreamableHTTPClientTransport(new URL(origin+'/mcp')));
    return async (name,args={}) => { const r=await client.callTool({name,arguments:args}); assert.ok(!r.isError,JSON.stringify(r)); return r.structuredContent; };
  }
  const a = await start(), b = await start();
  const shown = await a('show_property_explorer',{maxPriceVnd:4e9,minBedrooms:2});
  assert.deepEqual(shown.listings.map(x=>x.id).sort(),[...ids].sort());
  assert.ok(shown.listings.every(x=>!x.demo));
  assert.ok(!JSON.stringify(shown).includes('private-permission'));
  await a('set_selected_properties',{explorerSessionId:shown.explorerSessionId,ids});
  assert.deepEqual((await b('get_selected_properties',{explorerSessionId:shown.explorerSessionId})).selectedListingIds,ids);
  await withSharedCatalogue(store,c=>c.withdraw(ids[0],'operator','Supplier withdrawal'),{write:true});
  const context = await b('get_explorer_context',{explorerSessionId:shown.explorerSessionId});
  assert.deepEqual(context.selectedListingIds,[ids[1]]);
  assert.equal((await b('search_properties',{maxPriceVnd:4e9})).listings.length,1);
});
