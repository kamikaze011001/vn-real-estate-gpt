const status = document.querySelector('#copy-status');
document.querySelectorAll('[data-copy]').forEach(button => {
  const originalLabel = button.innerHTML;
  button.addEventListener('click', async () => {
    const text = document.getElementById(button.dataset.copy).textContent.trim();
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = button.dataset.copyMessage || 'Đã sao chép. Mở Nhà Hà Nội trong ChatGPT, dán câu hỏi và gửi.';
      button.textContent = 'Đã sao chép ✓';
      setTimeout(() => { button.innerHTML = originalLabel; }, 3000);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(document.getElementById(button.dataset.copy));
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      status.textContent = 'Trình duyệt chưa cho phép sao chép. Nội dung đã được chọn; hãy dùng lệnh sao chép của thiết bị.';
    }
  });
});

const liveCards = document.querySelector('#live-cards');
const liveStatus = document.querySelector('#live-status');
const retry = document.querySelector('#live-retry');
const sourceDate = value => value ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle:'short', timeStyle:'short' }).format(new Date(value)) : 'Chưa rõ';
function element(tag, text, className) {
  const node = document.createElement(tag); node.textContent = text;
  if (className) node.className = className;
  return node;
}
async function loadSources() {
  retry.hidden = true; liveCards.setAttribute('aria-busy','true');
  liveStatus.textContent = 'Đang tải nguồn đã thu thập…';
  try {
    const response = await fetch('/api/research/leads', {signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error('Unavailable');
    const data = await response.json();
    if (data.researchOnly !== true || !Array.isArray(data.leads)) throw new Error('Invalid feed');
    liveCards.replaceChildren();
    for (const lead of data.leads.slice(0,6)) {
      const card = element('article','', 'live-card');
      card.append(element('span',lead.sourceStatus === 'source-expired' ? 'Nguồn đánh dấu hết hạn' : 'Chưa xác minh','badge'),
        element('h3',lead.label), element('p',`${lead.source} · Đọc nguồn ${sourceDate(lead.collectedAt)}`,'source-meta'));
      const prices = lead.priceExpressions.map(item => item.raw+(item.basis === 'per_m2' ? ' /m²' : item.basis === 'per_month' ? ' /tháng' : '')).join(' · ');
      card.append(element('p',`Giá trong tin: ${prices || 'Chưa rõ'}`), element('p','Còn bán, đúng căn và thông số: chưa xác nhận.','source-meta'));
      const link=element('a','Xem nguồn và đối chiếu →'); link.href='/research?source='+encodeURIComponent(lead.id); card.append(link);
      liveCards.append(card);
    }
    const latest = data.leads.map(lead=>lead.collectedAt).sort().at(-1);
    liveStatus.textContent = data.total ? `${data.counts.usableGroups}/100 nhóm tin đủ điều kiện · ${data.counts.projects}/10 dự án · ${data.counts.collected} nguồn thu thập. Đọc gần nhất trong kết quả: ${sourceDate(latest)} (giờ Việt Nam).` : `${data.counts.usableGroups}/100 nhóm tin đủ điều kiện · ${data.counts.collected} nguồn đã thu thập; ${data.counts.needsContext} cần đối chiếu và ${data.counts.archive} trong kho lưu trữ. Chưa có tin đủ điều kiện; mở danh sách để xem dữ liệu đang có.`;
  } catch {
    liveCards.replaceChildren(); liveStatus.textContent='Chưa tải được nguồn đã thu thập. Hãy thử lại; trang không thay bằng căn mô phỏng.'; retry.hidden=false;
  } finally { liveCards.setAttribute('aria-busy','false'); }
}
if (liveCards) { retry.addEventListener('click',()=>void loadSources()); void loadSources(); }
