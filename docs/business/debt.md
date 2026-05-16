# Đặc tả nghiệp vụ: Debt

## 1) Tổng quan nghiệp vụ

**Debt** (Khoản vay/nợ) là thực thể ghi nhận các khoản tiền cho mượn hoặc đi vay trong hệ thống Money Flow, bao gồm:

- **Lent (Cho vay)**: Mình cho người khác mượn tiền → tiền ra khỏi account
- **Borrowed (Đi vay)**: Mình mượn của người khác tiền → tiền vào account

Debt luôn gắn liền với một **Person** (người vay/người cho vay) và một **Account** (nơi tiền ra/vào). Mọi khoản nợ đều được track chi tiết theo từng lần trả (repayment) cho đến khi tất toán (settled).

### Mối quan hệ cốt lõi

```
Debt ↔ Transaction ↔ Person ↔ Account
```

- **Debt → Transaction**: Mỗi khoản vay tạo ra transaction loại `debt`, mỗi lần trả tạo ra transaction loại `repayment`
- **Debt → Person**: Bắt buộc phải có người liên quan (không có anonymous debt)
- **Debt → Account**: Tiền phải ra/vào từ một account cụ thể
- **Repayment → Debt**: Nhiều repayment có thể link với 1 debt gốc

---

## 2) Debt Role (debt_role)

Giá trị chuẩn cho `debt_role`:

| Giá trị | Ý nghĩa | Dòng tiền | Ví dụ |
|---|---|---|---|
| `lent` | Mình cho người khác mượn | Tiền **ra** khỏi account | Cho Nam mượn 2,000,000đ từ Tiền mặt |
| `borrowed` | Mình mượn của người khác | Tiền **vào** account | Mượn Linh 3,000,000đ vào Techcombank |

> **Nguyên tắc:** `debt_role` xác định chiều dòng tiền và cách tính outstanding balance:
> - `lent`: Outstanding = original_amount - Σ(repayments) → số dương là tiền chưa thu hồi được
> - `borrowed`: Outstanding = original_amount - Σ(repayments) → số dương là tiền chưa trả hết

---

## 3) Trạng thái debt (debt_status)

Giá trị chuẩn cho `status`:

| Trạng thái | Ý nghĩa | Điều kiện | UI Badge |
|---|---|---|---|
| `pending` | Còn nợ chưa trả hết | remaining_amount > 0 AND repaid_amount = 0 | 🔴 Đỏ |
| `partial` | Đã trả một phần | remaining_amount > 0 AND repaid_amount > 0 | 🟡 Vàng |
| `settled` | Đã trả hết | remaining_amount = 0 (hoặc ≤ 0) | 🟢 Xanh |
| `cancelled` | Hủy | Debt không còn hiệu lực | ⚫ Xám |

> **Lưu ý:** Status được cập nhật tự động dựa trên công thức tính remaining_amount, không nhập tay.

---

## 4) Thuộc tính cốt lõi

| Field | Kiểu dữ liệu | Mô tả | Bắt buộc |
|---|---|---|---|
| `id` | UUID | Định danh duy nhất của debt record | Có |
| `original_amount` | Integer (VND) | Số tiền gốc ban đầu (luôn dương) | Có |
| `repaid_amount` | Integer (VND) | Tổng số tiền đã trả lại (tính từ Σ repayments posted) | Formula |
| `remaining_amount` | Integer (VND) | Số tiền còn nợ = original_amount - repaid_amount | Formula |
| `due_date` | Date | Ngày hẹn trả (có thể null nếu không có) | Không |
| `person_id` | UUID | ID người liên quan (người vay nếu lent, người cho vay nếu borrowed) | Có |
| `account_id` | UUID | ID account mà tiền ra/vào | Có |
| `debt_role` | Enum | `lent` hoặc `borrowed` | Có |
| `status` | Enum | `pending/partial/settled/cancelled` | Có (formula) |
| `notes` | String | Ghi chú mô tả khoản nợ | Không |
| `occurred_at` | Date/Timestamp | Ngày phát sinh khoản nợ | Có |
| `created_at` | Timestamp | Thời điểm tạo record | System |
| `updated_at` | Timestamp | Thời điểm cập nhật gần nhất | System |
| `metadata` | JSON | Dữ liệu mở rộng (bulk_allocation, tags, v.v.) | Không |

### Fields tính toán (Formula-only)

