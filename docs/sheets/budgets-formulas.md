# Budgets — Google Sheets Formulas Playbook

## 1. Tab `Budgets` — Suggested Schema

| Column | Field Name | Data Type | Format | Notes |
|--------|-----------|-----------|--------|-------|
| A | id | TEXT | UUID | Hidden column |
| B | name | TEXT | Plain text | Tên budget |
| C | category_id | TEXT | UUID | Link tới Categories!A |
| D | category_name | TEXT | Plain text | Formula từ VLOOKUP |
| E | owner_id | TEXT | UUID | Link tới People!A |
| F | owner_name | TEXT | Plain text | Formula từ VLOOKUP |
| G | amount | NUMBER | `#,##0` | Ngân sách gốc (VND) |
| H | spent_amount | NUMBER | `#,##0` | Formula từ SUMIFS |
| I | start_date | DATE | `dd/mm/yyyy` | Ngày bắt đầu |
| J | end_date | DATE | `dd/mm/yyyy` | Ngày kết thúc |
| K | remaining_amount | NUMBER | `#,##0` | Formula MAX(0, G-H) |
| L | utilization_percent | NUMBER | `0.0%` | Formula H/G |
| M | status | TEXT | Plain text | Formula nested IF |
| N | alert_threshold_percent | NUMBER | `0%` | Ngưỡng cảnh báo |
| O | is_alert_triggered | TEXT | Plain text | Formula alert check |
| P | is_rollover | BOOLEAN | TRUE/FALSE | Có cộng dồn không |
| Q | rollover_to_budget_id | TEXT | UUID | Link budget kỳ sau |
| R | notes | TEXT | Plain text | Ghi chú |
| S | created_at | DATETIME | `dd/mm/yyyy hh:mm` | Thời gian tạo |
| T | updated_at | DATETIME | `dd/mm/yyyy hh:mm` | Cập nhật gần nhất |

---

## 2. Core Formulas

### 2.1. Category Name Lookup (Column D)

```excel
=IFERROR(VLOOKUP(C2, Categories!$A:$B, 2, FALSE), "Unknown Category")
```

**Giải thích:**
- `C2`: category_id của budget hiện tại
- `Categories!$A:$B`: Range chứa id (cột A) và name (cột B) trong tab Categories
- `2`: Lấy cột thứ 2 (name)
- `FALSE`: Exact match
- `IFERROR`: Nếu không tìm thấy → "Unknown Category"

---

### 2.2. Owner Name Lookup (Column F)

```excel
=IFERROR(VLOOKUP(E2, People!$A:$B, 2, FALSE), "Unknown Owner")
```

**Giải thích:** Tương tự như category lookup nhưng link với People tab.

---

### 2.3. Spent Amount Calculation (Column H) — CRITICAL FORMULA

```excel
=SUMIFS(
  Transactions!$C:$C,                    // amount column
  Transactions!$D:$D, $C2,               // category_id match
  Transactions!$E:$E, $E2,               // owner_id match
  Transactions!$F:$F, ">="&$I2,          // occurred_at >= start_date
  Transactions!$F:$F, "<="&$J2,          // occurred_at <= end_date
  Transactions!$G:$G, "expense",         // type = expense
  Transactions!$H:$H, "<>void"           // status <> void
)
```

**Chi tiết parameters:**
- `Transactions!$C:$C`: Cột chứa transaction amounts
- `Transactions!$D:$D`: Cột chứa category_id
- `Transactions!$E:$E`: Cột chứa owner_id
- `Transactions!$F:$F`: Cột chứa occurred_at (transaction date)
- `Transactions!$G:$G`: Cột chứa transaction type
- `Transactions!$H:$H`: Cột chứa transaction status

**Lưu ý quan trọng:**
- Công thức này chỉ tính expenses (không include debt, service, transfer)
- Loại bỏ transactions có status = 'void'
- Dùng absolute references (`$`) để copy formula xuống các dòng mà không bị lỗi
- Nếu muốn include debt/service types, thêm OR condition:
  ```excel
  =SUMIFS(Transactions!$C:$C, ..., Transactions!$G:$G, "expense") 
   + SUMIFS(Transactions!$C:$C, ..., Transactions!$G:$G, "debt")
   + SUMIFS(Transactions!$C:$C, ..., Transactions!$G:$G, "service")
  ```

