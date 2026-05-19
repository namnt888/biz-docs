# 📋 Hướng dẫn Tổng hợp: QuickAdd + n8n Sync + CLI

> Đọc file này để setup lại toàn bộ hệ thống nhập liệu và đồng bộ Google Sheets từ đầu.

---

## PHẦN 1: Cài đặt Plugins Obsidian

### Plugins bắt buộc

| Plugin | Mục đích | Cài qua |
|---|---|---|
| **Dataview** | Render bảng thống kê động | Community Plugins |
| **QuickAdd** | Phím tắt nhập liệu nhanh | Community Plugins |
| **Modal Form** | Form đẹp để nhập txn | Community Plugins |

### Plugins tùy chọn (UI đẹp hơn)

| Plugin | Mục đích |
|---|---|
| **Advanced Tables** | Edit bảng MD như Excel (Tab/Enter) |
| **Obsidian Charts** | Vẽ biểu đồ chi tiêu |
| **Banners** | Ảnh banner đẹp đầu trang |
| **Style Settings** | Tùy chỉnh màu giao diện |
| **Calendar** | Xem calendar tháng trong sidebar |
| **Hider** | Ẩn bớt UI element |

**Cài đặt:** Settings → Community Plugins → Browse → Tìm tên → Install → Enable

---

## PHẦN 2: Setup QuickAdd (Nhập liệu thủ công)

### Bước 1: Tạo Macro trong QuickAdd
1. Mở Settings → QuickAdd
2. Bấm **"Add Choice"** → đặt tên: `💸 Nhập Giao dịch`
3. Chọn loại: **Macro**
4. Bấm ⚙️ cạnh Macro đó → **"Add Macro"** → tên: `AddTransactionMacro`
5. Bấm **"Configure"** → **"Add user script"**
6. Chọn file: `vault/99_System/QuickAdd/Add_Transaction_Macro.js`
7. Bật toggle **"Add to command palette"**

### Bước 2: Gán phím tắt
1. Settings → Hotkeys → Tìm: `QuickAdd: 💸 Nhập Giao dịch`
2. Gán phím tắt ví dụ: `Cmd + Shift + T`

### Bước 3: Test QuickAdd
Bấm `Cmd + Shift + T` → Form hiện ra → Điền thông tin:

```
Loại: Chi tiêu
Tài khoản: Tpbank
Số tiền: 65000
Ghi chú: Highlands Coffee
% Hoàn tiền: 5
```

✅ **Kết quả mong đợi:** Toast "🎉 GHI THÀNH CÔNG!" xuất hiện, giao dịch vào Supabase.

---

## PHẦN 3: Nhập liệu qua Monthly Log (Phương pháp chính)

### Cách 1: Gõ tự nhiên (Auto-sync sau 1.5 giây dừng gõ)

Mở `vault/01_Monthly_Logs/2026-05.md`, thêm vào mục `> [!todo] 📥 Unsynced`:

```
> - ăn trưa 55k Vpbank
> - Lâm shopee zakka 115k -8% Tpbank
> - Nam vay 500k Vpbank
> - nhận lương 20tr Tpbank
> - chuyển 1tr từ Tpbank sang MoMo
```

**Daemon đang chạy?** Kiểm tra Terminal: `npm run watch-vault`

### Cách 2: Paste từ Google Sheet (MỚI ✨)

Copy trực tiếp 1 dòng từ Sheet (không cần header), paste vào Unsynced:

```
> - Out	06-05	Điện T4	1.971.346	1,00	Power
> - Out	01-05	Youtube 2026-05 [2 slots] [29,243]/6	58.485	0,00	Youtube
> - In	15-05	Lương tháng 5	20.000.000	0,00	Tpbank
```

AI sẽ tự nhận diện format Sheet và parse đúng! Kết quả mẫu:
- Điện T4 → `amount: 1971346, cbPct: 1%, account: Power`
- Youtube → `amount: 58485, cbPct: 0%, account: Youtube`

> **💡 Lưu ý:** Nếu ShopSource không khớp với tên account trong DB, AI vẫn sẽ tạo txn với account_name đó. Bạn có thể thêm account trên Supabase rồi chạy `npm run generate-pages`.

---

## PHẦN 4: Setup n8n Sync Google Sheets

### Kiến trúc
```
Supabase DB → n8n Webhook → Google Sheets
```

### Bước 1: Tạo Google Sheet
1. Tạo Sheet mới tên: `Obsidian Money - Sync`
2. Thêm header row (Row 1):

| ID | Type | Date | Shop | Notes | Amount | % Back | đ Back | Σ Back | Final Price | ShopSource | Account |
|---|---|---|---|---|---|---|---|---|---|---|---|

