# Installment (Trả góp) - Business Specification

## 1. Tổng quan nghiệp vụ

### Installment là gì trong Money Flow

Installment (trả góp) là giao dịch mua hàng 1 lần nhưng được chia thành nhiều kỳ thanh toán định kỳ.

**Đặc điểm chính:**
- Có số kỳ cố định (total_installments)
- Số tiền mỗi kỳ bằng nhau (hoặc theo lịch trình định trước)
- Có ngày bắt đầu và ngày kết thúc xác định
- Khác với recurring service (subscription vô hạn)

### 2 Loại Installment chính

**A. Credit Card Installment (0% hoặc có phí):**
- Mua hàng qua thẻ tín dụng
- Convert sang trả góp sau khi mua
- Ví dụ: iPhone 24M → 12 tháng x 2M/tháng

**B. Debt Repayment Installment (trả góp nội bộ):**
- Vay tiền bạn bè/người thân
- Trả dần theo thỏa thuận
- Link với entity Debt

### Phân biệt với Recurring Services

| Tiêu chí | Installment | Recurring Service |
|----------|-------------|-------------------|
| Thời hạn | Hữu hạn (N kỳ) | Vô hạn (đến khi cancel) |
| Số kỳ | Cố định | Không áp dụng |
| Mục đích | Trả dần khoản mua lớn | Subscription định kỳ |
| Entity | InstallmentPlan | RecurringService |
| Kết thúc | Tự động khi hết kỳ | Phải manual cancel |

### Ảnh hưởng đến hệ thống

- **Account balance:** Giảm theo từng kỳ thanh toán
- **Cashback:** Tùy policy (xem section 7)
- **Debt balance:** Giảm nếu linked với debt
- **Budget tháng:** Tính vào tháng phát sinh payment

---

## 2. Thuộc tính Installment Plan Entity

| Field | Kiểu dữ liệu | Bắt buộc | Mô tả |
|-------|--------------|----------|-------|
| id | UUID | ✓ | ID duy nhất của plan |
| plan_name | String | ✓ | Tên plan (ví dụ: "iPhone 15 Pro - 12 tháng") |
| original_transaction_id | UUID | ✓* | ID giao dịch mua gốc (*hoặc linked_debt_id) |
| linked_debt_id | UUID | ✓* | ID khoản nợ liên quan (*hoặc original_transaction_id) |
| account_id | UUID | ✓ | Tài khoản thanh toán (thẻ credit/debit) |
| merchant_name | String | ✓ | Tên cửa hàng/người bán |
| category_code | String | ✓ | Category code (từ business-category.md) |
| principal_amount | Integer | ✓ | Số tiền gốc (VND) |
| total_installments | Integer | ✓ | Tổng số kỳ (>1) |
| installment_amount | Integer | ✓ | Số tiền mỗi kỳ (VND) |
| down_payment_amount | Integer | | Tiền trả trước (default: 0) |
| fee_amount | Integer | | Phí chuyển đổi trả góp (default: 0) |
| interest_rate | Decimal | | Lãi suất %/năm (default: 0 cho 0%) |
| start_date | Date | ✓ | Ngày bắt đầu plan |
| first_due_date | Date | ✓ | Ngày đến hạn kỳ đầu tiên |
| next_due_date | Date | ✓ | Ngày đến hạn kỳ tiếp theo |
| end_date | Date | ✓ | Ngày dự kiến kết thúc |
| installments_paid | Integer | | Số kỳ đã thanh toán (default: 0) |
| installments_remaining | Integer | | Số kỳ còn lại (computed) |
| total_paid_amount | Integer | | Tổng đã thanh toán (computed) |
| remaining_balance | Integer | | Số dư còn phải trả (computed) |
| payment_day | Integer | ✓ | Ngày trong tháng thanh toán (1-28) |
| is_auto_post | Boolean | | Tự động tạo transaction khi đến hạn |
| status | Enum | ✓ | active / completed / cancelled / paused |
| notes | Text | | Ghi chú thêm |
| created_at | Timestamp | ✓ | Thời gian tạo |
| updated_at | Timestamp | ✓ | Thời gian cập nhật cuối |

