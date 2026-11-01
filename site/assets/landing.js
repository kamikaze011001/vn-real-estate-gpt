const status = document.querySelector('#copy-status');
document.querySelectorAll('[data-copy]').forEach(button => {
  button.addEventListener('click', async () => {
    const text = document.getElementById(button.dataset.copy).textContent.trim();
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = 'Đã sao chép. Mở Nhà Hà Nội trong ChatGPT, dán câu hỏi và gửi.';
      button.textContent = 'Đã sao chép ✓';
      setTimeout(() => { button.innerHTML = 'Sao chép câu hỏi <span aria-hidden="true">↗</span>'; }, 3000);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(document.getElementById(button.dataset.copy));
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      status.textContent = 'Trình duyệt chưa cho phép sao chép. Câu hỏi đã được chọn; hãy dùng lệnh sao chép của thiết bị.';
    }
  });
});
