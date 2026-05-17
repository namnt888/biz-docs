# Recurring Services - Google Sheets Formulas Playbook

## 1. Tab `RecurringServices` — Schema chuẩn

| Cột | Field | Data Type | Example | Notes |
|-----|-------|-----------|---------|-------|
| A | `id` | String | `rec_001` | UUID hoặc short ID |
| B | `name` | String | `Netflix` | Tên dịch vụ |
| C | `provider` | String | `Netflix Inc.` | Nhà cung cấp |
| D | `category_code` | String | `streaming` | Link business-category.md |
| E | `category_name` | String | `Streaming` | VLOOKUP từ Categories tab |
| F | `amount` | Number | `180,000` | VND, format `#,##0` |
| G | `currency` | String | `VND` | VND/USD/EUR |
| H | `billing_cycle` | String | `monthly` | monthly/yearly/weekly |
| I | `billing_day` | Number | `15` | 1-28 |
| J | `account_id` | String | `acc_001` | Account UUID |
| K | `account_name` | String | `VIB Super Card` | VLOOKUP từ Accounts tab |
| L | `is_auto_charge` | Boolean | `TRUE` | TRUE/FALSE |
| M | `last_charged_date` | Date | `15/04/2026` | dd/mm/yyyy |
| N | `next_due_date` | Date | `15/05/2026` | Formula tự tính |
| O | `is_active` | Boolean | `TRUE` | TRUE/FALSE |
| P | `reminder_days` | Number | `3` | Số ngày nhắc trước |
| Q | `days_until_due` | Number | `5` | Formula: còn bao nhiêu ngày |
| R | `status_display` | String | `Đang active` | Formula-based status |
| S | `notes` | Text | `Gói Standard` | Ghi chú |

---

## 2. Formula tính `next_due_date` (cột N)

**Công thức:**
```excel
=IF(OR(M2="", H2=""), "",
  IF(H2="monthly", EDATE(M2, 1),
    IF(H2="yearly", EDATE(M2, 12),
      IF(H2="weekly", M2+7,
        M2))))  // custom: giữ nguyên
```

**Giải thích:**
- Nếu `last_charged_date` (M2) rỗng → trả về rỗng
- `billing_cycle = monthly`: +1 tháng dùng EDATE
- `billing_cycle = yearly`: +12 tháng
- `billing_cycle = weekly`: +7 ngày
- `custom`: giữ nguyên (user tự nhập)

**Lưu ý:** 
- EDATE tự động handle tháng thiếu ngày (ví dụ 31/01 + 1 month = 28/02)
- Format cell: Date → dd/mm/yyyy

---

## 3. Formula tính `days_until_due` (cột Q)

**Công thức:**
```excel
=IF(N2="", "", DATEDIF(TODAY(), N2, "D"))
```

**Giải thích:**
- `DATEDIF(start_date, end_date, "D")`: tính số ngày giữa 2 date
- `TODAY()`: ngày hiện tại
- Kết quả dương: còn bao nhiêu ngày nữa
- Kết quả âm: đã quá hạn bao nhiêu ngày
- Nếu `next_due_date` rỗng → trả về rỗng

**Alternative (hiện số âm khi quá hạn):**
```excel
=IF(N2="", "", N2-TODAY())
```

---

## 4. Formula tính `status_display` (cột R)

**Công thức:**
```excel
=IF(O2=FALSE, "Đã hủy",
  IF(Q2<0, "Quá hạn",
    IF(Q2<=3, "Sắp đến hạn",
      "Đang active")))
```

**Giải thích logic:**
1. Nếu `is_active = FALSE` → "Đã hủy"
2. Nếu `days_until_due < 0` → "Quá hạn" (âm = đã qua ngày due)
3. Nếu `days_until_due <= 3` → "Sắp đến hạn" (còn 0-3 ngày)
4. Còn lại → "Đang active"

**Variant chi tiết hơn:**
```excel
=IF(O2=FALSE, "🚫 Đã hủy",
  IF(Q2<0, "🔴 Quá hạn "&ABS(Q2)&" ngày",
    IF(Q2=0, "⚠️ Đến hạn hôm nay",
      IF(Q2<=3, "🟡 Sắp đến hạn ("&Q2&" ngày)",
        "🟢 Đang active"))))
```

---

## 5. Conditional Formatting Rules

### Rule 1: Quá hạn (đỏ)

**Apply to range:** `A2:S100`

**Custom formula:**
```excel
=$R2="Quá hạn"
```

