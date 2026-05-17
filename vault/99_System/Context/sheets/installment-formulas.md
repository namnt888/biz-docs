# Installment - Google Sheets Formulas Playbook

## 1. Tab `InstallmentPlans` — Schema chuẩn

### Mapping cột A → Z

| Cột | Field | Type | Width | Format |
|-----|-------|------|-------|--------|
| A | id | UUID | 38 | Plain text |
| B | plan_name | String | 40 | Plain text |
| C | original_txn_id | UUID | 38 | Plain text |
| D | linked_debt_id | UUID | 38 | Plain text |
| E | account_id | UUID | 38 | Plain text |
| F | merchant_name | String | 30 | Plain text |
| G | category_code | String | 25 | Plain text |
| H | principal_amount | Integer | 15 | `#,##0` (VND) |
| I | total_installments | Integer | 10 | Number |
| J | installment_amount | Integer | 15 | `#,##0` (VND) |
| K | down_payment | Integer | 15 | `#,##0` (VND) |
| L | fee_amount | Integer | 15 | `#,##0` (VND) |
| M | interest_rate | Decimal | 10 | `0.00%` |
| N | start_date | Date | 12 | `dd/mm/yyyy` |
| O | first_due_date | Date | 12 | `dd/mm/yyyy` |
| P | next_due_date | Date | 12 | `dd/mm/yyyy` (Formula) |
| Q | end_date | Date | 12 | `dd/mm/yyyy` (Formula) |
| R | installments_paid | Integer | 10 | Number |
| S | installments_remaining | Integer | 10 | Number (Formula) |
| T | total_paid_amount | Integer | 15 | `#,##0` (Formula) |
| U | remaining_balance | Integer | 15 | `#,##0` (Formula) |
| V | payment_day | Integer | 10 | Number |
| W | is_auto_post | Boolean | 10 | Checkbox |
| X | status | Enum | 15 | Dropdown |
| Y | notes | Text | 50 | Wrap text |
| Z | updated_at | Timestamp | 20 | `dd/mm/yyyy hh:mm` |

**Dropdown values for column X (status):**
- active
- completed
- cancelled
- paused

---

## 2. Core Formulas

### 2.1. installments_remaining (Cột S)

```excel
=S2: =MAX(0, I2-R2)
```

**Giải thích:**
- `I2`: total_installments
- `R2`: installments_paid
- `MAX(0, ...)`: Đảm bảo không âm

**Copy xuống:** Drag từ S2 đến cuối bảng

---

### 2.2. total_paid_amount (Cột T)

```excel
=T2: =R2*J2
```

**Giải thích:**
- `R2`: installments_paid
- `J2`: installment_amount
- Tổng đã trả = số kỳ đã trả × số tiền mỗi kỳ

---

### 2.3. remaining_balance (Cột U)

```excel
=U2: =MAX(0, H2+L2-T2)
```

**Giải thích:**
- `H2`: principal_amount
- `L2`: fee_amount
- `T2`: total_paid_amount
- Số dư còn lại = gốc + phí - đã trả
- `MAX(0, ...)`: Handle overpayment case

---

### 2.4. next_due_date (Cột P)

```excel
=P2: =IF(R2>=I2, "", IF(R2=0, O2, EDATE(O2, R2)))
```

**Giải thích:**
- `R2>=I2`: Đã trả hết → để trống
- `R2=0`: Chưa trả kỳ nào → first_due_date
- `EDATE(O2, R2)`: Tính ngày đến hạn kế tiếp
  - `O2`: first_due_date
  - `R2`: Số kỳ đã trả → kỳ tiếp theo là R2+1

**Alternative formula (nếu có last_paid_date riêng):**
```excel
=IF(R2>=I2, "", IF(ISBLANK(last_paid_date), O2, EDATE(last_paid_date, 1)))
```

---

### 2.5. end_date (Cột Q)

```excel
=Q2: =EDATE(O2, I2-1)
```

**Giải thích:**
- `O2`: first_due_date
- `I2`: total_installments
- Ngày kết thúc = first_due_date + (total-1) tháng
- Trừ 1 vì first_due_date đã là kỳ 1

---

## 3. Conditional Formatting Rules

### Rule 1: Plan Completed → Xanh lá

**Range:** `A2:Z1000`

**Custom formula:**
```excel
=$X2="completed"
```

**Format:**
- Background: `#6BCB77` (xanh lá nhạt)
- Text: Bold

---

### Rule 2: Due in 3 days → Vàng cảnh báo

**Range:** `A2:Z1000`

