# Đặc tả nghiệp vụ: Refund (Hoàn tiền/Hoàn trả)

## 1) Tổng quan nghiệp vụ

`Refund` (Hoàn tiền/Hoàn trả) là quy trình ghi nhận việc tiền được hoàn lại từ một giao dịch gốc đã thực hiện trước đó. Trong hệ thống Money Flow, refund KHÔNG phải là một transaction độc lập mà phải luôn link ngược về original transaction.

### 3 Loại Refund trong hệ thống:

**a) Full Refund (Hoàn toàn bộ)**
- Hoàn 100% số tiền gốc về đúng account gốc
- Original transaction status → `refunded`
- Thường dùng khi: hủy đơn hàng, trả lại sản phẩm, dịch vụ không thực hiện

**b) Partial Refund (Hoàn một phần)**
- Chỉ hoàn một phần số tiền gốc
- Original transaction status → `posted` (vẫn hoạt động)
- Track cumulative refunded_amount qua metadata
- Thường dùng khi: hủy một phần đơn, giảm giá sau mua, bồi thường một phần

**c) Reimbursement (Hoàn tiền từ người khác)**
- Người khác (không phải merchant) hoàn tiền cho mình
- Có thể vào account khác account gốc
- Optional link với debt record
- Thường dùng khi: ứng tiền cho công ty/người khác, họ trả lại sau

### Mô hình GD1-GD2-GD3 (3 giai đoạn refund):

```
GD1 (Giao dịch gốc) → GD2 (Pending refund request) → GD3 (Confirmed refund)
```

- **GD1**: Transaction gốc (expense/income)
- **GD2**: Pending refund record, parked ở `REFUND_PENDING_ACCOUNT_ID` (99999999-9999-9999-9999-999999999999)
- **GD3**: Confirmed refund transaction, tiền thực tế về account đích

> **Nguyên tắc:** Chỉ GD3 mới ảnh hưởng balance thực tế. GD2 chỉ là trạng thái chờ.

---

## 2) Thuộc tính cốt lõi của Refund Metadata

| Thuộc tính | Kiểu dữ liệu | Bắt buộc | Mô tả |
|---|---|---|---|
| `original_transaction_id` | UUID | ✅ | ID transaction gốc (GD1) |
| `original_account_id` | UUID | ✅ | Account của transaction gốc |
| `original_person_id` | UUID | ❌ | Person gắn với GD1 (nếu có) |
| `original_transaction_type` | Enum | ✅ | Type của GD1 (expense/income) |
| `refund_request_id` | UUID | ❌ | ID của GD2 (pending refund) |
| `refund_amount` | Integer | ✅ | Số tiền hoàn (luôn dương) |
| `is_partial_refund` | Boolean | ✅ | true = partial, false = full |
| `refund_stage_tag` | String | ✅ | GD1/GD2/GD3 |
| `refund_sequence` | Integer | ✅ | Thứ tự refund (1, 2, 3...) |
| `refund_requested_at` | Timestamp | ✅ (GD2) | Thời điểm yêu cầu hoàn |
| `refund_confirmed_at` | Timestamp | ✅ (GD3) | Thời điểm xác nhận hoàn |
| `refunded_amount_total` | Integer | ✅ (GD1) | Tổng đã hoàn (cumulative) |
| `has_refund_request` | Boolean | ✅ | true = đang có refund pending |
| `is_refund_confirmation` | Boolean | ✅ (GD3) | true = đây là GD3 |
| `instant_refund` | Boolean | ❌ | true = refund ngay không qua GD2 |
| `refund_status` | Enum | ✅ | pending/completed/void |

---

## 3) Refund Status

