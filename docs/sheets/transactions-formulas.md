# Google Sheets Formulas: Transactions

Tài liệu này cung cấp công thức **copy-paste sẵn** cho mô hình n8n + Google Sheets, với `Transactions` làm source of truth cho mọi tính toán tài chính.

## 1) Cấu trúc sheet đề xuất

### 1.1 Tab `Transactions` (Source of Truth)

| Cột | Tên cột | Ví dụ dữ liệu | Ý nghĩa |
|---|---|---|---|
| A | `txn_id` | TXN_001, TXN_002... | ID duy nhất |
| B | `txn_date` | 05/03/2026, 06/03/2026 | Ngày giao dịch |
| C | `status` | posted / pending / void | Trạng thái |
| D | `type` | income / expense / transfer_in / transfer_out / cashback / refund / debt / repayment / service | Loại giao dịch |
| E | `account_id` | ACC_TCB_001, ACC_MOMO_001 | Account chịu tác động |
| F | `account_name` | Techcombank, MoMo, Tiền mặt | Tên account (display) |
| G | `amount` | 150000, 5000000 | Số tiền (VND, luôn dương) |
| H | `category_id` | CAT_FOOD_001 | ID danh mục |
| I | `category_name` | Ăn uống, Mua sắm | Tên category |
| J | `shop_id` | SHOP_PH_001 | ID cửa hàng |
| K | `shop_name` | Pizza Hut, Starbucks | Tên shop |
| L | `person_id` | PER_001 | ID người (debt/repayment) |
| M | `person_name` | Nam, Linh | Tên người |
| N | `debt_role` | lent / borrowed | Vai trò nợ |
| O | `target_account_id` | ACC_VCB_001 | Account đích (transfer) |
| P | `note` | Ăn trưa, Cho mượn | Ghi chú |
| Q | `cycle_tag` | 2026-03, 2026-02 | Tag chu kỳ cashback |
| R | `cashback_amount` | 15000, 50000 | Tiền cashback |
| S | `is_installment` | TRUE/FALSE | Trả góp hay không |
| T | `created_at` | 05/03/2026 10:30 | Timestamp tạo |
| U | `updated_at` | 05/03/2026 10:30 | Timestamp cập nhật |

### 1.2 Tab `Accounts` (Balance Summary)

| Cột | Tên cột | Công thức |
|---|---|---|
| A | `account_id` | Nhập tay |
| B | `account_name` | Nhập tay |
| C | `type` | Nhập tay |
| D | `initial_balance` | Nhập tay |
| E | `current_balance` | Formula (tính từ Transactions) |
| F | `total_income` | Formula |
| G | `total_expense` | Formula |
| H | `total_transfer_in` | Formula |
| I | `total_transfer_out` | Formula |
| J | `total_cashback` | Formula |
| K | `total_debt_out` | Formula |
| L | `total_repayment_in` | Formula |

### 1.3 Tab `Summary` (Dashboard)

| Cột | Tên cột | Công thức |
|---|---|---|
| A | Metric | Nhập tay |
| B | Value | Formula |
| C | Note | Giải thích |

### 1.4 Tab `Cashback_by_Cycle`

| Cột | Tên cột | Ý nghĩa |
|---|---|---|
| A | `account_id` | Account |
| B | `account_name` | Tên account |
| C | `cycle_tag` | 2026-03 |
| D | `spent_amount` | Tổng chi trong cycle |
| E | `cashback_earned` | Cashback thực nhận |
| F | `max_budget` | Ngân sách tối đa |
| G | `remaining_budget` | Còn lại |
| H | `min_spend_target` | Mục tiêu chi tối thiểu |
| I | `is_qualified` | Đạt điều kiện chưa |

### 1.5 Tab `Debt_by_Person`

| Cột | Tên cột | Ý nghĩa |
|---|---|---|
| A | `person_id` | Person |
| B | `person_name` | Tên người |
| C | `total_lent` | Tổng đã cho mượn |
| D | `total_repaid` | Tổng đã trả |
| E | `balance_pending` | Còn nợ |
| F | `last_txn_date` | Giao dịch gần nhất |

---

## 2) Công thức tính số dư theo account (Accounts!E)

### 2.1 Công thức tổng quát cho current_balance

Đặt tại `Accounts!E2`, kéo xuống:

```gs
=IF(A2="","",
  D2
  + SUMIFS(Transactions!$G:$G, Transactions!$E:$E, $A2, Transactions!$D:$D, "income",       Transactions!$C:$C, "posted")
  - SUMIFS(Transactions!$G:$G, Transactions!$E:$E, $A2, Transactions!$D:$D, "expense",      Transactions!$C:$C, "posted")
  + SUMIFS(Transactions!$G:$G, Transactions!$E:$E, $A2, Transactions!$D:$D, "transfer_in",  Transactions!$C:$C, "posted")
  - SUMIFS(Transactions!$G:$G, Transactions!$E:$E, $A2, Transactions!$D:$D, "transfer_out", Transactions!$C:$C, "posted")
  + SUMIFS(Transactions!$G:$G, Transactions!$E:$E, $A2, Transactions!$D:$D, "cashback",     Transactions!$C:$C, "posted")
  + SUMIFS(Transactions!$G:$G, Transactions!$E:$E, $A2, Transactions!$D:$D, "refund",       Transactions!$C:$C, "posted")
  + SUMIFS(Transactions!$G:$G, Transactions!$E:$E, $A2, Transactions!$D:$D, "repayment",    Transactions!$C:$C, "posted")
  - SUMIFS(Transactions!$G:$G, Transactions!$E:$E, $A2, Transactions!$D:$D, "debt",         Transactions!$C:$C, "posted")
  - SUMIFS(Transactions!$G:$G, Transactions!$E:$E, $A2, Transactions!$D:$D, "service",      Transactions!$C:$C, "posted")
)
```

**Giải thích (VN):**
- Lấy số dư đầu (`D2`) làm gốc
- Cộng tất cả `income`, `transfer_in`, `cashback`, `refund`, `repayment` đã `posted`
- Trừ tất cả `expense`, `transfer_out`, `debt`, `service` đã `posted`
- Chỉ tính transactions có `status = posted`, bỏ qua `pending` và `void`
- `credit_card` có thể ra số âm (hợp lệ, thể hiện dư nợ thẻ)

### 2.2 Công thức cho total_income (Accounts!F)

```gs
=IF(A2="","",
  SUMIFS(Transactions!$G:$G, Transactions!$E:$E, $A2, Transactions!$D:$D, "income", Transactions!$C:$C, "posted")
)
```

**Giải thích (VN):** Tổng thu nhập vào account trong kỳ.

### 2.3 Công thức cho total_expense (Accounts!G)

```gs
=IF(A2="","",
  SUMIFS(Transactions!$G:$G, Transactions!$E:$E, $A2, Transactions!$D:$D, "expense", Transactions!$C:$C, "posted")
)
```

**Giải thích (VN):** Tổng chi tiêu từ account trong kỳ.

### 2.4 Công thức cho total_transfer_in (Accounts!H)

```gs
=IF(A2="","",
  SUMIFS(Transactions!$G:$G, Transactions!$E:$E, $A2, Transactions!$D:$D, "transfer_in", Transactions!$C:$C, "posted")
)
```

**Giải thích (VN):** Tổng tiền nhận chuyển khoản từ account khác.

### 2.5 Công thức cho total_transfer_out (Accounts!I)

```gs
=IF(A2="","",
  SUMIFS(Transactions!$G:$G, Transactions!$E:$E, $A2, Transactions!$D:$D, "transfer_out", Transactions!$C:$C, "posted")
)
```

**Giải thích (VN):** Tổng tiền chuyển khoản ra account khác.

### 2.6 Công thức cho total_cashback (Accounts!J)

```gs
=IF(A2="","",
  SUMIFS(Transactions!$G:$G, Transactions!$E:$E, $A2, Transactions!$D:$D, "cashback", Transactions!$C:$C, "posted")
)
```

**Giải thích (VN):** Tổng cashback nhận được trong kỳ.

### 2.7 Công thức cho total_debt_out (Accounts!K)

```gs
=IF(A2="","",
  SUMIFS(Transactions!$G:$G, Transactions!$E:$E, $A2, Transactions!$D:$D, "debt", Transactions!$C:$C, "posted")
)
```

**Giải thích (VN):** Tổng tiền đã cho người khác mượn (làm giảm số dư).

### 2.8 Công thức cho total_repayment_in (Accounts!L)

```gs
=IF(A2="","",
  SUMIFS(Transactions!$G:$G, Transactions!$E:$E, $A2, Transactions!$D:$D, "repayment", Transactions!$C:$C, "posted")
)
```

**Giải thích (VN):** Tổng tiền thu hồi nợ/nhận trả (làm tăng số dư).

---

