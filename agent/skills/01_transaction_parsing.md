# Skill 01: Natural Language Transaction Parsing & Sync

## Mục tiêu
Chuyển đổi văn bản ghi chép chi tiêu tự nhiên của người dùng thành cấu trúc JSON chuẩn xác, lưu vào Supabase, và đồng bộ lên Google Sheets qua n8n webhook.

## Quy trình End-to-End (Agentic Workflow)

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│ 1. Parse     │ ──▶ │ 2. Preview Table │ ──▶ │ 3. User     │
│  Input Text  │     │  (Agent shows)   │     │  Approves   │
└──────────────┘     └──────────────────┘     └──────┬──────┘
                                                      │
     ┌────────────────────────────────────────────────┘
     ▼
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│ 4. Insert    │ ──▶ │ 5. Trigger n8n   │ ──▶ │ 6. Mark     │
│  Supabase    │     │  Webhook (sync)  │     │  synced_at  │
└──────────────┘     └──────────────────┘     └─────────────┘
```

### Chi tiết từng bước

1. **Parse Input Text**: Đọc input từ user (natural language hoặc sheet format). Parse theo rules bên dưới.
2. **Preview Table (BẮT BUỘC)**: Agent **PHẢI** hiển thị bảng tổng hợp tất cả transactions đã parse trước khi submit. Bảng bao gồm: `#`, `Date`, `Amount`, `Notes`, `% CB`, `Fixed CB`, `Back Source`, `Shop Source`. Chờ user xác nhận ("OK", "submit", "commit", v.v.) trước khi tiếp tục.
3. **User Approves**: Chỉ khi user xác nhận mới tiến hành insert.
4. **Insert Supabase**: Insert từng transaction vào bảng `transactions` với `synced_at = NULL`.
5. **Trigger n8n Webhook**: Gọi POST webhook cho mỗi transaction. n8n sẽ tự động tạo sheet tab (nếu chưa tồn tại) và ghi data lên Google Sheets.
6. **Mark synced_at**: Chỉ khi webhook trả về 200 OK mới `UPDATE transactions SET synced_at = now()`.

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
- Giá trị `cashback_share_percent` lưu trong DB là thập phân (ví dụ: `0.08` cho 8%).
- Khi đồng bộ lên Google Sheets qua n8n, giá trị phải được nhân 100 thành số nguyên: `8%` ➔ gửi `8` (không phải `0.08`).
- Logic nhân nằm trong n8n Code node "Dynamic Router": `Math.round(record.cashback_share_percent * 100)`.

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