| Status | Ý nghĩa | Ảnh hưởng Balance | Khi nào |
|---|---|---|---|
| `waiting_refund` | GD1 đang chờ xử lý refund request | Không | Sau khi tạo GD2 |
| `pending` | GD2 đang chờ merchant xác nhận | Không | Khi tạo refund request |
| `completed` | GD3 đã confirmed, tiền về account | Có (+ refund_amount) | Khi confirm refund |
| `refunded` | GD1 đã hoàn tất (full refund) | Đã cập nhật | Sau GD3 successful |
| `void` | Refund bị hủy | Không | Khi cancel refund request |

### Flow chuyển trạng thái:

```text
GD1 (posted) 
  ↓ requestRefund()
GD1 (waiting_refund) + GD2 (pending)
  ↓ confirmRefund()
GD1 (refunded hoặc posted) + GD2 (completed) + GD3 (completed)
  ↓ voidTransaction()
GD2 (void) → GD1 rollback về posted
```

---

## 4) Business Rules bắt buộc

### 4.1 Không thể refund quá amount gốc

```typescript
// Công thức kiểm tra
const previousRefundedTotal = originalTxn.metadata.refunded_amount_total || 0;
const refundedAmountTotal = previousRefundedTotal + refundAmount;
const originalAmount = Math.abs(originalTxn.amount);

if (refundedAmountTotal > originalAmount) {
  throw new Error('Refund amount exceeds original transaction amount');
}
```

### 4.2 Chỉ refund transactions có status hợp lệ

- ✅ Allowed: `posted`, `completed`, `waiting_refund`
- ❌ Blocked: `void`, `cancelled`, `pending` (chưa posted)

### 4.3 Refund date phải ≥ original txn date

```typescript
if (refundOccurredAt < originalTxn.occurred_at) {
  throw new Error('Refund date cannot be before original transaction date');
}
```

### 4.4 Một transaction có thể có nhiều partial refunds

- Track qua `refund_sequence` (1, 2, 3...)
- Mỗi refund có `refund_amount` riêng
- Cumulative sum không vượt original_amount

### 4.5 Khi cumulative refund = original amount

```typescript
const isFullRefund = !isPartialRefundRequest || 
                     (originalAmount > 0 && refundedAmountTotal >= originalAmount);

if (isFullRefund) {
  // Update GD1 status
  originalTxn.status = 'refunded';
  
  // Clear person_id (không còn debt obligation)
  originalTxn.person_id = null;
  
  // Update metadata
  originalTxn.metadata.refunded_amount_total = originalAmount;
}
```

### 4.6 Khi cumulative refund < original amount

```typescript
// GD1 vẫn giữ status = posted
// Chỉ update metadata
originalTxn.metadata.refunded_amount_total = refundedAmountTotal;
originalTxn.metadata.has_refund_request = false;
```

### 4.7 Cancelled/Void transactions không thể refund

```typescript
if (existing.status === 'void' || existing.status === 'cancelled') {
  return { success: false, error: 'Cannot refund voided transaction' };
}
```

### 4.8 Reimbursement optional link với debt

- Nếu reimbursement từ person (công ty/người khác)
- Optional tạo repayment transaction để reduce debt
- Hoặc track riêng qua person_id trong GD3

### 4.9 GD2 Guard - Block duplicate refund requests

```typescript
// Kiểm tra GD2 đã tồn tại chưa
const gd2Children = await pocketbaseList('transactions', {
  filter: `metadata.refund_stage_tag = "GD2" && 
           metadata.original_transaction_id = "${pbId}" && 
           status != "voided" && status != "void"`,
  perPage: 1,
});

if (gd2Children.items.length > 0) {
  return { 
    success: false, 
    error: 'Cannot cancel: a pending refund (GD2) is already awaiting confirmation. Void GD2 first.'
  };
}
```

### 4.10 Atomicity - GD2 và GD3 phải consistent

- GD2 void → GD1 rollback về `posted`
- GD3 failed → GD2 giữ nguyên `pending`
- GD3 success → GD2 `completed`, GD1 `refunded` hoặc update metadata

---

## 5) Ảnh hưởng tới Balance

### 5.1 Chỉ confirmed refund (GD3) mới ảnh hưởng balance