## 3) Công thức dashboard tổng hợp (Summary tab)

### 3.1 Tổng tài sản (không tính credit_card âm)

Đặt tại `Summary!B2`:

```gs
=SUMIFS(Accounts!$E:$E, Accounts!$C:$C, "<>credit_card", Accounts!$E:$E, ">0", Accounts!$D:$D, "active")
```

**Giải thích (VN):** Cộng tất cả số dư dương của accounts `active`, loại trừ `credit_card`.

### 3.2 Tổng nợ thẻ tín dụng

Đặt tại `Summary!B3`:

```gs
=ABS(SUMIFS(Accounts!$E:$E, Accounts!$C:$C, "credit_card", Accounts!$E:$E, "<0", Accounts!$D:$D, "active"))
```

**Giải thích (VN):** Lấy phần âm của `credit_card`, đổi sang dương để biểu thị nghĩa vụ nợ.

### 3.3 Net Worth (Tài sản ròng)

Đặt tại `Summary!B4`:

```gs
=SUMIFS(Accounts!$E:$E, Accounts!$C:$C, "<>credit_card", Accounts!$E:$E, ">0", Accounts!$D:$D, "active")
 - ABS(SUMIFS(Accounts!$E:$E, Accounts!$C:$C, "credit_card", Accounts!$E:$E, "<0", Accounts!$D:$D, "active"))
```

**Giải thích (VN):** Tài sản ròng = Tổng tài sản - Tổng nợ thẻ.

### 3.4 Tổng thu tháng hiện tại

Đặt tại `Summary!B5`:

```gs
=SUMIFS(Transactions!$G:$G, Transactions!$D:$D, "income", Transactions!$C:$C, "posted",
        Transactions!$B:$B, ">="&EOMONTH(TODAY(),-1)+1, Transactions!$B:$B, "<="&EOMONTH(TODAY(),0))
```

**Giải thích (VN):** Tổng income trong tháng hiện tại.

### 3.5 Tổng chi tháng hiện tại

Đặt tại `Summary!B6`:

```gs
=SUMIFS(Transactions!$G:$G, Transactions!$D:$D, "expense", Transactions!$C:$C, "posted",
        Transactions!$B:$B, ">="&EOMONTH(TODAY(),-1)+1, Transactions!$B:$B, "<="&EOMONTH(TODAY(),0))
```

**Giải thích (VN):** Tổng expense trong tháng hiện tại.

### 3.6 Tiết kiệm tháng (Thu - Chi)

Đặt tại `Summary!B7`:

```gs
=B5-B6
```

**Giải thích (VN):** Chênh lệch thu chi tháng này.

### 3.7 Tỷ lệ tiết kiệm (%)

Đặt tại `Summary!B8`:

```gs
=IF(B5=0,0,B7/B5)
```

**Giải thích (VN):** Phần trăm thu nhập được tiết kiệm. Format as percentage.

---

## 4) Cashback tracking theo cycle

### 4.1 Spent amount trong cycle (Cashback_by_Cycle!D)

Đặt tại `Cashback_by_Cycle!D2`, kéo xuống:

```gs
=IF(A2="","",
  SUMIFS(Transactions!$G:$G,
         Transactions!$E:$E, $A2,
         Transactions!$Q:$Q, $C2,
         Transactions!$D:$D, {"expense","debt","service"},
         Transactions!$C:$C, "posted")
)
```

**Giải thích (VN):** 
- Tính tổng chi trong cycle tag cụ thể
- Bao gồm `expense`, `debt`, `service` (các loại làm giảm số dư và eligible cho cashback)
- Chỉ tính `posted` transactions

> **Lưu ý:** Google Sheets SUMIFS không hỗ trợ array constant trực tiếp. Dùng công thức thay thế:

```gs
=IF(A2="","",
  SUMIFS(Transactions!$G:$G, Transactions!$E:$E, $A2, Transactions!$Q:$Q, $C2, Transactions!$D:$D, "expense", Transactions!$C:$C, "posted")
  + SUMIFS(Transactions!$G:$G, Transactions!$E:$E, $A2, Transactions!$Q:$Q, $C2, Transactions!$D:$D, "debt", Transactions!$C:$C, "posted")
  + SUMIFS(Transactions!$G:$G, Transactions!$E:$E, $A2, Transactions!$Q:$Q, $C2, Transactions!$D:$D, "service", Transactions!$C:$C, "posted")
)
```

### 4.2 Cashback earned trong cycle (Cashback_by_Cycle!E)

