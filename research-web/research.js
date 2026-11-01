import { App, applyDocumentTheme, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';
import '../review-web/review.css';
import './style.css';

const $ = id => document.getElementById(id);
const hosted = window.parent !== window;
document.documentElement.dataset.hosted = String(hosted);
const state = { data: null, ids: [], focused: null, view: 'list', synced: false, writing: 0, sending: false, queryNumber: 0, preparing: false };
let bridge, connected = false, host = {}, writes = Promise.resolve(), writeVersion = 0;
const date = value => value ? value.slice(0, 10).split('-').reverse().join('/') : 'Chưa rõ';
const localDate = value => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
const qualityReasons = {'source-expired':'Nguồn đánh dấu hết hạn.','source-stale':'Quá 72 giờ chưa đọc lại nguồn.','old-ad':'Tin nguồn quá 30 ngày, chưa có xác nhận lại trong 7 ngày.','source-date-missing':'Chưa có ngày đăng hoặc sửa thực sự.','review-needed':'Cần đối chiếu dự án, phạm vi, giá và diện tích.','possible-duplicate':'Có thể trùng căn với nguồn khác; tạm đếm chung một nhóm.'};
const riskNames = {
  'source-date-semantics-unresolved': 'Ngày hiển thị có thể liên quan đến làm mới tin; chưa có bằng chứng về ngày đăng ban đầu hoặc sửa nội dung thực sự.',
  'project-label-conflict': 'Tên hoặc mã tòa trong các phần của tin nguồn có mâu thuẫn; chưa thể gắn với một tòa đã đối chiếu.',
  'quantity-context-unresolved': 'Các con số có thể thuộc nhiều căn, tiện ích hoặc phương án sửa; chưa xác định con số nào mô tả đúng căn.',
  'location-unresolved': 'Chưa xác nhận vị trí thuộc phạm vi Hà Nội; tin có thể nhắc nhiều khu vực.',
  'price-unresolved': 'Tổng giá hoặc cách ghi giá cần được xác nhận.', 'area-unit-unresolved': 'Đơn vị/cách tính diện tích chưa rõ.',
  'rate-not-total': 'Giá trên m² không phải tổng giá chào.', 'tenancy-unresolved': 'Cần làm rõ tình trạng thuê và điều kiện bàn giao.',
  'project-identity-unresolved': 'Chưa đối chiếu đúng dự án, tòa và căn.', 'expired-ad': 'Nguồn đánh dấu tin hết hạn; cần hỏi lại, chưa thể kết luận đã bán.',
  'room-layout-uncertain': 'Phân biệt phòng hiện có, phòng được mô tả và phương án sửa.', 'area-discrepancy': 'Diện tích tiêu đề và nội dung có khác biệt cần đối chiếu.',
};
function node(tag, text, className) { const item = document.createElement(tag); if (text !== undefined) item.textContent = text; if (className) item.className = className; return item; }
function button(label, action, className = 'quiet') { const item = node('button', label, className); item.type = 'button'; item.addEventListener('click', () => void action()); return item; }
function error(message = '') { $('error').hidden = !message; $('error').textContent = message; }
function allLeads() { return [...new Map([...(state.data?.leads ?? []), ...(state.data?.contextLeads ?? [])].map(lead => [lead.id, lead])).values()]; }
function getLead(id) { return allLeads().find(lead => lead.id === id); }
function expressions(lead, kind) {
  if (kind === 'price') return lead.priceExpressions.map(item => item.raw + (item.basis === 'per_m2' ? ' /m²' : item.basis === 'per_month' ? ' /tháng' : '')).join(' · ') || 'Chưa rõ giá';
  return lead[kind === 'area' ? 'areaExpressions' : 'bedroomExpressions'].join(' · ') || 'Chưa rõ';
}
function facts(lead) { const dl = node('dl', undefined, 'facts'); for (const [label, kind] of [['Giá trong nguồn', 'price'], ['Diện tích trong nguồn', 'area'], ['Phòng ngủ trong nguồn', 'bedroom']]) { const row = node('div'); row.append(node('dt', label), node('dd', expressions(lead, kind))); dl.append(row); } return dl; }
async function tool(name, args) {
  if (hosted) { if (!connected) throw new Error('Chưa kết nối được với ChatGPT. Hãy mở lại nguồn tham khảo.'); const result = await bridge.callServerTool({ name, arguments: args }); if (result.isError) throw new Error(result.content?.find(item => item.type === 'text')?.text || 'Không đọc được nguồn.'); return result.structuredContent; }
  const route = { show_research_explorer: 'show', set_research_selection: 'selection', get_research_context: 'context', compare_research_leads: 'compare', show_viewing_brief: 'brief' }[name];
  const response = await fetch(`/api/research/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Không đọc được nguồn.'); return data;
}
function receive(data, inputs = true) {
  if (data?.researchOnly !== true || !data.researchSessionId) return;
  $('cards').setAttribute('aria-busy', 'false');
  state.data = data; state.ids = [...(data.selectedLeadIds ?? [])]; state.focused = data.focusedLeadId; state.view = data.view || 'list'; state.synced = true;
  if (inputs) { $('query').value = data.query; $('scope').value = data.scope; }
  render();
}
async function sync() {
  if (!state.data?.researchSessionId) return false;
  const version = ++writeVersion;
  const snapshot = { researchSessionId: state.data.researchSessionId, ids: [...state.ids], focusedLeadId: state.focused, view: state.view, query: state.data.query, scope: state.data.scope, page:state.data.page };
  state.writing += 1; state.synced = false; render();
  try {
    writes = writes.catch(() => {}).then(() => tool('set_research_selection', snapshot));
    const data = await writes;
    if (version !== writeVersion) return false;
    receive(data, false); error();
    if (connected) {
      const payload = { content: [{ type: 'text', text: `Research source context: ${JSON.stringify({ researchSessionId: data.researchSessionId, selectedLeadIds: data.selectedLeadIds, focusedLeadId: data.focusedLeadId })}. Read get_research_context before answering about the viewed/selected sources. These are unverified source links, not approved inventory or confirmed matches.` }] };
      try { await bridge.updateModelContext(payload); } catch { /* Server context remains authoritative. */ }
    }
    return true;
  } catch (failure) { if (version === writeVersion) error(failure.message); return false; }
  finally { state.writing -= 1; render(); }
}
async function search(changes = {}) {
  const request = ++state.queryNumber;
  $('status').textContent = 'Đang đọc nguồn…'; $('cards').setAttribute('aria-busy', 'true');
  try { await writes.catch(() => {}); const data = await tool('show_research_explorer', { ...(state.data ? { researchSessionId: state.data.researchSessionId } : {}), ...changes }); if (request === state.queryNumber) { receive(data); error(); } }
  catch (failure) { if (request === state.queryNumber) error(failure.message); }
  finally { if (request === state.queryNumber) { $('cards').setAttribute('aria-busy', 'false'); if (state.data) render(); else $('status').textContent = 'Chưa đọc được nguồn.'; } }
}
async function toggle(id) { if (state.sending || state.preparing) return; state.ids = state.ids.includes(id) ? state.ids.filter(key => key !== id) : [...state.ids, id].slice(0, 3); render(); await sync(); }
async function detail(id) { state.focused = id; state.view = 'details'; render(); $('detail-title').focus(); await sync(); }
async function prepareBrief(ids = [...state.ids]) {
  if (!ids.length || state.preparing || state.writing || state.sending) return;
  const request = ++state.queryNumber, version = ++writeVersion;
  const sessionId = state.data.researchSessionId;
  state.preparing = true; state.synced = false; render(); error();
  try {
    writes = writes.catch(() => {}).then(() => tool('show_viewing_brief', { researchSessionId: sessionId, ids }));
    const data = await writes;
    if (request !== state.queryNumber || version !== writeVersion) return;
    receive(data); $('brief-title').focus();
    if (connected && !Object.keys(data.requirements ?? {}).length) await sendBriefRequirements(ids, sessionId);
  } catch (failure) { if (request === state.queryNumber) error(failure.message); }
  finally { state.preparing = false; render(); }
}
async function sendBriefRequirements(ids = state.data.viewingBrief?.items.map(item => item.leadId), sessionId = state.data.researchSessionId) {
  if (!ids?.length || state.sending) return;
  const labels = ids.map(getLead).filter(Boolean).map(lead => lead.label);
  state.sending = true; $('brief-delivery').textContent = 'Đang nhờ ChatGPT gắn yêu cầu đã có trong cuộc trò chuyện…'; render();
  try {
    await writes.catch(() => {});
    const captured = await tool('show_viewing_brief', { researchSessionId: sessionId, ids });
    if (state.data.researchSessionId === sessionId) receive(captured);
    const prompt = `Chuẩn bị trước khi xem nhà cho ${labels.join(' và ')} trong bản chuẩn bị tôi vừa mở. Dùng các điều kiện bắt buộc tôi đã nêu trong cuộc trò chuyện, giữ nguyên yêu cầu chưa thay đổi và mở bản cập nhật trong app. Nếu chưa có yêu cầu, vẫn giữ bản một phần, không cần hỏi thêm bảng câu hỏi. Nêu ngắn bước tiếp theo và khoảng trống lớn nhất; phân biệt tài liệu dự án với thông tin đã kiểm chứng của đúng căn.`;
    const result = await bridge.sendMessage({ role: 'user', content: [{ type: 'text', text: prompt }] });
    if (result.isError) throw new Error('send failed');
    $('brief-delivery').textContent = 'Đã gửi đến ChatGPT. Bản cập nhật sẽ dùng yêu cầu trong cuộc trò chuyện; bản hiện tại vẫn dùng được.';
  } catch { $('brief-delivery').textContent = 'Chưa gửi được đến ChatGPT. Bạn vẫn có thể dùng bản hiện tại và bấm thử lại.'; }
  finally { state.sending = false; render(); }
}
function sourceLink(label, url) {
  const link = node('a', label, 'source-link'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
  if (hosted) link.addEventListener('click', event => { event.preventDefault(); void bridge.openLink({ url }).catch(() => error('Chưa mở được nguồn. Hãy thử lại.')); });
  return link;
}
function renderBrief() {
  const brief = state.data.viewingBrief; if (!brief) return;
  const requirements = brief.requirements, names = [];
  if (requirements.maxPriceVnd !== undefined) names.push(`Tối đa ${new Intl.NumberFormat('vi-VN').format(requirements.maxPriceVnd)} VND`);
  if (requirements.minAreaM2 !== undefined) names.push(`Từ ${requirements.minAreaM2} m²`);
  if (requirements.minBedrooms !== undefined) names.push(`Từ ${requirements.minBedrooms} phòng ngủ`);
  names.push(...(requirements.areas ?? []), ...(requirements.otherMustHaves ?? []));
  $('brief-requirements').textContent = names.length ? `Điều kiện bắt buộc đã ghi nhận: ${names.join(' · ')}. Thay đổi bằng cuộc trò chuyện; chưa xác nhận tin đáp ứng.` : 'Chưa gắn yêu cầu từ cuộc trò chuyện. Bản một phần vẫn có thông tin và câu hỏi để bắt đầu.';
  $('brief-chat').hidden = !connected; $('brief-chat').disabled = state.sending || state.preparing;
  const body = $('brief-body'), expanded = new Set([...body.querySelectorAll('details[open]')].map(item => item.dataset.leadId)); body.replaceChildren();
  for (const item of brief.items) {
    const article = node('article', undefined, 'brief-card');
    article.append(node('p', item.actionLabel, `brief-action ${item.action}`), node('h3', item.label), node('p', item.reason, 'note'));
    const finding = node('div', undefined, 'brief-finding'); finding.append(node('strong', 'Điều biết được từ nguồn'), node('p', item.keyFinding), node('p', item.associationLabel, 'note'));
    const gap = node('div', undefined, 'brief-gap'); gap.append(node('strong', 'Khoảng trống lớn nhất'), node('p', item.biggestGap)); article.append(finding, gap);
    if (item.context[0]) finding.append(sourceLink(`${item.context[0].publisher} · ${date(item.context[0].publishedAt)} ↗`, item.context[0].url));
    const full = node('details', undefined, 'brief-full'), summary = node('summary', 'Xem đối chiếu, nguồn và câu hỏi'); full.dataset.leadId = item.leadId; full.open = expanded.has(item.leadId); full.append(summary);
    const list = node('dl', undefined, 'brief-checks');
    for (const check of item.checks) { const row = node('div'); row.append(node('dt', `${check.label} · ${check.status === 'unknown' ? 'Chưa rõ' : check.status === 'conflict' ? 'Mâu thuẫn yêu cầu' : 'Có nguồn đối chiếu'}`), node('dd', check.detail)); list.append(row); } full.append(list);
    full.append(node('h4', 'Tài liệu để đối chiếu'));
    if (!item.context.length) full.append(node('p', 'Chưa có tài liệu đã đối chiếu còn hạn cho phiên bản tin này. Không gắn tài liệu bằng tên gần giống.', 'note'));
    for (const fact of item.context) {
      const source = node('section', undefined, 'brief-source');
      source.append(node('p', fact.text), sourceLink(`${fact.publisher} ↗`, fact.url), node('p', `${fact.scope === 'project' ? 'Cấp dự án' : 'Đúng tòa đã đối chiếu'} · ${fact.timeBasis === 'historical' ? 'Thông tin lịch sử' : fact.timeBasis === 'announced-period' ? 'Giai đoạn được công bố' : 'Chưa rõ thời điểm áp dụng'}`, 'badge'), node('p', `Ngày nguồn: ${date(fact.publishedAt)} · Kỳ áp dụng: ${fact.effectivePeriod ?? 'Chưa rõ'} · Kiểm tra: ${date(fact.checkedAt)} · Rà soát trước: ${date(fact.reviewDueAt)}`, 'note'), node('p', `Vị trí trong nguồn: ${fact.locator}`, 'note'), node('p', fact.limitation, 'note')); full.append(source);
    }
    full.append(node('h4', 'Hỏi người bán trước khi hẹn'));
    const questions = node('ol', undefined, 'brief-questions');
    item.questions.forEach(question => { const li = node('li'); li.append(node('p', question.question), node('p', question.why, 'note')); questions.append(li); }); full.append(questions, sourceLink('Mở tin rao gốc ↗', item.sourceUrl)); article.append(full); body.append(article);
  }
}
async function compare() {
  if (state.ids.length < 2) return;
  try { await writes; await tool('compare_research_leads', { researchSessionId: state.data.researchSessionId }); state.view = 'comparison'; state.focused = null; render(); $('comparison-title').focus(); await sync(); }
  catch (failure) { error(failure.message); }
}
function render() {
  if (!state.data) return;
  const focusedKey = document.activeElement?.dataset.selectKey;
  $('research-overview').hidden = state.view === 'brief'; $('status').hidden = state.view === 'brief';
  $('status').textContent = state.writing ? 'Đang đồng bộ lựa chọn…' : `${state.data.total} nguồn · chưa xác minh${connected && state.ids.length && state.synced ? ' · ChatGPT đã nhận lựa chọn' : ''}`;
  const latest = state.data.leads.map(lead => lead.collectedAt).sort().at(-1);
  $('freshness').textContent = latest ? `Lần đọc nguồn gần nhất: ${localDate(latest)} (giờ Việt Nam). Đọc lại không có nghĩa là đã xác nhận còn bán.` : '';
  const counts=state.data.counts;
  $('coverage').textContent = `${counts.usableGroups}/100 nhóm tin đủ điều kiện · ${counts.projects}/10 dự án · ${counts.collected} nguồn thu thập · ${counts.needsContext} cần đối chiếu · ${counts.archive} lưu trữ`;
  $('selection').hidden = state.ids.length === 0 || state.view === 'brief';
  $('selected-label').textContent = `Đã chọn ${state.ids.length} nguồn · tối đa 3`;
  $('selected-names').textContent = state.ids.map(getLead).filter(Boolean).map(lead => lead.label).join(' · ');
  $('compare').disabled = state.ids.length < 2 || state.writing > 0 || state.sending || state.preparing;
  $('prepare-brief').disabled = !state.ids.length || state.writing > 0 || state.sending || state.preparing;
  $('prepare-brief').textContent = state.preparing ? 'Đang chuẩn bị…' : 'Chuẩn bị trước khi xem nhà';
  $('cards').replaceChildren();
  for (const lead of state.data.leads) {
    const card = node('article', undefined, `card${state.ids.includes(lead.id) ? ' selected' : ''}`), top = node('div', undefined, 'card-top');
    top.append(node('span', lead.quality?.state === 'archive' ? 'Lưu trữ · chưa xác minh' : lead.quality?.state === 'usable' ? 'Đã đối chiếu theo nguồn' : 'Cần đối chiếu', 'badge'), node('span', `${lead.source} · ${date(lead.publishedAt??lead.displayedAt)}${!lead.publishedAt&&lead.displayedAt?' · ngày hiển thị':''}`));
    const actions = node('div', undefined, 'card-actions'), select = button(state.ids.includes(lead.id) ? 'Đã chọn' : 'Chọn so sánh', () => toggle(lead.id));
    select.dataset.selectKey = lead.id; select.setAttribute('aria-label', `Chọn so sánh ${lead.label}`); select.setAttribute('aria-pressed', String(state.ids.includes(lead.id))); select.disabled = state.sending || state.preparing || (!state.ids.includes(lead.id) && state.ids.length >= 3);
    actions.append(button('Xem nguồn', () => detail(lead.id), 'primary'), select);
      card.append(top, node('h3', lead.label));
      if(lead.quality?.projectLabel&&lead.quality.projectLabel!==lead.label)card.append(node('p',`Dự án đã đối chiếu: ${lead.quality.projectLabel}`,'note'));
      card.append(facts(lead), node('p', 'Còn bán, giấy tờ và đáp ứng yêu cầu: chưa xác nhận.', 'note'), node('p', `Đọc nguồn: ${localDate(lead.collectedAt)}`, 'note'), actions); $('cards').append(card);
  }
  $('pages').hidden=state.view!=='list'||state.data.pages<=1;
  $('page-label').textContent=`Trang ${state.data.page}/${state.data.pages}`;
  $('previous').disabled=state.data.page<=1; $('next').disabled=state.data.page>=state.data.pages;
  $('empty').hidden = state.data.total > 0;
  $('empty').querySelector('h2').textContent = state.data.scope==='usable' ? 'Chưa có tin đủ điều kiện trong phạm vi này' : 'Chưa có nguồn trong phạm vi này';
  $('reset').textContent=state.data.scope==='usable'?'Xem nguồn cần đối chiếu':'Xem tất cả nguồn';
  $('list-panel').hidden = state.view !== 'list'; $('detail-panel').hidden = state.view !== 'details'; $('comparison-panel').hidden = state.view !== 'comparison'; $('brief-panel').hidden = state.view !== 'brief';
  if (state.view === 'brief') renderBrief();
  if (state.view === 'details') {
    const lead = getLead(state.focused), body = $('detail-body'); body.replaceChildren();
    if (lead) {
      $('detail-title').textContent = lead.label; body.append(facts(lead), node('p', `Bài gốc: ${date(lead.publishedAt)} · Sửa theo nguồn: ${date(lead.editedAt)} · Lần thu thập: ${localDate(lead.collectedAt)}`, 'note'));
      if(lead.displayedAt)body.append(node('p',`Ngày hiển thị trong tin: ${date(lead.displayedAt)}. Chưa xác định đây là ngày đăng ban đầu hay ngày làm mới; không dùng để xác nhận tin còn mới hoặc còn bán.`,'note'));
      if(lead.quality){
        const q=lead.quality;
        if(q.advertisedPriceVnd!==null)body.append(node('p',`Đã đối chiếu theo nguồn: giá chào ${new Intl.NumberFormat('vi-VN').format(q.advertisedPriceVnd)} VND · ${q.advertisedAreaM2} m². Thông tin nguồn, chưa phải giá giao dịch.`,'note'));
        body.append(node('p',q.availabilityConfirmed?`Nhà cung cấp báo còn bán: ${date(q.supplierConfirmedAt)}. Đây là xác nhận từ nguồn, không phải kiểm chứng độc lập.`:'Chưa có xác nhận còn bán từ chủ nhà/đơn vị được ủy quyền trong 7 ngày.','note'));
        if(q.duplicateCount>1)body.append(node('p',`${q.duplicateCount} nguồn trong một nhóm ${q.duplicateStatus==='confirmed'?'đã xác nhận trùng':'nghi trùng'}. Giữ riêng từng bằng chứng.`,'notice'));
        q.reasons.forEach(reason=>body.append(node('p',qualityReasons[reason],'note')));
      }
      const list = node('ul', undefined, 'risk-list'); lead.risks.forEach(key => list.append(node('li', riskNames[key]))); list.append(node('li', 'Cần xác nhận còn bán, đúng căn/tòa, hoàn thành và giấy tờ; không coi các biểu thức nguồn là thông số đã duyệt.')); body.append(list);
      const link = node('a', 'Mở tin gốc ↗', 'source-link'); link.href = lead.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
      if (hosted) link.addEventListener('click', event => { event.preventDefault(); void bridge.openLink({ url: lead.sourceUrl }).catch(() => error('Chưa mở được nguồn. Hãy thử lại.')); });
      const prepare = button('Chuẩn bị trước khi xem nhà', () => prepareBrief([lead.id]), 'primary'); prepare.disabled = state.preparing || state.writing > 0 || state.sending;
      body.append(prepare, link, node('p', 'Chỉ hiển thị liên kết và dữ liệu nguồn tối thiểu; không sao chép mô tả, ảnh, liên hệ hoặc phản hồi tác giả.', 'note'));
    }
  }
  if (state.view === 'comparison') {
    const leads = state.ids.map(getLead).filter(Boolean), table = node('table'), head = node('thead'), top = node('tr'); top.append(node('th', 'Theo nguồn, chưa xác minh'));
    leads.forEach(lead => { const th = node('th', lead.label); th.scope = 'col'; top.append(th); }); head.append(top); const body = node('tbody');
    for (const [label, value] of [['Giá trong nguồn', lead => expressions(lead, 'price')], ['Diện tích trong nguồn', lead => expressions(lead, 'area')], ['Phòng ngủ trong nguồn', lead => expressions(lead, 'bedroom')], ['Bài gốc', lead => date(lead.publishedAt)], ['Trạng thái nguồn', lead => lead.sourceStatus === 'source-expired' ? 'Nguồn hết hạn' : 'Chưa xác minh'], ['Còn bán / hoàn thành / giấy tờ', () => 'Chưa xác nhận'], ['Đáp ứng yêu cầu của bạn', () => 'Chưa được kiểm chứng'], ['Cần làm rõ', lead => lead.risks.map(key => riskNames[key]).join(' ')]]) { const row = node('tr'), th = node('th', label); th.scope = 'row'; row.append(th); leads.forEach(lead => row.append(node('td', value(lead)))); body.append(row); }
    table.append(head, body); const scroll = $('comparison-body').scrollLeft; $('comparison-body').replaceChildren(table); $('comparison-body').scrollLeft = scroll;
  }
  $('chat-action').hidden = !connected || state.view === 'list' || state.view === 'brief'; $('ask').disabled = state.writing > 0 || !state.synced || state.sending;
  if (focusedKey && state.view === 'list') [...document.querySelectorAll('[data-select-key]')].find(item => item.dataset.selectKey === focusedKey)?.focus({ preventScroll: true });
}
function hostContext(context = {}) {
  host = { ...host, ...context };
  if (context.theme) { applyDocumentTheme(context.theme); document.documentElement.dataset.theme = context.theme; }
  if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
  if (context.displayMode) document.documentElement.dataset.display = context.displayMode;
  if (context.safeAreaInsets) document.documentElement.style.setProperty('--safe-bottom', `${Math.max(0, context.safeAreaInsets.bottom)}px`);
  $('expand').hidden = !host.availableDisplayModes?.includes('fullscreen') || host.displayMode === 'fullscreen';
}
$('previous').addEventListener('click',()=>void search({page:state.data.page-1,view:'list',focusedLeadId:null}));
$('next').addEventListener('click',()=>void search({page:state.data.page+1,view:'list',focusedLeadId:null}));
$('filters').addEventListener('submit', event => { event.preventDefault(); void search({ page:1,query: $('query').value, scope: $('scope').value, view: 'list', focusedLeadId: null }); });
$('reset').addEventListener('click', () => void search({ page:1,query: '', scope: state.data?.scope==='usable'?'research':'all', view: 'list', focusedLeadId: null }));
$('clear').addEventListener('click', () => { state.ids = []; if (state.view === 'comparison') state.view = 'list'; render(); void sync(); });
$('prepare-brief').addEventListener('click', () => void prepareBrief());
$('brief-chat').addEventListener('click', () => void sendBriefRequirements());
$('compare').addEventListener('click', () => void compare());
document.querySelectorAll('[data-back]').forEach(item => item.addEventListener('click', () => { state.view = 'list'; state.focused = null; render(); void sync(); $('query').focus(); }));
$('expand').addEventListener('click', async () => { try { await bridge.requestDisplayMode({ mode: 'fullscreen' }); } catch { error('Chưa mở rộng được. Bạn vẫn có thể xem nguồn trong khung hiện tại.'); } });
$('ask').addEventListener('click', async () => {
  const ids = state.view === 'comparison' ? [...state.ids] : [state.focused], labels = ids.map(getLead).filter(Boolean).map(lead => lead.label);
  const prompt = `Tôi muốn kiểm tra ${labels.join(' và ')}. Hãy đọc get_research_context với researchSessionId="${state.data.researchSessionId}". Các nguồn tại thời điểm hỏi có IDs ${JSON.stringify(ids)}; nếu lựa chọn đổi sau đó, vẫn dùng các IDs này. ${ids.length > 1 ? 'Dùng compare_research_leads để đối chiếu.' : ''} Nêu những điều cần xác minh, dẫn đường link và ngày nguồn. Giữ nguyên các yêu cầu tôi đã nêu; không coi biểu thức trong tin là đáp ứng ngân sách, diện tích hoặc phòng ngủ, và không khẳng định còn bán, hoàn thành hay giấy tờ.`;
  state.sending = true; $('delivery').textContent = `Đang gửi câu hỏi về ${labels.join(' và ')}…`; render();
  try { await writes; const result = await bridge.sendMessage({ role: 'user', content: [{ type: 'text', text: prompt }] }); if (result.isError) throw new Error('send failed'); $('delivery').textContent = `Đã gửi câu hỏi về ${labels.join(' và ')} đến ChatGPT.`; }
  catch { $('delivery').textContent = 'Chưa gửi được. Hãy giữ lựa chọn và thử lại.'; }
  finally { state.sending = false; render(); }
});
if (hosted) {
  bridge = new App({ name: 'hanoi-home-research', version: '0.1.0' }, { availableDisplayModes: ['inline', 'fullscreen'] }, { autoResize: true });
  bridge.ontoolresult = params => { if (params.structuredContent?.researchSessionId) receive(params.structuredContent); };
  bridge.onhostcontextchanged = hostContext;
  bridge.connect().then(() => { connected = true; hostContext(bridge.getHostContext()); render(); if (state.data) void sync(); }).catch(() => error('Chưa kết nối được với ChatGPT. Hãy mở lại nguồn tham khảo.'));
  setInterval(async () => { if (!connected || !state.data || state.writing || state.sending || state.preparing || host.displayMode !== 'fullscreen' || document.visibilityState !== 'visible' || document.activeElement?.matches('input,select')) return; try { const data = await tool('get_research_context', { researchSessionId: state.data.researchSessionId }); if (data.revision !== state.data.revision) receive(data); } catch (failure) { error(failure.message); } }, 8000);
} else {
  $('website-nav').hidden = false;
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  applyDocumentTheme(dark ? 'dark' : 'light'); document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const params=new URLSearchParams(location.search);
  const initialScope=params.has('source')?'all':(['usable','research','archive','all'].includes(params.get('scope'))?params.get('scope'):'usable');
  const focusedLeadId=params.get('source');
  void search({scope:initialScope,...(focusedLeadId?{focusedLeadId,view:'details'}:{})});
}
