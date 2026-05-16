# People - Business Specification

## 1. Tổng quan nghiệp vụ

### 1.1 Person là gì?
Person (Người) trong hệ thống Money Flow là **danh bạ tài chính** (financial contact), không phải user account. Đây là đại diện cho những người có liên quan đến dòng tiền của bạn.

### 1.2 Ba vai trò chính của Person

| Vai trò | Mô tả | Ví dụ |
|---------|-------|-------|
| **Người vay** (debt_role = lent) | Người mà bạn cho mượn tiền | Nam mượn 2 triệu chưa trả |
| **Người cho vay** (debt_role = borrowed) | Người mà bạn mượn tiền của họ | Linh cho bạn mượn 3 triệu |
| **Người nhận cashback share** | Người được chia sẻ cashback từ chi tiêu của bạn | Hùng được share 50% cashback từ thẻ Techcombank |

### 1.3 Phân biệt với các khái niệm khác

- **Person ≠ User**: Person không đăng nhập được, chỉ là record lưu thông tin liên lạc
- **Person ≠ Account**: Person không giữ tiền, chỉ gắn với transactions/debts
- **Person là bắt buộc** khi tạo debt/repayment transaction

---

## 2. Thuộc tính cốt lõi

| Field | Kiểu dữ liệu | Bắt buộc | Mô tả |
|-------|-------------|----------|-------|
| `id` | UUID | ✅ | Unique identifier |
| `name` | String (max 100) | ✅ | Tên đầy đủ (unique) |
| `nickname` | String (max 50) | ❌ | Biệt danh hiển thị (Nam "cạ cứng", Linh "tài chính") |
| `phone` | String (max 20) | ❌ | Số điện thoại (dùng để tìm kiếm, unique nếu có) |
| `avatar` | String (URL) | ❌ | Link ảnh đại diện |
| `note` | Text | ❌ | Ghi chú thêm (quan hệ, công ty, ghi nhớ đặc biệt) |
| `is_favorite` | Boolean | ❌ (default: false) | Đánh dấu yêu thích, hiển thị đầu danh sách |
| `status` | Enum | ✅ (default: active) | `active` \| `archived` |
| `created_at` | Timestamp | ✅ | Thời gian tạo |
| `updated_at` | Timestamp | ✅ | Thời gian cập nhật gần nhất |
| `total_lent_outstanding` | Decimal (computed) | ❌ | Tổng tiền còn cho người này mượn |
| `total_borrowed_outstanding` | Decimal (computed) | ❌ | Tổng tiền còn nợ người này |
| `net_position` | Decimal (computed) | ❌ | lent_outstanding - borrowed_outstanding |
| `total_cashback_shared` | Decimal (computed) | ❌ | Tổng cashback đã share cho người này |
| `last_transaction_date` | Date (computed) | ❌ | Ngày giao dịch gần nhất liên quan |

---

## 3. Person Status

### 3.1 `active`
- Đang sử dụng bình thường
- Hiển thị trong tất cả UI dropdowns, lists
- Có thể tạo transactions/debts mới

### 3.2 `archived`
- Ẩn khỏi UI chính nhưng data vẫn giữ nguyên
- Không thể tạo transactions/debts mới
- Vẫn hiển thị trong historical reports
- **Không hard delete** nếu đã có transactions/debts liên quan

### 3.3 Khi nào archive?
- Người đó không còn liên quan tài chính nữa
- Quan hệ kết thúc (nhân viên nghỉ việc, đối tác ngừng hợp tác)
- Muốn dọn dẹp danh sách nhưng cần giữ lịch sử

---

## 4. Financial Summary (Computed Fields)

### 4.1 `total_lent_outstanding`
```
Tổng tiền mình còn cho người này mượn chưa đòi lại được
= SUM(debts WHERE person_id = X AND debt_role = 'lent' AND status IN ('pending', 'partial'))
```

**Ví dụ:** 
- Nam mượn 3 lần: 2M, 1M, 500k
- Đã trả 2 lần: 1M, 500k
- `total_lent_outstanding` = 2M (còn nợ)

### 4.2 `total_borrowed_outstanding`
```
Tổng tiền mình còn nợ người này chưa trả
= SUM(debts WHERE person_id = X AND debt_role = 'borrowed' AND status IN ('pending', 'partial'))
```

