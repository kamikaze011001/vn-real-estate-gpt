export const areaBasisLabel = p => ({ net: 'thông thủy', gross: 'tim tường' }[p.areaBasis] || 'chưa rõ cách tính');
export const locationLabel = p => p.lat == null ? 'Chưa có vị trí' : p.demo ? 'Vị trí minh họa' : 'Vị trí tòa nhà';
export const availabilityLabel = p => p.availability === 'available' ? 'Nguồn xác nhận còn bán' : 'Cần xác nhận lại còn bán';
export const priceStatusLabel = p => p.priceStatus === 'stale' ? 'Giá cần xác nhận lại' : p.priceVnd == null ? 'Chưa rõ giá' : 'Giá chào theo nguồn';
export const inventoryNotice = demo => demo
  ? 'Dữ liệu mô phỏng · Giá, căn hộ và vị trí không phải tin đang bán.'
  : 'Tin đã duyệt nguồn · Giá chào có ngày xác nhận; xác minh lại trước khi xem nhà.';
