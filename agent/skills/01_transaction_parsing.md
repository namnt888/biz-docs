# Skill 01: Natural Language Transaction Parsing

## Mục tiêu
Chuyển đổi văn bản ghi chép chi tiêu tự nhiên của người dùng thành cấu trúc JSON chuẩn xác để lưu trữ vào cơ sở dữ liệu.

## Quy trình thực thi (Agentic Workflow)
1. **Lấy dữ liệu đầu vào:** Quét file `vault/01_Daily_Logs/Today.md`. Chỉ lấy các dòng nằm dưới mục `## Unsynced Transactions`.
2. **Tiền xử lý ngữ cảnh:** Đọc danh sách tài khoản (`accounts`) và danh mục (`categories`) hiện có trong hệ thống để thực hiện đối chiếu (fuzzy matching).
3. **Gọi LLM (9Router/Claude/OpenAI):** Gửi prompt yêu cầu xuất dữ liệu theo định dạng JSON chuẩn.
4. **Bóc tách JSON (Robust Parser):** Do các LLM dòng suy luận (Thinking models) thường trả về khối `<thinking>...</thinking>`, Agent phải loại bỏ toàn bộ các thẻ này bằng regex và trích xuất chuỗi nằm giữa `[` và `]` đầu tiên/cuối cùng trước khi gọi `JSON.parse`.
5. **Đồng bộ và Dán nhãn:** Sau khi ghi nhận thành công lên Supabase **VÀ** n8n đã xác nhận sync sheet, Agent chuyển các dòng đã xử lý xuống mục `## Synced Transactions` với định dạng:
   `- [x] <nội dung gốc> (✅ synced at <thời gian>)`

---

## Input Format chuẩn
<person_name>, <YYYY-MM>:

Ngày <DD.MM> <shop_source>

<amount> <notes_text> [back_source?]

<amount> -<X>% <notes_text> [back_source?]


---

## ⚠️ RULES BẮT BUỘC — Cashback vs Notes

### RULE 1: `(giảm Xk <source>)` trong notes = DISCOUNT ĐÃ ĐƯỢC TRỪ VÀO GIÁ
Cụm `(giảm Xk <source>)` hoặc `(Giảm Xk <source>)` có nghĩa là:
- **Giá đã được giảm trực tiếp trước khi thanh toán** (không phải cashback về sau)
- `amount` = số tiền **đã trả thực tế** (sau khi giảm rồi)
- `cashback_share_fixed = 0` — KHÔNG tách số tiền giảm này ra
- `cashback_share_percent = 0`
- Cụm `(giảm...)` chỉ là **ghi chú thông tin cho user biết nguồn giảm**, KHÔNG phải lệnh tạo cashback
- `notes` = giữ nguyên **toàn bộ chuỗi** kể cả cụm `(giảm...)` vì đây là mô tả sản phẩm

### RULE 2: `-X%` sau amount = CASHBACK % VỀ SAU
Cụm `-X%` xuất hiện sau số tiền có nghĩa là:
- `cashback_share_percent = X`
- `cashback_share_fixed = 0`
- `amount` = số tiền đã trả
- `notes` = phần còn lại (không bao gồm `-X%`)

### RULE 3: KHÔNG có ký hiệu back → không có cashback
- `cashback_share_percent = 0`
- `cashback_share_fixed = 0`

### RULE 4: Phân biệt `shop_source` (Cửa hàng) và `back_source` (Ngân hàng thanh toán)
- **`shop_source` (Merchant/Platform)**: Luôn lấy từ tiêu đề ngày (ví dụ: `- Ngày 5.5 Shopee` ➔ `shop_source = "Shopee"` cho tất cả giao dịch con bên dưới). Đây là giá trị đồng bộ lên cột `ShopSource` của Google Sheets.
- **`back_source` (Payment Bank)**: 
  - Lấy từ cuối dòng giao dịch nếu có ghi rõ (ví dụ: `Vpbank`, `Msb Online`). Hỗ trợ so khớp các ngân hàng có tên nhiều từ ở cuối dòng giao dịch.
  - Nếu cuối dòng không ghi rõ phương thức thanh toán ➔ mặc định `back_source = "Vpbank"`.
  - Giá trị này được dùng để ánh xạ tài khoản thanh toán (`account_id`) trên Supabase.

### RULE 5: Định dạng phần trăm hoàn tiền `% Back` đồng bộ lên Google Sheets
- Khi đồng bộ lên Google Sheets, tỉ lệ hoàn tiền `% Back` phải được nhân với 100 thành số nguyên nguyên bản (ví dụ: `8%` ➔ gửi giá trị `8` thay vì `0.08` thập phân).

---

## Ví dụ phân tích ĐÚNG

### Input:
Lâm, 2026-05:

Ngày 5.5 Shopee

+ 941,420 Derma: 1 Rescuer, 1 HA B5, 1 VitC (giảm 100k Vpbank) Vpbank

