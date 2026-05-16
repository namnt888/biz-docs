# Google Sheets Formulas: Debt

Tài liệu này cung cấp công thức **copy-paste sẵn** cho mô hình n8n + Google Sheets, với `Transactions` là source of truth và tab `Debts` để track khoản vay/nợ.

---

## 1) Cấu trúc sheet đề xuất

### 1.1 Tab `Debts` — Master debt tracking

| Cột | Tên cột | Field | Ví dụ dữ liệu |
|---|---|---|---|
| A | `debt_id` | debt_id | DEBT_001, DEBT_002... |
| B | `occurred_at` | occurred_at | 10/03/2026, 15/03/2026 |
| C | `person_id` | person_id | PER_001, PER_002 |
| D | `person_name` | person_name | Nam, Linh, Hùng |
| E | `account_id` | account_id | ACC_CASH_001, ACC_TCB_001 |
| F | `account_name` | account_name | Tiền mặt, Techcombank |
| G | `debt_role` | debt_role | lent / borrowed |
| H | `original_amount` | original_amount | 2000000, 3000000 |
| I | `repaid_amount` | repaid_amount | Formula |
| J | `remaining_amount` | remaining_amount | Formula |
| K | `status` | status | Formula (pending/partial/settled/cancelled) |
| L | `due_date` | due_date | 30/04/2026 |
| M | `overdue_flag` | overdue_flag | Formula (OVERDUE/) |
| N | `progress_percent` | progress_percent | Formula (25%, 100%) |
| O | `progress_bar` | progress_bar | Formula (▓▓▓░░) |
| P | `last_repayment_date` | last_repayment_date | Formula |
| Q | `notes` | notes | Cho mượn ăn cưới, Mượn sửa nhà |
| R | `metadata_json` | metadata | JSON bulk_allocation |
| S | `created_at` | created_at | 10/03/2026 10:30 |
| T | `updated_at` | updated_at | 20/03/2026 15:45 |

### 1.2 Tab `DebtRepayments` — Chi tiết repayments

| Cột | Tên cột | Field | Ví dụ dữ liệu |
|---|---|---|---|
| A | `repayment_id` | repayment_id | REPAY_001, REPAY_002 |
| B | `repayment_date` | repayment_date | 20/03/2026, 30/03/2026 |
| C | `debt_id` | debt_id | DEBT_001 (link về Debts) |
| D | `person_id` | person_id | PER_001 |
| E | `person_name` | person_name | Nam |
| F | `account_id` | account_id | ACC_CASH_001 |
| G | `amount` | amount | 500000, 1500000 |
| H | `status` | status | posted / pending / void |
| I | `notes` | notes | Trả lần 1, Trả hết |
| J | `allocated_to_debts` | allocated_to_debts | JSON allocation details |
| K | `created_at` | created_at | 20/03/2026 10:00 |

### 1.3 Tab `People` — Person master data

| Cột | Tên cột | Field | Ví dụ dữ liệu |
|---|---|---|---|
| A | `person_id` | person_id | PER_001, PER_002 |
| B | `person_name` | person_name | Nam, Linh, Hùng |
| C | `phone` | phone | 0901234567 |
| D | `total_lent_pending` | total_lent_pending | Formula |
| E | `total_borrowed_pending` | total_borrowed_pending | Formula |
| F | `net_position` | net_position | Formula |
| G | `last_txn_date` | last_txn_date | Formula |
| H | `is_favorite` | is_favorite | TRUE/FALSE |

### 1.4 Tab `Summary` — Dashboard tổng hợp

| Cột | Metric | Value | Note |
|---|---|---|---|
| A | Total Lent Outstanding | Formula | Tiền cho mượn chưa thu hồi |
| B | Total Borrowed Outstanding | Formula | Tiền đi vay chưa trả |
| C | Net Debt Position | Formula | = Lent - Borrowed |
| D | Overdue Debts Count | Formula | Số debts quá hạn |
| E | Settled Debts This Month | Formula | Số debts tất toán trong tháng |

---

## 2) Công thức tính repaid_amount (Debts!I)

### 2.1 Công thức cơ bản (đặt tại `Debts!I2`, kéo xuống)