**Alternative cho multiple types (Google Sheets only):**
```excel
=SUM(FILTER(
  Transactions!$C:$C,
  Transactions!$D:$D = $C2,
  Transactions!$E:$E = $E2,
  Transactions!$F:$F >= $I2,
  Transactions!$F:$F <= $J2,
  MATCH(Transactions!$G:$G, {"expense","debt","service"}, 0),
  Transactions!$H:$H <> "void"
))
```

---

### 2.4. Remaining Amount (Column K)

```excel
=MAX(0, G2 - H2)
```

**Giải thích:**
- `G2`: amount (ngân sách gốc)
- `H2`: spent_amount (đã chi)
- `MAX(0, ...)`: Đảm bảo không âm, nếu exceeded thì hiển thị 0

---

### 2.5. Utilization Percent (Column L)

```excel
=IF(G2 > 0, H2 / G2, 0)
```

**Giải thích:**
- Check `G2 > 0` để tránh chia cho 0
- Format cell as Percentage với 1 decimal place (ví dụ: 75.5%)

---

### 2.6. Status Calculation (Column M)

```excel
=IF(
  TODAY() > J2,
  IF(H2 <= G2, "completed", "exceeded"),
  IF(H2 > G2, "exceeded", "active")
)
```

**Logic breakdown:**
1. Check `TODAY() > J2` (đã hết chu kỳ chưa?)
   - YES → Check spent vs amount:
     - `H2 <= G2` → "completed"
     - `H2 > G2` → "exceeded"
   - NO (vẫn trong chu kỳ) → Check spent vs amount:
     - `H2 > G2` → "exceeded"
     - Otherwise → "active"

**Kết quả possible:** `active`, `completed`, `exceeded`

---

### 2.7. Alert Triggered (Column O)

```excel
=IF(L2 >= N2/100, "⚠️ ALERT", "")
```

**Giải thích:**
- `L2`: utilization_percent (ví dụ: 0.85 = 85%)
- `N2`: alert_threshold_percent (ví dụ: 80)
- `N2/100`: Convert từ percentage number sang decimal (80 → 0.80)
- Nếu utilization >= threshold → Hiển thị "⚠️ ALERT"
- Ngược lại → Empty string

---

## 3. Dashboard Summary Formulas (Tab `Summary`)

### 3.1. Total Budget This Month

```excel
=SUMIFS(
  Budgets!G:G,                              // amount column
  Budgets!I:I, "<=" & TODAY(),              // start_date <= today
  Budgets!J:J, ">=" & TODAY(),              // end_date >= today
  Budgets!M:M, "active"                     // status = active
)
```

**Format:** `#,##0` VND

---

### 3.2. Total Spent This Month

```excel
=SUMIFS(
  Budgets!H:H,                              // spent_amount column
  Budgets!I:I, "<=" & TODAY(),
  Budgets!J:J, ">=" & TODAY(),
  Budgets!M:M, "active"
)
```

---

### 3.3. Total Remaining This Month

```excel
=SUMIFS(
  Budgets!K:K,                              // remaining_amount column
  Budgets!I:I, "<=" & TODAY(),
  Budgets!J:J, ">=" & TODAY(),
  Budgets!M:M, "active"
)
```

---

### 3.4. Average Utilization Rate

```excel
=AVERAGEIFS(
  Budgets!L:L,                              // utilization_percent column
  Budgets!I:I, "<=" & TODAY(),
  Budgets!J:J, ">=" & TODAY(),
  Budgets!M:M, "active"
)
```

**Format:** Percentage với 1 decimal (ví dụ: 67.3%)

**Interpretation:**
- < 30%: Budget quá cao, chưa tận dụng
- 30-70%: Healthy range
- 70-90%: Cần chú ý
- > 90%: Nguy cơ vượt budget

---

### 3.5. Count of Exceeded Budgets

```excel
=COUNTIFS(
  Budgets!M:M, "exceeded",
  Budgets!I:I, "<=" & TODAY(),
  Budgets!J:J, ">=" & TODAY()
)
```