| Field | Công thức |
|---|---|
| `repaid_amount` | `=SUMIFS(Repayments!amount, Repayments!debt_id, [@id], Repayments!status, "posted")` |
| `remaining_amount` | `=[@original_amount] - [@repaid_amount]` |
| `status` | `=IF([@remaining_amount]<=0, "settled", IF([@repaid_amount]>0, "partial", "pending"))` |
| `progress_percent` | `=[@repaid_amount]/[@original_amount]` (format percentage) |

---

## 5) Quy tắc nghiệp vụ bắt buộc

### 5.1 Công thức tính remaining amount

```
remaining_amount = original_amount - Σ(repayment amounts where status = posted)
```

- Chỉ tính repayments có `status = posted`
- Amount luôn là số dương, chiều dòng tiền xác định bởi `debt_role`
- Nếu remaining_amount ≤ 0 → tự động chuyển status = `settled`

### 5.2 Debt phải gắn với person (no anonymous debt)

- Giao dịch `type = debt` BẮT BUỘC phải có `person_id`
- Giao dịch `type = repayment` BẮT BUỘC phải có `person_id`
- Không tồn tại debt vô chủ trong hệ thống

### 5.3 Repayment không được vượt quá original_amount (handle overpayment)

**Trường hợp 1: Overpayment vô tình**
- User trả nhiều hơn số nợ còn lại (ví dụ: nợ 1,000,000đ nhưng trả 1,500,000đ)
- Xử lý: Vẫn ghi nhận full repayment amount
- remaining_amount = 0 (không âm)
- Phần overpayment có thể:
  - Coi như tip/lãi (không refund)
  - Hoặc credit vào debt tiếp theo của cùng person đó

**Trường hợp 2: Overpayment cố ý (trả lãi)**
- User muốn trả thêm tiền lãi
- Xử lý: Thêm field `interest_amount` trong metadata để track riêng
- `principal_amount` vẫn capped ở original_amount

### 5.4 Khi remaining = 0 → tự động chuyển status = settled

```gs
=IF(remaining_amount <= 0, "settled", IF(repaid_amount > 0, "partial", "pending"))
```

- Không cần thao tác thủ công
- Trigger tự động khi repayment được tạo/update

### 5.5 Partial repayment được phép (nhiều lần trả)

- Một debt có thể có nhiều repayments (1-n relationship)
- Mỗi repayment có thể có amount khác nhau
- Tổng repayments không được vượt quá original_amount (trừ overpayment case)

### 5.6 Debt cancelled không tính vào outstanding balance

- Khi `status = cancelled`, debt được loại khỏi tính toán outstanding balance
- Repayments đã tạo trước đó vẫn giữ nguyên
- Cancelled debt nên có note giải thích lý do

### 5.7 Due date: cảnh báo khi quá hạn

```gs
=IF(AND(due_date <> "", TODAY() > due_date, status <> "settled"), "OVERDUE", "")
```

- Overdue badge hiển thị màu đỏ
- Có thể gửi notification nhắc nhở

### 5.8 FIFO allocation cho repayments (First-In-First-Out)

Khi một repayment không chỉ định cụ thể debt nào để trả:
- Ưu tiên trả debt cũ nhất (theo occurred_at)
- Nếu debt cũ đã settled, chuyển sang debt kế tiếp
- Logic này đặc biệt quan trọng khi 1 person có nhiều debt đồng thời

### 5.9 Tag matching cho repayments

Nếu repayment có `debt_cycle_tag`:
- Ưu tiên trả debt có cùng tag trước
- Nếu không có debt cùng tag, fallback về FIFO

### 5.10 Cashback calculation trên debt transactions

Debt transactions có thể có cashback (nếu chi bằng thẻ tín dụng):
```
final_price = amount - cashback
cashback = (amount × percent/100) + fixed_amount
```

- Cashback thuộc về chủ thẻ, không phải person vay
- Track cashback trong metadata để tính final_price chính xác

---

## 6) Vòng đời trạng thái

```text
                    ┌─────────────┐
                    │   pending   │ ← Tạo debt mới (chưa trả gì)
                    └──────┬──────┘
                           │ Trả lần đầu (repaid_amount > 0)
                           ▼
                    ┌─────────────┐
                    │   partial   │ ← Đang trả dần
                    └──────┬──────┘
                           │ Trả hết (remaining_amount = 0)
                           ▼
                    ┌─────────────┐
                    │   settled   │ ← Tất toán xong
                    └─────────────┘

                    ┌─────────────┐
                    │   pending   │
                    └──────┬──────┘
                           │ Hủy debt (không còn hiệu lực)
                           ▼
                    ┌─────────────┐
                    │  cancelled  │ ← Hủy bỏ
                    └─────────────┘

                    ┌─────────────┐
                    │   partial   │
                    └──────┬──────┘
                           │ Hủy debt (hiếm)
                           ▼
                    ┌─────────────┐
                    │  cancelled  │
                    └─────────────┘
```