```gs
=IF(A2="", "",
  SUMIFS(
    DebtRepayments!$G:$G,           // Cột amount
    DebtRepayments!$C:$C, $A2,      // Match debt_id
    DebtRepayments!$H:$H, "posted"  // Chỉ tính posted
  )
)
```

**Giải thích (VN):**
- Tính tổng tất cả repayments đã chốt (`status = posted`) link với debt này
- Nếu debt_id rỗng → trả về rỗng
- Amount luôn dương, không cần xét dấu

### 2.2 Công thức với named ranges (cleaner)

Đặt named ranges trước:
- `repayAmount` = `DebtRepayments!$G:$G`
- `repayDebtId` = `DebtRepayments!$C:$C`
- `repayStatus` = `DebtRepayments!$H:$H`

```gs
=IF(A2="", "", SUMIFS(repayAmount, repayDebtId, $A2, repayStatus, "posted"))
```

---

## 3) Công thức tính remaining_amount (Debts!J)

### 3.1 Công thức cơ bản (đặt tại `Debts!J2`, kéo xuống)

```gs
=IF(A2="", "", MAX(0, H2 - I2))
```

**Giải thích (VN):**
- `H2` = original_amount
- `I2` = repaid_amount (formula từ section 2)
- `MAX(0, ...)` đảm bảo không âm (handle overpayment case)
- Nếu overpayment xảy ra, remaining = 0 (không hiển thị số âm)

### 3.2 Alternative: Hiển thị credit nếu overpayment

```gs
=IF(A2="", "", H2 - I2)
```

→ Có thể âm nếu overpayment, dùng để alert user

---

## 4) Công thức tính status (Debts!K)

### 4.1 Auto-update status dựa trên remaining_amount

```gs
=IF(A2="", "",
  IF(J2 <= 0, "settled",
    IF(I2 > 0, "partial", "pending")
  )
)
```

**Giải thích (VN):**
- Nếu `remaining_amount ≤ 0` → `settled` (trả hết)
- Nếu `repaid_amount > 0` nhưng còn nợ → `partial` (trả một phần)
- Nếu chưa trả gì → `pending`

### 4.2 Handle cancelled status riêng

Nếu có cột `cancelled_flag` hoặc logic cancel riêng:

```gs
=IF(A2="", "",
  IF(cancelled_flag, "cancelled",
    IF(J2 <= 0, "settled",
      IF(I2 > 0, "partial", "pending")
    )
  )
)
```

---

## 5) Công thức overdue flag (Debts!M)

### 5.1 Kiểm tra quá hạn

```gs
=IF(A2="", "",
  IF(AND(L2 <> "", TODAY() > L2, K2 <> "settled", K2 <> "cancelled"),
    "OVERDUE",
    ""
  )
)
```

**Giải thích (VN):**
- `L2` = due_date
- Quá hạn nếu: có due_date AND hôm nay > due_date AND chưa settled/cancelled
- Trả về "OVERDUE" để conditional formatting tô đỏ

### 5.2 Số ngày quá hạn

```gs
=IF(M2 = "OVERDUE", TODAY() - L2, "")
```

→ Hiển thị số ngày trễ (ví dụ: 5, 10, 30 ngày)

---

## 6) Công thức progress tracking (Debts!N, O)

### 6.1 Progress percent (Debts!N)

```gs
=IF(A2="", "",
  IF(H2 = 0, 0, I2 / H2)
)
```

**Format:** Percentage (%), 0 decimal places

**Giải thích (VN):**
- `I2 / H2` = repaid / original
- Nếu original = 0 → tránh divide by zero, trả về 0

### 6.2 Progress bar visualization (Debts!O)

```gs
=IF(A2="", "",
  REPT("▓", ROUND(N2 * 5, 0)) & REPT("░", 5 - ROUND(N2 * 5, 0))
)
```

**Giải thích (VN):**
- Scale progress thành 5 blocks
- `▓` = phần đã trả
- `░` = phần còn nợ
- Ví dụ: 60% → ▓▓▓░░

### 6.3 Progress bar với màu sắc (conditional formatting)

Kết hợp với conditional formatting:
- 0-25%: Đỏ
- 26-50%: Cam
- 51-75%: Vàng
- 76-99%: Xanh nhạt
- 100%: Xanh đậm

---

## 7) Công thức last repayment date (Debts!P)

