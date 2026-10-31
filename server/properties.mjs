import { activeInventory, inventoryMode } from './inventory-repository.mjs';
export { inventory } from './demo-inventory.mjs';

export const normalize = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

export function searchProperties(filters = {}, records = activeInventory()) {
  const { maxPriceVnd, minBedrooms, minAreaM2, district, query, sort = 'price-asc' } = filters;
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const listings = records.filter(p => p.completed && p.transaction === 'resale' && p.availability !== 'unavailable')
    .filter(p => !district || normalize(p.district) === normalize(district))
    .filter(p => maxPriceVnd == null || (p.priceVnd != null && p.priceVnd <= maxPriceVnd))
    .filter(p => minBedrooms == null || (p.bedrooms != null && p.bedrooms >= minBedrooms))
    .filter(p => minAreaM2 == null || (p.areaM2 != null && p.areaBasis === 'net' && p.areaM2 >= minAreaM2))
    .filter(p => words.every(word => normalize(`${p.title} ${p.district} ${p.building} ${p.project || ''}`).includes(word)))
    .sort((a, b) => sort === 'area-desc'
      ? (b.areaBasis === 'net' ? b.areaM2 ?? -Infinity : -Infinity) - (a.areaBasis === 'net' ? a.areaM2 ?? -Infinity : -Infinity)
      : (a.priceVnd ?? Infinity) - (b.priceVnd ?? Infinity));
  return {
    demo: inventoryMode === 'demo', mode: inventoryMode, listings, filters, total: listings.length,
    notice: inventoryMode === 'demo' ? 'Toàn bộ căn hộ, giá và vị trí là dữ liệu mô phỏng; không phải nguồn hàng đang bán.' : 'Tin đã qua duyệt nguồn. Giá là giá chào; kiểm tra ngày xác nhận và xác minh lại trước khi xem nhà.',
    explanation: listings.length ? 'Chỉ hiển thị căn đáp ứng điều kiện đã chọn. Thông tin thiếu không được coi là đáp ứng điều kiện.'
      : 'Chưa có căn đáp ứng tất cả điều kiện trong dữ liệu hiện tại. Bạn có thể chủ động đổi điều kiện; ứng dụng chưa tự nới điều kiện.',
  };
}

export function getProperty(id) {
  return activeInventory().find(p => p.id === id) ?? null;
}

export function comparisonHighlights(listings) {
  const missingPriceIds = listings.filter(p => !Number.isFinite(p.priceVnd) || p.priceVnd < 0).map(p => p.id);
  const missingAreaIds = listings.filter(p => !Number.isFinite(p.areaM2) || p.areaM2 <= 0).map(p => p.id);
  const priceComplete = listings.length > 1 && missingPriceIds.length === 0;
  const areaComparable = listings.length > 1 && missingAreaIds.length === 0 && listings.every(p => p.areaBasis === 'net');
  const minPrice = priceComplete ? Math.min(...listings.map(p => p.priceVnd)) : null;
  const maxArea = areaComparable ? Math.max(...listings.map(p => p.areaM2)) : null;
  return {
    priceComplete, areaComparable, missingPriceIds, missingAreaIds,
    priceSpreadVnd: priceComplete ? Math.max(...listings.map(p => p.priceVnd)) - minPrice : null,
    lowestPriceIds: priceComplete ? listings.filter(p => p.priceVnd === minPrice).map(p => p.id) : [],
    areaSpreadM2: areaComparable ? maxArea - Math.min(...listings.map(p => p.areaM2)) : null,
    largestAreaIds: areaComparable ? listings.filter(p => p.areaM2 === maxArea).map(p => p.id) : [],
  };
}

export function compareProperties(ids) {
  const unique = [...new Set(ids)];
  if (unique.length < 2 || unique.length > 3) throw new Error('Hãy chọn từ hai đến ba căn khác nhau để so sánh.');
  const listings = unique.map(getProperty);
  if (listings.some(p => !p)) throw new Error('Có mã căn hộ không tồn tại. Hãy chọn lại từ kết quả tìm kiếm.');
  return {
    demo: inventoryMode === 'demo', mode: inventoryMode, listings,
    notice: inventoryMode === 'demo' ? 'So sánh dữ liệu mô phỏng. Giá là giá chào giả lập, không phải giá giao dịch.' : 'Giá chào theo nguồn và ngày xác nhận; không phải giá giao dịch hoàn tất.',
    highlights: comparisonHighlights(listings),
    pricePerM2: listings.map(p => ({ id: p.id, value: p.priceVnd != null && p.areaM2 > 0 && p.areaBasis === 'net' ? Math.round(p.priceVnd / p.areaM2) : null })),
  };
}
