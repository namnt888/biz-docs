# 🔄 n8n Google Sheets Sync — Workflow v1.6.0

> Hệ thống Obsidian Money đồng bộ dữ liệu tự động sang Google Sheets qua n8n webhook.

---

## 🏗 Kiến trúc Workflow

```
POST /webhook/supabase-multi-webhook (responseMode=lastNode)
  │
  ▼
Dynamic Router (Code) ─── phân luồng theo person, cycle, format cashback %
  │
  ▼
Switch ─── transactions vs debts
  │                │
  ▼                ▼
[Transaction]    [Debt → GSheets Append DEBT]
  │
  ▼
Prepare Sheet Row (Set: ID, Type, Date, Notes, Amount, %Back, đBack, ShopSource)
  │
  ▼
Check Sheet Existence (HTTP GET: sheets.properties)
  │
  ▼
Process Sheet Status (Code: tìm Template tab, kiểm tra cycle tab tồn tại)
  │
  ▼
IF Sheet Exists
  ├─ True  ────────────────┐
  └─ False → Clone Template┘
                            │
                            ▼
                  Get Current Row Count (HTTP GET: A3:A)
                            │
                            ▼
                  Build Write Payload (Code: tính nextRow, tạo batchUpdate payload)
                            │
                            ▼
                  Write Transaction (HTTP POST: values:batchUpdate)
```

---

## ⚠️ Design Decisions quan trọng

### 1. `values:batchUpdate` với disjoint ranges (KHÔNG dùng GSheets Append node)
Google Sheets Template có **formulas** ở 3 cột:
- **D** (Shop): `=VLOOKUP(K4,Metadata!$A$2:$B,2,FALSE)`
- **I** (Σ Back): `=ROUND(F4*G4/100+H4)`
- **J** (Final Price): `=F4-I4`

Node GSheets Append của n8n ghi toàn bộ row `A:K` (kể cả giá trị trống cho cột không map) → **xóa mất formula**. Thay vào đó, workflow dùng raw API `values:batchUpdate` với 3 range rời rạc:
- `A{row}:C{row}` → [ID, Type, Date]
- `E{row}:H{row}` → [Notes, Amount, % Back, đ Back]
- `K{row}` → [ShopSource]

**Hoàn toàn không chạm cột D, I, J.**

### 2. `responseMode: lastNode` — Sequential Execution
Webhook trả response SAU KHI workflow hoàn tất (thay vì trả 200 ngay lập tức). Đảm bảo CLI script gửi request tuần tự, tránh race condition tạo duplicate `_conflict` sheet tabs khi nhiều transactions sync cùng lúc.

### 3. Google Apps Script — Self-Healing & Formatting
File `google_apps_script.js` được paste vào Extensions → Apps Script trong Google Spreadsheet. Trigger `onChange` (bao gồm cả `changeType='OTHER'` từ API writes):
- Self-heal formulas Row 4 nếu bị mất
- Copy formulas từ Row 4 xuống rows mới
- Set borders cho data range
- Sort theo Date ascending

### 4. Template-Based Sheet Creation
Spreadsheet phải có tab `Template` với:
- Summary table ở Row 1-2
- Headers ở Row 3
- Formulas ở D4, I4, J4

Khi cycle mới chưa có tab → n8n tự clone Template → đặt tên theo cycle (ví dụ: `2026-06`).

---

## 🚀 Import & Deploy

### Lần đầu hoặc sau khi thay đổi workflow:
```bash
# Import JSON vào n8n SQLite database & activate
python3 n8n/import_and_activate.py

# Restart n8n để load workflow mới
lsof -ti :5678 | xargs kill 2>/dev/null
node $(which n8n) start > n8n/n8n_run.log 2>&1 &
```

### Credentials
- **Google Sheets OAuth2 ID**: `qi7b3ugwTvV969Ar`
- **Webhook path**: Tự động sinh bởi n8n. Kiểm tra bằng:
  ```bash
  sqlite3 /Users/rei/.n8n/database.sqlite "SELECT webhookPath FROM webhook_entity;"
  ```

---

## 📋 Google Sheets Column Layout (Row 3 = Header)

| Col | Header       | Written by | Notes                                    |
|-----|-------------|------------|------------------------------------------|
| A   | ID          | n8n        | Transaction UUID (hidden column)         |
| B   | Type        | n8n        | "Out" / "In"                             |
| C   | Date        | n8n        | DD-MM format                             |
| D   | Shop        | **FORMULA**| `=VLOOKUP(K4,Metadata!$A$2:$B,2,FALSE)` |
| E   | Notes       | n8n        | Transaction description                  |
| F   | Amount      | n8n        | Số tiền                                  |
| G   | % Back      | n8n        | Integer (8 = 8%)                         |
| H   | đ Back      | n8n        | Fixed cashback amount                    |
| I   | Σ Back      | **FORMULA**| `=ROUND(F4*G4/100+H4)`                  |
| J   | Final Price | **FORMULA**| `=F4-I4`                                 |
| K   | ShopSource  | n8n        | Raw shop source key (hidden column)      |

---

## ✅ Test Sync

```bash
cd agent

# Preview (dry run):
npx tsx src/scripts/sync_transactions_custom.ts

# Commit & sync:
npx tsx src/scripts/sync_transactions_custom.ts --commit
```
