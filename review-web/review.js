const $ = id => document.getElementById(id);
const state = { leads: [], selected: new Set(), loading: false, focus: null };
const normal = value => String(value).toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll('đ', 'd');
const date = value => value ? value.slice(0, 10).split('-').reverse().join('/') : 'Chưa rõ';
const shortTitle = lead => lead.title.replace(/^(?:\[[^\]]+\]\s*|Hết hạn\s+)/i, '');
const alive = lead => Date.parse(lead.expiresAt) >= Date.now();
const claims = (lead, kind) => [...new Set(lead.fields[`${kind}_candidates`].map(candidate => candidate.raw +
  (kind === 'price' && candidate.basis === 'per_m2' ? ' /m²' : kind === 'price' && candidate.basis === 'per_month' ? ' /tháng' : '')))].join(' · ') || 'Chưa thấy trong bài';
const status = lead => lead.flags.includes('source-ad-marked-expired-not-proof-of-sale') ? 'Tin nguồn hết hạn' : lead.queue === 'excluded' ? 'Nguồn cần loại khỏi đề xuất' : lead.decision === 'review-required' ? 'Bài thay đổi · cần đọc lại' : 'Chưa xác minh';
const riskNames = {
  'publication-use-unresolved': 'Chưa có căn cứ cho phép hiển thị tin này trong ứng dụng.',
  'project-and-building-not-canonicalized': 'Chưa đối chiếu đúng dự án, tòa và căn hộ.',
  'source-ad-marked-expired-not-proof-of-sale': 'Tin được nguồn đánh dấu hết hạn; cần hỏi lại, chưa thể kết luận đã bán.',
  'offer-identity-and-completion-unconfirmed': 'Chưa xác nhận đúng căn và tình trạng hoàn thành của tòa.',
  'availability-unconfirmed': 'Chưa có xác nhận căn còn bán ở thời điểm hiện tại.',
  'price-expression-unresolved': 'Cách ghi giá viết tắt cần được giải thích trước khi chuẩn hóa.',
  'area-unit-unresolved': 'Đơn vị diện tích viết tắt chưa đủ để xác nhận m².',
  'per-m2-rate-is-not-a-total-asking-price': 'Giá trên m² không phải tổng giá chào.',
  'multiple-expressions-do-not-pair-automatically': 'Có nhiều con số trong bài; không tự ghép chúng thành thông số căn.',
  'source-text-truncated': 'Nội dung được lưu có giới hạn độ dài.',
  'price-missing': 'Chưa thấy tổng giá bán rõ ràng.',
  'area-missing': 'Chưa thấy diện tích rõ ràng.',
  'bedroom-missing': 'Chưa thấy số phòng ngủ rõ ràng.',
};
const reasonNames = {
  'mixed-sale-and-rental': 'Phân biệt tiền thuê với giá bán và làm rõ tình trạng người thuê.',
  'mixed-property-types': 'Bài nhắc nhiều loại bất động sản; tách đúng phần nói về căn hộ.',
  'multiple-geographies-needs-location-review': 'Bài nhắc nhiều địa điểm; chưa xác định vị trí của căn cần xem.',
  'hanoi-location-needs-confirmation': 'Cần xác nhận căn thuộc phạm vi Hà Nội.',
  'source-indicates-closed-offer': 'Nguồn có dấu hiệu dừng giao dịch; không xem như căn đang chào bán.',
};
function risks(lead) {
  return [...new Set([...lead.reasons.map(key => reasonNames[key]), ...lead.flags.map(key => riskNames[key])].filter(Boolean))];
}
function node(tag, text, className) {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  return item;
}
function button(text, callback, className = 'quiet') {
  const item = node('button', text, className);
  item.type = 'button';
  item.addEventListener('click', callback);
  return item;
}
function facts(lead) {
  const list = node('dl', undefined, 'facts');
  for (const [label, value] of [['Giá trong bài', claims(lead, 'price')], ['Diện tích trong bài', claims(lead, 'area')], ['Phòng ngủ trong bài', claims(lead, 'bedroom')]]) {
    const row = node('div'); row.append(node('dt', label), node('dd', value)); list.append(row);
  }
  return list;
}
function toggle(lead) {
  if (state.selected.has(lead.id)) state.selected.delete(lead.id);
  else if (state.selected.size < 3) state.selected.add(lead.id);
  render();
}
function render() {
  state.leads = state.leads.filter(alive);
  const ids = new Set(state.leads.map(lead => lead.id));
  state.selected = new Set([...state.selected].filter(id => ids.has(id)));
  const focusKey = document.activeElement?.dataset.actionKey;
  const query = normal($('search').value.trim()), scope = $('scope').value;
  const filtered = state.leads.filter(lead => (!query || normal(lead.title + ' ' + lead.text).includes(query)) &&
    (scope === 'all' || (scope === 'expired' ? lead.flags.includes('source-ad-marked-expired-not-proof-of-sale') : lead.queue === scope)));
  $('cards').replaceChildren();
  for (const lead of filtered) {
    const card = node('article', undefined, `card${state.selected.has(lead.id) ? ' selected' : ''}`);
    const top = node('div', undefined, 'card-top'); top.append(node('span', status(lead), 'badge'), node('span', `Bài gốc ${date(lead.publishedAt)}`));
    const actions = node('div', undefined, 'card-actions');
    const detail = button('Xem chi tiết nguồn', () => showDetail(lead), 'primary');
    detail.dataset.detailKey = lead.id;
    const select = button(state.selected.has(lead.id) ? 'Đã chọn' : 'Chọn so sánh', () => toggle(lead));
    select.dataset.actionKey = lead.id;
    select.setAttribute('aria-label', `Chọn so sánh ${shortTitle(lead)}`);
    select.setAttribute('aria-pressed', String(state.selected.has(lead.id)));
    select.disabled = state.selected.size >= 3 && !state.selected.has(lead.id);
    actions.append(detail, select);
    const contextNote = /sua.{0,35}(?:thanh|phong)/.test(normal(lead.text)) ? 'Có phương án sửa phòng trong bài; đọc ngữ cảnh để phân biệt với phòng hiện có. ' : '';
    card.append(top, node('h3', shortTitle(lead)), facts(lead), node('p', contextNote + 'Lời nguồn chưa xác minh · Còn bán: chưa rõ', 'note'), actions);
    $('cards').append(card);
  }
  $('cards').setAttribute('aria-busy', String(state.loading));
  $('empty').hidden = state.loading || filtered.length > 0;
  $('count').textContent = state.loading ? 'Đang đọc nguồn…' : `${filtered.length} / ${state.leads.length} tin giữ lại · chưa xác minh`;
  $('selection').hidden = state.selected.size === 0;
  $('selected-label').textContent = `Đã chọn ${state.selected.size} tin · tối đa 3`;
  $('selected-names').textContent = state.leads.filter(lead => state.selected.has(lead.id)).map(shortTitle).join(' · ');
  $('compare').disabled = state.selected.size < 2;
  if (focusKey) [...$('cards').querySelectorAll('[data-action-key]')].find(item => item.dataset.actionKey === focusKey)?.focus({ preventScroll: true });
  if ($('detail').open && !ids.has(state.focus)) $('detail').close();
  if ($('comparison').open) showComparison(false);
}
function showDetail(lead, open = true) {
  state.focus = lead.id;
  $('detail-title').textContent = shortTitle(lead);
  const body = $('detail-body'); body.replaceChildren();
  body.append(node('p', status(lead), 'badge'), facts(lead), node('p', `Ngày bài gốc: ${date(lead.publishedAt)} · Ngày sửa theo nguồn: ${date(lead.editedAt)} · Lần thu thập: ${date(lead.collectedAt)}`, 'note'));
  const list = node('ul', undefined, 'risk-list'); risks(lead).forEach(text => list.append(node('li', text)));
  body.append(node('h3', 'Những điều cần làm rõ'), list);
  if (lead.sourceUrl) {
    const link = node('a', 'Mở bài gốc trên diễn đàn ↗', 'source-link');
    link.href = lead.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; body.append(link);
  }
  const source = node('details'); source.append(node('summary', 'Đọc nội dung nguồn đã lưu'), node('p', lead.text, 'source-text')); body.append(source);
  if (lead.updates.length) {
    const updates = node('details'); updates.append(node('summary', `${lead.updates.length} phản hồi liên quan từ cùng dấu hiệu tài khoản`), node('p', 'Chưa xác minh vai trò người đăng. Phản hồi hoặc đẩy bài không xác nhận còn bán.', 'note'));
    for (const update of lead.updates) { const section = node('div', undefined, 'update'); section.append(node('strong', date(update.publishedAt)), node('p', update.text)); updates.append(section); }
    body.append(updates);
  }
  body.append(node('p', `Tin rời bản duyệt sau ${date(lead.expiresAt)} nếu không được thu thập lại. Thu thập lại không phải xác nhận còn bán.`, 'note'));
  if (open) { $('detail').showModal(); $('detail-title').focus(); }
}
function showComparison(open = true) {
  const selected = state.leads.filter(lead => state.selected.has(lead.id));
  if (selected.length < 2) { if ($('comparison').open) $('comparison').close(); return; }
  const table = node('table'), caption = node('caption', 'Đối chiếu thông tin chưa xác minh của các tin đã chọn');
  const head = node('thead'), top = node('tr'); top.append(node('th', 'Thông tin'));
  selected.forEach(lead => { const th = node('th', shortTitle(lead)); th.scope = 'col'; top.append(th); }); head.append(top);
  const body = node('tbody');
  const rows = [['Trạng thái nguồn', status], ['Giá theo bài', lead => claims(lead, 'price')], ['Diện tích theo bài', lead => claims(lead, 'area')], ['Phòng ngủ theo bài', lead => claims(lead, 'bedroom')], ['Ngày bài gốc', lead => date(lead.publishedAt)], ['Ngày sửa bài', lead => date(lead.editedAt)], ['Còn bán / giấy tờ', () => 'Chưa xác nhận'], ['Cần làm rõ', lead => risks(lead).join(' ')]];
  for (const [label, value] of rows) { const row = node('tr'), th = node('th', label); th.scope = 'row'; row.append(th); selected.forEach(lead => row.append(node('td', value(lead)))); body.append(row); }
  table.append(caption, head, body); $('comparison-body').replaceChildren(table);
  if (open) { $('comparison').showModal(); $('comparison-title').focus(); }
}
async function load() {
  if (state.loading) return;
  state.loading = true; $('refresh').disabled = true; render();
  try {
    const response = await fetch('/api/leads', { cache: 'no-store' });
    if (!response.ok) throw new Error('unavailable');
    const data = await response.json();
    if (data.privateReviewOnly !== true || !Array.isArray(data.leads)) throw new Error('invalid response');
    state.leads = data.leads; $('error').hidden = true;
    if ($('detail').open) { const current = state.leads.find(lead => lead.id === state.focus); if (current) showDetail(current, false); }
  } catch {
    $('error').hidden = false; $('error').textContent = 'Chưa đọc được hộp nguồn. Các tin đang hiển thị có thể cũ; thử Đọc lại dữ liệu.';
  } finally { state.loading = false; $('refresh').disabled = false; render(); }
}
$('search').addEventListener('input', render); $('scope').addEventListener('change', render);
$('refresh').addEventListener('click', load); $('reset').addEventListener('click', () => { $('search').value = ''; $('scope').value = 'all'; render(); $('search').focus(); });
$('clear').addEventListener('click', () => { state.selected.clear(); render(); }); $('compare').addEventListener('click', () => showComparison());
document.querySelectorAll('[data-close]').forEach(item => item.addEventListener('click', () => $(item.dataset.close).close()));
$('comparison').addEventListener('close', () => ($('compare').disabled ? $('search') : $('compare')).focus());
$('detail').addEventListener('close', () => ([...document.querySelectorAll('[data-detail-key]')].find(item => item.dataset.detailKey === state.focus) || $('search')).focus());
document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
$('theme').addEventListener('click', () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; });
setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30000);
load();