```gs
=IF(A2="", "",
  MAXIFS(
    DebtRepayments!$B:$B,           // Cột repayment_date
    DebtRepayments!$C:$C, $A2,      // Match debt_id
    DebtRepayments!$H:$H, "posted"  // Chỉ tính posted
  )
)
```

**Giải thích (VN):**
- Tìm ngày repayment gần nhất đã chốt của debt này
- Nếu chưa có repayment → trả về rỗng

---

## 8) Formulas summary dashboard (tab Summary)

### 8.1 Total outstanding lent (receivable)

```gs
=SUMIFS(
  Debts!$J:$J,          // remaining_amount
  Debts!$G:$G, "lent",  // debt_role = lent
  Debts!$K:$K, "<>settled",
  Debts!$K:$K, "<>cancelled"
)
```

**Giải thích (VN):** Tổng tiền mình cho mượn chưa thu hồi được

### 8.2 Total outstanding borrowed (payable)

```gs
=SUMIFS(
  Debts!$J:$J,              // remaining_amount
  Debts!$G:$G, "borrowed",  // debt_role = borrowed
  Debts!$K:$K, "<>settled",
  Debts!$K:$K, "<>cancelled"
)
```

**Giải thích (VN):** Tổng tiền mình đi vay chưa trả

### 8.3 Net debt position

```gs
= (Total outstanding lent) - (Total outstanding borrowed)
```

Hoặc viết gọn:

```gs
=SUMIFS(Debts!$J:$J, Debts!$G:$G, "lent", Debts!$K:$K, "<>settled", Debts!$K:$K, "<>cancelled")
 - SUMIFS(Debts!$J:$J, Debts!$G:$G, "borrowed", Debts!$K:$K, "<>settled", Debts!$K:$K, "<>cancelled")
```

**Ý nghĩa:**
- **Số dương**: Mình đang có nhiều tiền phải thu hơn phải trả (lợi thế)
- **Số âm**: Mình đang nợ nhiều hơn được nợ (rủi ro)
- **Số 0**: Cân bằng

### 8.4 Overdue debts count

```gs
=COUNTIFS(
  Debts!$M:$M, "OVERDUE",
  Debts!$K:$K, "<>settled",
  Debts!$K:$K, "<>cancelled"
)
```

**Giải thích (VN):** Đếm số debts đang quá hạn chưa xử lý

### 8.5 Settled debts this month

```gs
=COUNTIFS(
  Debts!$K:$K, "settled",
  Debts!$P:$P, ">=" & EOMONTH(TODAY(), -1) + 1,
  Debts!$P:$P, "<=" & EOMONTH(TODAY(), 0)
)
```

**Giải thích (VN):** Số debts đã tất toán trong tháng hiện tại

---

## 9) Per-person outstanding balance (tab People)

### 9.1 Total lent pending per person (People!D)

```gs
=IF(A2="", "",
  SUMIFS(
    Debts!$J:$J,              // remaining_amount
    Debts!$C:$C, $A2,         // Match person_id
    Debts!$G:$G, "lent",      // debt_role = lent
    Debts!$K:$K, "<>settled",
    Debts!$K:$K, "<>cancelled"
  )
)
```

**Giải thích (VN):** Người này đang nợ mình bao nhiêu (chưa thu hồi)

### 9.2 Total borrowed pending per person (People!E)

```gs
=IF(A2="", "",
  SUMIFS(
    Debts!$J:$J,              // remaining_amount
    Debts!$C:$C, $A2,         // Match person_id
    Debts!$G:$G, "borrowed",  // debt_role = borrowed
    Debts!$K:$K, "<>settled",
    Debts!$K:$K, "<>cancelled"
  )
)
```

**Giải thích (VN):** Mình đang nợ người này bao nhiêu (chưa trả)

### 9.3 Net position per person (People!F)

```gs
=IF(A2="", "", D2 - E2)
```

**Ý nghĩa:**
- **Số dương**: Người này nợ mình nhiều hơn mình nợ họ
- **Số âm**: Mình nợ người này nhiều hơn họ nợ mình
- **Số 0**: Hòa (hoặc không có debt nào)

### 9.4 Last transaction date per person (People!G)

```gs
=IF(A2="", "",
  MAX(
    MAXIFS(Debts!$B:$B, Debts!$C:$C, $A2),
    MAXIFS(DebtRepayments!$B:$B, DebtRepayments!$D:$D, $A2)
  )
)
```

