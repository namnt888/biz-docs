# Google Sheets Formulas: Refund Tracking

## 1. Tab `Refunds` — Suggested Schema

| Cột | Field | Kiểu | Formula/Notes |
|---|---|---|---|
| A | `id` | UUID | ID refund record (GD2 hoặc GD3) |
| B | `stage` | String | GD2/GD3 |
| C | `original_txn_id` | UUID | Link về GD1 |
| D | `original_note` | String | `=IF(C2<>"", VLOOKUP(C2, Transactions!$A:$Z, 2, FALSE), "")` |
| E | `refund_amount` | Integer | Số tiền hoàn (luôn dương) |
| F | `refund_date` | Date | Ngày hoàn (confirmed_at cho GD3) |
| G | `target_account_id` | UUID | Account nhận tiền |
| H | `target_account_name` | String | `=IF(G2<>"", VLOOKUP(G2, Accounts!$A:$B, 2, FALSE), "")` |
| I | `person_id` | UUID | Person liên quan (nếu có) |
| J | `person_name` | String | `=IF(I2<>"", VLOOKUP(I2, People!$A:$B, 2, FALSE), "")` |
| K | `status` | Enum | pending/completed/void |
| L | `is_partial` | Boolean | TRUE = partial refund |
| M | `cumulative_refunded` | Integer | `=IF(C2<>"", INDEX(Transactions!$M:$M, MATCH(C2, Transactions!$A:$A, 0)), 0)` |
| N | `remaining_refundable` | Integer | `=M2 - E2` (từ GD1 metadata) |

---

## 2. Cumulative Refund per Transaction

### 2.1 Tổng đã refund trên 1 transaction (GD1)

```excel
// Trong Transactions tab, column M: cumulative_refunded
=SUMIFS(
  Refunds!$E:$E,           // refund_amount
  Refunds!$C:$C, $A2,      // original_txn_id match với txn hiện tại
  Refunds!$K:$K, "completed"  // chỉ tính confirmed refunds
)
```

**Comment:** Tính tổng số tiền đã hoàn cho transaction này (chỉ count GD3 đã completed)

### 2.2 Remaining refundable amount

```excel
// Trong Transactions tab, column N: remaining_refundable
=MAX(0, $F2 - $M2)
```

**Comment:** Số tiền còn có thể hoàn = original_amount - cumulative_refunded. Dùng MAX(0,) để tránh âm khi over-refund (error case)

### 2.3 Validation rule: Refund không vượt original

```excel
// Data validation rule khi nhập refund_amount trong Refunds tab
=E2 <= VLOOKUP(C2, Transactions!$A:$F, 6, FALSE) - SUMIFS(
  Refunds!$E:$E,
  Refunds!$C:$C, C2,
  Refunds!$K:$K, "completed"
)
```

**Comment:** Prevent user nhập refund_amount > remaining_refundable. Custom error message: "Refund amount exceeds remaining refundable"

---

## 3. Original Transaction Status Update

### 3.1 Formula tính `refund_status` trong Transactions tab

```excel
// Column O: refund_status
=IF($M2 = 0, "none",
  IF($M2 >= $F2, "fully_refunded",
    "partially_refunded"
  )
)
```

**Comment:** 
- cumulative = 0 → "none" (chưa refund)
- cumulative >= original → "fully_refunded"
- 0 < cumulative < original → "partially_refunded"

### 3.2 Badge text cho UI

```excel
// Column P: refund_badge
=IF($O2 = "fully_refunded", "🟢 Hoàn đủ",
  IF($O2 = "partially_refunded", "🟡 Hoàn phần " & TEXT($M2/$F2, "0%"),
    ""
  )
)
```

**Comment:** Hiển thị badge màu + % đã hoàn

---

## 4. Cashback Cycle Recalculation

### 4.1 Spent_amount sau khi trừ refund