---

### 3.6. List of Exceeded Categories

```excel
=FILTER(
  Budgets!D:D,                              // category_name column
  Budgets!M:M = "exceeded",
  Budgets!I:I <= TODAY(),
  Budgets!J:J >= TODAY()
)
```

**Result:** Array trả về danh sách các category đang vượt budget trong tháng hiện tại.

---

### 3.7. Top 5 Highest Utilization Budgets

```excel
=SORT(
  FILTER(
    {Budgets!B:B, Budgets!D:D, Budgets!G:G, Budgets!H:H, Budgets!L:L},
    Budgets!M:M = "active",
    Budgets!I:I <= TODAY(),
    Budgets!J:J >= TODAY()
  ),
  5,                                        // Sort by column 5 (utilization_percent)
  FALSE                                     // Descending order
)
```

**Result:** 5 budgets có utilization cao nhất, hiển thị: name, category, amount, spent, utilization%.

---

## 4. Rollover Calculation Helper

### 4.1. Next Period Budget Amount (với rollover)

Giả sử bạn muốn tính effective amount cho budget kỳ sau:

```excel
=G2 + IF(P2=TRUE, 
  SUMIFS(
    Budgets!K:K,                            // remaining_amount from previous period
    Budgets!C:C, C2,                        // Same category
    Budgets!E:E, E2,                        // Same owner
    Budgets!J:J, "=" & (I2 - 1),            // Previous period end_date = current start_date - 1 day
    Budgets!M:M, "completed"                // Only rollover if completed (not exceeded)
  ),
  0
)
```

**Giải thích:**
- `G2`: Base amount của kỳ này
- `IF(P2=TRUE, ...)`: Chỉ cộng rollover nếu `is_rollover = TRUE`
- `SUMIFS(...)`: Tìm remaining_amount từ kỳ trước
- `Budgets!J:J, "=" & (I2 - 1)`: Match previous period end_date
- `Budgets!M:M, "completed"`: Chỉ rollover nếu status = completed

---

## 5. Progress Bar Visualization (Text-based)

### 5.1. Simple Progress Bar

Thêm column mới (ví dụ column U) với formula:

```excel
=REPT("▓", ROUND(L2 * 10, 0)) & REPT("░", 10 - ROUND(L2 * 10, 0)) & " " & TEXT(L2, "0%")
```

**Example output:**
- 0%: `░░░░░░░░░░ 0%`
- 45%: `▓▓▓▓░░░░░░ 45%`
- 100%: `▓▓▓▓▓▓▓▓▓▓ 100%`
- 120%: `▓▓▓▓▓▓▓▓▓▓ 120%` (max at 10 bars)

**Customization:**
- Thay đổi `10` thành số bar mong muốn (ví dụ: 20 bars chi tiết hơn)
- Thay đổi ký tự `▓` và `░` thành emoji hoặc ký tự khác

---

### 5.2. Color-coded Progress (Conditional Formatting)

Áp dụng conditional formatting cho column U (progress bar):

**Rule 1: Green (0-50%)**
```
Formula: =$L2 <= 0.5
Color: Light green background (#d4edda)
```

**Rule 2: Yellow (50-80%)**
```
Formula: =AND($L2 > 0.5, $L2 <= 0.8)
Color: Light yellow background (#fff3cd)
```

**Rule 3: Orange (80-100%)**
```
Formula: =AND($L2 > 0.8, $L2 <= 1.0)
Color: Light orange background (#ffe5cc)
```

**Rule 4: Red (>100%)**
```
Formula: =$L2 > 1.0
Color: Light red background (#f8d7da)
```

---

## 6. Named Ranges Suggestions

Đặt tên cho các ranges để formulas dễ đọc và maintain:

| Named Range | Refers To | Purpose |
|-------------|-----------|---------|
| `Budget_Amount` | `Budgets!$G:$G` | Reference ngân sách gốc |
| `Budget_Spent` | `Budgets!$H:$H` | Reference số tiền đã chi |
| `Budget_CategoryID` | `Budgets!$C:$C` | Reference category_id |
| `Budget_OwnerID` | `Budgets!$E:$E` | Reference owner_id |
| `Budget_StartDate` | `Budgets!$I:$I` | Reference start_date |
| `Budget_EndDate` | `Budgets!$J:$J` | Reference end_date |
| `Budget_Status` | `Budgets!$M:$M` | Reference status |
| `Txn_Amount` | `Transactions!$C:$C` | Reference transaction amounts |
| `Txn_CategoryID` | `Transactions!$D:$D` | Reference transaction category_id |
| `Txn_OwnerID` | `Transactions!$E:$E` | Reference transaction owner_id |
| `Txn_Date` | `Transactions!$F:$F` | Reference transaction dates |
| `Txn_Type` | `Transactions!$G:$G` | Reference transaction type |
| `Txn_Status` | `Transactions!$H:$H` | Reference transaction status |

**Sử dụng named ranges trong formulas:**

Thay vì:
```excel
=SUMIFS(Transactions!$C:$C, Transactions!$D:$D, $C2, ...)
```

Dùng named ranges:
```excel
=SUMIFS(Txn_Amount, Txn_CategoryID, $C2, Txn_OwnerID, $E2, Txn_Date, ">="&$I2, Txn_Date, "<="&$J2, Txn_Type, "expense", Txn_Status, "<>void")
```

**Cách tạo named range:**
1. Chọn column/range muốn đặt tên
2. Vào menu **Data** → **Named ranges**
3. Nhập tên (không dấu cách, dùng underscore)
4. Click **Done**

---

## 7. Conditional Formatting Rules

### 7.1. Status-based Row Coloring

Select toàn bộ rows trong Budgets tab (ví dụ: A2:T100), áp dụng các rules sau:

**Active (Green)**
```
Formula: =$M2 = "active"
Color: Light green (#d4edda)
```

**Completed (Blue)**
```
Formula: =$M2 = "completed"
Color: Light blue (#d1ecf1)
```

**Exceeded (Red)**
```
Formula: =$M2 = "exceeded"
Color: Light red (#f8d7da)
```

**Alert Triggered (Bold Red Text)**
```
Formula: =NOT(ISBLANK($O2))
Format: Bold, Red text color (#dc3545)
```

---

### 7.2. Utilization Heatmap (Column L)

Select column L (utilization_percent), áp dụng color scale:

