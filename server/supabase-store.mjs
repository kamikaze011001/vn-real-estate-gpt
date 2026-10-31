import { z } from 'zod';
import { leadSchema } from './research-links.mjs';

const namespace = z.enum(['explorer', 'research']);
const uuid = z.string().uuid();
const failure = () => new Error('Không kết nối được kho dữ liệu. Hãy thử lại.');

export class SupabaseStore {
  constructor({ url, secretKey, fetcher = fetch }) {
    const parsed = new URL(url);
    if ((parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error('Invalid SUPABASE_URL');
    if (!secretKey || (!secretKey.startsWith('sb_secret_') && !secretKey.startsWith('eyJ'))) throw new Error('A server-only Supabase secret key is required');
    this.origin = parsed.origin; this.secretKey = secretKey; this.fetcher = fetcher;
  }
  async request(path, { method = 'GET', body } = {}) {
    const headers = { apikey: this.secretKey, 'Content-Type': 'application/json' };
    // Modern secret keys belong only in apikey; legacy service-role JWTs also
    // need Authorization for the local Supabase stack/older gateways.
    if (this.secretKey.startsWith('eyJ')) headers.Authorization = `Bearer ${this.secretKey}`;
    try {
      const response = await this.fetcher(`${this.origin}/rest/v1/${path}`, { method, headers, redirect: 'error', ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw failure();
      return response.status === 204 ? null : await response.json();
    } catch { throw failure(); }
  }
  async load(kind, id) {
    namespace.parse(kind); uuid.parse(id);
    const query = new URLSearchParams({ namespace: `eq.${kind}`, id: `eq.${id}`, expires_at: `gt.${new Date().toISOString()}`, select: 'state,version' });
    return (await this.request(`app_sessions?${query}`))[0] ?? null;
  }
  async commit(kind, id, expectedVersion, state) {
    namespace.parse(kind); uuid.parse(id);
    return await this.request('rpc/commit_app_session', { method: 'POST', body: {
      p_namespace: kind, p_id: id, p_expected_version: expectedVersion,
      p_state: state, p_expires_at: new Date(state.updatedAt + 3600000).toISOString(),
    } });
  }
  async researchRecords() {
    const query = new URLSearchParams({ expires_at: `gt.${new Date().toISOString()}`, select: 'payload', order: 'position.asc', limit: '50' });
    const rows = await this.request(`research_sources?${query}`);
    const leads = rows.map(row => leadSchema.parse(row.payload));
    // Recheck the payload lease too, even if a table expiry was set incorrectly.
    return leads.filter(lead => Date.parse(lead.expiresAt) > Date.now());
  }
  async replaceResearch(leads) {
    const safe = z.array(leadSchema).max(50).parse(leads);
    return this.request('rpc/replace_research_sources', { method: 'POST', body: { p_leads: safe } });
  }
}