```excel
// Trong CashbackCycles tab, điều chỉnh spent_amount
=SUMIFS(
  Transactions!$F:$F,          // amount
  Transactions!$B:$B, $A2,     // account_id match
  Transactions!$G:$G, $B2,     // persisted_cycle_tag match
  Transactions!$C:$C, "expense",  // chỉ expense
  Transactions!$D:$D, "posted",   // chỉ posted
  Transactions!$H:$H, "<>create initial"  // exclude initial balance
)
-
SUMIFS(
  Refunds!$E:$E,               // refund_amount
  Refunds!$F:$F, ">=" & $C2,   // refund_date >= cycle_start
  Refunds!$F:$F, "<=" & $D2,   // refund_date <= cycle_end
  Refunds!$K:$K, "completed"   // chỉ confirmed refunds
)
```

**Comment:** spent_amount = total expense trong cycle - total confirmed refunds trong cycle

### 4.2 Re-check min_spend_target sau refund

```excel
// Column: is_qualified_after_refund
=IF($E2 >= $F2, TRUE, FALSE)
```

**Trong đó:**
- E2: spent_amount (sau khi đã trừ refund)
- F2: cb_min_spend

**Comment:** Kiểm tra lại điều kiện cashback sau khi đã adjust cho refunds

### 4.3 Cashback clawback calculation

```excel
// Column: cashback_clawback
=IF(
  AND($G2 = TRUE, $H2 > 0),  // is_qualified = FALSE nhưng đã có real_awarded
  $H2,  // clawback toàn bộ real_awarded
  0
)
```

**Trong đó:**
- G2: is_qualified_after_refund (FALSE = không đạt)
- H2: real_awarded (số cashback thực tế đã nhận)

**Comment:** Nếu refund làm spent_amount xuống dưới min_spend → thu hồi toàn bộ cashback đã nhận

### 4.4 Virtual profit recalculation sau refund

```excel
// Column: virtual_profit_after_refund
=IF(
  $G2 = FALSE,  // not qualified
  0,
  MIN(
    $E2 * $I2,  // spent_amount * cb_percent
    $J2         // cb_max_budget
  )
)
```

**Trong đó:**
- G2: is_qualified_after_refund
- E2: spent_amount (sau refund)
- I2: cb_percent
- J2: cb_max_budget

**Comment:** Recalculate virtual profit theo spent mới, apply budget cap

---

## 5. Balance Impact Formulas

### 5.1 Account balance update khi refund confirmed

```excel
// Trong Accounts tab, tính total_refunds_received
=SUMIFS(
  Refunds!$E:$E,           // refund_amount
  Refunds!$G:$G, $A2,      // target_account_id match
  Refunds!$K:$K, "completed"  // chỉ confirmed
)
```

**Comment:** Tổng refund đã nhận vào account này

### 5.2 Net balance impact từ refunds

```excel
// Column: net_refund_impact
=$current_balance - $initial_balance - $total_income + $total_expense + $total_refunds
```

**Comment:** Kiểm tra consistency: balance change phải khớp với refunds + các transactions khác

### 5.3 SUMIFS refunds per account per month

```excel
// Tạo pivot table hoặc dùng formula
=SUMIFS(
  Refunds!$E:$E,           // refund_amount
  Refunds!$G:$G, $A2,      // target_account_id
  Refunds!$F:$F, ">=" & DATE(2026, 4, 1),  // tháng 4/2026
  Refunds!$F:$F, "<=" & DATE(2026, 4, 30),
  Refunds!$K:$K, "completed"
)
```

**Comment:** Tổng refund received trong tháng 4/2026 cho account này

---

## 6. Reimbursement Tracking

### 6.1 Tổng reimbursements nhận trong tháng

```excel
// Filter reimbursements (instant_refund = TRUE hoặc person_id present)
=SUMIFS(
  Refunds!$E:$E,           // refund_amount
  Refunds!$F:$F, ">=" & DATE(2026, 4, 1),
  Refunds!$F:$F, "<=" & DATE(2026, 4, 30),
  Refunds!$K:$K, "completed",
  Refunds!$I:$I, "<>"      // person_id không rỗng
)
```