**Computed fields (tự động tính):**
- `installments_remaining = total_installments - installments_paid`
- `remaining_balance = principal_amount + fee_amount - total_paid_amount`
- `end_date = first_due_date + (total_installments - 1) months`

---

## 3. Phân loại Installment

### A. Credit Card Installment

**Đặc điểm:**
- Account_id bắt buộc là credit card
- Merchant là cửa hàng bán lẻ
- Category thường là electronics, shopping, insurance
- Có thể có fee_amount (phí chuyển đổi)
- Interest rate thường = 0 (khuyến mãi 0%)

**Ví dụ:**
```json
{
  "plan_name": "iPhone 15 Pro Max - TGDD",
  "original_transaction_id": "txn_abc123",
  "account_id": "acc_vib_super",
  "merchant_name": "Thế Giới Di Động",
  "category_code": "electronics",
  "principal_amount": 24000000,
  "total_installments": 12,
  "installment_amount": 2000000,
  "down_payment_amount": 4000000,
  "fee_amount": 0,
  "interest_rate": 0,
  "payment_day": 15,
  "is_auto_post": true
}
```

### B. Debt Repayment Installment

**Đặc điểm:**
- Linked_debt_id bắt buộc
- Account_id có thể là debit/cash/wallet
- Merchant là tên người cho vay
- Category thường là debt_repayment
- Không có fee/interest (hoặc thỏa thuận riêng)

**Ví dụ:**
```json
{
  "plan_name": "Trả nợ Lâm",
  "linked_debt_id": "debt_lam_001",
  "account_id": "acc_tcb_debit",
  "merchant_name": "Lâm",
  "category_code": "debt_repayment",
  "principal_amount": 12000000,
  "total_installments": 6,
  "installment_amount": 2000000,
  "payment_day": 10,
  "is_auto_post": false
}
```

### C. Internal Family Installment

**Đặc điểm:**
- Trả góp cho người thân không chính thức
- Có thể có person_id
- Không có original_transaction
- Linh hoạt về payment_day

---

## 4. Business Rules

### RULE-INST-001: Validation khi tạo plan

```
IF original_transaction_id IS NULL AND linked_debt_id IS NULL:
  → ERROR: Must have either original_transaction or linked_debt

IF total_installments <= 1:
  → ERROR: total_installments must be > 1

IF installment_amount <= 0:
  → ERROR: installment_amount must be positive

IF payment_day < 1 OR payment_day > 28:
  → ERROR: payment_day must be between 1-28
```

### RULE-INST-002: Công thức tính toán

```javascript
// Số kỳ còn lại
installments_remaining = MAX(0, total_installments - installments_paid)

// Số dư còn phải trả
remaining_balance = MAX(0, principal_amount + fee_amount - total_paid_amount)

// Ngày kết thúc dự kiến
end_date = EDATE(first_due_date, total_installments - 1)

// Next due date (sau khi thanh toán kỳ hiện tại)
next_due_date = EDATE(last_paid_date, 1)
```

### RULE-INST-003: Status transitions

```
active → completed: Khi installments_remaining = 0
active → cancelled: User hủy plan giữa chừng
active → paused: Tạm ngưng (không tạo payment mới)
cancelled/paused → active: Resume (cần confirm)

completed/cancelled → KHÔNG thể quay lại active
```

### RULE-INST-004: Không được xóa plan đã có payment

```
IF installments_paid > 0:
  → Cannot DELETE, only CANCEL or CLOSE
  → Giữ lịch sử để track budget/cashback
```

### RULE-INST-005: Auto-post behavior

```
IF is_auto_post = true AND next_due_date = TODAY:
  → n8n auto-create installment transaction
  → Status: completed (nếu auto-charge)
         hoặc pending (chờ user confirm)

IF is_auto_post = false:
  → Gửi reminder trước payment_day N ngày
  → User manual create transaction
```

### RULE-INST-006: Link với Debt

```
IF linked_debt_id IS NOT NULL:
  → Mỗi installment payment PHẢI update debt.remaining_balance
  → Khi plan completed → debt.status = settled (nếu fully paid)
  → Payment history append vào debt.repayments
```