**Ví dụ:**
- Mượn Linh 3 lần: 3M, 2M, 1M
- Đã trả 1 lần: 2M
- `total_borrowed_outstanding` = 4M (còn nợ)

### 4.3 `net_position`
```
= total_lent_outstanding - total_borrowed_outstanding
```

**Diễn giải:**
- **Dương (+)**: Người này đang nợ mình nhiều hơn mình nợ họ
- **Âm (-)**: Mình đang nợ người này nhiều hơn họ nợ mình
- **0**: Hòa nhau (hoặc không có debt nào)

### 4.4 `total_cashback_shared`
```
Tổng cashback đã share cho người này (lifetime)
= SUM(transactions WHERE cashback_share_person_id = X AND cashback_share_amount > 0)
```

### 4.5 `last_transaction_date`
```
Ngày giao dịch gần nhất liên quan đến người này
= MAX(transactions WHERE person_id = X OR cashback_share_person_id = X)
```

---

## 5. Business Rules

### Rule 5.1: Track riêng lent và borrowed
Một person có thể vừa là người vay (lent) vừa là người cho vay (borrowed) cùng lúc. **Không net off** 2 chiều này trong database, chỉ net off khi hiển thị `net_position`.

**Ví dụ:**
- Bạn cho Nam mượn 2M (lent)
- Bạn mượn của Nam 1M (borrowed)
- Database: 2 debts riêng biệt
- Display: net_position = +1M (Nam còn nợ bạn 1M)

### Rule 5.2: Person phải tồn tại trước khi tạo debt
Không thể tạo debt/repayment transaction với person_id chưa tồn tại. Phải tạo person record trước.

### Rule 5.3: Không xóa person nếu còn outstanding debt
Nếu person còn bất kỳ debt nào với status `pending` hoặc `partial`, không được phép xóa (chỉ được archive sau khi settle hết).

### Rule 5.4: is_favorite hiển thị đầu danh sách
Khi `is_favorite = true`, person này luôn hiển thị ở top của dropdown/search results.

### Rule 5.5: Unique constraint
- `name` là unique (không có 2 người cùng tên)
- HOẶC `phone` là unique nếu có (không có 2 người cùng số điện thoại)
- Nếu trùng, phải phân biệt bằng nickname hoặc note

### Rule 5.6: Archive thay vì delete
Khi người dùng muốn "xóa" person:
- Nếu chưa có transactions/debts: cho phép hard delete
- Nếu đã có lịch sử: chỉ cho phép archive

### Rule 5.7: Person name hiển thị format
```
Display name = nickname (nếu có) ELSE name
Example: "Nam 'cạ cứng'" hoặc "Nguyễn Văn Nam"
```

### Rule 5.8: Cashback share person không cần là debtor
Người nhận cashback share không cần có debt relationship. Có thể share cashback cho bất kỳ ai.

---

## 6. Quan hệ dữ liệu

### 6.1 Person → Transactions (one-to-many)
```
Person (1) ←→ (N) Transactions
- Qua field: person_id (debtor/creditor trong debt/repayment txn)
- Qua field: cashback_share_person_id (người nhận cashback share)
```

### 6.2 Person → Debts (one-to-many)
```
Person (1) ←→ (N) Debts
- Một người có thể có nhiều debts (cả lent và borrowed)
- Qua field: person_id trong Debt entity
```

### 6.3 Person → CashbackEntries (indirect)
```
Person (1) ←→ (N) CashbackEntries ←→ CashbackCycle
- Người nhận cashback share được lưu trong CashbackEntry
- Entry link ngược lại person qua person_id
```

### 6.4 Person ↛ Accounts (no direct relationship)
Person không có quan hệ trực tiếp với Accounts. Tiền luôn nằm trong accounts, person chỉ là bên liên quan trong transactions.

---

## 7. Google Sheets Column Mapping

### Tab `People`