**Comment:** Chỉ count refunds có person_id (reimbursements từ người khác)

### 6.2 Orphan reimbursements (chưa link với debt)

```excel
// FILTER để tìm unlinked reimbursements
=FILTER(
  Refunds!$A:$J,
  (Refunds!$I:$I <> "") *           // có person_id
  (Refunds!$K:$K = "completed") *   // đã confirmed
  (ISERROR(MATCH(Refunds!$I:$I, DebtRepayments!$C:$C, 0)))  // chưa có repayment link
)
```

**Comment:** List các reimbursements chưa được link với debt repayment record

### 6.3 Reimbursement per person summary

```excel
// Trong People tab, column: total_reimbursed
=SUMIFS(
  Refunds!$E:$E,           // refund_amount
  Refunds!$I:$I, $A2,      // person_id match
  Refunds!$K:$K, "completed"
)
```

**Comment:** Tổng tiền người này đã hoàn lại cho mình (reimbursement)

---

## 7. Dashboard Formulas (Tab Summary)

### 7.1 Tổng refund đang pending (chưa nhận tiền)

```excel
=SUMIFS(
  Refunds!$E:$E,
  Refunds!$K:$K, "pending"
)
```

**Comment:** Số tiền đang chờ merchant xác nhận (GD2 pending)

### 7.2 Tổng refund tháng này (confirmed)

```excel
=SUMIFS(
  Refunds!$E:$E,
  Refunds!$F:$F, ">=" & DATE(YEAR(TODAY()), MONTH(TODAY()), 1),
  Refunds!$F:$F, "<=" & EOMONTH(TODAY(), 0),
  Refunds!$K:$K, "completed"
)
```

**Comment:** Total refunds received trong tháng hiện tại

### 7.3 Cashback clawback YTD

```excel
=SUM(
  CashbackCycles!$K:$K  // column cashback_clawback
)
```

**Comment:** Tổng cashback bị thu hồi do refund từ đầu năm đến giờ

### 7.4 Top accounts nhận nhiều refund nhất

```excel
// Dùng SORT và UNIQUE
=SORT(
  UNIQUE(Refunds!$G:$H),  // account_id + account_name
  SUMIFS(Refunds!$E:$E, Refunds!$G:$G, UNIQUE(Refunds!$G:$G), Refunds!$K:$K, "completed"),
  FALSE  // descending
)
```

**Comment:** List accounts sorted by total refunds received (top-down)

### 7.5 Refund success rate

```excel
// Tỷ lệ refund requests thành công
=COUNTIFS(Refunds!$K:$K, "completed") / COUNTIFS(Refunds!$K:$K, "<>void")
```

**Comment:** % refund requests được confirm (không bị void)

### 7.6 Average refund processing time

```excel
// Average days từ request đến confirm
=AVERAGEIFS(
  Refunds!$L:$L,  // column processing_days = refund_date - request_date
  Refunds!$K:$K, "completed"
)
```

**Comment:** Số ngày trung bình để refund được xử lý

---

## 8. Named Ranges Suggestions

```excel
Refunds_All = Refunds!$A:$Z
Refunds_Pending = FILTER(Refunds!$A:$Z, Refunds!$K:$K = "pending")
Refunds_Completed = FILTER(Refunds!$A:$Z, Refunds!$K:$K = "completed")
Refunds_ThisMonth = FILTER(Refunds!$A:$Z, 
  Refunds!$F:$F >= DATE(YEAR(TODAY()), MONTH(TODAY()), 1),
  Refunds!$F:$F <= EOMONTH(TODAY(), 0)
)

Transactions_WithRefunds = FILTER(Transactions!$A:$Z, Transactions!$O:$O <> "none")
Transactions_FullyRefunded = FILTER(Transactions!$A:$Z, Transactions!$O:$O = "fully_refunded")
Transactions_PartiallyRefunded = FILTER(Transactions!$A:$Z, Transactions!$O:$O = "partially_refunded")

Cashback_ClawbackYTD = SUM(CashbackCycles!$K:$K)
Refunds_TotalPending = SUMIFS(Refunds!$E:$E, Refunds!$K:$K, "pending")
Refunds_TotalCompleted = SUMIFS(Refunds!$E:$E, Refunds!$K:$K, "completed")
```