### RULE-INST-007: Credit card requirement

```
IF plan_type = "credit_card_installment":
  → account_id PHẢI thuộc loại credit_card
  → Validate account.type == "credit_card"
```

---

## 5. Quan hệ với Transactions

### Transaction Flow

```
Original Transaction (GD0)
    ↓
Installment Plan Created
    ↓
[Kỳ 1] Installment Transaction #1
    ↓
[Kỳ 2] Installment Transaction #2
    ↓
...
    ↓
[Kỳ N] Installment Transaction #N
    ↓
Plan Completed
```

### Metadata structure cho Installment Transaction

```json
{
  "type": "expense",
  "amount": -2000000,
  "account_id": "acc_vib_super",
  "category_code": "electronics",
  "note": "Trả góp iPhone 15 Pro - Kỳ 3/12",
  "metadata": {
    "installment_plan_id": "plan_xyz789",
    "installment_number": 3,
    "total_installments": 12,
    "original_transaction_id": "txn_abc123",
    "is_installment_payment": true
  }
}
```

### Auto-create Transaction (n8n workflow)

**Trigger:** Cron job hàng ngày check `next_due_date = TODAY`

**Steps:**
1. Query plans: `status = 'active' AND next_due_date = TODAY`
2. Với mỗi plan:
   - Tạo transaction với metadata như trên
   - Update `installments_paid += 1`
   - Update `total_paid_amount += installment_amount`
   - Recalculate `remaining_balance`
   - Update `next_due_date = EDATE(TODAY, 1)`
   - Nếu `installments_remaining = 0` → `status = 'completed'`
3. Sync lên Google Sheets

### Manual Payment Flow

Nếu `is_auto_post = false`:
1. Gửi reminder trước N ngày
2. User nhắn chat confirm payment
3. Agent tạo transaction
4. Update plan stats

---

## 6. Quan hệ với Debt

### Khi linked_debt_id được set

**Installment payment tác động đến Debt:**

```
Mỗi installment payment:
  1. Tạo transaction expense
  2. debt.remaining_balance -= installment_amount
  3. debt.repaid_amount += installment_amount
  4. Append repayment record:
     {
       "date": payment_date,
       "amount": installment_amount,
       "transaction_id": txn_id,
       "installment_plan_id": plan_id
     }
  5. IF debt.remaining_balance = 0:
       → debt.status = 'settled'
       → installment_plan.status = 'completed'
```

### Example: Vay bạn Lâm 12M

**Debt record:**
```json
{
  "id": "debt_lam_001",
  "person_id": "person_lam",
  "debt_role": "borrowed",
  "original_amount": 12000000,
  "repaid_amount": 0,
  "remaining_balance": 12000000,
  "status": "pending"
}
```

**Installment Plan:**
```json
{
  "linked_debt_id": "debt_lam_001",
  "principal_amount": 12000000,
  "total_installments": 6,
  "installment_amount": 2000000
}
```

**Sau kỳ 1:**
- Debt: `repaid_amount = 2M`, `remaining = 10M`
- Plan: `installments_paid = 1`, `remaining = 5`

**Sau kỳ 6:**
- Debt: `status = 'settled'`
- Plan: `status = 'completed'`

---

## 7. Quan hệ với Cashback

### ⚠️ DECISION NEEDED

Hiện tại có 2 cách tiếp cận:

**Option A: Cashback tính tại thời điểm mua gốc (RECOMMENDED)**
- Original transaction qualify cashback ngay
- Các kỳ installment sau KHÔNG tính cashback nữa
- Lý do: Tránh double-counting spend

**Option B: Cashback tính theo từng kỳ payment**
- Chỉ installment payment mới tính vào spent_amount
- Original transaction không tính cashback
- Lý do: Phù hợp với cashflow thực tế

### Recommendation cho Money Flow

**Chọn Option A** vì:
1. Đơn giản hơn cho tracking
2. Phù hợp với thực tế thẻ tín dụng VN (cashback khi quẹt thẻ mua hàng)
3. Tránh phức tạp khi refund/cancel giữa kỳ

### Implementation Rule