```gs
=IF(A2="","",
  SUMIFS(Transactions!$R:$R, Transactions!$E:$E, $A2, Transactions!$Q:$Q, $C2, Transactions!$C:$C, "posted")
)
```

**Giải thích (VN):** Tổng cashback đã nhận trong cycle.

### 4.3 Remaining budget (Cashback_by_Cycle!G)

```gs
=IF(A2="","",MAX(0,$F2-$E2))
```

**Giải thích (VN):** Ngân sách còn lại = max_budget - earned. Không âm.

### 4.4 Is qualified (đạt min spend) (Cashback_by_Cycle!I)

```gs
=IF(A2="","",IF($H2="","TRUE",$D2>=$H2))
```

**Giải thích (VN):** 
- Nếu không có min_spend_target (`H2` rỗng) → tự động đạt
- Nếu có target → kiểm tra spent >= target

### 4.5 Cycle label hiển thị

Đặt tại `Cashback_by_Cycle!C2`, format thành readable label:

```gs
=IF(A2="","",TEXT(DATEVALUE($C2&"-01"),"mm/yyyy"))
```

**Giải thích (VN):** Chuyển `2026-03` thành `03/2026` để hiển thị đẹp hơn.

---

## 5) Debt tracking theo person

### 5.1 Total lent (cho vay) (Debt_by_Person!C)

Đặt tại `Debt_by_Person!C2`, kéo xuống:

```gs
=IF(A2="","",
  SUMIFS(Transactions!$G:$G, Transactions!$L:$L, $A2, Transactions!$D:$D, "debt", Transactions!$N:$N, "lent", Transactions!$C:$C, "posted")
)
```

**Giải thích (VN):** Tổng tiền đã cho person này mượn (vai trò `lent`).

### 5.2 Total repaid (đã trả) (Debt_by_Person!D)

```gs
=IF(A2="","",
  SUMIFS(Transactions!$G:$G, Transactions!$L:$L, $A2, Transactions!$D:$D, "repayment", Transactions!$N:$N, "lent", Transactions!$C:$C, "posted")
)
```

**Giải thích (VN):** Tổng tiền person này đã trả lại (cho vai trò `lent`).

### 5.3 Balance pending (còn nợ) (Debt_by_Person!E)

```gs
=IF(A2="","",C2-D2)
```

**Giải thích (VN):** Số dư còn nợ = total_lent - total_repaid.

### 5.4 Last transaction date (Debt_by_Person!F)

```gs
=IF(A2="","",MAXIFS(Transactions!$B:$B, Transactions!$L:$L, $A2, Transactions!$C:$C, "posted"))
```

**Giải thích (VN):** Ngày giao dịch gần nhất với person này.

### 5.5 Total borrowed (đi vay) - Optional

Nếu muốn track cả chiều đi vay (person cho mình mượn):

```gs
=IF(A2="","",
  SUMIFS(Transactions!$G:$G, Transactions!$L:$L, $A2, Transactions!$D:$D, "debt", Transactions!$N:$N, "borrowed", Transactions!$C:$C, "posted")
)
```

---

## 6) Monthly breakdown theo category

### 6.1 Tạo tab `Category_Breakdown`

| Cột | Tên | Công thức |
|---|---|---|
| A | `category_name` | Nhập tay hoặc UNIQUE |
| B | `This Month` | Formula |
| C | `Last Month` | Formula |
| D | `MTD %` | Formula |

### 6.2 This Month spending by category

Đặt tại `Category_Breakdown!B2`:

```gs
=IF(A2="","",
  SUMIFS(Transactions!$G:$G,
         Transactions!$I:$I, $A2,
         Transactions!$D:$D, "expense",
         Transactions!$C:$C, "posted",
         Transactions!$B:$B, ">="&EOMONTH(TODAY(),-1)+1,
         Transactions!$B:$B, "<="&EOMONTH(TODAY(),0))
)
```

**Giải thích (VN):** Tổng chi theo category trong tháng hiện tại.

### 6.3 Last Month spending by category

Đặt tại `Category_Breakdown!C2`:

```gs
=IF(A2="","",
  SUMIFS(Transactions!$G:$G,
         Transactions!$I:$I, $A2,
         Transactions!$D:$D, "expense",
         Transactions!$C:$C, "posted",
         Transactions!$B:$B, ">="&EOMONTH(TODAY(),-2)+1,
         Transactions!$B:$B, "<="&EOMONTH(TODAY(),-1))
)
```