**Format:**
- Background: `#FF6B6B` (đỏ nhạt)
- Text: Bold

---

### Rule 2: Sắp đến hạn (vàng)

**Apply to range:** `A2:S100`

**Custom formula:**
```excel
=$R2="Sắp đến hạn"
```

**Format:**
- Background: `#FFD93D` (vàng)
- Text: Default

---

### Rule 3: Đang active (xanh lá)

**Apply to range:** `A2:S100`

**Custom formula:**
```excel
=$R2="Đang active"
```

**Format:**
- Background: `#6BCB77` (xanh lá nhạt)
- Text: Default

---

### Rule 4: Đã hủy (xám)

**Apply to range:** `A2:S100`

**Custom formula:**
```excel
=$R2="Đã hủy"
```

**Format:**
- Background: `#D3D3D3` (xám)
- Text: Strikethrough, màu xám đậm

---

### Rule 5: Highlight auto-charge services

**Apply to range:** `L2:L100`

**Custom formula:**
```excel
=$L2=TRUE
```

**Format:**
- Background: `#E3F2FD` (xanh dương rất nhạt)
- Border: Blue thin border

---

## 6. Monthly Recurring Summary (Dashboard)

### Total fixed expenses per month

**Formula:**
```excel
=SUMPRODUCT(
  --(RecurringServices!$O$2:$O$100=TRUE),
  --(RecurringServices!$H$2:$H$100="monthly"),
  RecurringServices!$F$2:$F$100
)
```

**Giải thích:**
- `--(condition)`: convert TRUE/FALSE thành 1/0
- Chỉ tính services có `is_active=TRUE` và `billing_cycle=monthly`
- Nhân với `amount` (cột F) để ra tổng tiền

**Named range suggestion:**
```
MonthlyFixedExpenses = SUMPRODUCT(...)
```

---

### Yearly recurring (prorated monthly)

**Formula:**
```excel
=SUMPRODUCT(
  --(RecurringServices!$O$2:$O$100=TRUE),
  --(RecurringServices!$H$2:$H$100="yearly"),
  RecurringServices!$F$2:$F$100
) / 12
```

**Giải thích:** Chia 12 để ra số tiền trung bình mỗi tháng.

---

### Total recurring (monthly equivalent)

**Formula:**
```excel
=MonthlyFixedExpenses + YearlyProrated
```

Hoặc gộp chung:
```excel
=SUMPRODUCT(
  --(RecurringServices!$O$2:$O$100=TRUE),
  --(RecurringServices!$H$2:$H$100="monthly"),
  RecurringServices!$F$2:$F$100
) + 
SUMPRODUCT(
  --(RecurringServices!$O$2:$O$100=TRUE),
  --(RecurringServices!$H$2:$H$100="yearly"),
  RecurringServices!$F$2:$F$100
) / 12
```

---

## 7. Fixed vs Variable Expense Ratio

### % chi phí cố định / tổng chi tiêu

**Formula:**
```excel
=IFERROR(
  MonthlyFixedExpenses / 
  SUMIFS(
    Transactions!$C:$C,  // amount column
    Transactions!$D:$D,  // type column, "expense"
    Transactions!$E:$E,  // status column, "completed"
    Transactions!$F:$F,  // date column, ">="&month_start
    Transactions!$F:$F,  // date column, "<="&month_end
  ),
  0
)
```

**Trong đó:**
- `month_start`: `=DATE(YEAR(TODAY()), MONTH(TODAY()), 1)`
- `month_end`: `=EOMONTH(TODAY(), 0)`

**Format:** Percentage với 1 decimal place (ví dụ: 45.2%)

---

### Budget warning message

**Formula:**
```excel
=IF(fixed_ratio > 0.5,
  "⚠️ Chi phí cố định chiếm "&TEXT(fixed_ratio,"0%")&" ngân sách tháng. Cân nhắc cắt giảm subscription.",
  IF(fixed_ratio > 0.3,
    "💡 Chi phí cố định ở mức "&TEXT(fixed_ratio,"0%")&" - khá cao.",
    "✅ Tỷ lệ chi phí cố định ổn định ("&TEXT(fixed_ratio,"0%")&")"))
```

---

## 8. Upcoming Charges (7 ngày tới)

### FILTER danh sách services sắp đến hạn

**Formula:**
```excel
=FILTER(
  RecurringServices!$B$2:$R$100,  // name → status_display columns
  (RecurringServices!$Q$2:$Q$100 >= 0) *
  (RecurringServices!$Q$2:$Q$100 <= 7) *
  (RecurringServices!$O$2:$O$100 = TRUE)
)
```