```
IF original_transaction.category_code IN applicable_categories:
  → Tính cashback tại thời điểm original purchase
  → Mark metadata.cashback_calculated = true

Các installment payments sau:
  → metadata.affects_cashback = false
  → Không cộng vào spent_amount của cycle
```

### Special Cases

**Internal transfer / Debt repayment:**
- `affects_cashback = false` (không tính cashback)
- Category: debt_repayment, internal_transfer

**Shopping/Insurance installment:**
- Vẫn affect budget tháng
- Cashback đã tính ở original purchase

---

## 8. Quan hệ với Budget

### 2 Modes model Budget

**Mode A: Cashflow Mode (RECOMMENDED)**
- Mỗi tháng chỉ ghi nhận installment_amount
- Original transaction không ghi full amount vào budget
- Phù hợp tracking cashflow thực tế

**Mode B: Accrual Mode**
- Original transaction ghi full principal_amount vào budget tháng mua
- Installment payments không tính vào budget nữa
- Phù hợp tracking commitment tổng

### Recommendation: Cashflow Mode

Vì kiến trúc n8n + Google Sheet tập trung vào cashflow thực tế:

```
Monthly budget calculation:
  spent_amount = SUM(
    all_expense_transactions_in_month
    WHERE metadata.is_installment_payment = false
    OR metadata.is_installment_payment = true  // Include installment
  )
  
Installment impact:
  - Tháng này: budget += installment_amount (2M)
  - KHÔNG phải: budget += principal_amount (24M)
```

### Budget Warning

```
IF total_installment_payments_this_month > 30% of monthly_budget:
  → Cảnh báo: "Chi phí trả góp chiếm tỷ lệ cao"
```

---

## 9. Refund & Cancellation Edge Cases

### Case 1: Hủy đơn trước kỳ đầu

**Scenario:**
- Mua iPhone, convert trả góp
- Hủy trước khi đến hạn kỳ 1

**Impact:**
- Original transaction: status = 'void' hoặc 'refunded'
- Installment plan: status = 'cancelled'
- Không có installment payment nào được tạo
- Cashback clawback: Nếu original đã tính cashback → clawback toàn bộ

### Case 2: Refund một phần giữa kỳ

**Scenario:**
- Trả góp 12 kỳ, đã trả 3 kỳ
- Refund 50% giá trị

**Xử lý:**
```
refund_amount = principal_amount * 50%
remaining_principal = principal_amount * 50%

Option A: Giảm installment_amount các kỳ còn lại
  new_installment_amount = remaining_principal / installments_remaining

Option B: Giảm số kỳ còn lại
  new_total_installments = installments_paid + CEIL(remaining_principal / installment_amount)

→ Cần user chọn option
```

**Cashback:**
- Clawback proportional: cashback_received * 50%

### Case 3: Refund toàn bộ khi plan đang active

**Scenario:**
- Đã trả 5/12 kỳ
- Merchant refund toàn bộ

**Xử lý:**
1. Tạo refund transaction cho original_amount
2. Cancel installment plan: status = 'cancelled'
3. Refund các kỳ đã trả:
   - Tạo refund transactions cho total_paid_amount
   - Hoặc offset vào future transactions
4. Cashback clawback: Toàn bộ cashback đã nhận

### Case 4: Prepayment (Trả trước hạn toàn bộ)

**Scenario:**
- Còn 7 kỳ chưa trả
- User muốn trả hết 1 lần

**Xử lý:**
1. Tạo transaction: amount = remaining_balance
2. Update plan:
   - installments_paid = total_installments
   - remaining_balance = 0
   - status = 'completed'
3. Nếu linked_debt_id:
   - debt.status = 'settled'
4. Stop auto-post workflow

### Case 5: Merchant hủy installment conversion

**Scenario:**
- Đã approve trả góp
- Merchant hủy do không đủ điều kiện

**Xử lý:**
1. Cancel installment plan
2. Original transaction trở lại bình thường
3. User phải thanh toán full amount hoặc phương án khác
4. Adjust cashback nếu cần

---

## 10. Google Sheets Mapping

### Tab: InstallmentPlans