### Điều kiện chuyển trạng thái

| Từ | Đến | Điều kiện |
|---|---|---|
| `pending` | `partial` | Có repayment đầu tiên được tạo (repaid_amount > 0) |
| `partial` | `settled` | remaining_amount ≤ 0 |
| `pending` | `settled` | Repayment full amount ngay lần đầu |
| `pending` | `cancelled` | User hủy debt (có thể do thỏa thuận khác) |
| `partial` | `cancelled` | User hủy debt giữa chừng (hiếm) |

> **Lưu ý:** Không có đường chuyển từ `settled` hoặc `cancelled` sang trạng thái khác (terminal states).

---

## 7) Quan hệ dữ liệu

### 7.1 Debt → Transaction (one-to-many)

```
Debt (original) → Transaction (type = debt)
Debt → Transactions (type = repayment, nhiều records)
```

- Debt gốc tạo 1 transaction loại `debt`
- Mỗi repayment tạo 1 transaction loại `repayment`
- Tất cả transactions share cùng `person_id`

### 7.2 Debt → Person (many-to-one, bắt buộc)

```
Debt.person_id → Person.id
```

- Person là người vay (nếu debt_role = lent)
- Person là người cho vay (nếu debt_role = borrowed)
- Một person có thể có nhiều debts đồng thời

### 7.3 Debt → Account (many-to-one)

```
Debt.account_id → Account.id
```

- Account là nơi tiền ra (nếu lent) hoặc vào (nếu borrowed)
- Ảnh hưởng trực tiếp đến current_balance của account

### 7.4 Repayment → Debt (many-to-one)

```
Repayment.debt_id → Debt.id (qua metadata.bulk_allocation hoặc implicit linking)
```

- Nhiều repayments có thể link với 1 debt
- Linking qua:
  - Explicit: metadata.bulk_allocation.debts[]
  - Implicit: FIFO allocation hoặc tag matching

### 7.5 Debt → CashbackCycle (indirect)

```
Debt transaction → persisted_cycle_tag → CashbackCycle
```

- Nếu debt transaction dùng thẻ tín dụng, nó thuộc về 1 cashback cycle
- Cashback được tính vào cycle của account phát sinh

---

## 8) Tích hợp Google Sheets (Debts master tab)

### 8.1 Mục tiêu

Tab `Debts` là bảng master để:
- Track tất cả khoản vay/nợ theo person
- Tính outstanding balance tự động từ repayments
- Link với tab `Transactions` và `People`
- Cung cấp dữ liệu cho dashboard debt tracking

### 8.2 Mapping cột khuyến nghị cho tab `Debts`

| Cột | Field | Bắt buộc | Ghi chú |
|---|---|---|---|
| A | `debt_id` | Có | UUID duy nhất |
| B | `occurred_at` | Có | Ngày tạo debt (dd/mm/yyyy) |
| C | `person_id` | Có | ID người liên quan |
| D | `person_name` | Không | Tên người (display) |
| E | `account_id` | Có | ID account tiền ra/vào |
| F | `account_name` | Không | Tên account (display) |
| G | `debt_role` | Có | lent/borrowed |
| H | `original_amount` | Có | Số tiền gốc (VND) |
| I | `repaid_amount` | Formula | Tổng đã trả |
| J | `remaining_amount` | Formula | Còn nợ |
| K | `status` | Formula | pending/partial/settled/cancelled |
| L | `due_date` | Không | Ngày hẹn trả |
| M | `overdue_flag` | Formula | OVERDUE nếu quá hạn |
| N | `progress_percent` | Formula | % đã trả |
| O | `progress_bar` | Formula | Visual progress (▓▓▓░░) |
| P | `last_repayment_date` | Formula | Ngày trả gần nhất |
| Q | `notes` | Không | Ghi chú |
| R | `metadata_json` | Không | JSON metadata |
| S | `created_at` | Không | Timestamp tạo |
| T | `updated_at` | Không | Timestamp cập nhật |

### 8.3 Tab `DebtRepayments` (chi tiết repayments)