## Tự động tạo Account Page trong Obsidian khi tạo Account mới (BẮT BUỘC)
- Khi đồng bộ/thêm giao dịch mà tài khoản thanh toán (`back_source`) chưa tồn tại, hệ thống sẽ tự động tạo một tài khoản (`account`) mới trên Supabase.
- **BẮT BUỘC**: Agent phải tạo ngay một file Markdown tương ứng trong thư mục `vault/02_Accounts/` với tên file là `<Tên_tài_khoản>.md` dựa theo template của [MoMo.md](file:///Users/rei/Github/biz-docs/vault/02_Accounts/MoMo.md).
- Trang tài khoản mới phải có frontmatter chứa đúng `id` của tài khoản vừa được tạo trong database:
  ```yaml
  ---
  type: account
  id: <ID_tài_khoản_vừa_tạo_trong_DB>
  ---
  ```
- Thiết kế này đảm bảo DataviewJS trong file Markdown có thể tự động truy vấn và hiển thị số dư, cashback, và lịch sử giao dịch của tài khoản đó từ Supabase mà không cần thao tác thủ công.

---

## Sync Gate — Bắt buộc n8n confirm trước khi mark synced
- Insert Supabase → `synced_at = NULL`
- Trigger n8n webhook
- **Chỉ khi** n8n callback thành công → `UPDATE transactions SET synced_at = now()`
- Nếu n8n timeout/fail → giữ `synced_at = NULL`, log "pending sync"
- **Không được** đánh dấu `## Synced Transactions` nếu `synced_at` vẫn là NULL

---

## 🔧 n8n Workflow — Technical Reference (v1.6.0)

### Workflow Architecture
```
Webhook (POST, responseMode=lastNode)
  → Dynamic Router (Code: extract metadata, cycle, cashbackPct)
  → Switch (transactions vs debts)
  → Prepare Sheet Row (Set node: ID, Type, Date, Notes, Amount, %Back, đBack, ShopSource)
  → Check Sheet Existence (HTTP GET: sheets.properties)
  → Process Sheet Status (Code: check if cycle tab exists, get Template sheetId)
  → IF Sheet Exists
      ├─ True  → Get Current Row Count
      └─ False → Duplicate Template Sheet → Get Current Row Count
  → Build Write Payload (Code: calculate nextRow, build batchUpdate ranges)
  → Write Transaction (HTTP POST: values:batchUpdate)
```

### ⚠️ CRITICAL: Tại sao dùng `values:batchUpdate` thay vì GSheets node
- Google Sheets Template có **formulas** ở 3 cột: **D** (Shop VLOOKUP), **I** (Σ Back), **J** (Final Price).
- Node GSheets Append của n8n ghi toàn bộ row `A:K`, gửi giá trị trống cho các cột không map → **xóa mất formula**.
- **Fix**: Dùng raw API `values:batchUpdate` với 3 range rời rạc:
  - `A{row}:C{row}` → [ID, Type, Date]
  - `E{row}:H{row}` → [Notes, Amount, % Back, đ Back]
  - `K{row}`          → [ShopSource]
- **Hoàn toàn không chạm cột D, I, J** → formula được bảo toàn.

### Google Apps Script (Self-Healing & Formatting)
- File: `n8n/google_apps_script.js`
- Trigger: `onChange` (fires on ALL change types including API writes `changeType='OTHER'`)
- Chức năng:
  1. Self-heal Row 4 formulas nếu bị mất
  2. Copy formulas từ Row 4 xuống các row mới (D, I, J)
  3. Set borders cho data range (A4:K)
  4. Sort theo cột Date (C) ascending

### Google Sheets Column Layout (Row 3 = Header)
| Col | Header       | Source     | Notes                                    |
|-----|-------------|------------|------------------------------------------|
| A   | ID          | n8n writes | Transaction UUID (hidden column)         |
| B   | Type        | n8n writes | "Out" / "In"                             |
| C   | Date        | n8n writes | DD-MM format                             |
| D   | Shop        | FORMULA    | `=VLOOKUP(K4,Metadata!$A$2:$B,2,FALSE)` |
| E   | Notes       | n8n writes | Transaction description                  |
| F   | Amount      | n8n writes | Số tiền                                  |
| G   | % Back      | n8n writes | Integer (8 = 8%)                         |
| H   | đ Back      | n8n writes | Fixed cashback amount                    |
| I   | Σ Back      | FORMULA    | `=ROUND(F4*G4/100+H4)`                  |
| J   | Final Price | FORMULA    | `=F4-I4`                                 |
| K   | ShopSource  | n8n writes | Raw shop source key (hidden column)      |

### Credentials & Webhook Path
1. **Google Sheets Credentials ID**: `qi7b3ugwTvV969Ar` (tên: "Google Sheets account")
2. **Webhook node name**: `Webhook` (không chứa khoảng trắng — tránh lỗi `%20` encoding)
3. **Webhook URL (Production)**: n8n tự thêm prefix workflow ID:
   - Format: `http://localhost:5678/webhook/<workflow-id>/webhook/<path>`
   - Kiểm tra URL thực: `sqlite3 /Users/rei/.n8n/database.sqlite "SELECT webhookPath FROM webhook_entity;"`
4. **Webhook responseMode**: `lastNode` — đảm bảo sequential execution, tránh race condition tạo duplicate sheet tabs

### Import & Deploy Workflow
```bash
# Import JSON vào n8n SQLite database:
python3 n8n/import_and_activate.py

# Restart n8n để load workflow mới (BẮT BUỘC thêm NODE_OPTIONS để tránh lỗi kết nối IPv6 của Google API bị treo):
lsof -ti :5678 | xargs kill 2>/dev/null
NODE_OPTIONS="--dns-result-order=ipv4first" node $(which n8n) start > n8n/n8n_run.log 2>&1 &
```

### Auto-Create Sheet Tab (Template Cloning)
- Spreadsheet phải có sheet tab tên `Template` với:
  - Summary table ở Row 1-2
  - Headers ở Row 3
  - Formulas ở D4, I4, J4 (các ô khác Row 4 trống)
- Khi cycle mới (ví dụ `2026-06`) chưa có sheet tab → n8n tự clone `Template` → đặt tên `2026-06`

---

## Reference Script: `sync_transactions_custom.ts`

Script CLI tại `agent/src/scripts/sync_transactions_custom.ts` là reference implementation cho toàn bộ flow:
1. Parse input text → structured transactions
2. Lookup `sheet_id` from `people` table
3. Resolve `account_id` from `accounts` table (auto-create if missing)
4. Insert to Supabase `transactions` table
5. Trigger n8n webhook with payload
6. Update `synced_at` on success