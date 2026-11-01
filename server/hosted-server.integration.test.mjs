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
  const research = await a.call('show_research_explorer',{scope:'all'}), selected = research.leads.slice(0, 2).map(x => x.id);
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
  const response = await fetch(cold.origin + '/api/research/show', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({scope:'all'}) });
  const data = await response.json(); assert.equal(data.total, 2);
  assert.ok(!JSON.stringify(data).includes('PRIVATE BODY'));
  const live = await fetch(cold.origin+'/api/research/leads');
  assert.equal(live.headers.get('cache-control'),'no-store');
  const feed = await live.json();
  assert.equal(feed.total,0); assert.equal(feed.counts.collected,2); assert.equal(feed.researchSessionId,undefined,'preview reads never create sessions');
  assert.equal(feed.counts.usableGroups,0,'unresolved test records are not usable supply');
  assert.ok(!JSON.stringify(feed).includes('fingerprint'));
  const eligible=rows.find(row=>row.id!==removed.id&&!row.payload.flags.length);
  await store.request('rpc/assess_sale_candidate',{method:'POST',body:{p_id:eligible.id,p_fingerprint:eligible.fingerprint,p_decision:'usable',
    p_facts:{projectId:'test-project',projectLabel:'TEST ONLY Hanoi Project',hanoi:true,completedResale:true,totalAskingPriceVnd:4e9,areaM2:72,sourcePublishedAt:new Date().toISOString().slice(0,10)},
    p_duplicate_group:null,p_duplicate_status:'distinct',p_reviewer:'PRIVATE REVIEWER',p_evidence_ref:'PRIVATE EVIDENCE',p_review_seconds:60}});
  const usable=await fetch(cold.origin+'/api/research/leads').then(r=>r.json());
  assert.equal(usable.total,1);assert.equal(usable.counts.usableGroups,1);assert.equal(usable.counts.projects,1);
  assert.equal(usable.leads[0].quality.advertisedPriceVnd,4e9);assert.equal(usable.leads[0].priceVnd,null);
  assert.ok(!JSON.stringify(usable).includes('PRIVATE'));
  await store.request('sale_candidates?id=eq.'+eligible.id,{method:'PATCH',body:{fingerprint:'e'.repeat(64)}});
  const revised=await fetch(cold.origin+'/api/research/leads').then(r=>r.json());
  assert.equal(revised.total,0,'new source revision cannot inherit an old usable assessment');

  const portal={...eligible,id:'candidate-'+'f'.repeat(24),source_id:'alonhadat',source_key:'alonhadat:12345678:ad-12345678',
    source_url:'https://alonhadat.com.vn/test-only-12345678.html',fingerprint:'f'.repeat(64),
    payload:{...eligible.payload,format:'public-ad',post_key:'ad-12345678',source_published_at:null,source_edited_at:null,
      projects:[{label:'TEST ONLY Source Project'}],fields:{...eligible.payload.fields,displayed_date:new Date().toISOString().slice(0,10),area_label:'Cầu Giấy'},flags:['source-date-semantics-unresolved']}};
  rows.push(portal);
  await store.request('sale_candidates',{method:'POST',body:portal});
  const portalFeed=await fetch(cold.origin+'/api/research/leads?scope=research').then(r=>r.json());
  const portalLead=portalFeed.leads.find(x=>x.source==='ALONHADAT');
  assert.ok(portalLead);assert.equal(portalLead.publishedAt,null);assert.ok(portalLead.displayedAt);
  assert.equal(portalLead.quality.state,'needs-context','displayed source date never proves freshness');
  assert.equal(portalFeed.counts.usableGroups,0);
  const mixed=await cold.call('show_research_explorer',{scope:'all'});
  const mixedIds=[portalLead.id,mixed.leads.find(x=>x.source==='OTOFUN').id];
  await b.call('set_research_selection',{researchSessionId:mixed.researchSessionId,ids:mixedIds});
  assert.deepEqual((await cold.call('compare_research_leads',{researchSessionId:mixed.researchSessionId})).leads.map(x=>x.id),mixedIds);

  const rongbay={...portal,id:'candidate-'+'9'.repeat(24),source_id:'rongbay',source_key:'rongbay:34423215:ad-34423215',source_url:'https://rongbay.com/Ha-Noi/Test-only-c15-raovat-34423215.html',
    payload:{...portal.payload,post_key:'ad-34423215'}};
  rows.push(rongbay);await store.request('sale_candidates',{method:'POST',body:rongbay});
  const rongFeed=await fetch(cold.origin+'/api/research/leads?scope=research&query=rongbay').then(r=>r.json());
  assert.equal(rongFeed.total,1);assert.equal(rongFeed.leads[0].source,'RONGBAY');assert.equal(rongFeed.leads[0].publishedAt,null);
  assert.equal(rongFeed.leads[0].quality.state,'needs-context');assert.equal(rongFeed.counts.usableGroups,0);
  const three=[...mixedIds,rongFeed.leads[0].id];
  await b.call('set_research_selection',{researchSessionId:mixed.researchSessionId,ids:three});
  assert.deepEqual((await cold.call('compare_research_leads',{researchSessionId:mixed.researchSessionId})).leads.map(x=>x.id),three);

});
