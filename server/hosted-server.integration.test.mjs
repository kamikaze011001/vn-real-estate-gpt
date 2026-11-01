import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SupabaseStore } from './supabase-store.mjs';
import { ResearchLinks, fingerprint } from './research-links.mjs';
import { researchFixture } from './test-support/research-fixture.mjs';

test('real Supabase + independent Node instances preserve both explorers across cold starts', { skip: process.env.HOSTED_INTEGRATION_TEST !== '1', timeout: 45000 }, async t => {
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(process.env.SUPABASE_URL).hostname));
  const f = researchFixture(), store = new SupabaseStore({ url: process.env.SUPABASE_URL, secretKey: process.env.SUPABASE_SECRET_KEY });
  const leads = new ResearchLinks(f).localRecords();
  const rows = leads.map((lead,i) => ({
    id:'candidate-'+fingerprint(`otofun:${i+1}:post-${i+1}`).slice(0,24), source_id:'otofun', source_key:`otofun:${i+1}:post-${i+1}`,
    source_url:lead.sourceUrl, fingerprint:'d'.repeat(64), checked_at:new Date().toISOString(), expires_at:new Date(Date.now()+86400000).toISOString(),
    payload:{format:'public-post',post_role:'opening-ad',post_key:`post-${i+1}`,queue:'sale-candidates',flags:i===2?['source-ad-marked-expired-not-proof-of-sale']:[],
      fields:{price_candidates:lead.priceExpressions,area_candidates:lead.areaExpressions.map(raw=>({raw})),bedroom_candidates:lead.bedroomExpressions.map(raw=>({raw}))},
      source_published_at:lead.publishedAt,source_edited_at:lead.editedAt,publication_ready:false},
  }));
  const children = [], clients = new Set();
  async function stop(child) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const stopped = once(child, 'exit');
    const timer = setTimeout(() => child.kill('SIGKILL'), 1000);
    child.kill();
    try { await stopped; } finally { clearTimeout(timer); }
  }
  t.after(async () => {
    try { await Promise.all([...clients].map(client => client.close())); }
    finally { await Promise.all(children.map(stop)); await store.replaceResearch([]); await store.request('sale_candidates?id=in.('+rows.map(r=>r.id).join(',')+')',{method:'DELETE'}); f.cleanup(); }
  }, { timeout: 10000 });
  await store.replaceResearch(leads);
  await store.request('sale_candidates',{method:'POST',body:rows});
  async function start() {
    const child = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, SESSION_BACKEND: 'supabase', RESEARCH_LINKS_ENABLED: '1', INVENTORY_MODE: 'demo', PORT: '0', HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] }); children.push(child);
    const origin = await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Hosted test server did not start')), 5000); child.once('exit', () => { clearTimeout(timer); reject(new Error('Hosted test server exited')); }); child.stdout.on('data', data => { const match = String(data).match(/http:\/\/localhost:(\d+)/); if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); } }); });
    const client = new Client({ name: 'hosted-cross-instance', version: '1.0.0' }); clients.add(client);
    await client.connect(new StreamableHTTPClientTransport(new URL(origin + '/mcp')));
    return { origin, client, child, call: async (name, args = {}) => { const result = await client.callTool({ name, arguments: args }); assert.ok(!result.isError, `${name}: ${result.content?.[0]?.text}`); return result.structuredContent; } };
  }
  const a = await start(), b = await start();
  const explorer = await a.call('show_property_explorer', { maxPriceVnd: 4e9, minBedrooms: 2 });
  const ids = explorer.listings.slice(0, 2).map(x => x.id);
  await b.call('set_selected_properties', { explorerSessionId: explorer.explorerSessionId, ids, focusedListingId: ids[0] });
  assert.deepEqual((await a.call('get_selected_properties', { explorerSessionId: explorer.explorerSessionId })).selectedListingIds, ids);
  const research = await a.call('show_research_explorer'), selected = research.leads.slice(0, 2).map(x => x.id);
  await b.call('set_research_selection', { researchSessionId: research.researchSessionId, ids: selected, view: 'comparison' });
  await a.client.close();
  clients.delete(a.client); await stop(a.child);
  const cold = await start();
  assert.deepEqual((await cold.call('compare_research_leads', { researchSessionId: research.researchSessionId })).leads.map(x => x.id), selected);
  const context = await cold.call('get_explorer_context', { explorerSessionId: explorer.explorerSessionId });
  assert.equal(context.filters.maxPriceVnd, 4e9); assert.deepEqual(context.selectedListingIds, ids);
  const removed = rows.find(row => 'research-'+fingerprint(row.source_key).slice(0,20) === selected[0]);
  await store.request('sale_candidates?id=eq.'+removed.id,{method:'DELETE'});
  assert.deepEqual((await cold.call('get_research_context', { researchSessionId: research.researchSessionId })).selectedLeadIds, [selected[1]]);
  const response = await fetch(cold.origin + '/api/research/show', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
  const data = await response.json(); assert.equal(data.total, 2);
  assert.ok(!JSON.stringify(data).includes('PRIVATE BODY'));
  const live = await fetch(cold.origin+'/api/research/leads');
  assert.equal(live.headers.get('cache-control'),'no-store');
  const feed = await live.json();
  assert.equal(feed.total,2); assert.equal(feed.researchSessionId,undefined,'preview reads never create sessions');
  const current = rows.find(row => 'research-'+fingerprint(row.source_key).slice(0,20) === feed.leads[0].id);
  assert.equal(Date.parse(feed.leads[0].collectedAt),Date.parse(current.checked_at),'page reads daily dates, not old curated dates');
  assert.ok(!JSON.stringify(feed).includes('fingerprint'));
});