**Giải thích (VN):** Tổng chi theo category trong tháng trước.

### 6.4 Month-to-Date percentage

Đặt tại `Category_Breakdown!D2`:

```gs
=IF(SUM($B:$B)=0,0,B2/SUM($B:$B))
```

**Giải thích (VN):** Tỷ lệ % của category so với tổng chi tháng. Format as percentage.

---

## 7) Named Ranges (khuyến nghị)

Để công thức ngắn gọn và dễ đọc, tạo các Named Ranges sau:

| Name | Refers to |
|---|---|
| `txnDate` | `Transactions!$B:$B` |
| `txnStatus` | `Transactions!$C:$C` |
| `txnType` | `Transactions!$D:$D` |
| `txnAccount` | `Transactions!$E:$E` |
| `txnAmount` | `Transactions!$G:$G` |
| `txnCategory` | `Transactions!$I:$I` |
| `txnPerson` | `Transactions!$L:$L` |
| `txnDebtRole` | `Transactions!$N:$N` |
| `txnCycleTag` | `Transactions!$Q:$Q` |
| `txnCashback` | `Transactions!$R:$R` |

**Ví dụ công thức rút gọn:**

```gs
=IF(A2="","",
  D2
  + SUMIFS(txnAmount, txnAccount, $A2, txnType, "income",       txnStatus, "posted")
  - SUMIFS(txnAmount, txnAccount, $A2, txnType, "expense",      txnStatus, "posted")
  + SUMIFS(txnAmount, txnAccount, $A2, txnType, "transfer_in",  txnStatus, "posted")
  - SUMIFS(txnAmount, txnAccount, $A2, txnType, "transfer_out", txnStatus, "posted")
  + SUMIFS(txnAmount, txnAccount, $A2, txnType, "cashback",     txnStatus, "posted")
  + SUMIFS(txnAmount, txnAccount, $A2, txnType, "refund",       txnStatus, "posted")
  + SUMIFS(txnAmount, txnAccount, $A2, txnType, "repayment",    txnStatus, "posted")
  - SUMIFS(txnAmount, txnAccount, $A2, txnType, "debt",         txnStatus, "posted")
  - SUMIFS(txnAmount, txnAccount, $A2, txnType, "service",      txnStatus, "posted")
)
```

---

## 8) Advanced: Dynamic month selector

### 8.1 Tạo cell chọn tháng

Tại `Summary!E1`, dùng Data Validation → List from range hoặc nhập manual:
```
2026-01
2026-02
2026-03
...
```

Hoặc dùng formula để tạo dropdown dynamic:

```gs
=ARRAYFORMULA(TEXT(UNIQUE(FILTER(MONTH(Transactions!$B:$B), YEAR(Transactions!$B:$B)=YEAR(TODAY()))),"00")&"-"&YEAR(TODAY()))
```

### 8.2 Công thức thu/chi theo tháng selected

**Total Income (selected month):**

```gs
=SUMIFS(Transactions!$G:$G,
        Transactions!$D:$D, "income",
        Transactions!$C:$C, "posted",
        Transactions!$B:$B, ">="&DATEVALUE(RIGHT($E$1,4)&"-"&LEFT($E$1,2)&"-01"),
        Transactions!$B:$B, "<="&EOMONTH(DATEVALUE(RIGHT($E$1,4)&"-"&LEFT($E$1,2)&"-01"),0))
```

**Giải thích (VN):** 
- Parse `YYYY-MM` từ cell E1 thành date
- Tính tổng income trong tháng đó
- Có thể copy cho expense, transfer, v.v.

---

## 9) Formatting notes (VND)

### 9.1 Định dạng số

- Cột `amount`, `current_balance`, money columns: `#,##0` (không decimal)
- Percentage columns (tiết kiệm %, MTD %): `0.0%` (1 chữ số thập phân)
- Date columns: `dd/mm/yyyy`

### 9.2 Conditional formatting

**Accounts!E:E (current_balance):**
- Rule 1: `E2 < 0` → Fill color red (cho credit_card âm)
- Rule 2: `D2 = "inactive"` → Fill color gray (archived accounts)
- Rule 3: `D2 = "archived"` → Fill color light gray, text italic

**Transactions!C:C (status):**
- `C2 = "posted"` → Green background
- `C2 = "pending"` → Yellow background
- `C2 = "void"` → Red background, strikethrough text