**Custom formula:**
```excel
=AND($X2="active", $P2<>"", $P2-TODAY()<=3, $P2-TODAY()>=0)
```

**Format:**
- Background: `#FFD93D` (vàng)
- Text: Bold

---

### Rule 3: Overdue → Đỏ

**Range:** `A2:Z1000`

**Custom formula:**
```excel
=AND($X2="active", $P2<>"", $P2<TODAY())
```

**Format:**
- Background: `#FF6B6B` (đỏ nhạt)
- Text: Bold, màu trắng

---

### Rule 4: Cancelled → Xám

**Range:** `A2:Z1000`

**Custom formula:**
```excel
=$X2="cancelled"
```

**Format:**
- Background: `#D3D3D3` (xám)
- Text: Strikethrough, màu xám đậm

---

### Rule 5: Paused → Cam nhạt

**Range:** `A2:Z1000`

**Custom formula:**
```excel
=$X2="paused"
```

**Format:**
- Background: `#FFB347` (cam nhạt)

---

## 4. Dashboard Formulas (Tab Summary)

### 4.1. Total Active Installment Plans

```excel
=COUNTIFS(InstallmentPlans!X:X, "active")
```

**Kết quả:** Số plan đang active

---

### 4.2. Total Monthly Installment Expense (Tháng này)

```excel
=SUMPRODUCT(
  --(InstallmentPlans!X:X="active"),
  --(MONTH(InstallmentPlans!P:P)=MONTH(TODAY())),
  --(YEAR(InstallmentPlans!P:P)=YEAR(TODAY())),
  InstallmentPlans!J:J
)
```

**Giải thích:**
- Chỉ tính plans active
- Chỉ tính kỳ đến hạn trong tháng hiện tại
- `J:J`: installment_amount

**Alternative (đơn giản hơn nếu có tab InstallmentPayments):**
```excel
=SUMIFS(
  InstallmentPayments!F:F,  // amount column
  InstallmentPayments!G:G,  // status column
  "completed",
  InstallmentPayments!E:E,  // payment_date column
  ">="&EOMONTH(TODAY(),-1)+1,
  InstallmentPayments!E:E,
  "<="&EOMONTH(TODAY(),0)
)
```

---

### 4.3. Upcoming Payments (7 ngày tới)

```excel
=FILTER(
  InstallmentPlans!B2:U1000,  // plan_name đến remaining_balance
  (InstallmentPlans!X2:X1000="active")*
  (InstallmentPlans!P2:P1000<>"")*
  (InstallmentPlans!P2:P1000-TODAY()<=7)*
  (InstallmentPlans!P2:P1000-TODAY()>=0)
)
```

**Kết quả:** Danh sách các plan đến hạn trong 7 ngày tới

**Columns returned:**
- B: plan_name
- F: merchant_name
- J: installment_amount
- P: next_due_date
- S: installments_remaining
- U: remaining_balance

---

### 4.4. Total Remaining Balance (All Active Plans)

```excel
=SUMIFS(
  InstallmentPlans!U:U,  // remaining_balance
  InstallmentPlans!X:X,  // status
  "active"
)
```

**Kết quả:** Tổng số tiền còn phải trả góp

---

### 4.5. Installment by Category (Monthly Breakdown)

**Tạo Pivot Table:**

- **Rows:** category_code (Column G)
- **Columns:** Month (từ next_due_date Column P)
- **Values:** SUM of installment_amount (Column J)
- **Filter:** status = "active"

**Hoặc dùng formula:**

```excel
=SUMIFS(
  InstallmentPlans!J:J,
  InstallmentPlans!G:G, "electronics",  // Thay category cần tính
  InstallmentPlans!X:X, "active",
  InstallmentPlans!P:P, ">="&EOMONTH(TODAY(),-1)+1,
  InstallmentPlans!P:P, "<="&EOMONTH(TODAY(),0)
)
```

---

### 4.6. % Budget Used by Installments

```excel
=IFERROR(
  [Total Monthly Installment] / [Monthly Budget],
  0
)
```

**Ví dụ cụ thể:**
```excel
=IFERROR(
  SUMPRODUCT(
    --(InstallmentPlans!X:X="active"),
    --(MONTH(InstallmentPlans!P:P)=MONTH(TODAY())),
    InstallmentPlans!J:J
  ) / Budgets!C2,  // Giả sử C2 là monthly_budget
  0
)
```

**Format:** Percentage `0%`

**Conditional formatting:**
- > 30%: Vàng cảnh báo
- > 50%: Đỏ

---

## 5. Debt-Linked Installment Formulas

### 5.1. Total Paid per Debt