```typescript
// GD2 (pending) - KHÔNG ảnh hưởng balance
account_id = REFUND_PENDING_ACCOUNT_ID (holding account)

// GD3 (completed) - CÓ ảnh hưởng balance
account_id = targetAccountId (tiền thực tế về đây)
balance += refundAmount
```

### 5.2 Balance update formula

```text
new_balance = previous_balance + refund_amount (GD3 only)

Trong đó:
- refund_amount > 0 (luôn dương)
- GD3.type = 'income' (tiền vào)
- GD3.status = 'completed'
```

### 5.3 Full refund vs Partial refund impact

| Loại refund | GD1 status | GD1 person_id | Balance impact |
|---|---|---|---|
| Full refund | `refunded` | Cleared (null) | +100% amount |
| Partial refund | `posted` | Kept | +partial amount |

### 5.4 Reimbursement vào account khác

```typescript
// GD3 có thể có account_id khác GD1
GD3.account_id = targetAccountId (user chọn khi confirm)
GD3.to_account_id = GD1.account_id (reference)
```

---

## 6) Ảnh hưởng tới Cashback

### 6.1 Refund làm giảm spent_amount trong cycle

```typescript
// spent_amount recalculation
cycle.spent_amount = Σ(expense posted trong cycle) 
                   - Σ(refund confirmed trong cycle)
```

### 6.2 Min spend gate re-check sau refund

```typescript
// Sau khi refund, kiểm tra lại is_qualified
const newSpentAmount = originalSpentAmount - refundAmount;
const isQualified = newSpentAmount >= cb_min_spend;

if (!isQualified) {
  // Cashback bị thu hồi
  cashback_clawback = real_awarded;
  virtual_profit = 0;
}
```

### 6.3 Cashback clawback scenario

**Ví dụ:**
- Chi 4,000,000đ, cb_min_spend = 3,000,000đ, cb_percent = 1%
- Virtual profit ban đầu: 40,000đ
- Sau đó refund 2,000,000đ
- Spent còn lại: 2,000,000đ < min_spend
- **Kết quả:**
  - is_qualified = false
  - cashback_clawback = 40,000đ (thu hồi toàn bộ)
  - virtual_profit = 0

### 6.4 Refund sau khi cycle đã closed/settled

```typescript
// Edge case: refund xảy ra sau khi cycle đã settle
if (cycle.status === 'settled') {
  // Option 1: Tạo adjustment entry trong cycle mới
  // Option 2: Track separately trong metadata
  // TODO: Business decision needed
}
```

### 6.5 Real awarded cashback đã nhận nhưng refund

```typescript
// Scenario: real_awarded đã credit vào account
// Sau đó refund xảy ra
if (real_awarded > 0 && refundConfirmed) {
  // Option 1: Tạo negative cashback entry
  // Option 2: Deduct từ cycle tiếp theo
  // TODO: Business decision needed
}
```

---

## 7) Quan hệ dữ liệu

### 7.1 Refund → Transaction (GD1-GD2-GD3)

```text
GD1 (original_transaction_id = null)
  ↓ metadata.original_transaction_id
GD2 (original_transaction_id = GD1.id)
  ↓ metadata.refund_request_id
GD3 (original_transaction_id = GD1.id, refund_request_id = GD2.id)
```

### 7.2 Refund → Account

```text
GD2.account_id = REFUND_PENDING_ACCOUNT_ID (holding)
GD3.account_id = targetAccountId (user selected)
GD3.to_account_id = GD1.account_id (reference)
```

### 7.3 Refund → CashbackCycle (indirect)

```text
Refund confirmed
  ↓ trigger recalculation
CashbackCycle.spent_amount -= refundAmount
CashbackCycle.virtual_profit = recalculate()
CashbackCycle.is_qualified = recheck()
```

### 7.4 Refund → Person (optional)

