import { fingerprint, leadSchema, safeSource } from './research-links.mjs';
import { sourceLabels } from './source-identity.mjs';

// Only bounded numeric expressions cross this boundary; never spread candidate payloads.
const number = '[0-9]+(?:[.,][0-9]+)*';
const patterns = {
  price: new RegExp(`^${number}\\s*(?:tỷ|ty|triệu|trieu|tr|tỉ|vnd|đồng|dong)(?:\\s*${number}\\s*(?:triệu|trieu|tr|vnd|đồng|dong))*(?:\\s*vnd)?$`, 'iu'),
  area: new RegExp(`^${number}\\s*m(?:2|²)?$`, 'iu'),
  bedroom: new RegExp(`^${number}\\s*(?:phòng\\s*ngủ|phong\\s*ngu|ngủ|ngu|pn)$`, 'iu'),
};
const projectLabels = { 'samsora-van-phuc': 'Samsora Vạn Phúc', 'my-dinh-ii-ct1adn1': 'CT1A-ĐN1 · Mỹ Đình II' };
const factLabel=value=>typeof value==='string'&&value.length<=80&&!/[<>@\n\r]|\d{8,}/.test(value)?value:null;
const expressions = (items, kind) => [...new Set((Array.isArray(items) ? items : [])
  .map(item => item?.raw).filter(raw => typeof raw === 'string' && raw.length <= 80 && patterns[kind].test(raw)))].slice(0, 12);
const date = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return null;
  const day = value.slice(0, 10), parsed = new Date(day+'T00:00:00Z');
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === day && day <= new Date().toISOString().slice(0, 10) ? day : null;
};

export function candidateResearch(rows, curated = [], reviews = [], clock = Date.now()) {
  const labels = new Map(curated.map(lead => [lead.id, lead]));
  const rejected = new Set(reviews.filter(r => r.decision === 'reject').map(r => r.candidate_id+':'+r.fingerprint));
  return rows.flatMap(row => {
    const key = row.source_key, p = row.payload, checked = Date.parse(row.checked_at), expiry = Date.parse(row.expires_at);
    const portal=row.source_id==='alonhadat';
    if (typeof key !== 'string' || !(portal?/^alonhadat:(\d+):ad-\1$/:/^(otofun|voz):\d+:post-\d+$/).test(key) || key.split(':')[0] !== row.source_id
        || !p || p.format !== (portal?'public-ad':'public-post') || !['opening-ad', 'opening-post'].includes(p.post_role)
        || p.post_key !== key.split(':')[2] || !['sale-candidates', 'needs-context'].includes(p.queue)
        || rejected.has(row.id+':'+row.fingerprint) || !Number.isFinite(checked) || checked > clock+60000
        || checked+14*86400000 <= clock || !(expiry > clock)) return [];
    try {
      const sourceUrl = safeSource(row.source_url, key), id = `research-${fingerprint(key).slice(0, 20)}`;
      const source = sourceLabels[row.source_id];
      const prior = labels.get(id), fields = p.fields || {}, flags = new Set(Array.isArray(p.flags) ? p.flags : []);
      let named = false;
      try { named = !!prior && !!safeSource(prior.sourceUrl, key); } catch { /* Ignore a mismatched historical label. */ }
      const priceExpressions = (Array.isArray(fields.price_candidates) ? fields.price_candidates : []).flatMap(item =>
        expressions([item], 'price').map(raw => ({ raw, basis: ['per_m2','per_month'].includes(item.basis) ? item.basis : 'unspecified', uncertain: item.uncertain === true })));
      const areaExpressions = expressions(fields.area_candidates, 'area'), bedroomExpressions = expressions(fields.bedroom_candidates, 'bedroom');
      const expired = flags.has('source-ad-marked-expired-not-proof-of-sale');
      const risks = new Set(['project-identity-unresolved', 'quantity-context-unresolved', ...(named ? prior.risks : [])]);
      if (expired) risks.add('expired-ad');
      if (p.geography !== 'hanoi-mentioned' || flags.has('multiple-projects-or-geographies')) risks.add('location-unresolved');
      if (priceExpressions.some(x => x.basis === 'per_m2')) risks.add('rate-not-total');
      if (!priceExpressions.length || flags.has('price-expression-unresolved')) risks.add('price-unresolved');
      if (flags.has('area-unit-unresolved')) risks.add('area-unit-unresolved');
      if(portal)risks.add('source-date-semantics-unresolved');
      if(flags.has('area-discrepancy'))risks.add('area-discrepancy');
      if(flags.has('project-label-conflict'))risks.add('project-label-conflict');
      const project = (Array.isArray(p.projects) ? p.projects : []).map(x => projectLabels[x.candidate]).find(Boolean);
      // Curated names are our historical labels, not copied source titles or new verification.
      const portalProject=portal?(Array.isArray(p.projects)?p.projects:[]).map(x=>factLabel(x.label)).find(Boolean):null;
      const label = named ? prior.label : portal ? [portalProject?`${portalProject} (theo nguồn)`:'Tin ALONHADAT',factLabel(fields.area_label),`#${key.split(':')[1]}`].filter(Boolean).join(' · ').slice(0,160) : project || `Tin ${source} · #${key.split(':')[1]}`;
      return [leadSchema.parse({ id, label, source, sourceUrl, publishedAt: date(p.source_published_at), editedAt: date(p.source_edited_at),
        ...(portal?{displayedAt:date(fields.displayed_date)}:{}),
        collectedAt: row.checked_at, expiresAt: new Date(Math.min(expiry, checked+14*86400000)).toISOString(),
        sourceStatus: expired ? 'source-expired' : 'unverified-ad', priceExpressions: priceExpressions.slice(0,12),
        areaExpressions, bedroomExpressions, risks: [...risks], priceVnd:null, areaM2:null, bedrooms:null,
        availability:'unknown', completion:'unknown', legalStatus:'unknown', inventoryEligible:false, requirementsVerified:false })];
    } catch { return []; } // One invalid source identity cannot expose a payload or hide valid records.
  });
}