**Giải thích (VN):** Ngày giao dịch gần nhất (debt hoặc repayment) của người này

---

## 10) Named ranges khuyến nghị

Để formulas dễ đọc và maintain, tạo các named ranges sau:

| Named Range | Refers To | Mục đích |
|---|---|---|
| `debtId` | `Debts!$A:$A` | Debt ID column |
| `debtRole` | `Debts!$G:$G` | Lent/borrowed column |
| `debtOriginal` | `Debts!$H:$H` | Original amount |
| `debtRepaid` | `Debts!$I:$I` | Repaid amount |
| `debtRemaining` | `Debts!$J:$J` | Remaining amount |
| `debtStatus` | `Debts!$K:$K` | Status column |
| `debtPersonId` | `Debts!$C:$C` | Person ID in Debts |
| `debtDueDate` | `Debts!$L:$L` | Due date column |
| `repayAmount` | `DebtRepayments!$G:$G` | Repayment amount |
| `repayDebtId` | `DebtRepayments!$C:$C` | Debt ID in Repayments |
| `repayStatus` | `DebtRepayments!$H:$H` | Repayment status |
| `repayDate` | `DebtRepayments!$B:$B` | Repayment date |
| `repayPersonId` | `DebtRepayments!$D:$D` | Person ID in Repayments |

### Ví dụ formula với named ranges

Thay vì:
```gs
=SUMIFS(Debts!$J:$J, Debts!$C:$C, $A2, Debts!$G:$G, "lent", Debts!$K:$K, "<>settled")
```

Dùng named ranges:
```gs
=SUMIFS(debtRemaining, debtPersonId, $A2, debtRole, "lent", debtStatus, "<>settled")
```

→ Dễ đọc, dễ debug, dễ maintain hơn

---

## 11) Conditional formatting rules

### 11.1 Overdue debts (tô đỏ)