```excel
=SUMIFS(
  InstallmentPlans!T:T,  // total_paid_amount
  InstallmentPlans!D:D,  // linked_debt_id
  A2  // debt_id cần tính
)
```

**Đặt trong tab Debts** để track tổng đã trả cho mỗi debt

---

### 5.2. Remaining per Debt via Installment

```excel
=SUMIFS(
  InstallmentPlans!U:U,  // remaining_balance
  InstallmentPlans!D:D,  // linked_debt_id
  A2  // debt_id cần tính
)
```

---

### 5.3. Count Active Installment Plans per Debt

```excel
=COUNTIFS(
  InstallmentPlans!D:D,  // linked_debt_id
  A2,
  InstallmentPlans!X:X,  // status
  "active"
)
```

---

## 6. Cashback Eligibility Notes

### Formula kiểm tra cashback impact

Trong tab InstallmentPlans, thêm column AA:

```excel
=AA2: =IF(
  OR(
    InstallmentPlans!G2="debt_repayment",
    InstallmentPlans!G2="internal_transfer"
  ),
  "Không áp dụng cashback",
  "Kiểm tra policy thẻ " & InstallmentPlans!E2
)
```

**Giải thích:**
- Nếu category là debt_repayment hoặc internal_transfer → không cashback
- Ngược lại → nhắc check cashback policy của account

### Formula gợi ý thẻ tốt nhất

```excel
=IF(
  InstallmentPlans!G2="life_insurance",
  "💡 Dùng VPBank Lady → 7.5%-15% max 300k",
  IF(
    InstallmentPlans!G2="electronics",
    "💡 Dùng VIB Super → 5% online shopping",
    IF(
      InstallmentPlans!G2="online_shopping",
      "💡 Dùng VIB Super → 5%",
      "—"
    )
  )
)
```

---

## 7. Named Ranges Suggestions

| Name | Range | Description |
|------|-------|-------------|
| `InstPlan_Status` | `InstallmentPlans!X:X` | Status column |
| `InstPlan_NextDue` | `InstallmentPlans!P:P` | Next due date |
| `InstPlan_Amount` | `InstallmentPlans!J:J` | Installment amount |
| `InstPlan_Remaining` | `InstallmentPlans!U:U` | Remaining balance |
| `InstPlan_Active` | `InstallmentPlans!X2:X1000` | Active plans only |
| `InstPlan_Category` | `InstallmentPlans!G:G` | Category codes |

**Cách tạo Named Range:**
1. Chọn range
2. Formulas → Define Name
3. Nhập tên và OK

**Sử dụng trong formula:**
```excel
=SUMIFS(InstPlan_Remaining, InstPlan_Status, "active")
```

---

## 8. Tab `InstallmentPayments` — Schema

### Mapping columns

| Cột | Field | Type | Format |
|-----|-------|------|--------|
| A | payment_id | UUID | Plain text |
| B | plan_id | UUID | Plain text |
| C | transaction_id | UUID | Plain text |
| D | installment_number | Integer | Number |
| E | payment_date | Date | `dd/mm/yyyy` |
| F | amount | Integer | `#,##0` (VND) |
| G | status | Enum | Dropdown |
| H | notes | Text | Wrap text |

**Dropdown values for column G (status):**
- pending
- completed
- failed

---

### Formula linking với InstallmentPlans

**Trong InstallmentPlans, column AB (Payment History):**

```excel
=AB2: =TEXTJOIN(
  ", ",
  TRUE,
  FILTER(
    InstallmentPayments!D:D & "/" & InstallmentPlans!I2,
    InstallmentPayments!B:B=A2,
    InstallmentPayments!G:G="completed"
  )
)
```

**Kết quả:** "1/10, 2/10, 3/10" (các kỳ đã hoàn thành)

---

## 9. Troubleshooting Common Issues

### Issue 1: #VALUE! trong EDATE

**Nguyên nhân:** Date format không đúng

**Fix:**
```excel
=EDATE(DATEVALUE(TEXT(O2,"dd/mm/yyyy")), R2)
```

---

### Issue 2: next_due_date không update

**Nguyên nhân:** installments_paid (R) chưa được update manual

**Fix:** Tạo script auto-update hoặc reminder

---

### Issue 3: Conditional formatting không hoạt động

**Nguyên nhân:** Range không khớp hoặc formula sai reference

**Fix:**
- Check range: Phải bắt đầu từ row 2 (`A2:Z1000`)
- Check formula: Dùng `$X2` thay vì `X2` để lock column

---

### Issue 4: SUMIFS returns 0

**Nguyên nhân:** 
- Criteria không match (text vs number)
- Date format issue