```text
// Full refund: clear person_id
GD3.person_id = null

// Partial refund hoặc reimbursement: keep person_id
GD3.person_id = originalPersonId hoặc requestedPersonId

// Reimbursement từ debt: optional link repayment
```

---

## 8) Google Sheets column mapping

### Tab `Refunds` (tracking pending & confirmed refunds)

| Cột | Field | Kiểu | Mô tả |
|---|---|---|---|
| A | `id` | UUID | ID refund record (GD2 hoặc GD3) |
| B | `stage` | String | GD2/GD3 |
| C | `original_txn_id` | UUID | Link về GD1 |
| D | `original_note` | String | Note của GD1 |
| E | `refund_amount` | Integer | Số tiền hoàn |
| F | `refund_date` | Date | Ngày hoàn (confirmed_at) |
| G | `target_account_id` | UUID | Account nhận tiền |
| H | `target_account_name` | String | Tên account nhận tiền |
| I | `person_id` | UUID | Person liên quan (nếu có) |
| J | `person_name` | String | Tên person |
| K | `status` | Enum | pending/completed/void |
| L | `is_partial` | Boolean | true = partial refund |
| M | `cumulative_refunded` | Integer | Tổng đã hoàn (từ GD1 metadata) |
| N | `remaining_refundable` | Integer | = original_amount - cumulative |

### Link ngược về Transactions tab

```excel
=IF(C2<>"", VLOOKUP(C2, Transactions!$A:$Z, 2, FALSE), "")
// Lấy note của GD1 từ original_txn_id
```

### Trigger recalculate cashback cycle

```excel
=SUMIFS(Refunds!$E:$E, Refunds!$F:$F, ">="&cycle_start, Refunds!$F:$F, "<="&cycle_end, Refunds!$K:$K, "completed")
// Tổng refund confirmed trong cycle → trừ khỏi spent_amount
```

---

## 9) Ví dụ thực tế

### 9.1 Full refund - Shopee order

**Scenario:** Mua đồ Shopee 500k từ Tài khoản Techcombank, hoàn 100% sau 3 ngày

```text
GD1 (2026-04-15):
  - type: expense
  - amount: 500,000
  - account: Techcombank
  - note: "Mua đồ Shopee"
  - status: posted

GD2 (2026-04-18, refund request):
  - type: expense
  - amount: 500,000
  - account: REFUND_PENDING_ACCOUNT_ID
  - note: "[GD2|abc123] Refund for: Mua đồ Shopee"
  - status: pending
  - metadata:
      original_transaction_id: GD1.id
      refund_amount: 500,000
      is_partial_refund: false
      refund_stage_tag: GD2

GD3 (2026-04-20, confirmed):
  - type: income
  - amount: 500,000
  - account: Techcombank
  - note: "[GD3|abc123] Refund received: Mua đồ Shopee"
  - status: completed
  - metadata:
      original_transaction_id: GD1.id
      refund_request_id: GD2.id
      is_refund_confirmation: true

GD1 (sau GD3):
  - status: refunded
  - metadata.refunded_amount_total: 500,000
  - person_id: null (cleared)
```

### 9.2 Partial refund - Tour booking

**Scenario:** Đặt tour 5M, hủy 1 phần hoàn 2M

```text
GD1:
  - amount: 5,000,000
  - note: "Đặt tour Đà Lạt"
  - status: posted

GD2 (partial refund request):
  - amount: 2,000,000
  - metadata.is_partial_refund: true

GD3 (confirmed):
  - amount: 2,000,000
  - status: completed

GD1 (sau GD3):
  - status: posted (vẫn hoạt động)
  - metadata.refunded_amount_total: 2,000,000
  - remaining_refundable: 3,000,000
```

### 9.3 Reimbursement - Ứng tiền công ty

**Scenario:** Ứng tiền mua đồ cho công ty 3M, công ty trả lại vào tài khoản khác