**3-color scale:**
- Min (0%): Green (#28a745)
- Midpoint (75%): Yellow (#ffc107)
- Max (100%+): Red (#dc3545)

**Cách设置:**
1. Select column L
2. **Format** → **Conditional formatting**
3. Tab **Color scale**
4. Chọn 3-color scale
5. Customize min/mid/max colors và values

---

### 7.3. Overdue Budgets Highlight

```
Formula: =AND($M2 = "active", TODAY() > $J2)
Color: Orange background (#ffeeba)
```

**Purpose:** Highlight budgets đáng lẽ phải closed nhưng vẫn active (data inconsistency).

---

## 8. Troubleshooting Common Issues

### Issue 1: SUMIFS returns 0 khi chắc chắn có transactions

**Possible causes:**
- Date format mismatch (text vs date)
- category_id/owner_id không match exact (extra spaces, case sensitivity)
- Transaction type không phải "expense"

**Debug steps:**
```excel
// Check nếu category_id match
=COUNTIF(Transactions!$D:$D, $C2)

// Check nếu có transactions trong date range
=COUNTIFS(Transactions!$F:$F, ">="&$I2, Transactions!$F:$F, "<="&$J2)

// Check transaction types
=UNIQUE(FILTER(Transactions!$G:$G, Transactions!$D:$D=$C2))
```

---

### Issue 2: #VALUE! error trong VLOOKUP

**Cause:**数据类型不匹配 (lookup value là text, nhưng column là number hoặc ngược lại)

**Fix:**
```excel
=IFERROR(VLOOKUP(TEXT(C2, "0"), Categories!$A:$B, 2, FALSE), "Not found")
```

Hoặc đảm bảo cả 2 columns cùng data type.

---

### Issue 3: Circular dependency warning

**Cause:** Formula reference chính column nó đang tính

**Example sai:**
```excel
// Trong column H (spent_amount), reference đến H2
=SUMIFS(..., Budgets!H:H, ...)  // ❌ Wrong!
```

**Fix:** Không bao giờ reference column hiện tại trong formula của chính nó.

---

### Issue 4: Formula chậm khi dataset lớn

**Optimization tips:**
1. Thay vì reference toàn bộ column (`A:A`), dùng range cụ thể (`A2:A1000`)
2. Dùng helper columns thay vì nested formulas phức tạp
3. Avoid volatile functions (TODAY, NOW) trong nhiều cells
4. Consider using Google Apps Script cho calculations phức tạp

---

## 9. Sample Data Ready-to-Test

Copy paste vào tab `Budgets` để test formulas:

| id | name | category_id | category_name | owner_id | owner_name | amount | spent_amount | start_date | end_date | remaining_amount | utilization_percent | status | alert_threshold_percent | is_alert_triggered | is_rollover |
|----|------|-------------|---------------|----------|------------|--------|--------------|------------|----------|------------------|---------------------|--------|------------------------|--------------------|-------------|
| bud_001 | Ăn uống T3/2026 | cat_food | Ăn uống | per_nam | Nam | 5000000 | [formula] | 01/03/2026 | 31/03/2026 | [formula] | [formula] | [formula] | 80 | [formula] | FALSE |
| bud_002 | Mua sắm T3/2026 | cat_shop | Mua sắm | per_linh | Linh | 3000000 | [formula] | 01/03/2026 | 31/03/2026 | [formula] | [formula] | [formula] | 75 | [formula] | TRUE |
| bud_003 | Đi lại T3/2026 | cat_transport | Đi lại | per_nam | Nam | 2000000 | [formula] | 01/03/2026 | 31/03/2026 | [formula] | [formula] | [formula] | 85 | [formula] | FALSE |

Sau đó paste formulas tương ứng vào các columns và verify results.

---

## 10. Checklist Kiểm Tra Sau Khi Dán Formulas

- [ ] Column D (category_name) hiển thị đúng tên category
- [ ] Column F (owner_name) hiển thị đúng tên owner
- [ ] Column H (spent_amount) ≠ 0 nếu có transactions trong kỳ
- [ ] Column K (remaining_amount) = 0 khi exceeded
- [ ] Column L (utilization_percent) format percentage đúng
- [ ] Column M (status) trả về active/completed/exceeded
- [ ] Column O (alert) hiển thị ⚠️ khi vượt threshold
- [ ] Conditional formatting hoạt động (màu sắc theo status)
- [ ] Dashboard formulas (tab Summary) cho ra kết quả đúng
- [ ] Không có #VALUE!, #REF!, #DIV/0! errors
- [ ] Copy formula xuống 10+ rows vẫn hoạt động đúng
- [ ] Named ranges được tạo và reference đúng

---

## 11. Tips & Best Practices

### 11.1. Data Validation cho Input Columns

**Column N (alert_threshold_percent):**
```
Data → Data validation
Criteria: Number between 0 and 100
Reject input: Show warning
```

**Column P (is_rollover):**
```
Data → Data validation
Criteria: Checkbox
```

**Column M (status):**
```
Data → Data validation
Criteria: List of items: active,completed,exceeded,archived
```

---

### 11.2. Protect Formula Columns

Để tránh user accidentally overwrite formulas:

1. Select columns có formulas (H, K, L, M, O)
2. Right-click → **View more cell actions** → **Protect range**
3. Set permissions: Only you (owner) can edit
4. Add warning message: "This column contains auto-calculated formulas. Do not edit manually."

---

### 11.3. Version Control cho Sheet

```
File → Version history → See version history
Name current version: "Budget formulas v1.0 - 2026-03-XX"
```

Mỗi khi update formulas quan trọng, tạo version snapshot để rollback nếu cần.

---

## 12. Tài Liệu Tham Khảo

- `docs/business/budgets.md`: Business spec chi tiết
- `docs/sheets/transactions-formulas.md`: Cách filter transactions
- `docs/sheets/cashback-formulas.md`: Similar cycle-based calculations
- Google Sheets documentation: SUMIFS, VLOOKUP, FILTER, SORT functions

