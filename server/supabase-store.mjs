import { z } from 'zod';
import { leadSchema } from './research-links.mjs';
import { applySupplyPolicy } from './supply-quality.mjs';
import { fingerprint } from './research-links.mjs';
import { candidateResearch } from './candidate-research.mjs';

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
      const text = await response.text();
      return text ? JSON.parse(text) : null;
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
  async researchRecords() { return (await this.researchSnapshot()).records; }
  async researchSnapshot() {
    const clock = Date.now(), current = `gt.${new Date(clock).toISOString()}`;
    const [rows, names] = await Promise.all([
      this.request(`sale_candidates?${new URLSearchParams({ expires_at:current, select:'id,source_id,source_key,source_url,fingerprint,payload,checked_at,expires_at', order:'checked_at.desc,id.asc', limit:'500' })}`),
      this.request(`research_sources?${new URLSearchParams({ expires_at:current, select:'payload', limit:'50' })}`),
    ]);
    const ids = rows.map(row => row.id).filter(id => /^candidate-[a-f0-9]{24}$/.test(id));
    const batches=[];
    for(let offset=0;offset<ids.length;offset+=100){const group=ids.slice(offset,offset+100);batches.push(Promise.all([
      this.request(`candidate_reviews?${new URLSearchParams({select:'candidate_id,fingerprint,decision',decision:'eq.reject',candidate_id:`in.(${group.join(',')})`})}`),
      this.request(`candidate_assessments?${new URLSearchParams({select:'candidate_id,fingerprint,decision,facts,duplicate_group,duplicate_status',candidate_id:`in.(${group.join(',')})`})}`),
      this.request(`candidate_context_reviews?${new URLSearchParams({select:'candidate_id,fingerprint,project_id,building_id,match_level,reviewed_at,review_due_at',candidate_id:`in.(${group.join(',')})`})}`),
    ]));}
    const grouped=await Promise.all(batches),reviews=grouped.flatMap(x=>x[0]),assessments=grouped.flatMap(x=>x[1]);
    const assessed=new Map(), contextReviews=new Map();
    const contexts=grouped.flatMap(x=>x[2]);
    for(const row of rows){const review=contexts.find(a=>a.candidate_id===row.id&&a.fingerprint===row.fingerprint);if(review)contextReviews.set('research-'+fingerprint(row.source_key).slice(0,20),review);}
    for(const row of rows){const assessment=assessments.find(a=>a.candidate_id===row.id&&a.fingerprint===row.fingerprint);if(assessment)assessed.set('research-'+fingerprint(row.source_key).slice(0,20),assessment);}
    const curated = names.flatMap(row => { const result = leadSchema.safeParse(row.payload); return result.success && Date.parse(result.data.expiresAt)>clock ? [result.data] : []; });
    // No static/demo fallback: the live inbox alone controls current membership and dates.
    const records = applySupplyPolicy(candidateResearch(rows, curated, reviews, clock),assessed,clock).sort((a,b) =>
      Number(a.sourceStatus === 'source-expired') - Number(b.sourceStatus === 'source-expired') || Date.parse(b.collectedAt)-Date.parse(a.collectedAt));
    return {records,contextReviews};
  }
  async replaceResearch(leads) {
    const safe = z.array(leadSchema).max(50).parse(leads);
    return this.request('rpc/replace_research_sources', { method: 'POST', body: { p_leads: safe } });
  }
}