**Giải thích:**
- Filter rows có `days_until_due` từ 0-7
- Và `is_active = TRUE`
- Trả về columns B→R (name đến status_display)

**SORT theo days_until_due:**
```excel
=SORT(
  FILTER(...),
  16,  // column Q là column thứ 16 trong range B:R
  TRUE  // ascending (sắp đến trước)
)
```

---

### COUNT số lượng charges trong 7 ngày tới

**Formula:**
```excel
=COUNTIFS(
  RecurringServices!$Q:$Q, ">=0",
  RecurringServices!$Q:$Q, "<=7",
  RecurringServices!$O:$O, TRUE
)
```

---

### SUM tổng tiền charges trong 7 ngày tới

**Formula:**
```excel
=SUMIFS(
  RecurringServices!$F:$F,  // amount
  RecurringServices!$Q:$Q, ">=0",
  RecurringServices!$Q:$Q, "<=7",
  RecurringServices!$O:$O, TRUE
)
```

---

## 9. Cashback Optimization Hint

### Gợi ý thẻ tốt nhất cho từng category

**Formula (cột T - Cashback Hint):**
```excel
=IF($D2="life_insurance",
  "💡 Dùng VPBank Lady → cashback 7.5%-15% (max 100k-300k)",
  IF($D2="health_insurance",
    "💡 Dùng VPBank Lady → cashback 7.5%-15%",
    IF($D2="streaming",
      "💳 Kiểm tra thẻ có ưu đãi streaming miễn phí",
      IF($D2="online_shopping",
        "💡 Dùng VIB Super → 5% cashback Shopee/Lazada",
        IF($D2="dining_out",
          "💡 Dùng UOB ONE → 5% cashback ăn uống",
          "—")))))
```

**Giải thích:**
- Lookup category_code (cột D)
- Trả về hint cashback phù hợp
- Default: "—" (không có hint đặc biệt)

---

## 10. Per-Category Recurring Summary

### Pivot Table setup

**Rows:** `category_code` (cột D) hoặc `category_name` (cột E)

**Values:** 
- `SUM of amount` (cột F)
- `COUNT of name` (số lượng services)

**Filters:**
- `is_active = TRUE`
- `billing_cycle = monthly`

**Kết quả mẫu:**

| Category | Count | Total Amount |
|----------|-------|-------------|
| Streaming | 3 | 318,000 |
| Cloud Storage | 2 | 68,000 |
| Telecom | 2 | 400,000 |
| Fitness | 1 | 800,000 |
| Rent | 1 | 8,000,000 |
| **Total** | **9** | **9,586,000** |

---

### Formula không dùng Pivot Table

**SUMIFS per category:**
```excel
=SUMIFS(
  RecurringServices!$F:$F,  // amount
  RecurringServices!$D:$D, "streaming",  // category_code
  RecurringServices!$O:$O, TRUE,  // is_active
  RecurringServices!$H:$H, "monthly"  // billing_cycle
)
```

---

## 11. Recurring Service History (Tab mới)

### Tab `RecurringHistory` schema

Mục đích: Track lịch sử thay đổi của recurring services (amount change, pause, cancel...)

| Cột | Field | Mô tả |
|-----|-------|-------|
| A | `timestamp` | Thời điểm thay đổi |
| B | `service_id` | ID service |
| C | `service_name` | Tên service |
| D | `change_type` | amount_change / status_change / account_change / etc. |
| E | `old_value` | Giá trị cũ |
| F | `new_value` | Giá trị mới |
| G | `note` | Ghi chú |

---

## 12. Named Ranges Suggestions

| Name | Refers to | Purpose |
|------|-----------|---------|
| `RecurringServices_All` | `RecurringServices!$A$2:$S$100` | Toàn bộ data |
| `RecurringServices_Active` | `RecurringServices!$A$2:$S$100` (filtered is_active=TRUE) | Chỉ active services |
| `RecurringServices_Monthly` | `RecurringServices!$F$2:$F$100` (filtered monthly) | Amounts monthly |
| `RecurringServices_Yearly` | `RecurringServices!$F$2:$F$100` (filtered yearly) | Amounts yearly |
| `DaysUntilDue_Range` | `RecurringServices!$Q$2:$Q$100` | Days until due column |
| `StatusDisplay_Range` | `RecurringServices!$R$2:$R$100` | Status display column |
| `MonthlyFixedExpenses` | Formula result | Total monthly recurring |

