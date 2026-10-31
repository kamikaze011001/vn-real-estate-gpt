# Mẫu tiếp nhận căn hộ chuyển nhượng Hà Nội

Dùng một bản cho mỗi căn hộ. Nhà cung cấp điền các mục bên dưới; người duyệt bổ sung thông tin kiểm tra và quyền sử dụng trước khi đưa vào kết quả tìm kiếm. Mẫu để trống có chủ ý và không chứa căn hộ minh họa được trình bày như nguồn hàng thật.

Nhập giá bằng VND và diện tích bằng m². Dùng ngày theo dạng YYYY-MM-DD; nếu ghi giờ, kèm múi giờ, ví dụ +07:00. Để trống thông tin chưa biết và ghi nguyên nhân khi cần; không dùng số 0 thay cho giá hoặc diện tích chưa rõ.

## Thông tin do nhà cung cấp điền

| Trường | Giá trị | Hướng dẫn |
| --- | --- | --- |
| Mã căn của nhà cung cấp | | Mã ổn định để cập nhật cùng một căn; không cần công khai số căn |
| Tên đơn vị hoặc nguồn | | Tên được phép ghi nguồn |
| Vai trò cung cấp | | Chủ sở hữu / đơn vị được ủy quyền / môi giới / khác; ghi rõ |
| Dự án hoặc tòa nhà | | Tên tòa nếu biết; nêu cả tên cũ khi cần đối chiếu |
| Địa chỉ nguồn cung cấp | | Giữ nguyên cách ghi địa chỉ; không tự đổi địa giới |
| Khu vực hiện dùng để tìm kiếm | | Phường hoặc tên khu vực đã kiểm tra; ghi cách đối chiếu nếu khác địa chỉ nguồn |
| Tình trạng hoàn thành | | Đã hoàn thành / chưa rõ / khác; kèm nguồn xác nhận |
| Loại giao dịch | | Chuyển nhượng căn đã sở hữu; nêu nếu là loại khác |
| Giá chào VND | | Tổng giá, không viết 3.5 để biểu thị 3,5 tỷ |
| Ngày xác nhận giá chào | | Không tự lấy ngày nhập dữ liệu thay ngày xác nhận |
| Khoản đã gồm hoặc chưa gồm | | Nội thất, phí, thuế và khoản khác theo nguồn; chưa rõ thì ghi chưa rõ |
| Diện tích m² | | Giá trị số |
| Cách tính diện tích | | Thông thủy / tim tường / khác / chưa rõ |
| Số phòng ngủ | | Giá trị số nếu đã biết |
| Mô tả gốc được phép dùng | | Nội dung do người có quyền cung cấp |
| Tình trạng chào bán được báo | | Đang chào / còn bán đã xác nhận / đã bán hoặc ngừng bán / chưa rõ |
| Ngày và cách xác nhận còn bán | | Ai xác nhận, bằng cách nào; không ghi thông tin riêng tư vào phần công khai |
| Tình trạng giấy tờ theo nguồn | | Ghi đúng lời nguồn cung cấp và loại bằng chứng được phép mô tả; không gửi bản chụp giấy tờ cá nhân |
| Đường dẫn nguồn nếu có | | Không bắt buộc khi nhận trực tiếp; không tạo đường dẫn giả |
| Ngày thông tin được nguồn cập nhật | | Tách khỏi ngày dự án kiểm tra lại |
| Ảnh và đường dẫn tệp | | Chỉ cung cấp ảnh có quyền cho phép hiển thị; ghi chủ thể quyền và điều kiện ghi nguồn |
| Liên hệ được phép công khai | | Tùy chọn; xác nhận đồng ý công khai riêng |
| Người phụ trách cập nhật | | Liên hệ phục vụ vận hành; mặc định chỉ dùng nội bộ |

Các thông tin như tầng hoặc khoảng tầng, hướng, phí quản lý, chỗ đỗ xe, tình trạng bàn giao và lịch có thể xem nhà có thể bổ sung khi đã biết. Mỗi mục cần phân biệt thông tin nguồn cung cấp với thông tin được bên khác kiểm tra.

## Vị trí để hiển thị bản đồ

| Trường | Giá trị | Hướng dẫn |
| --- | --- | --- |
| Vĩ độ | | Tùy chọn; hệ WGS84, số thập phân |
| Kinh độ | | Tùy chọn; hệ WGS84, số thập phân |
| Độ chính xác được phép công khai | | Tòa nhà / khu vực gần đúng / chưa rõ |
| Nguồn xác định tọa độ | | Người cung cấp, bản đồ có quyền sử dụng hoặc cách kiểm tra khác |
| Ngày kiểm tra vị trí | | Ghi khi đã kiểm tra |