---

## 9. Conditional Formatting Rules

### 9.1 Refund status colors (Refunds tab)

| Rule | Formula | Format |
|---|---|---|
| Pending | `=$K2 = "pending"` | 🟡 Yellow background |
| Completed | `=$K2 = "completed"` | 🟢 Green background |
| Void | `=$K2 = "void"` | ⚪ Gray background + strikethrough |

### 9.2 Cashback clawback warning

| Rule | Formula | Format |
|---|---|---|
| Clawback > 0 | `=$K2 > 0` | 🔴 Red text + bold |

### 9.3 Refund status badges (Transactions tab)

| Rule | Formula | Format |
|---|---|---|
| Fully refunded | `=$O2 = "fully_refunded"` | 🟢 Green border |
| Partially refunded | `=$O2 = "partially_refunded"` | 🟡 Yellow border |
| Has pending refund | `=AND($O2 <> "none", $P2 = "pending")` | 🟠 Orange border |

### 9.4 Overdue refund processing

```excel
// Refund pending quá 7 ngày
=AND($K2 = "pending", TODAY() - $F2 > 7)
```
**Format:** 🔴 Red background (cảnh báo refund chậm)

### 9.5 Progress color scale (cumulative refunded)

```excel
// Color scale từ 0% → 100% refunded
Data bar: $M2 / $F2 (cumulative / original)
Min: 0 (white)
Max: 1 (green)
```

---

## 10. Sample Data Ready-to-Test

### Refunds tab sample:

| id | stage | original_txn_id | refund_amount | refund_date | target_account_id | status | is_partial |
|---|---|---|---|---|---|---|---|
| gd2-001 | GD2 | txn-shopee-001 | 500,000 | 2026-04-18 | (pending) | pending | FALSE |
| gd3-001 | GD3 | txn-shopee-001 | 500,000 | 2026-04-20 | acc-techcombank | completed | FALSE |
| gd2-002 | GD2 | txn-tour-001 | 2,000,000 | 2026-04-19 | (pending) | pending | TRUE |
| gd3-002 | GD3 | txn-tour-001 | 2,000,000 | 2026-04-22 | acc-vcb | completed | TRUE |

### Transactions tab sample (với refund columns):

| id | note | amount | cumulative_refunded | remaining_refundable | refund_status | refund_badge |
|---|---|---|---|---|---|---|
| txn-shopee-001 | Mua đồ Shopee | 500,000 | 500,000 | 0 | fully_refunded | 🟢 Hoàn đủ |
| txn-tour-001 | Đặt tour Đà Lạt | 5,000,000 | 2,000,000 | 3,000,000 | partially_refunded | 🟡 Hoàn phần 40% |
| txn-vp-001 | Mua VP phẩm | 3,000,000 | 3,000,000 | 0 | fully_refunded | 🟢 Hoàn đủ |

---

## 11. Troubleshooting Tips

### #VALUE! lỗi thường gặp

**Problem:** `SUMIFS returns #VALUE!`
**Cause:** Range sizes không match
**Fix:** Đảm bảo tất cả ranges trong SUMIFS có cùng số rows

### SUMIFS returns 0 nhưng đáng lẽ phải có value

**Problem:** Formula đúng syntax nhưng trả về 0
**Possible causes:**
1. original_txn_id không match (kiểu dữ liệu khác nhau: text vs number)
2. Status filter sai ("Completed" thay vì "completed")
3. Date range không include refund_date

**Debug:**
```excel
// Test từng condition riêng
=COUNTIFS(Refunds!$C:$C, $A2)  // Có bao nhiêu refunds link tới txn này?
=COUNTIFS(Refunds!$K:$K, "completed")  // Có bao nhiêu completed refunds?
```

