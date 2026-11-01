import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const base = new URL(process.argv[2] || process.env.APP_BASE_URL);
if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password) throw new Error('Provide the deployment base URL');
const headers = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET } : {};
const response = await fetch(new URL('/health', base), { headers, signal: AbortSignal.timeout(15000) });
assert.equal(response.status, 200, 'deployment health must be publicly reachable');
const health = await response.json();
assert.equal(health.ok, true);
if (process.env.EXPECT_HOSTED === '1') assert.equal(health.sessionBackend, 'supabase');
const client = new Client({ name: 'deployment-smoke', version: '1.0.0' });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL('/mcp', base), { requestInit: { headers } }));
  const identity = client.getServerVersion();
  assert.equal(identity.title, 'Nhà Hà Nội');
  assert.equal(identity.websiteUrl, 'https://vn-real-estate-gpt.vercel.app/');
  const landing = await fetch(new URL('/', base), { headers }).then(r => { assert.equal(r.status, 200); return r.text(); });
  assert.ok(landing.includes('id="cach-dung"'), 'public website must serve the user guide');
  assert.ok(landing.includes('id="live-cards"'), 'public website must include the collected-source preview');
  const icon = await fetch(new URL(new URL(identity.icons[0].src).pathname, base), { headers });
  assert.equal(icon.status, 200);
  assert.ok(icon.headers.get('content-type').includes('image/png'));
  const demo = await fetch(new URL('/demo', base), { headers }).then(r => { assert.equal(r.status, 200); return r.text(); });
  assert.ok(demo.includes('id="result-count"'), 'standalone explorer stays available at /demo');
  const call = async (name, args = {}) => {
    const result = await client.callTool({ name, arguments: args });
    assert.ok(!result.isError, `${name} failed`); return result.structuredContent;
  };
  const tools = (await client.listTools()).tools;
  for (const name of ['search_properties', 'show_property_explorer', 'get_explorer_context']) assert.ok(tools.some(x => x.name === name));
  const explorer = await call('show_property_explorer', { maxPriceVnd: 4e9, minBedrooms: 2 });
  const ids = explorer.listings.slice(0, 2).map(x => x.id);
  assert.equal(ids.length, 2, 'demo smoke fixture must contain two matches');
  await call('set_selected_properties', { explorerSessionId: explorer.explorerSessionId, ids });
  assert.deepEqual((await call('get_selected_properties', { explorerSessionId: explorer.explorerSessionId })).selectedListingIds, ids);
  assert.deepEqual((await call('compare_properties', { ids })).listings.map(x => x.id), ids);
  const ui = await client.readResource({ uri: 'ui://hanoi-home/explorer-v12.html' });
  assert.ok(ui.contents[0].text.includes('text/html') || ui.contents[0].mimeType.includes('mcp-app'));
  let sources = null;
  if (health.researchLinksEnabled) {
    const publicFeed = await fetch(new URL('/api/research/leads', base), { headers });
    assert.equal(publicFeed.status, 200);
    assert.equal(publicFeed.headers.get('cache-control'), 'no-store');
    const feed = await publicFeed.json();
    assert.equal(feed.researchOnly, true);
    assert.equal(feed.researchSessionId, undefined, 'preview reads must not create sessions');
    assert.ok(feed.leads.every(lead => lead.inventoryEligible === false && lead.priceVnd === null));
    const research = await call('show_research_explorer',{scope:'all'}); sources = research.total;
    if (sources >= 2) {
      const selected = research.leads.slice(0, 2).map(x => x.id);
      await call('set_research_selection', { researchSessionId: research.researchSessionId, ids: selected });
      assert.deepEqual((await call('compare_research_leads', { researchSessionId: research.researchSessionId })).leads.map(x => x.id), selected);
    }
    await client.readResource({ uri: 'ui://hanoi-home/research-v3.html' });
  }
  console.log(JSON.stringify({ ok: true, origin: base.origin, sessionBackend: health.sessionBackend, sources, selectionComparison: 'passed' }));
} finally { await client.close(); }