### Bước 2: Tạo Webhook trên n8n
1. Mở n8n (self-hosted hoặc n8n.io)
2. New Workflow → **Webhook** trigger
3. Method: `POST`, Path: `/obsidian-txn-sync`
4. Copy URL: `https://your-n8n.domain.com/webhook/obsidian-txn-sync`

### Bước 3: Map dữ liệu trong n8n
Thêm node **"Google Sheets"** → Action: **"Append Row"**:

| Sheet Column | n8n Expression |
|---|---|
| ID | `{{ $json.body.id }}` |
| Type | `{{ $json.body.type == 'expense' ? 'Out' : 'In' }}` |
| Date | `{{ $json.body.occurred_at.substring(8,10) }}-{{ $json.body.occurred_at.substring(5,7) }}` |
| Notes | `{{ $json.body.note }}` |
| Amount | `{{ $json.body.amount }}` |
| % Back | `{{ ($json.body.cashback_share_percent || 0) * 100 }}` |
| đ Back | `{{ $json.body.cashback_share_fixed || 0 }}` |
| Σ Back | `{{ $json.body.metadata?.cb_amount || 0 }}` |
| Final Price | `{{ $json.body.metadata?.final_price || $json.body.amount }}` |
| Account | `{{ $json.body.account_name }}` |

### Bước 4: Cài Webhook vào Supabase
Vào Supabase → Database → Webhooks → **Create Webhook**:
- Table: `transactions`
- Events: ✅ INSERT
- URL: `https://your-n8n.domain.com/webhook/obsidian-txn-sync`
- HTTP Method: POST

### Bước 5: Test Webhook
Tạo 1 txn từ Obsidian (gõ vào Unsynced, đợi sync):

**Txn test mẫu:** `> - highlands 65k Tpbank -5%`

**Kết quả trong Sheet sau ~10 giây:**

| ID | Type | Date | Notes | Amount | % Back | Σ Back | Final Price | Account |
|---|---|---|---|---|---|---|---|---|
| abc12 | Out | 18-05 | highlands | 65000 | 5.00 | 3250 | 61750 | Tpbank |

---

## PHẦN 5: CLI Mode (Nhập liệu qua Terminal)

### Cách dùng (hiện tại)
Daemon chạy ngầm nên chỉ cần **paste trực tiếp vào file Obsidian** là đủ. Nhưng nếu muốn dùng terminal:

```bash
# Chạy daemon (nếu chưa chạy)
cd /Users/rei/Library/Mobile\ Documents/com~apple~CloudDocs/github2026/biz-docs
npm run watch-vault

# Sau đó trong terminal khác, append txn vào file:
echo "> - ăn sáng 45k Vpbank" >> vault/01_Monthly_Logs/2026-05.md
```

Daemon sẽ pick up ngay và parse!

### Ví dụ input đầy đủ để test

**Natural language:**
```
> - ăn trưa 55k Vpbank
> - Lâm shopee zakka 115k -8% Tpbank
> - Hương vay 300k Vpbank
> - nhận lương 20tr Tpbank
> - cafe 35k MoMo phí 2k
```

**Sheet format (paste thẳng từ Google Sheet):**
```
> - Out	06-05	Điện T4	1.971.346	1,00	Power
> - Out	01-05	iCloud 2026-05 [2 slots] [43,150]/6	86.300	0,00	iCloud
> - In	15-05	Lương tháng 5	20.000.000	0,00	Tpbank
```

---

## PHẦN 6: Xử lý Giao dịch có liên đới (Debt + CB)

### Txn có người (Debt tracking)
```
> - Lâm mua đồ shopee 115k -8% Tpbank
```
→ Tạo debt record: Lâm nợ bạn `115k - 8% = 105,800đ`
→ Cashback cycle Tpbank: +9,200đ virtual CB

### Txn trả nợ
```
> - Nam trả nợ 2 triệu vào Tpbank
```
→ FIFO repayment: tự trừ dần các khoản nợ cũ của Nam

### Kiểm tra sau khi tạo txn
1. **Supabase** → Table `transactions` → xem row mới nhất
2. **Supabase** → Table `debts` → xem nợ mới tạo (nếu có person)
3. **Supabase** → Table `cashback_cycles` → xem spent_amount tăng
4. **Google Sheet** → xem row mới (nếu n8n đã setup)
5. **Obsidian** → File `Lâm.md` → bảng Dataview tự refresh

---

## PHẦN 7: Tái sinh Pages (khi thêm Account/People mới)

```bash
cd /Users/rei/Library/Mobile\ Documents/com~apple~CloudDocs/github2026/biz-docs
npm run generate-pages
```

Chạy lệnh này bất cứ khi nào bạn:
- Thêm thẻ mới trên Supabase
- Thêm người bạn mới
- Muốn refresh lại toàn bộ Dashboard Dataview