Không suy ra tọa độ chính xác từ một địa chỉ mơ hồ. Vị trí tòa nhà không xác định vị trí căn bên trong tòa. Nếu chưa có tọa độ phù hợp, giữ căn trong danh sách với nhãn thiếu vị trí bản đồ. Quyền sử dụng ảnh và dữ liệu vị trí được kiểm tra riêng.

## Thông tin nội bộ do người duyệt điền

| Trường | Giá trị | Hướng dẫn |
| --- | --- | --- |
| Mã tin nội bộ | | Mã ổn định liên kết thẻ, bản đồ và so sánh |
| Ngày nhận dữ liệu | | Không thay cho ngày xác nhận còn bán |
| Người duyệt | | Người chịu trách nhiệm kiểm tra |
| Lần kiểm tra gần nhất | | Ghi riêng thao tác đã kiểm tra |
| Trạng thái còn bán | | advertised / availability_confirmed / unavailable / unknown |
| Bằng chứng cho trạng thái | | Tham chiếu nội bộ, ngày, phương thức và vai trò người xác nhận |
| Kiểm tra trùng tin | | Căn có thể trùng, thông tin mâu thuẫn và cách xử lý; chưa chắc thì không tự gộp |
| Kiểm tra điều kiện pilot | | Căn hộ, Hà Nội, đã hoàn thành, chuyển nhượng; ghi mục còn chưa xác định |
| Mã hoặc vị trí lưu xác nhận quyền dùng | | Không đưa thỏa thuận riêng vào nội dung công khai |
| Phạm vi cho phép | | Dữ liệu, mô tả, ảnh, vị trí, liên hệ; nơi hiển thị và điều kiện ghi nguồn |
| Chuẩn hóa và lưu trữ được phép | | Phạm vi, thời hạn và điều kiện sử dụng |
| Quy trình cập nhật và rút tin | | Người phụ trách, kênh nhận cập nhật, xử lý thu hồi |
| Lần cần kiểm tra tiếp | | Theo lịch đã thống nhất, không tự giả định chu kỳ |
| Trạng thái xuất bản | | draft / ready / withdrawn; mặc định draft |
| Lý do chưa xuất bản hoặc rút | | Mục cần bổ sung hoặc thay đổi |

`availability_confirmed` cần một xác nhận rõ ràng có ngày và nguồn. Kiểm tra một trang vẫn mở được không đủ để đặt trạng thái này. Nếu bằng chứng vượt cửa sổ cập nhật đã thống nhất, không tiếp tục khẳng định còn bán hiện tại. Căn đã bán hoặc ngừng bán dùng `unavailable`; thiếu bằng chứng hiện tại dùng `unknown` hoặc giữ trạng thái được quảng cáo đúng với bằng chứng.

## Điều kiện đưa vào pilot

- Có mã ổn định, nguồn và phạm vi quyền sử dụng phù hợp với từng phần sẽ hiển thị.
- Đã xác định thuộc phạm vi căn hộ hoàn thành, chuyển nhượng tại Hà Nội; mục chưa rõ phải được kiểm tra trước khi dùng như căn đáp ứng phạm vi.
- Có ngày nguồn và ngày kiểm tra khi có thể xác định, hoặc nhãn chưa rõ; không tự điền ngày giả.
- Thông tin cần cho yêu cầu cụ thể của người mua đã có hoặc được ghi thiếu rõ ràng. Thiếu giá hoặc diện tích không đồng nghĩa với giá hoặc diện tích bằng 0.
- Vị trí, trạng thái còn bán, ảnh và thông tin giấy tờ không mạnh hơn bằng chứng thực tế.
- Có người và kênh tiếp nhận cập nhật, cách rút tin và cách xử lý quyền sử dụng hết hạn.
- Không xuất bản liên hệ nội bộ, danh tính chủ nhà, thỏa thuận riêng hoặc hồ sơ cá nhân ngoài phạm vi đã cho phép.

Lưu thay đổi giá chào và tình trạng thành các bản ghi có ngày, không ghi đè mất lịch sử quan sát được phép giữ. Giá chào được xác nhận vẫn không phải giá giao dịch hoàn tất.