**Transactions!D:D (type):**
- `D2 = "income"` → Text color green
- `D2 = "expense"` → Text color red
- `D2 = "cashback"` → Text color blue
- `D2 = "debt"` → Text color orange

### 9.3 Freeze panes

- Freeze row 1 (headers) cho tất cả tabs
- Freeze column A (account_id/person_id) nếu cần scroll ngang

---

## 10) Kiểm tra nhanh sau khi dán công thức

### Checklist validation:

1. **Tạo test data:**
   - [ ] 5 accounts: Techcombank, VCB, MoMo, Tiền mặt, Uob (credit_card)
   - [ ] 10 transactions đủ loại: income, expense, transfer_in, transfer_out, cashback, debt, repayment
   - [ ] 2 persons: Nam, Linh (cho debt tracking)
   - [ ] 3 categories: Ăn uống, Mua sắm, Lương

2. **Verify balances:**
   - [ ] `current_balance` khớp với tính toán tay
   - [ ] Transfer không bị double-count (kiểm tra 2 dòng transfer_in/out)
   - [ ] Credit_card có thể âm hợp lệ

3. **Verify cashback:**
   - [ ] `spent_amount` trong cycle đúng
   - [ ] `is_qualified` logic đúng (so sánh với min_spend)
   - [ ] `remaining_budget` không âm

4. **Verify debt:**
   - [ ] `total_lent` - `total_repaid` = `balance_pending`
   - [ ] Phân biệt rõ `lent` vs `borrowed` roles

5. **Verify dashboard:**
   - [ ] Net worth = Assets - Liabilities
   - [ ] Monthly savings = Income - Expense
   - [ ] Savings rate % correct

### Sample test dataset:

**Accounts:**
```
ACC_TCB_001 | Techcombank | bank | 50000000
ACC_VCB_001 | VCB | bank | 12000000
ACC_MOMO_001 | MoMo | wallet | 800000
ACC_CASH_001 | Tiền mặt | cash | 2000000
ACC_UOB_001 | Uob | credit_card | -5000000
```

**Transactions:**
```
TXN_001 | 05/03/2026 | posted | income | ACC_TCB_001 | 25000000 | Lương
TXN_002 | 06/03/2026 | posted | expense | ACC_MOMO_001 | 150000 | Ăn uống
TXN_003 | 07/03/2026 | posted | transfer_out | ACC_TCB_001 | 5000000 | ACC_VCB_001
TXN_004 | 07/03/2026 | posted | transfer_in | ACC_VCB_001 | 5000000 | ACC_TCB_001
TXN_005 | 10/03/2026 | posted | debt | ACC_CASH_001 | 2000000 | Nam (lent)
TXN_006 | 20/03/2026 | posted | repayment | ACC_CASH_001 | 1000000 | Nam (lent)
TXN_007 | 31/03/2026 | posted | cashback | ACC_UOB_001 | 150000 | Hoàn tiền T3
```

**Expected results:**
```
Techcombank: 50M + 25M - 5M = 70M
VCB: 12M + 5M = 17M
MoMo: 800k - 150k = 650k
Tiền mặt: 2M - 2M + 1M = 1M
Uob: -5M + 150k = -4.85M

Net Worth: 70M + 17M + 650k + 1M - 4.85M = 83.8M
```

---

## 11) Troubleshooting常见问题

### Q: Công thức báo #VALUE!

**A:** Kiểm tra:
- Date format có đúng `dd/mm/yyyy` không?
- Amount columns có phải số không (không phải text)?
- Có khoảng trắng thừa trong criteria strings không?

### Q: SUMIFS trả về 0 mặc dù có data

**A:** Kiểm tra:
- Criteria range và sum range có cùng số rows không?
- Status có match exact string `"posted"` không (case-sensitive)?
- Account_id có khớp chính xác không (trim whitespace)?

### Q: Current_balance sai với tính toán tay

**A:** Debug steps:
1. Tách riêng từng component (income, expense, transfer) ra columns phụ
2. So sánh từng SUMIFS với filter manual trên Transactions tab
3. Kiểm tra có transaction `pending` hoặc `void` nào bị tính nhầm không
4. Verify transfer có đủ 2 dòng in/out không

### Q: Cashback cycle tag không match

**A:** Kiểm tra:
- Format tag có đúng `YYYY-MM` không?
- Statement cycle có đang dùng month kết thúc không?
- Có transaction nào thiếu `persisted_cycle_tag` không?

---

**Version:** 1.0  
**Created:** 2026-03-20  
**Follows:** docs/business/transactions.md