| Column | Field | Data Type | Notes |
|--------|-------|-----------|-------|
| A | `id` | UUID | Hidden column |
| B | `name` | String | Tên đầy đủ |
| C | `nickname` | String | Biệt danh (optional) |
| D | `phone` | String | Số điện thoại |
| E | `avatar` | URL | Link ảnh |
| F | `note` | Text | Ghi chú |
| G | `is_favorite` | Boolean | TRUE/FALSE |
| H | `status` | Enum | active/archived |
| I | `total_lent_outstanding` | Decimal | Formula (xem docs/sheets/people-formulas.md) |
| J | `total_borrowed_outstanding` | Decimal | Formula |
| K | `net_position` | Decimal | Formula (= I2 - J2) |
| L | `total_cashback_shared` | Decimal | Formula |
| M | `last_transaction_date` | Date | Formula |
| N | `created_at` | Timestamp | Auto-fill |
| O | `updated_at` | Timestamp | Auto-update |

### Link với tab khác

**Link People → Transactions:**
```
=FILTER(Transactions!A:Z, Transactions!H:H = People!A2)
(H = person_id column trong Transactions)
```

**Link People → Debts:**
```
=FILTER(Debts!A:Z, Debts!E:E = People!A2)
(E = person_id column trong Debts)
```

---

## 8. Ví dụ thực tế

### Example 8.1: Nam - Người vay (lent)
```
Person:
- id: p_001
- name: Nguyễn Văn Nam
- nickname: Nam "cạ cứng"
- phone: 0901234567
- is_favorite: TRUE
- status: active

Debts:
1. Debt #1: lent 2,000,000 (pending)
2. Debt #2: lent 500,000 (partial, đã trả 200k)

Financial Summary:
- total_lent_outstanding: 2,300,000
- total_borrowed_outstanding: 0
- net_position: +2,300,000 (Nam đang nợ mình)
```

### Example 8.2: Linh - Người cho vay (borrowed)
```
Person:
- id: p_002
- name: Trần Thị Linh
- nickname: Linh "tài chính"
- phone: 0907654321
- is_favorite: TRUE
- status: active

Debts:
1. Debt #3: borrowed 3,000,000 (pending)

Financial Summary:
- total_lent_outstanding: 0
- total_borrowed_outstanding: 3,000,000
- net_position: -3,000,000 (mình đang nợ Linh)
```

### Example 8.3: Hùng - Chỉ nhận cashback share
```
Person:
- id: p_003
- name: Lê Văn Hùng
- nickname: Hùng "đồng nghiệp"
- phone: 0909876543
- is_favorite: FALSE
- status: active

Cashback Shares:
1. Transaction #100: share 50,000 VND (50% cashback từ thẻ Techcombank)
2. Transaction #150: share 30,000 VND

Financial Summary:
- total_lent_outstanding: 0
- total_borrowed_outstanding: 0
- net_position: 0
- total_cashback_shared: 80,000
```

### Example 8.4: Lan - Mixed (vừa lent vừa borrowed)
```
Person:
- id: p_004
- name: Phạm Thị Lan
- nickname: Lan "chị gái"
- phone: 0901112223
- is_favorite: TRUE
- status: active

Debts:
1. Debt #4: lent 5,000,000 (cho Lan mượn mua xe, partial đã trả 2M)
2. Debt #5: borrowed 1,000,000 (mượn Lan ăn trưa, pending)

Financial Summary:
- total_lent_outstanding: 3,000,000
- total_borrowed_outstanding: 1,000,000
- net_position: +2,000,000 (Lan còn nợ mình 2M net)
```

---

## 9. Edge Cases

### Case 9.1: Trùng tên (2 người tên Nam)
**Giải pháp:**
- Bắt buộc nhập phone khác nhau
- Hoặc thêm nickname phân biệt: "Nam kế toán", "Nam shipper"
- Hệ thống reject nếu name + phone đều trùng

### Case 9.2: Person đã archived nhưng có debt pending
**Xử lý:**
- Không cho archive nếu còn outstanding debts
- Hiển thị error: "Cannot archive. Outstanding debts: 2,300,000 VND. Please settle first."
- User phải settle hoặc transfer debts sang person khác trước khi archive

### Case 9.3: Merge 2 person records thành 1
**Scenario:** Tạo nhầm 2 records cho cùng 1 người (Nam và Nguyễn Văn Nam)

**Xử lý:**
- Chọn person chính (master)
- Transfer tất cả transactions/debts từ person phụ sang master
- Update person_id trong tất cả related records
- Archive person phụ
- Log audit trail: "Merged p_002 into p_001 at 2026-04-20"