```text
GD1:
  - type: expense
  - amount: 3,000,000
  - account: Cá nhân VCB
  - note: "Mua văn phòng phẩm"
  - person_id: CôngTyABC

GD3 (reimbursement, instant - không qua GD2):
  - type: income
  - amount: 3,000,000
  - account: Công ty trả về (khác VCB)
  - note: "Công ty hoàn tiền VP phẩm"
  - person_id: CôngTyABC
  - metadata:
      original_transaction_id: GD1.id
      instant_refund: true
      refund_status: completed

GD1 (sau GD3):
  - status: refunded
  - metadata.refunded_amount_total: 3,000,000
```

### 9.4 Cashback clawback scenario

**Scenario:** Chi 4M back 1%, min_spend 3M, sau đó refund 3M

```text
Cycle 2026-04:
  - cb_min_spend: 3,000,000
  - cb_percent: 1%
  - cb_max_budget: 500,000

Ban đầu:
  - spent_amount: 4,000,000
  - is_qualified: true
  - virtual_profit: 40,000

Sau refund 3M:
  - spent_amount: 1,000,000 (4M - 3M)
  - is_qualified: false (1M < 3M)
  - cashback_clawback: 40,000
  - virtual_profit: 0
```

---

## 10) Edge Cases

### 10.1 Refund sau khi cycle đã closed/settled

**Problem:** Cycle 2026-03 đã settle, sang 2026-04 mới refund

**Solution options:**
1. Tạo adjustment entry trong cycle hiện tại (2026-04)
2. Track separately trong metadata, không adjust cycle cũ
3. Tạo negative cashback entry

**Current implementation:** TODO - cần business decision

### 10.2 Refund về account khác account gốc

**Scenario:** GD1 từ Techcombank, GD3 về MoMo

```typescript
GD3.account_id = MoMo (user selected)
GD3.to_account_id = Techcombank (reference)
GD3.note = "Refund received (original: Techcombank)"
```

**Balance impact:**
- Techcombank: không thay đổi (đã trừ từ GD1)
- MoMo: + refund_amount

### 10.3 Multiple partial refunds trên cùng 1 transaction

```text
GD1: amount = 10,000,000

GD2 #1 (partial 1): refund_amount = 3,000,000
GD3 #1: confirmed → cumulative = 3,000,000

GD2 #2 (partial 2): refund_amount = 2,000,000
GD3 #2: confirmed → cumulative = 5,000,000

GD1.metadata.refunded_amount_total = 5,000,000
remaining_refundable = 5,000,000
```

### 10.4 Refund của transaction đã dùng để tính budget tháng

**Problem:** Budget report tháng 4 đã chạy, sang tháng 5 mới refund

**Impact:**
- Month 4 spent_amount: không adjust (đã đóng sổ)
- Month 5: track refund separately hoặc adjust month 5 budget

**Recommendation:** Track refund trong tháng phát sinh refund, không retroactively adjust tháng cũ

### 10.5 Reimbursement từ người vay: auto reduce debt?

**Scenario:** Nam mượn 2M, sau đó hoàn tiền mua đồ 500k

**Question:** Có nên tự động create repayment transaction để reduce debt không?

**Options:**
1. ✅ Auto create repayment (giảm manual work)
2. ❌ Keep separate, user manually link (tránh side effects)

**Current implementation:** Keep separate, user quyết định có tạo repayment không

---

## 11) Checklist cho Agent/Codegen

### Refund Request (GD2 creation)
- [ ] Kiểm tra GD1 tồn tại và status hợp lệ (không void/cancelled)
- [ ] Kiểm tra chưa có GD2 pending nào (GD2 Guard)
- [ ] Validate refund_amount > 0 và ≤ original_amount
- [ ] Validate refund_date ≥ original_txn_date
- [ ] Tạo GD2 với status = pending
- [ ] GD2.account_id = REFUND_PENDING_ACCOUNT_ID
- [ ] Set metadata đầy đủ (original_transaction_id, refund_stage_tag=GD2, refund_sequence)
- [ ] Update GD1.status = waiting_refund
- [ ] Update GD1.metadata.has_refund_request = true
- [ ] Sync với Google Sheets (Refunds tab)