+ 666,700 Derma: 1 B3 (Giảm 50k Vpbank) Vpbank

+ 589,120 Mediamix: 10 xà bông, Tẩy trang Chacott

+ 1,021,140 -8% Babé: 1 SRM, Zakka: 2 SRM Msb Online

### Output JSON ĐÚNG:

```json
[
  {
    "type": "Out",
    "date": "05-05",
    "cycle_tag": "2026-05",
    "person_name": "Lâm",
    "amount": 941420,
    "notes": "Derma: 1 Rescuer, 1 HA B5, 1 VitC (giảm 100k Vpbank)",
    "cashback_share_percent": 0,
    "cashback_share_fixed": 0,
    "shop_source": "Shopee",
    "back_source": "Vpbank"
  },
  {
    "type": "Out",
    "date": "05-05",
    "cycle_tag": "2026-05",
    "person_name": "Lâm",
    "amount": 666700,
    "notes": "Derma: 1 B3 (Giảm 50k Vpbank)",
    "cashback_share_percent": 0,
    "cashback_share_fixed": 0,
    "shop_source": "Shopee",
    "back_source": "Vpbank"
  },
  {
    "type": "Out",
    "date": "05-05",
    "cycle_tag": "2026-05",
    "person_name": "Lâm",
    "amount": 589120,
    "notes": "Mediamix: 10 xà bông, Tẩy trang Chacott",
    "cashback_share_percent": 0,
    "cashback_share_fixed": 0,
    "shop_source": "Shopee",
    "back_source": "Vpbank"
  },
  {
    "type": "Out",
    "date": "05-05",
    "cycle_tag": "2026-05",
    "person_name": "Lâm",
    "amount": 1021140,
    "notes": "Babé: 1 SRM, Zakka: 2 SRM",
    "cashback_share_percent": 8,
    "cashback_share_fixed": 0,
    "shop_source": "Shopee",
    "back_source": "Msb Online"
  }
]
```

### ❌ Output SAI (agent không được làm thế này):
```json
// SAI — không được tách 100k ra thành cashback_share_fixed
{
  "cashback_share_fixed": 100000,  // ← SAI
  "notes": "Derma: 1 Rescuer, 1 HA B5, 1 VitC"  // ← SAI, đã mất cụm giảm giá
}
```

---

## Lookup sheet_id từ DB (bắt buộc)
- **KHÔNG** hard-code sheet_id trong code hoặc prompt
- Trước khi insert: `SELECT sheet_id FROM people WHERE name = '<person_name>'`
- Nếu không tìm thấy → **STOP**, báo lỗi, không tạo transaction

---

## Sync Gate — Bắt buộc n8n confirm trước khi mark synced
- Insert Supabase → `synced_at = NULL`
- Trigger n8n webhook
- **Chỉ khi** n8n callback thành công → `UPDATE transactions SET synced_at = now()`
- Nếu n8n timeout/fail → giữ `synced_at = NULL`, log "pending sync"
- **Không được** đánh dấu `## Synced Transactions` nếu `synced_at` vẫn là NULL

### ⚠️ Lưu ý quan trọng về Webhook & Credentials cho n8n (Dành cho AI Agent):
1. **Google Sheets Credentials**: Node Google Sheets trong n8n phải được liên kết với credential ID: `qi7b3ugwTvV969Ar` (tên hiển thị: "Google Sheets account"). Khi import lại hoặc thiết lập workflow, hãy đảm bảo các node Google Sheets được cấu hình ID này để tránh lỗi "Node does not have any credentials set".
2. **Tên node Webhook không chứa khoảng trắng**: Tên của node Webhook đầu vào trong n8n không nên chứa khoảng trắng (ví dụ đặt tên là `Webhook` thay vì `Webhook (Supabase Trigger)`) để tránh lỗi lệch so khớp đường dẫn do n8n mã hóa khoảng trắng thành `%20` trong cơ sở dữ liệu còn bộ định tuyến so khớp ký tự space bình thường.
3. **Đường dẫn Webhook trong Production**: n8n chạy local sẽ tự động thêm tiền tố workflow ID vào đường dẫn webhook production:
   - Cấu trúc: `http://localhost:5678/webhook/<workflow-id>/<node-name-slugified>/<path>`
   - Ví dụ thực tế: `http://localhost:5678/webhook/JIfwZP5txIaEsyvZ/webhook/supabase-multi-webhook`
   - AI Agent **bắt buộc** phải kiểm tra bảng `webhook_entity` trong SQLite database `/Users/rei/.n8n/database.sqlite` bằng câu lệnh SQL:
     `sqlite3 /Users/rei/.n8n/database.sqlite "SELECT webhookPath FROM webhook_entity;"`
     để lấy đúng URL path cần gọi (không hardcode) để đảm bảo n8n tiếp nhận webhook thành công.