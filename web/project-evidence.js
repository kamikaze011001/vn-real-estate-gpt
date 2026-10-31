const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const topics = { parking: 'Chỗ đỗ xe', management: 'Quản lý', fees: 'Chi phí', noise: 'Tiếng ồn', elevators: 'Thang máy', access: 'Đi lại', infrastructure: 'Hạ tầng', legal: 'Giấy tờ', market: 'Thị trường', other: 'Thông tin khác' };
const verification = { documented: 'Theo tài liệu; cần đối chiếu phạm vi', unverified: 'Chưa xác minh độc lập', disputed: 'Có ý kiến hoặc bằng chứng trái chiều' };
function sourceLink(item) {
  try {
    const url = new URL(item.sourceUrl);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return '';
    return `<a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">Đọc nguồn ↗</a>`;
  } catch { return ''; }
}
function reference(item) {
  return `<article class="project-reference"><p class="eyebrow">${escape(topics[item.topic] || topics.other)} · ${escape(verification[item.verification] || verification.unverified)}</p><p>${escape(item.summary)}</p><p class="muted">Gắn với: ${escape(item.scope)}<br>Phạm vi nguồn: ${escape(item.sourceScope)}${item.reportingPeriod ? `<br>Kỳ báo cáo: ${escape(item.reportingPeriod)}` : ''}<br>Nguồn: ${escape(item.source)} · ${escape(item.sourceLocator)}<br>Đăng: ${escape(item.sourcePublishedAt)}${item.sourceEditedAt ? ` · Sửa: ${escape(item.sourceEditedAt)}` : ''} · Kiểm tra: ${escape(item.checkedAt)}<br>Duyệt lại trước: ${escape(item.reviewDueAt)}</p><p><strong>Khi xem nhà:</strong> ${escape(item.question)}</p>${sourceLink(item)}</article>`;
}
export function renderProjectEvidence(data, { loading = false } = {}) {
  if (loading) return '<section class="project-context"><h3>Nguồn thông tin dự án</h3><p class="muted" role="status">Đang tải nguồn đã duyệt cho căn này…</p></section>';
  if (!data) return '<section class="project-context"><h3>Nguồn thông tin dự án</h3><p class="muted">Chưa tải được nguồn đã duyệt cho căn này. Mở lại chi tiết để kiểm tra; không suy ra dự án không có vấn đề.</p></section>';
  const official = data.official || [], community = data.community || [];
  return `<section class="project-context" aria-label="Nguồn thông tin dự án"><h3>Thông tin dự án</h3>${official.length ? official.map(reference).join('') : '<p class="muted">Chưa có tài liệu đã duyệt cho phạm vi này.</p>'}<h3>Góc nhìn cộng đồng</h3><p class="muted">Ý kiến cá nhân có thời điểm và phạm vi riêng; chưa xác minh tư cách cư dân, không đại diện cho toàn dự án.</p>${community.length ? community.map(reference).join('') : '<p class="muted">Chưa có thảo luận cộng đồng đã duyệt cho phạm vi này.</p>'}<p class="result-note">${escape(data.notice)}</p></section>`;
}
