// Entirely fictional inventory for usability testing. These are not advertisements.
const samples = [
  ['01', 'Cầu Giấy', 'Không gian cho gia đình nhỏ', 3.6, 72, 2, 21.033, 105.792, 'Đông Nam', 'Phòng khách thoáng, hai phòng ngủ riêng.'],
  ['02', 'Tây Hồ', 'Căn góc nhiều ánh sáng', 5.2, 92, 3, 21.071, 105.816, 'Đông', 'Căn góc, ban công rộng, bếp tách biệt.'],
  ['03', 'Nam Từ Liêm', 'Hai phòng ngủ, bếp mở', 3.2, 68, 2, 21.012, 105.773, 'Nam', 'Bố trí gọn, phù hợp người cần hai phòng ngủ.'],
  ['04', 'Long Biên', 'Thêm một phòng cho gia đình', 4.1, 98, 3, 21.045, 105.89, 'Bắc', 'Ba phòng ngủ và không gian sinh hoạt chung.'],
  ['05', 'Hà Đông', 'Lựa chọn trong ngân sách', 2.8, 65, 2, 20.975, 105.773, 'Tây Nam', 'Hai phòng ngủ, có khu vực giặt phơi riêng.'],
  ['06', 'Thanh Xuân', 'Một nơi vừa đủ', 2.4, 48, 1, 20.996, 105.815, 'Đông Bắc', 'Một phòng ngủ, bếp mở và ban công nhỏ.'],
  ['07', 'Cầu Giấy', 'Thêm không gian làm việc', 4.5, 86, 3, 21.045, 105.801, 'Nam', 'Có thể dành một phòng riêng để làm việc.'],
  ['08', 'Tây Hồ', 'Hai phòng ngủ và ban công', 4.0, 75, 2, 21.083, 105.805, 'Đông Nam', 'Phòng khách nối ban công; diện tích vừa phải.'],
  ['09', 'Hà Đông', 'Căn mẫu đang thiếu thông tin', null, null, 2, null, null, null, 'Chưa có giá, diện tích và vị trí để đối chiếu.'],
];

export const inventory = samples.map(([id, district, title, price, area, bedrooms, lat, lng, direction, description]) => ({
  id: `demo-${id}`, title, district, priceVnd: price === null ? null : Math.round(price * 1e9),
  areaM2: area, bedrooms, lat, lng, direction, description,
  building: `Tòa mẫu ${id}`, areaBasis: 'net', completed: true, transaction: 'resale',
  availability: 'unknown', checkedAt: null, source: 'Dữ liệu mô phỏng', sourceUrl: null,
  locationPrecision: lat === null ? 'unknown' : 'illustrative', demo: true,
}));

