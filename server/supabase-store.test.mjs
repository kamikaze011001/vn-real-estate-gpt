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