### Case 9.4: Person đổi số điện thoại
**Xử lý:**
- Cập nhật phone field, giữ history trong note
- Note: "Phone cũ: 0901234567 (đổi từ 2026-04-20)"
- Không tạo person mới, update trực tiếp
- Nếu phone mới đã tồn tại → cảnh báo trùng

### Case 9.5: Debt với person đã mất (deceased)
**Xử lý:**
- Archive person với note: "Deceased 2026-04-20"
- Giữ nguyên outstanding debts
- Transfer debts sang estate/person đại diện nếu cần
- Không xóa data

---

## 10. Checklist cho Agent/Codegen

### Person Creation
- [ ] Validate name không trùng (case-insensitive)
- [ ] Validate phone không trùng nếu có
- [ ] Set default status = 'active'
- [ ] Set default is_favorite = false
- [ ] Generate UUID cho id
- [ ] Set created_at = now()
- [ ] Set updated_at = now()

### Person Update
- [ ] Allow update name, nickname, phone, avatar, note, is_favorite
- [ ] Re-validate uniqueness khi update name/phone
- [ ] Update updated_at timestamp
- [ ] Không cho update status từ archived → active (cần flow riêng)

### Person Archive
- [ ] Check outstanding debts (SUM where status IN ['pending', 'partial'])
- [ ] Block archive nếu outstanding > 0
- [ ] Show error message với số tiền cụ thể
- [ ] Set status = 'archived'
- [ ] Update updated_at

### Person Delete (Hard)
- [ ] Only allow if no transactions AND no debts
- [ ] Confirm dialog: "This action cannot be undone"
- [ ] Soft delete preferred over hard delete

### Financial Summary Computation
- [ ] total_lent_outstanding: SUMIFS(debts, person_id, debt_role='lent', status NOT IN ['settled','cancelled'])
- [ ] total_borrowed_outstanding: SUMIFS(debts, person_id, debt_role='borrowed', status NOT IN ['settled','cancelled'])
- [ ] net_position: lent - borrowed
- [ ] total_cashback_shared: SUMIFS(transactions, cashback_share_person_id)
- [ ] last_transaction_date: MAX(txn_date WHERE person_id OR cashback_share_person_id match)

### UI/UX Requirements
- [ ] Favorites hiển thị đầu danh sách (sort by is_favorite DESC, name ASC)
- [ ] Search by name, nickname, phone
- [ ] Badge hiển thị outstanding balance cạnh tên
- [ ] Color code: green nếu net_position > 0 (họ nợ mình), red nếu < 0 (mình nợ họ)
- [ ] Confirm trước khi archive/delete

### API Endpoints Needed
- [ ] GET /people - list all (with filter: status, is_favorite, search)
- [ ] GET /people/:id - get detail with financial summary
- [ ] POST /people - create new
- [ ] PUT /people/:id - update
- [ ] POST /people/:id/archive - archive
- [ ] DELETE /people/:id - hard delete (if allowed)
- [ ] GET /people/:id/transactions - get related transactions
- [ ] GET /people/:id/debts - get related debts
- [ ] GET /people/:id/cashback-shares - get cashback share history

---

## 11. Tóm tắt nhanh

| Khía cạnh | Chi tiết |
|-----------|----------|
| **Entity type** | Danh bạ tài chính (financial contact) |
| **3 vai trò** | Người vay (lent), Người cho vay (borrowed), Người nhận cashback share |
| **Status** | active, archived |
| **Unique fields** | name (bắt buộc), phone (nếu có) |
| **Computed fields** | total_lent_outstanding, total_borrowed_outstanding, net_position, total_cashback_shared, last_transaction_date |
| **Relationships** | Transactions (via person_id, cashback_share_person_id), Debts (via person_id), CashbackEntries (indirect) |
| **Delete policy** | Soft delete (archive) nếu có lịch sử, hard delete chỉ khi chưa có transactions/debts |
| **Business rules** | 8 rules quan trọng (xem section 5) |
| **Edge cases** | Trùng tên, archived với pending debt, merge records, đổi phone, deceased |

---

*Document version: 1.0*  
*Last updated: 2026-04-20*  
*Author: AI Agent*  
*Reference: accounts.md, transactions.md, debt.md, TRANSACTION_SYSTEM_DOCS.md*