| Cột | Field | Bắt buộc | Ghi chú |
|---|---|---|---|
| A | `repayment_id` | Có | UUID duy nhất |
| B | `repayment_date` | Có | Ngày trả (dd/mm/yyyy) |
| C | `debt_id` | Có | Link về Debts tab |
| D | `person_id` | Có | ID người trả |
| E | `person_name` | Không | Tên người (display) |
| F | `account_id` | Có | Account nhận tiền |
| G | `amount` | Có | Số tiền trả (VND) |
| H | `status` | Có | posted/pending/void |
| I | `notes` | Không | Ghi chú |
| J | `allocated_to_debts` | Không | JSON bulk_allocation |
| K | `created_at` | Không | Timestamp tạo |

### 8.4 Nguyên tắc nhập liệu

- Mỗi dòng `Debts` là 1 khoản vay gốc độc nhất
- Mỗi dòng `DebtRepayments` là 1 lần trả nợ
- Amount luôn nhập số dương, chiều dòng tiền xác định bởi `debt_role`
- Chỉ `status = posted` mới tính vào repaid_amount
- Date format: `dd/mm/yyyy`
- VND format: `#,##0` (không decimal)

---

## 9) Ví dụ dữ liệu debt thực tế

### 9.1 Debt gốc - Cho Nam mượn tiền

| debt_id | occurred_at | person_id | person_name | account_id | account_name | debt_role | original_amount |
|---|---|---|---|---|---|---|---:|
| DEBT_001 | 10/03/2026 | PER_001 | Nam | ACC_CASH_001 | Tiền mặt | lent | 2000000 |

### 9.2 Repayment lần 1 - Nam trả 500,000đ

| repayment_id | repayment_date | debt_id | person_id | account_id | amount | status | notes |
|---|---|---|---|---|---:|---|---|
| REPAY_001 | 20/03/2026 | DEBT_001 | PER_001 | ACC_CASH_001 | 500000 | posted | Nam trả nợ lần 1 |

Sau repayment này:
- `repaid_amount` = 500,000
- `remaining_amount` = 1,500,000
- `status` = `partial`
- `progress_percent` = 25%

### 9.3 Repayment lần 2 - Nam trả hết 1,500,000đ

| repayment_id | repayment_date | debt_id | person_id | account_id | amount | status | notes |
|---|---|---|---|---|---:|---|---|
| REPAY_002 | 30/03/2026 | DEBT_001 | PER_001 | ACC_CASH_001 | 1500000 | posted | Nam trả hết nợ |

Sau repayment này:
- `repaid_amount` = 2,000,000
- `remaining_amount` = 0
- `status` = `settled`
- `progress_percent` = 100%

### 9.4 Debt borrowed - Mình mượn Linh tiền

| debt_id | occurred_at | person_id | person_name | account_id | account_name | debt_role | original_amount |
|---|---|---|---|---|---|---|---:|
| DEBT_002 | 15/03/2026 | PER_002 | Linh | ACC_TCB_001 | Techcombank | borrowed | 3000000 |

- Dòng tiền: **+3,000,000** vào Techcombank
- Outstanding: 3,000,000 (mình còn nợ Linh)

---

## 10) Edge cases cần handle

### 10.1 Overpayment (trả nhiều hơn nợ)

**Kịch bản:** Nợ 1,000,000đ nhưng trả 1,500,000đ

**Xử lý:**
- `repaid_amount` = 1,500,000 (ghi nhận đầy đủ)
- `remaining_amount` = 0 (capped at 0, không âm)
- `status` = `settled`
- Metadata lưu `overpayment_amount` = 500,000 để reference

**Formula:**
```gs
remaining_amount = MAX(0, original_amount - repaid_amount)
```

### 10.2 Debt cancelled sau khi đã partial repay

**Kịch bản:** Đã trả 500,000/2,000,000đ, sau đó debt bị hủy (thỏa thuận khác)

**Xử lý:**
- `status` chuyển sang `cancelled`
- `remaining_amount` vẫn giữ nguyên (1,500,000) nhưng không tính vào outstanding balance
- Repayments đã tạo vẫn giữ nguyên
- Note nên giải thích lý do cancel

**Formula lọc cancelled debts:**
```gs
outstanding_balance = SUMIFS(remaining_amount, status, "<>cancelled")
```

### 10.3 Cùng 1 người có nhiều debt đồng thời

**Kịch bản:** Nam mượn 3 lần:
- DEBT_001: 1,000,000đ (10/01/2026)
- DEBT_002: 2,000,000đ (15/02/2026)
- DEBT_003: 500,000đ (01/03/2026)

**Xử lý:**
- Track riêng từng debt record
- Per-person outstanding = SUM(remaining_amounts của tất cả debts chưa settled)
- Repayment allocation: FIFO (trả debt cũ nhất trước) hoặc explicit qua metadata