**Fix:**
```excel
=SUMIFS(
  InstallmentPlans!J:J,
  InstallmentPlans!X:X, "active",
  InstallmentPlans!P:P, ">="&DATE(2026,4,1),
  InstallmentPlans!P:P, "<="&DATE(2026,4,30)
)
```

---

### Issue 5: FILTER returns #N/A

**Nguyên nhân:** Không có data match criteria

**Fix:**
```excel
=IFERROR(
  FILTER(...),
  "Không có dữ liệu"
)
```

---

## 10. Sample Data (Ready-to-Test)

### Row 2: iPhone Installment

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| plan_001 | iPhone 15 Pro - TGDD | txn_001 | | acc_vib_super | TGDD | electronics | 20000000 | 10 | 2000000 |

| K | L | M | N | O | P | Q | R | S | T | U |
|---|---|---|---|---|---|---|---|---|---|---|
| 4000000 | 0 | 0% | 01/04/2026 | 15/05/2026 | *=formula* | *=formula* | 0 | *=formula* | *=formula* | *=formula* |

| V | W | X | Y |
|---|---|---|---|
| 15 | TRUE | active | Trả góp 0% lãi suất |

**Expected results after formulas:**
- P2 (next_due_date): 15/05/2026
- Q2 (end_date): 15/02/2027
- S2 (installments_remaining): 10
- T2 (total_paid_amount): 0
- U2 (remaining_balance): 20,000,000

---

### Row 3: Debt Repayment to Lâm

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| plan_002 | Trả nợ Lâm | | debt_001 | acc_tcb | Lâm | debt_repayment | 12000000 | 6 | 2000000 |

| K | L | M | N | O | P | Q | R | S | T | U |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 0 | 0% | 01/04/2026 | 10/05/2026 | 10/05/2026 | 10/10/2026 | 0 | 6 | 0 | 12000000 |

| V | W | X | Y |
|---|---|---|---|
| 10 | FALSE | active | Manual payment mỗi tháng |

---

## 11. Checklist Kiểm Tra Sau Khi Dán Formulas

- [ ] Column S (installments_remaining) hiển thị đúng
- [ ] Column T (total_paid_amount) = R × J
- [ ] Column U (remaining_balance) = H + L - T
- [ ] Column P (next_due_date) tự update khi R thay đổi
- [ ] Column Q (end_date) = EDATE(O, I-1)
- [ ] Conditional formatting hoạt động cho tất cả status
- [ ] FILTER upcoming payments trả về đúng danh sách
- [ ] SUMIFS monthly expense tính đúng tháng hiện tại
- [ ] Named ranges được tạo và hoạt động
- [ ] Sample data test cases chạy đúng expected results
- [ ] No #VALUE!, #N/A, #REF! errors
- [ ] VND format `#,##0` applied cho columns H, J, K, L, T, U
- [ ] Date format `dd/mm/yyyy` applied cho N, O, P, Q, E (Payments tab)
- [ ] Dropdown status hoạt động (active/completed/cancelled/paused)
- [ ] Checkbox is_auto_post hoạt động
- [ ] TEXTJOIN payment history hiển thị đúng
- [ ] Pivot table category breakdown hoạt động
- [ ] Dashboard formulas link đúng cells
- [ ] Print area setup cho easy sharing
- [ ] Protected ranges cho formula columns (S, T, U, P, Q)

---

## 12. Tips & Best Practices

### Tip 1: Auto-hide completed plans

**Filter view:**
```
Status ≠ completed
OR
Next due date IS NOT BLANK
```

### Tip 2: Color-code categories

Thêm conditional formatting dựa vào category_code:
- electronics: Xanh dương
- insurance: Tím
- debt_repayment: Cam
- shopping: Hồng

### Tip 3: Progress bar visualization

Thêm column AC:

```excel
=AC2: =REPT("▓", ROUND((R2/I2)*10)) & REPT("░", 10-ROUND((R2/I2)*10)) & " " & TEXT(R2/I2,"0%")
```

**Kết quả:** "▓▓▓░░░░░░░ 30%"

### Tip 4: Quick summary với Sparkline

Trong dashboard:

```excel
=SPARKLINE(
  FILTER(InstallmentPlans!J:J, InstallmentPlans!P:P>=TODAY()),
  {"charttype","column"; "color","#4285F4"}
)
```

### Tip 5: Reminder automation hint

Thêm column AD cho n8n webhook:

```excel
=AD2: =IF(
  AND($X2="active", $P2-TODAY()=3),
  "SEND_REMINDER",
  ""
)
```

n8n poll column này mỗi ngày để gửi reminder.