**Áp dụng:** `Debts!A:T`  
**Condition:** Custom formula  
**Formula:**
```gs
=$M2 = "OVERDUE"
```
**Format:** Red background (#FFEBEE), dark red text

### 11.2 Settled debts (tô xanh lá)

**Áp dụng:** `Debts!A:T`  
**Condition:** Custom formula  
**Formula:**
```gs
=$K2 = "settled"
```
**Format:** Light green background (#E8F5E9), dark green text

### 11.3 Partial debts (tô vàng)

**Áp dụng:** `Debts!A:T`  
**Condition:** Custom formula  
**Formula:**
```gs
=$K2 = "partial"
```
**Format:** Light yellow background (#FFF9C4), amber text

### 11.4 Cancelled debts (tô xám)

**Áp dụng:** `Debts!A:T`  
**Condition:** Custom formula  
**Formula:**
```gs
=$K2 = "cancelled"
```
**Format:** Light gray background (#F5F5F5), gray text

### 11.5 Progress bar color scale

**Áp dụng:** `Debts!N:N` (progress_percent)  
**Condition:** Color scale  
**Rules:**
- Min (0%): Red (#F44336)
- Midpoint (50%): Yellow (#FFEB3B)
- Max (100%): Green (#4CAF50)

---

## 12) Format notes (VND & Dates)

### 12.1 VND format (không decimal)

**Áp dụng:** Các cột amount (original_amount, repaid_amount, remaining_amount)  
**Format:** `#,##0`

Ví dụ:
- 2000000 → 2,000,000
- 500000 → 500,000
- 0 → 0

### 12.2 Date format

**Áp dụng:** occurred_at, due_date, repayment_date  
**Format:** `dd/mm/yyyy`

Ví dụ:
- 10/03/2026
- 30/04/2026

### 12.3 Percentage format

**Áp dụng:** progress_percent  
**Format:** Percentage, 0 decimal places

Ví dụ:
- 0.25 → 25%
- 1 → 100%
- 0 → 0%

---

## 13) Troubleshooting常见 issues

### 13.1 Formula trả về #VALUE!

**Nguyên nhân:** Data type mismatch (text vs number)  
**Fix:** Đảm bảo amount columns là số, không phải text  
**Check:** Dùng `=ISNUMBER(H2)` để verify

### 13.2 SUMIFS trả về 0 dù có data

**Nguyên nhân:** 
- debt_id không match exact (có space, case sensitive)
- Status không đúng "posted"

**Fix:**
```gs
=TRIM(A2)  // Xóa spaces thừa
=UPPER(status)  // Chuẩn hóa case
```

### 13.3 Circular dependency error

**Nguyên nhân:** Formula reference chính nó  
**Fix:** Check xem formula có indirect self-reference không

### 13.4 MAXIFS/MINIFS không hoạt động

**Nguyên nhân:** Google Sheets yêu cầu ít nhất 1 criteria range  
**Fix:** Thêm criteria dummy nếu cần:
```gs
=MAXIFS(range, criteria_range, "<>")
```

### 13.5 Progress bar hiển thị sai

**Nguyên nhân:** Progress percent không phải số (text format)  
**Fix:** Convert sang số:
```gs
=VALUE(N2)  // Hoặc format cell as Number/Percentage
```

---

## 14) Checklist kiểm tra sau khi dán formulas

- [ ] `repaid_amount` tính đúng tổng repayments posted
- [ ] `remaining_amount` = original - repaid (capped at 0)
- [ ] `status` tự động update khi repayment thay đổi
- [ ] `overdue_flag` hiển thị đúng với debts quá hạn
- [ ] `progress_percent` hiển thị % chính xác
- [ ] `progress_bar` visual đúng số blocks
- [ ] `last_repayment_date` tìm đúng ngày gần nhất
- [ ] Summary dashboard tính đúng totals
- [ ] Per-person outstanding balances chính xác
- [ ] Conditional formatting tô màu đúng rules
- [ ] VND format áp dụng đúng (không decimal)
- [ ] Date format thống nhất dd/mm/yyyy
- [ ] Named ranges defined và hoạt động
- [ ] Không có circular dependency errors
- [ ] Test với edge cases: overpayment, cancelled, multiple debts per person

---

## 15) Ví dụ data mẫu ready-to-test

### Tab `Debts`:

| debt_id | occurred_at | person_id | person_name | account_id | debt_role | original_amount | repaid_amount | remaining_amount | status | due_date | overdue_flag | progress_percent | progress_bar |
|---|---|---|---|---|---|---:|---:|---:|---|---|---|---:|---|
| DEBT_001 | 10/03/2026 | PER_001 | Nam | ACC_CASH_001 | lent | 2000000 | 500000 | 1500000 | partial | 30/04/2026 | | 25% | ▓░░░░ |
| DEBT_002 | 15/03/2026 | PER_002 | Linh | ACC_TCB_001 | borrowed | 3000000 | 0 | 3000000 | pending | 15/05/2026 | | 0% | ░░░░░ |
| DEBT_003 | 01/02/2026 | PER_001 | Nam | ACC_MOMO_001 | lent | 1000000 | 1000000 | 0 | settled | 28/02/2026 | | 100% | ▓▓▓▓▓ |
| DEBT_004 | 01/01/2026 | PER_003 | Hùng | ACC_CASH_001 | lent | 500000 | 0 | 500000 | pending | 31/01/2026 | OVERDUE | 0% | ░░░░░ |

### Tab `DebtRepayments`:

| repayment_id | repayment_date | debt_id | person_id | amount | status | notes |
|---|---|---|---|---:|---|---|
| REPAY_001 | 20/03/2026 | DEBT_001 | PER_001 | 500000 | posted | Nam trả lần 1 |
| REPAY_002 | 25/02/2026 | DEBT_003 | PER_001 | 500000 | posted | Nam trả lần 1 |
| REPAY_003 | 01/03/2026 | DEBT_003 | PER_001 | 500000 | posted | Nam trả hết |

### Tab `Summary`:

| Metric | Value | Formula |
|---|---:|---|
| Total Lent Outstanding | 2000000 | `=SUMIFS(...)` |
| Total Borrowed Outstanding | 3000000 | `=SUMIFS(...)` |
| Net Debt Position | -1000000 | `= Lent - Borrowed` |
| Overdue Debts Count | 1 | `=COUNTIFS(...)` |
| Settled This Month | 1 | `=COUNTIFS(...)` |

---

**Version:** 1.0  
**Created:** March 2026  
**Last Review:** March 2026