**Formula per-person outstanding:**
```gs
=SUMIFS(Debts!$J:$J, Debts!$C:$C, person_id, Debts!$K:$K, "<>settled", Debts!$K:$K, "<>cancelled")
```

### 10.4 Debt liên quan đến transfer (cho mượn bằng chuyển khoản)

**Kịch bản:** Cho Nam mượn 5,000,000đ bằng cách chuyển từ Techcombank sang tài khoản Nam

**Xử lý:**
- Tạo 2 transactions:
  1. `type = debt`, `debt_role = lent`, `account_id = ACC_TCB_001`, `amount = 5,000,000`
  2. `type = transfer_out` (nếu cần track bank transfer fee riêng)
- Hoặc chỉ 1 transaction `debt` là đủ, transfer ngầm hiểu

**Lưu ý:** Không tạo double-counting (vừa debt vừa transfer_out).

### 10.5 Repayment không chỉ định debt cụ thể (unallocated)

**Kịch bản:** Nam trả 1,000,000đ nhưng không nói là trả debt nào

**Xử lý:**
- Áp dụng FIFO: tự động allocate vào debt oldest nhất còn pending
- Nếu có `debt_cycle_tag`, ưu tiên match cùng tag
- Lưu allocation result trong metadata.bulk_allocation

### 10.6 Debt với interest (có lãi)

**Kịch bản:** Cho mượn 1,000,000đ,约定 trả 1,100,000đ (100k lãi)

**Xử lý:**
- `original_amount` = 1,000,000 (principal only)
- Repayment total = 1,100,000
- Metadata lưu `interest_amount` = 100,000
- `remaining_amount` capped ở 0 sau khi principal được trả hết

**Alternative:** Tạo 2 debt records:
1. Principal debt: 1,000,000
2. Interest debt: 100,000 (separate tracking)

---

## 11) Checklist triển khai cho agent/codegen

- [ ] Debt BẮT BUỘC phải có `person_id` (không cho phép anonymous)
- [ ] Debt BẮT BUỘC phải có `account_id` (tiền ra/vào từ đâu)
- [ ] `debt_role` phải là `lent` hoặc `borrowed`
- [ ] `original_amount` luôn dương, không lưu âm
- [ ] `repaid_amount` tính tự động từ SUM(repayments posted)
- [ ] `remaining_amount` = MAX(0, original_amount - repaid_amount)
- [ ] `status` tự động update: pending → partial → settled
- [ ] Chỉ tính repayments có `status = posted`
- [ ] Handle overpayment: remaining_amount capped at 0
- [ ] Exclude cancelled debts khỏi outstanding balance calculation
- [ ] Implement FIFO allocation cho unallocated repayments
- [ ] Support tag matching cho repayments với debt_cycle_tag
- [ ] Due date validation: cảnh báo overdue
- [ ] Progress bar visualization (% đã trả)
- [ ] Link với People tab để hiển thị person_name
- [ ] Link với Accounts tab để tính impact vào current_balance
- [ ] Metadata JSON lưu bulk_allocation, interest_amount, v.v.
- [ ] Không hard delete debt, chỉ set status = cancelled nếu cần
- [ ] Audit trail: giữ tất cả repayments history

---

## 12) Formulas tổng hợp debt tracking

### 12.1 Total outstanding lent (tiền cho mượn chưa thu hồi)

```gs
=SUMIFS(Debts!$J:$J, Debts!$G:$G, "lent", Debts!$K:$K, "<>settled", Debts!$K:$K, "<>cancelled")
```

### 12.2 Total outstanding borrowed (tiền đi vay chưa trả)

```gs
=SUMIFS(Debts!$J:$J, Debts!$G:$G, "borrowed", Debts!$K:$K, "<>settled", Debts!$K:$K, "<>cancelled")
```

### 12.3 Net debt position (receivable - payable)

```gs
= (Total outstanding lent) - (Total outstanding borrowed)
```

Số dương: Mình đang có nhiều tiền phải thu hơn phải trả  
Số âm: Mình đang nợ nhiều hơn được nợ

### 12.4 Per-person outstanding balance

```gs
=SUMIFS(Debts!$J:$J, Debts!$C:$C, person_id, Debts!$K:$K, "<>settled", Debts!$K:$K, "<>cancelled")
```

### 12.5 Danh sách debts quá hạn (overdue)

```gs
=FILTER(Debts!A:T, Debts!$L:$L < TODAY(), Debts!$K:$K <> "settled", Debts!$K:$K <> "cancelled", Debts!$L:$L <> "")
```

---

**Version:** 1.0  
**Created:** March 2026  
**Last Review:** March 2026
