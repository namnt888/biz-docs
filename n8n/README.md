# 🔄 Hướng dẫn Cấu hình Webhook Đồng bộ Supabase -> n8n -> Google Sheets

> Hệ thống Obsidian Money hỗ trợ đồng bộ dữ liệu tự động (append-only) sang Google Sheets thông qua Webhook của Supabase kết hợp với n8n.

---

## 🚀 Quy trình Cấu hình 3 Bước (Chỉ mất 2 phút)

### Bước 1: Import Workflow vào n8n
1. Mở giao diện n8n của bạn (self-hosted hoặc cloud).
2. Bấm vào nút **Add workflow** (Tạo workflow mới) -> Chọn **Import from file** ở góc phải.
3. Chọn file `n8n/google_sheets_sync_workflow.json` trong thư mục repo này.
4. Bấm vào node đầu tiên **"Webhook (Supabase Trigger)"**. Copy đường dẫn **Test URL** (hoặc Production URL) được tạo ra.

### Bước 2: Bật Webhook trên Supabase Cloud
1. Đăng nhập vào trang quản trị [Supabase](https://supabase.com/dashboard) và chọn project của bạn.
2. Tại cột menu bên trái, chọn biểu tượng bánh răng **Database** -> Chọn mục **Webhooks**.
3. Bấm nút **Enable Webhooks** (nếu chưa bật) và chọn **Create Webhook**.
4. Thiết lập thông số như sau:
   - **Name**: `sync_transactions_to_sheets`
   - **Table**: `transactions`
   - **Events**: Đánh dấu chọn `Insert` (Chỉ kích hoạt khi có giao dịch mới).
   - **Type**: Chọn `HTTP Request`.
   - **Method**: Chọn `POST`.
   - **URL**: Dán đường dẫn Webhook URL từ n8n ở Bước 1 vào.
   - **Headers**: Bấm Save.

### Bước 3: Cấu hình tài khoản Google Sheets
1. Trong n8n, bấm vào node số 2 **"Google Sheets"**.
2. Chọn tài khoản Google (OAuth2 hoặc Service Account) và cấp quyền truy cập.
3. Trong ô **Spreadsheet**, dán ID của file Google Sheets bạn muốn đồng bộ. (ID là chuỗi ký tự ngẫu nhiên trong URL file của bạn, ví dụ: `1BxiMVs0X15uBsMUeCs...`).
4. Trong ô **Sheet Name**, gõ `Transactions`.
5. Bấm **Active** workflow ở góc trên cùng bên phải n8n.

---

## ✅ Kiểm thử Đồng bộ
Bây giờ, mỗi khi bạn nhập 1 giao dịch qua biểu mẫu `Quick_Entry.md` hoặc qua văn bản tự nhiên trên `Today.md`, Supabase sẽ lập tức gửi dữ liệu đó sang n8n và ghi thêm 1 dòng mới vào file Google Sheets của bạn!