### Circular dependency warning

**Problem:** Formula reference chính nó
**Cause:** Refunds tab formula reference Transactions tab, mà Transactions tab formula lại reference Refunds tab

**Fix:** Dùng helper column hoặc tính cumulative ở 1 nơi duy nhất (nên là Transactions tab)

### Processing days calculation sai

**Problem:** `refund_date - request_date` ra số âm
**Cause:** Date format không consistent (text thay vì date)

**Fix:**
```excel
=DATEVALUE(refund_date) - DATEVALUE(request_date)
```

### FILTER returns #N/A

**Problem:** Không có data match filter conditions
**Fix:** Wrap trong IFERROR:
```excel
=IFERROR(FILTER(...), "No data found")
```

---

## 12. Checklist kiểm tra sau khi dán formulas

### Setup cơ bản
- [ ] Refunds tab có đủ columns A → N
- [ ] Transactions tab có thêm columns M → P (refund tracking)
- [ ] CashbackCycles tab có columns cho clawback calculation
- [ ] Named ranges đã được tạo

### Formulas verification
- [ ] cumulative_refunded formula test với 1 txn có refund
- [ ] remaining_refundable không âm (dùng MAX(0, ...))
- [ ] refund_status hiển thị đúng (none/partially/fully)
- [ ] spent_amount trong CashbackCycles đã trừ refunds
- [ ] is_qualified re-check sau refund
- [ ] cashback_clawback trigger đúng khi spent < min_spend

### Conditional formatting
- [ ] Pending refunds màu vàng
- [ ] Completed refunds màu xanh
- [ ] Void refunds màu xám + strikethrough
- [ ] Clawback > 0 màu đỏ
- [ ] Fully refunded transactions có border xanh

### Dashboard formulas
- [ ] Total pending refunds correct
- [ ] Total completed refunds this month correct
- [ ] Cashback clawback YTD sum correct
- [ ] Top accounts by refund sorted correctly

### Edge cases testing
- [ ] Test với partial refund (cumulative < original)
- [ ] Test với full refund (cumulative = original)
- [ ] Test với multiple refunds trên 1 txn
- [ ] Test với refund date ngoài cycle range
- [ ] Test với reimbursement (có person_id)

### Performance
- [ ] Không có circular dependencies
- [ ] FILTER formulas có IFERROR wrapper
- [ ] Named ranges dùng để giảm formula length
- [ ] Sheet load time < 3 seconds

---

## 13. Advanced: Query Examples

### Tìm tất cả refunds của 1 person trong quý

```excel
=QUERY(
  Refunds!$A:$J,
  "SELECT A, D, E, F, H, K 
   WHERE I = '" & $A2 & "' 
   AND F >= DATE '2026-04-01' 
   AND F <= DATE '2026-06-30'
   AND K = 'completed'
   ORDER BY F DESC",
  1
)
```

### Refunds theo category breakdown

```excel
=QUERY(
  Refunds!$A:$Z,
  "SELECT D, SUM(E) 
   WHERE K = 'completed' 
   GROUP BY D 
   ORDER BY SUM(E) DESC
   LABEL SUM(E) 'Total Refunded'",
  1
)
```

### Pending refunds aging report

```excel
=QUERY(
  Refunds!$A:$Z,
  "SELECT B, D, E, F, K, DATEDIF(F, NOW(), 'D') 
   WHERE K = 'pending' 
   ORDER BY F ASC
   LABEL DATEDIF(F, NOW(), 'D') 'Days Pending'",
  1
)
```

---

## Tóm tắt constants

```excel
REFUND_PENDING_ACCOUNT_ID = "99999999-9999-9999-9999-999999999999"
VND_FORMAT = "#,##0"
DATE_FORMAT = "dd/mm/yyyy"
```

Tất cả formulas ready-to-paste, chỉ cần adjust range references nếu sheet structure khác!