**Cách tạo named range:**
1. Formulas → Name Manager → New
2. Nhập tên và công thức
3. Dùng trong formulas khác dễ đọc hơn

---

## 13. Dashboard Summary Tab

### Tab `Summary` - Key Metrics

| Cell | Label | Formula |
|------|-------|---------|
| B2 | **Total Active Services** | `=COUNTIFS(RecurringServices!$O:$O, TRUE)` |
| B3 | **Monthly Fixed Expenses** | `=MonthlyFixedExpenses` (named range) |
| B4 | **Yearly Expenses (prorated)** | `=SUMPRODUCT(--(RecurringServices!$O:$O=TRUE), --(RecurringServices!$H:$H="yearly"), RecurringServices!$F:$F)/12` |
| B5 | **Total Monthly Equivalent** | `=B3+B4` |
| B7 | **Upcoming (7 days)** | `=COUNTIFS(RecurringServices!$Q:$Q, ">=0", RecurringServices!$Q:$Q, "<=7", RecurringServices!$O:$O, TRUE)` |
| B8 | **Amount Due (7 days)** | `=SUMIFS(RecurringServices!$F:$F, RecurringServices!$Q:$Q, ">=0", RecurringServices!$Q:$Q, "<=7", RecurringServices!$O:$O, TRUE)` |
| B10 | **Overdue Count** | `=COUNTIFS(RecurringServices!$Q:$Q, "<0", RecurringServices!$O:$O, TRUE)` |
| B11 | **Overdue Amount** | `=SUMIFS(RecurringServices!$F:$F, RecurringServices!$Q:$Q, "<0", RecurringServices!$O:$O, TRUE)` |
| B13 | **Fixed/Total Ratio** | `=B3/SUMIFS(Transactions!$C:$C, Transactions!$D:$D, "expense", Transactions!$E:$E, "completed", Transactions!$F:$F, ">="&EOMONTH(TODAY(),-1)+1, Transactions!$F:$F, "<="&EOMONTH(TODAY(),0))` |

---

### Visualization suggestions

**Chart 1: Pie chart - Expenses by Category**
- Data: Pivot Table từ Section 10
- Labels: Category names
- Values: Total amounts

**Chart 2: Bar chart - Monthly trend**
- Data: Tổng recurring expenses các tháng trước
- X-axis: Months (Jan, Feb, Mar...)
- Y-axis: Amount (VND)

**Chart 3: Progress bar - Budget usage**
- Formula tạo progress bar text:
```excel
=REPT("▓", ROUND(fixed_ratio*10, 0)) & REPT("░", 10-ROUND(fixed_ratio*10, 0)) & " " & TEXT(fixed_ratio, "0%")
```

---

## 14. Troubleshooting Common Issues

### Issue 1: #VALUE! error trong next_due_date

**Nguyên nhân:** `last_charged_date` không phải valid date format.

**Fix:**
```excel
=IF(ISNUMBER(M2), EDATE(M2,1), "")
```

---

### Issue 2: SUMPRODUCT trả về 0

**Nguyên nhân:** Data types không match (text vs number).

**Fix:** Đảm bảo:
- `is_active` column là boolean (TRUE/FALSE), không phải text ("TRUE"/"FALSE")
- `amount` column là number, không phải text

Convert text to boolean:
```excel
=--($O2="TRUE")  // nếu data là text "TRUE"
```

---

### Issue 3: DATEDIF returns #NUM!

**Nguyên nhân:** Start date > end date.

**Fix:**
```excel
=IF(N2<TODAY(), -DATEDIF(N2, TODAY(), "D"), DATEDIF(TODAY(), N2, "D"))
```

---

### Issue 4: Conditional formatting không apply

**Nguyên nhân:** Range reference sai hoặc formula reference sai column.

**Fix:**
- Check Apply to range: `A2:S100` (không include header row)
- Custom formula dùng `$R2` (absolute column, relative row)
- Test formula riêng trong cell trước khi apply formatting

---

### Issue 5: FILTER returns #CALC! error

**Nguyên nhân:** Không có rows nào match condition.

**Fix:**
```excel
=IFERROR(
  FILTER(...),
  "Không có services nào sắp đến hạn"
)
```

---

## 15. Sample Data Ready-to-Test

Copy-paste vào tab `RecurringServices` (rows 2-10):