| Cột | Field | Type | Formula/Input |
|-----|-------|------|---------------|
| A | id | UUID | Input |
| B | plan_name | String | Input |
| C | original_txn_id | UUID | Input |
| D | linked_debt_id | UUID | Input |
| E | account_id | UUID | Input |
| F | merchant_name | String | Input |
| G | category_code | String | Input |
| H | principal_amount | Integer | Input (VND) |
| I | total_installments | Integer | Input |
| J | installment_amount | Integer | Input (VND) |
| K | down_payment | Integer | Input |
| L | fee_amount | Integer | Input |
| M | interest_rate | Decimal | Input (%) |
| N | start_date | Date | Input |
| O | first_due_date | Date | Input |
| P | next_due_date | Date | Formula |
| Q | end_date | Date | Formula |
| R | installments_paid | Integer | Input/Formula |
| S | installments_remaining | Integer | Formula |
| T | total_paid_amount | Integer | Formula |
| U | remaining_balance | Integer | Formula |
| V | payment_day | Integer | Input |
| W | is_auto_post | Boolean | Input |
| X | status | Enum | Input/Dropdown |
| Y | notes | Text | Input |
| Z | updated_at | Timestamp | Auto |

**Formulas:**

```excel
// P2 (next_due_date):
=IF(R2>=I2, "", IF(R2=0, O2, EDATE(O2, R2)))

// Q2 (end_date):
=EDATE(O2, I2-1)

// S2 (installments_remaining):
=MAX(0, I2-R2)

// T2 (total_paid_amount):
=R2*J2

// U2 (remaining_balance):
=MAX(0, H2+L2-T2)
```

### Tab: InstallmentPayments

| Cột | Field | Type |
|-----|-------|------|
| A | payment_id | UUID |
| B | plan_id | UUID |
| C | transaction_id | UUID |
| D | installment_number | Integer |
| E | payment_date | Date |
| F | amount | Integer |
| G | status | Enum |
| H | notes | Text |

---

## 11. Ví dụ thực tế

### Ví dụ 1: iPhone 15 Pro Max - Credit Card Installment

**Thông tin:**
- Giá: 24,000,000đ
- Trả trước: 4,000,000đ
- Trả góp: 20,000,000đ / 10 kỳ
- Thẻ: VIB Super Card
- Lãi suất: 0%

**Plan:**
```json
{
  "plan_name": "iPhone 15 Pro Max - TGDD",
  "original_transaction_id": "txn_iphone_001",
  "account_id": "acc_vib_super",
  "merchant_name": "Thế Giới Di Động",
  "category_code": "electronics",
  "principal_amount": 20000000,
  "total_installments": 10,
  "installment_amount": 2000000,
  "down_payment_amount": 4000000,
  "fee_amount": 0,
  "interest_rate": 0,
  "payment_day": 15,
  "first_due_date": "2026-05-15",
  "is_auto_post": true
}
```

**Timeline:**
- 01/04/2026: Mua iPhone, trả trước 4M (transaction gốc)
- 15/05/2026: Kỳ 1/10 - 2M
- 15/06/2026: Kỳ 2/10 - 2M
- ...
- 15/02/2027: Kỳ 10/10 - 2M → Completed

**Cashback:**
- Original transaction (24M): VIB Super 5% = 1,200,000đ (nếu online)
- Installment payments: Không tính thêm cashback

### Ví dụ 2: Vay bạn Lâm 12M - Debt Repayment

**Debt record:**
```json
{
  "id": "debt_lam_001",
  "person_id": "person_lam",
  "debt_role": "borrowed",
  "original_amount": 12000000,
  "status": "pending"
}
```

**Installment Plan:**
```json
{
  "plan_name": "Trả nợ Lâm",
  "linked_debt_id": "debt_lam_001",
  "account_id": "acc_tcb_debit",
  "merchant_name": "Lâm",
  "category_code": "debt_repayment",
  "principal_amount": 12000000,
  "total_installments": 6,
  "installment_amount": 2000000,
  "payment_day": 10,
  "first_due_date": "2026-05-10",
  "is_auto_post": false
}
```

