import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseStore } from './supabase-store.mjs';

test('Supabase server secrets use apikey only and requests expose no secret in URLs', async () => {
  const requests = [], key = 'sb_secret_TEST_NEVER_LOG';
  const store = new SupabaseStore({ url: 'https://test.supabase.co', secretKey: key, fetcher: async (url, options) => { requests.push({ url, options }); return new Response('[]'); } });
  await store.load('research', '11111111-1111-4111-8111-111111111111');
  assert.equal(requests[0].options.headers.apikey, key);
  assert.equal(requests[0].options.headers.Authorization, undefined);
  assert.ok(!requests[0].url.includes(key)); assert.ok(requests[0].url.includes('expires_at='));
});

test('Supabase errors never reflect private response bodies, credentials or remote diagnostics', async () => {
  const store = new SupabaseStore({ url: 'https://test.supabase.co', secretKey: 'sb_secret_TEST', fetcher: async () => new Response('PRIVATE SQL DETAILS', { status: 500 }) });
  await assert.rejects(store.researchRecords(), error => !error.message.includes('PRIVATE') && /Hãy thử lại/.test(error.message));
  assert.throws(() => new SupabaseStore({ url: 'http://public.test', secretKey: 'sb_secret_TEST' }));
  assert.throws(() => new SupabaseStore({ url: 'https://test.supabase.co', secretKey: 'sb_publishable_TEST' }));
});

test('hosted research serves daily candidates with current check dates instead of a static batch', async () => {
  const calls = [], stamp = new Date().toISOString(), expires = new Date(Date.now()+86400000).toISOString();
  const candidate = {
    id: 'candidate-'+'a'.repeat(24), source_id: 'otofun', source_key: 'otofun:1234:post-5678',
    source_url: 'https://www.otofun.net.vn/threads/test.1234/#post-5678', fingerprint: 'b'.repeat(64),
    checked_at: stamp, expires_at: expires,
    payload: { format: 'public-post', post_role: 'opening-ad', post_key: 'post-5678', queue: 'sale-candidates',
      flags: [], reasons: [], fields: { price_candidates: [{raw:'78 triệu',basis:'per_m2',uncertain:false}],
        area_candidates: [{raw:'68.68 m2'}], bedroom_candidates: [{raw:'2 phòng ngủ'}] },
      source_published_at:'2026-10-22', source_edited_at:null,
      text:'PRIVATE BODY', contacts:'PRIVATE CONTACT', publication_ready:false },
  };
  const store = new SupabaseStore({url:'https://test.supabase.co',secretKey:'sb_secret_TEST',fetcher:async url=>{
    calls.push(url); return Response.json(url.includes('/sale_candidates?') ? [candidate] : []);
  }});
  const leads=await store.researchRecords();
  assert.equal(leads.length,1);
  assert.equal(leads[0].collectedAt,stamp);
  assert.equal(leads[0].priceExpressions[0].basis,'per_m2');
  assert.equal(leads[0].priceVnd,null);
  assert.ok(!JSON.stringify(leads).includes('PRIVATE'));
  assert.ok(calls.some(url=>url.includes('/sale_candidates?')&&url.includes('expires_at=')));
});

test('successful PostgREST minimal insert responses may have an empty 201 body', async()=>{
  const store=new SupabaseStore({url:'https://test.supabase.co',secretKey:'sb_secret_TEST',fetcher:async()=>new Response(null,{status:201})});
  assert.equal(await store.request('sale_candidates',{method:'POST',body:[]}),null);
});