| id | name | provider | category_code | amount | currency | billing_cycle | billing_day | account_name | is_auto_charge | last_charged_date | is_active | reminder_days | notes |
|----|------|----------|---------------|--------|----------|---------------|-------------|--------------|----------------|-------------------|-----------|---------------|-------|
| rec_001 | Netflix | Netflix Inc. | streaming | 180000 | VND | monthly | 15 | VIB Super Card | TRUE | 15/04/2026 | TRUE | 3 | Gói Standard |
| rec_002 | Spotify | Spotify | streaming | 59000 | VND | monthly | 10 | VIB Super Card | TRUE | 10/04/2026 | TRUE | 3 | |
| rec_003 | iCloud 200GB | Apple | cloud_storage | 49000 | VND | monthly | 5 | Apple Card | TRUE | 05/04/2026 | TRUE | 3 | |
| rec_004 | Tiền điện | EVN | electricity | 800000 | VND | monthly | 15 | Techcombank | FALSE | 15/04/2026 | TRUE | 5 | Estimated |
| rec_005 | Internet Viettel | Viettel | telecom | 220000 | VND | monthly | 20 | Techcombank | TRUE | 20/04/2026 | TRUE | 3 | |
| rec_006 | Tiền nhà | Chủ nhà | rent | 8000000 | VND | monthly | 1 | Techcombank | FALSE | 01/04/2026 | TRUE | 5 | |
| rec_007 | California Fitness | California | fitness | 990000 | VND | monthly | 25 | VIB Super Card | FALSE | 25/04/2026 | TRUE | 5 | |
| rec_008 | BHNT Manulife | Manulife | life_insurance | 5000000 | VND | monthly | 10 | VPBank Lady | FALSE | 10/04/2026 | TRUE | 5 | Cashback 7.5-15% |
| rec_009 | YouTube Premium | Google | streaming | 79000 | VND | monthly | 8 | VIB Super Card | TRUE | 08/04/2026 | TRUE | 3 | |

**Formulas to add after paste:**
- Column N (next_due_date): Paste formula from Section 2
- Column Q (days_until_due): Paste formula from Section 3
- Column R (status_display): Paste formula from Section 4

---

## 16. Checklist kiểm tra sau khi dán formulas

- [ ] next_due_date tự tính đúng cho tất cả rows
- [ ] days_until_due hiển thị số ngày chính xác
- [ ] status_display show đúng trạng thái (active/sắp/quá hạn/hủy)
- [ ] Conditional formatting apply đúng màu
- [ ] MonthlyFixedExpenses formula trả về số đúng
- [ ] FILTER upcoming charges hoạt động
- [ ] Pivot Table group đúng categories
- [ ] Named ranges được tạo và reference đúng
- [ ] Dashboard summary numbers khớp với data
- [ ] Sample data test thành công
- [ ] Format VND `#,##0` áp dụng cho amount columns
- [ ] Format dd/mm/yyyy áp dụng cho date columns
- [ ] No #VALUE!, #REF!, #NUM! errors
- [ ] Conditional formatting rules không overlap conflict
- [ ] FILTER formulas có IFERROR handle empty result
- [ ] Named ranges scope là Workbook (không phải Sheet-specific)
- [ ] Charts visualize đúng data từ Pivot Table
- [ ] Progress bar formula render đúng ▓░ characters
- [ ] Cashback hint column hiển thị đúng recommendations
- [ ] Audit trail tab ghi nhận changes (nếu implement)

---

## Tóm tắt nhanh cho Agent

**Columns quan trọng nhất:**
- N: `next_due_date` (auto-calc)
- Q: `days_until_due` (countdown)
- R: `status_display` (visual status)

**Formulas must-have:**
1. next_due_date: `EDATE(last_charged, months)`
2. days_until_due: `DATEDIF(TODAY(), due_date, "D")`
3. status_display: Nested IF với is_active + days_until_due
4. Monthly total: `SUMPRODUCT(is_active, monthly, amount)`
5. Upcoming filter: `FILTER(days>=0, days<=7, is_active)`

**Conditional formatting:**
- Đỏ: Quá hạn
- Vàng: Sắp đến hạn (≤3 ngày)
- Xanh: Đang active
- Xám: Đã hủy

**Dashboard metrics:**
- Total active services
- Monthly fixed expenses
- Upcoming charges (count + amount)
- Overdue count
- Fixed/Total ratio

**Troubleshooting top 3:**
1. #VALUE! → Check date format
2. SUMPRODUCT=0 → Check boolean vs text
3. FILTER #CALC! → Add IFERROR