**Progress:**
- Sau kỳ 1: Debt remaining = 10M, Plan remaining = 5
- Sau kỳ 6: Debt status = 'settled', Plan status = 'completed'

### Ví dụ 3: Bảo hiểm nhân thọ - VPBank Lady

**Thông tin:**
- Phí năm: 18,000,000đ
- Chia 12 tháng: 1,500,000đ/tháng
- Thẻ: VPBank Lady Card
- Category: life_insurance

**Cashback Policy VPBank Lady:**
- Insurance: 7.5% max 100k (spend < 15M)
- Insurance: 15% max 300k (spend >= 15M)

**Xử lý:**
- Original transaction (18M): Qualify cashback ngay
- Spend threshold check: 18M >= 15M → Tier 15%
- Cashback: MIN(18M * 15%, 300k) = 300k
- Installment payments: Không tính cashback thêm

---

## 12. Checklist cho Agent/Codegen

### Tạo Installment Plan mới

- [ ] Validate: original_transaction_id XOR linked_debt_id
- [ ] Validate: total_installments > 1
- [ ] Validate: installment_amount > 0
- [ ] Validate: payment_day ∈ [1, 28]
- [ ] Tính first_due_date từ start_date + payment_day
- [ ] Tính end_date = EDATE(first_due_date, total_installments-1)
- [ ] Tính next_due_date = first_due_date
- [ ] Set status = 'active'
- [ ] Sync lên Google Sheets tab InstallmentPlans
- [ ] Nếu original_transaction: update metadata.has_installment = true

### Tạo Installment Payment

- [ ] Check: next_due_date <= TODAY
- [ ] Check: status = 'active'
- [ ] Tạo transaction với metadata đầy đủ
- [ ] Update installments_paid += 1
- [ ] Update total_paid_amount += installment_amount
- [ ] Recalculate remaining_balance
- [ ] Update next_due_date = EDATE(next_due_date, 1)
- [ ] Nếu linked_debt_id: update debt.remaining_balance
- [ ] Sync cả InstallmentPlans và InstallmentPayments tabs

### Handle Prepayment

- [ ] Tính remaining_balance hiện tại
- [ ] Tạo transaction: amount = remaining_balance
- [ ] Update installments_paid = total_installments
- [ ] Update remaining_balance = 0
- [ ] Set status = 'completed'
- [ ] Nếu linked_debt_id: debt.status = 'settled'
- [ ] Stop auto-post workflow cho plan này

### Handle Refund/Cancellation

- [ ] Xác định refund type: partial hay full
- [ ] Nếu full refund:
  - Cancel plan: status = 'cancelled'
  - Tạo refund transactions
  - Cashback clawback calculation
- [ ] Nếu partial refund:
  - Điều chỉnh installment_amount hoặc remaining_installments
  - User confirm method
- [ ] Sync changes lên Sheets

### Daily Auto-post Workflow (n8n)

- [ ] Query plans: status='active' AND next_due_date=TODAY
- [ ] Filter: is_auto_post = true
- [ ] Với mỗi plan:
  - Tạo transaction
  - Update plan stats
  - Check completion condition
- [ ] Send notifications cho manual plans (reminder)
- [ ] Sync tất cả changes lên Sheets

### Cashback Impact Check

- [ ] Xác định original transaction đã tính cashback chưa
- [ ] Nếu chưa: tính cashback theo policy
- [ ] Mark metadata.cashback_calculated = true
- [ ] Các installment payments: affects_cashback = false

---

## Tóm tắt Constants & Defaults

```javascript
const INSTALLMENT_CONSTANTS = {
  MIN_INSTALLMENTS: 2,
  MAX_INSTALLMENTS: 60,  // 5 năm
  PAYMENT_DAY_MIN: 1,
  PAYMENT_DAY_MAX: 28,
  DEFAULT_AUTO_POST: false,
  REMINDER_DAYS_BEFORE: 3,
  
  STATUS: {
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    PAUSED: 'paused'
  },
  
  CASHBACK_RULE: 'at_original_purchase',  // Option A
  
  BUDGET_MODE: 'cashflow'  // Track actual monthly outflow
};
```