### Refund Confirmation (GD3 creation)
- [ ] Kiểm tra GD2 tồn tại và status = pending
- [ ] Lấy targetAccountId từ user input
- [ ] Tính cumulative refunded_amount_total
- [ ] Xác định isFullRefund (= cumulative >= original)
- [ ] Tạo GD3 với status = completed
- [ ] GD3.account_id = targetAccountId
- [ ] GD3.type = income
- [ ] Set metadata (original_transaction_id, refund_request_id, is_refund_confirmation=true, refund_stage_tag=GD3)
- [ ] Nếu full refund:
  - [ ] Update GD1.status = refunded
  - [ ] Clear GD1.person_id = null
  - [ ] Sync sheet với full refund flag
- [ ] Nếu partial refund:
  - [ ] Update GD1.metadata.refunded_amount_total
  - [ ] GD1.status giữ nguyên = posted
- [ ] Update GD2.status = completed
- [ ] Trigger cashback cycle recalculation
- [ ] Sync với Google Sheets (Refunds tab)

### Refund Void/Cancel
- [ ] Kiểm tra GD2 tồn tại
- [ ] Kiểm tra chưa có GD3 (nếu có GD3 rồi thì không void được)
- [ ] Update GD2.status = void
- [ ] Rollback GD1.status từ waiting_refund → posted
- [ ] Clear GD1.metadata.has_refund_request
- [ ] Sync với Google Sheets (mark void)

### Cashback Recalculation
- [ ] Tìm cashback cycle chứa GD1 (qua persisted_cycle_tag)
- [ ] Recalculate spent_amount = original_spent - refund_amount
- [ ] Re-check is_qualified (spent >= min_spend)
- [ ] Nếu not qualified:
  - [ ] Set cashback_clawback = real_awarded
  - [ ] Set virtual_profit = 0
- [ ] Nếu qualified:
  - [ ] Recalculate virtual_profit theo spent mới
- [ ] Update cycle snapshot

### Sheet Sync
- [ ] Refunds tab: thêm row mới cho GD2/GD3
- [ ] Transactions tab: update refund_status column
- [ ] CashbackCycles tab: trigger recalc formulas
- [ ] Summary dashboard: update total_refunds_pending, total_refunds_confirmed

---

## 12) Tóm tắt công thức quan trọng

### Cumulative refunded amount
```typescript
refunded_amount_total = previousRefundedTotal + currentRefundAmount
```

### Remaining refundable
```typescript
remaining_refundable = original_amount - refunded_amount_total
```

### Full refund check
```typescript
isFullRefund = !isPartialRefundRequest || (refunded_amount_total >= original_amount)
```

### Balance impact (GD3 only)
```typescript
new_balance = previous_balance + refund_amount
```

### Cashback spent_amount after refund
```typescript
new_spent_amount = original_spent_amount - refund_amount
```

### Cashback clawback condition
```typescript
if (new_spent_amount < cb_min_spend) {
  cashback_clawback = real_awarded
  virtual_profit = 0
}
```

---

## 13) Constants & IDs

```typescript
// Holding account cho pending refunds
REFUND_PENDING_ACCOUNT_ID = '99999999-9999-9999-9999-999999999999'

// Refund stages
REFUND_STAGE_GD1 = 'GD1'  // Original transaction
REFUND_STAGE_GD2 = 'GD2'  // Pending refund request
REFUND_STAGE_GD3 = 'GD3'  // Confirmed refund

// Refund statuses
REFUND_STATUS_PENDING = 'pending'
REFUND_STATUS_COMPLETED = 'completed'
REFUND_STATUS_VOID = 'void'

// Transaction statuses liên quan
TXN_STATUS_WAITING_REFUND = 'waiting_refund'
TXN_STATUS_REFUNDED = 'refunded'
```
