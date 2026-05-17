# Google Sheets Formulas - Category Management

## 1. Tab `Categories` — Schema chuẩn

### Mapping cột A → M

| Column | Field | Example | Formula/Notes |
|--------|-------|---------|---------------|
| A | `id` | `cat_001` | Primary key |
| B | `code` | `dining_out` | Unique code |
| C | `name_vi` | `Ăn ngoài` | Hiển thị chính |
| D | `name_en` | `Dining out` | Optional |
| E | `parent_code` | `food_drink` | Empty nếu Level 1 |
| F | `level` | `2` | 1 hoặc 2 |
| G | `group` | `expense` | expense/income/transfer |
| H | `icon` | `restaurant` | Material icon |
| I | `color` | `#FF6B6B` | Hex color |
| J | `affects_cashback` | `TRUE` | TRUE/FALSE |
| K | `is_system` | `TRUE` | System categories |
| L | `is_active` | `TRUE` | Active/Inactive |
| M | `sort_order` | `10` | Display order |

---

## 2. Category Lookup trong Transactions Tab

### 2.1 VLOOKUP category name từ code

**Mục đích**: Hiển thị tên tiếng Việt thay vì code trong Transactions tab

```excel
// Trong Transactions!C2 (category_name column)
=IFERROR(VLOOKUP(B2, Categories!B:C, 2, FALSE), "Không xác định")
```

**Giải thích**:
- `B2`: Chứa `category_code` (ví dụ: `dining_out`)
- `Categories!B:C`: Range lookup (code → name_vi)
- `2`: Trả về cột thứ 2 (name_vi)
- `FALSE`: Exact match
- `IFERROR`: Fallback về "Không xác định" nếu không tìm thấy

### 2.2 Hiển thị full path (Level 1 > Level 2)

```excel
// Trong Transactions!D2 (category_full_path)
=IFERROR(
  LET(
    code, B2,
    level, VLOOKUP(code, Categories!B:F, 5, FALSE),
    name_vi, VLOOKUP(code, Categories!B:C, 2, FALSE),
    parent_code, VLOOKUP(code, Categories!B:E, 4, FALSE),
    
    IF(level = 1,
      name_vi,  // Level 1: chỉ hiển thị tên
      IF(ISBLANK(parent_code),
        name_vi,  // Level 2 không có parent
        VLOOKUP(parent_code, Categories!B:C, 2, FALSE) & " > " & name_vi
      )
    )
  ),
  "Không xác định"
)
```

**Kết quả**:
- Level 1: `Ăn uống`
- Level 2: `Ăn uống > Cà phê`

---

## 3. Spending by Category Formulas

### 3.1 Tổng chi theo Level 1 category trong tháng

```excel
// Trong Summary!B5 (tổng chi cho "Ăn uống" tháng 3/2026)
=SUMIFS(
  Transactions!E:E,              // amount (cột E)
  Transactions!C:C,              // category_l1 (cột C)
  "food_drink",                  // category filter
  Transactions!A:A,              // date (cột A)
  ">="&DATE(2026,3,1),           // month start
  Transactions!A:A,
  "<="&DATE(2026,3,31),          // month end
  Transactions!F:F,              // status (cột F)
  "confirmed"                    // chỉ tính confirmed
)
```

**Comment tiếng Việt**: Tính tổng chi tiêu cho category Ăn uống trong tháng 3/2026, chỉ đếm transactions đã confirmed

### 3.2 Tổng chi theo Level 2 category (chi tiết hơn)

```excel
// Trong Summary!C5 (tổng chi cho "Cà phê" tháng 3/2026)
=SUMIFS(
  Transactions!E:E,              // amount
  Transactions!D:D,              // category_code (cột D)
  "cafe",                        // specific category
  Transactions!A:A,
  ">="&DATE(2026,3,1),
  Transactions!A:A,
  "<="&DATE(2026,3,31),
  Transactions!F:F,
  "confirmed"
)
```

### 3.3 % của tổng chi tiêu

```excel
// Trong Summary!D5 (% cà phê so với tổng ăn uống)
=IFERROR(
  C5 / B5,  // cafe_spend / food_drink_total
  0
)
```

**Format**: Percentage (`0.0%`)

### 3.4 Tổng chi tất cả categories trong tháng

```excel
// Trong Summary!B2 (total spend tháng 3/2026)
=SUMIFS(
  Transactions!E:E,              // amount
  Transactions!A:A,              // date
  ">="&DATE(2026,3,1),
  Transactions!A:A,
  "<="&DATE(2026,3,31),
  Transactions!F:F,              // status
  "confirmed",
  Transactions!G:G,              // group (expense/income/transfer)
  "expense"                      // chỉ expense
)
```

---

## 4. Cashback Category Filter

### 4.1 FILTER transactions eligible cho cashback

```excel
// Tạo danh sách transactions tính cashback
=FILTER(
  Transactions!A:H,                          // toàn bộ row data
  Transactions!J:J = TRUE,                   // affects_cashback = TRUE
  Transactions!G:G = "expense",              // chỉ expense
  Transactions!F:F = "confirmed",            // confirmed only
  Transactions!B:B = "vpbank",               // specific account (optional)
  Transactions!A:A >= DATE(2026,3,1),        // month start
  Transactions!A:A <= DATE(2026,3,31)        // month end
)
```

**Comment**: Lọc ra tất cả transactions eligible cho cashback của VPBank trong tháng 3/2026

### 4.2 Tổng spent eligible cho cashback per account per cycle

```excel
// Trong CashbackCycles!H2 (spent_amount)
=SUMIFS(
  Transactions!E:E,                          // amount
  Transactions!B:B,                          // account_id
  A2,                                        // current account_id
  Transactions!K:K,                          // persisted_cycle_tag
  C2,                                        // current cycle_tag
  Transactions!J:J,                          // affects_cashback
  TRUE,
  Transactions!G:G,                          // group
  "expense",
  Transactions!F:F,                          // status
  "confirmed"
)
```

**Comment**: Tính total spent_amount cho cashback cycle, exclude internal transfers và income

---

## 5. Budget Tracking per Category

### 5.1 Tổng chi category trong tháng so với budget limit

```excel
// Trong Budgets!F2 (actual_spend)
=SUMIFS(
  Transactions!E:E,                          // amount
  Transactions!D:D,                          // category_code
  B2,                                        // current category_code
  Transactions!A:A,                          // date
  ">="&C2,                                   // period_start
  Transactions!A:A,
  "<="&D2,                                   // period_end
  Transactions!F:F,                          // status
  "confirmed"
)
```

### 5.2 % budget đã dùng

```excel
// Trong Budgets!G2 (usage_percent)
=IFERROR(
  F2 / E2,  // actual_spend / budget_limit
  0
)
```

**Format**: Percentage (`0.0%`)

### 5.3 Cảnh báo khi > 80% budget

```excel
// Trong Budgets!H2 (budget_status)
=IF(F2 > E2,
  "EXCEEDED",      // Vượt ngân sách
  IF(F2 > E2 * 0.8,
    "WARNING",     // Trên 80%
    "OK"           // Dưới 80%
  )
)
```

**Conditional Formatting**:
- `EXCEEDED` → Background đỏ, text trắng
- `WARNING` → Background vàng, text đen
- `OK` → Background xanh lá, text trắng

### 5.4 Số tiền còn lại có thể chi

```excel
// Trong Budgets!I2 (remaining_budget)
=MAX(0, E2 - F2)  // budget_limit - actual_spend
```

---

## 6. Category Report (Tab Summary)

### 6.1 Top 5 categories chi nhiều nhất tháng này

```excel
// Trong Summary!A10
=SORTN(
  QUERY(
    Transactions!A:H,
    "SELECT C, SUM(E) 
     WHERE A >= date '"&TEXT(DATE(2026,3,1),"yyyy-mm-dd")&"' 
       AND A <= date '"&TEXT(DATE(2026,3,31),"yyyy-mm-dd")&"'
       AND F = 'confirmed'
       AND G = 'expense'
     GROUP BY C
     LABEL SUM(E) 'Total'",
    0
  ),
  5,                    // top 5
  1,                    // sort by first column
  2, FALSE              // sort by Total descending
)
```

**Comment**: Lấy top 5 categories có tổng chi cao nhất tháng 3/2026

### 6.2 So sánh tháng này vs tháng trước

```excel
// Tháng này (Summary!B15)
=SUMIFS(
  Transactions!E:E,
  Transactions!C:C, "food_drink",
  Transactions!A:A, ">="&DATE(2026,3,1),
  Transactions!A:A, "<="&DATE(2026,3,31),
  Transactions!F:F, "confirmed"
)

// Tháng trước (Summary!C15)
=SUMIFS(
  Transactions!E:E,
  Transactions!C:C, "food_drink",
  Transactions!A:A, ">="&DATE(2026,2,1),
  Transactions!A:A, "<="&DATE(2026,2,28),
  Transactions!F:F, "confirmed"
)

// % thay đổi (Summary!D15)
=IFERROR((B15 - C15) / C15, 0)
```

**Format**: Percentage với 1 decimal (`0.0%`)
**Conditional Formatting**: Xanh nếu dương, đỏ nếu âm

### 6.3 SPARKLINE chart trend 6 tháng per category

```excel
// Trong Summary!E15 (trend chart cho food_drink)
=SPARKLINE(
  {
    SUMIFS(Transactions!E:E, Transactions!C:C, "food_drink", Transactions!A:A, ">="&DATE(2025,10,1), Transactions!A:A, "<="&DATE(2025,10,31), Transactions!F:F, "confirmed");
    SUMIFS(Transactions!E:E, Transactions!C:C, "food_drink", Transactions!A:A, ">="&DATE(2025,11,1), Transactions!A:A, "<="&DATE(2025,11,30), Transactions!F:F, "confirmed");
    SUMIFS(Transactions!E:E, Transactions!C:C, "food_drink", Transactions!A:A, ">="&DATE(2025,12,1), Transactions!A:A, "<="&DATE(2025,12,31), Transactions!F:F, "confirmed");
    SUMIFS(Transactions!E:E, Transactions!C:C, "food_drink", Transactions!A:A, ">="&DATE(2026,1,1), Transactions!A:A, "<="&DATE(2026,1,31), Transactions!F:F, "confirmed");
    SUMIFS(Transactions!E:E, Transactions!C:C, "food_drink", Transactions!A:A, ">="&DATE(2026,2,1), Transactions!A:A, "<="&DATE(2026,2,28), Transactions!F:F, "confirmed");
    SUMIFS(Transactions!E:E, Transactions!C:C, "food_drink", Transactions!A:A, ">="&DATE(2026,3,1), Transactions!A:A, "<="&DATE(2026,3,31), Transactions!F:F, "confirmed")
  },
  {"charttype","column"; "color","#FF6B6B"}
)
```

**Comment**: Biểu đồ cột xu hướng chi tiêu 6 tháng cho category Ăn uống

---

## 7. Smart Keyword Lookup

### 7.1 Tab `CategoryKeywords` schema

| Column | Field | Example |
|--------|-------|---------|
| A | `keyword` | `shopee` |
| B | `category_code` | `online_shopping` |
| C | `priority` | `1` |
| D | `context_keywords` | `food,delivery` |
| E | `override_category` | `food_delivery` |

### 7.2 Formula tra cứu nhanh

```excel
// Khi có merchant name trong ô X2
=IFERROR(
  VLOOKUP(LOWER(X2), CategoryKeywords!A:B, 2, FALSE),
  "uncategorized"
)
```

### 7.3 Tra cứu với context keywords

```excel
// Advanced lookup với context checking
=LET(
  merchant, LOWER(X2),
  note, LOWER(Y2),  // note column
  
  // Step 1: Tìm keyword match
  base_category, IFERROR(VLOOKUP(merchant, CategoryKeywords!A:B, 2, FALSE), ""),
  
  // Step 2: Check context rules
  context_row, FILTER(
    CategoryKeywords!A:E,
    CategoryKeywords!A:A = merchant
  ),
  
  // Step 3: Nếu có context keywords, check trong note
  IF(COUNTA(context_row) > 0,
    LET(
      ctx_keywords, INDEX(context_row, 1, 4),  // context_keywords column
      override_cat, INDEX(context_row, 1, 5),  // override_category
      
      // Check nếu có keyword trong note
      IF(REGEXMATCH(note, ctx_keywords),
        override_cat,
        base_category
      )
    ),
    base_category
  )
)
```

**Ví dụ**:
- Merchant: `grab`, Note: `đặt cơm trưa` → `food_delivery`
- Merchant: `grab`, Note: `đi làm` → `rideshare`

---

## 8. Named Ranges Đề xuất

| Named Range | Refers To | Purpose |
|-------------|-----------|---------|
| `Categories_List` | `Categories!B:B` | Danh sách all category codes |
| `Categories_Names` | `Categories!B:C` | Code → Name mapping |
| `Categories_Full` | `Categories!B:M` | Full category data |
| `Expense_Categories` | `FILTER(Categories!B:B, Categories!G:G="expense")` | Chỉ expense categories |
| `Cashback_Eligible` | `FILTER(Categories!B:B, Categories!J:J=TRUE)` | Categories tính cashback |
| `Keywords_Lookup` | `CategoryKeywords!A:B` | Keyword → Category mapping |
| `Level1_Categories` | `FILTER(Categories!B:C, Categories!F:F=1)` | Level 1 categories |
| `Level2_Categories` | `FILTER(Categories!B:E, Categories!F:F=2)` | Level 2 categories với parent |

**Cách sử dụng**:
```excel
=VLOOKUP(A2, Categories_Names, 2, FALSE)
=SUMIFS(amount_range, category_range, Expense_Categories)
```

---

## 9. Formatting & Conditional Formatting

### 9.1 Màu sắc cho Level 1 categories

| Category | Color | Hex |
|----------|-------|-----|
| Ăn uống | Red | `#FF6B6B` |
| Mua sắm | Blue | `#4ECDC4` |
| Di chuyển | Orange | `#FFA07A` |
| Hóa đơn & Dịch vụ | Purple | `#DDA0DD` |
| Sức khỏe | Green | `#98D8AA` |
| Giải trí | Pink | `#FFB6C1` |
| Bảo hiểm | Teal | `#5DBCD2` |
| Giáo dục | Brown | `#D2B48C` |
| Du lịch | Cyan | `#87CEEB` |
| Thu nhập | Green (dark) | `#228B22` |
| Chuyển khoản nội bộ | Gray | `#A9A9A9` |
| Khác | Silver | `#C0C0C0` |

### 9.2 Conditional Formatting rules

**Rule 1: Budget warning > 80%**
```
Range: Budgets!G:G (usage_percent)
Condition: Custom formula
Formula: =$G2 > 0.8
Format: Yellow background (#FFFACD), black text
```

**Rule 2: Budget exceeded > 100%**
```
Range: Budgets!G:G
Condition: Custom formula
Formula: =$G2 > 1
Format: Red background (#FF6B6B), white text
```

**Rule 3: Income categories**
```
Range: Transactions!C:C (category_name)
Condition: Custom formula
Formula: =VLOOKUP($B2, Categories!B:G, 6, FALSE) = "income"
Format: Light green background (#90EE90)
```

**Rule 4: Uncategorized transactions**
```
Range: Transactions!C:C
Condition: Text contains
Value: uncategorized
Format: Orange background (#FFA500), bold text
```

**Rule 5: Cashback eligible highlight**
```
Range: Transactions!A:H (entire row)
Condition: Custom formula
Formula: =$J2 = TRUE
Format: Light blue background (#E0F7FA)
```

### 9.3 Data Validation cho category selection

```
Range: Transactions!B:B (category_code)
Criteria: List from a range
Range: Categories!B:B (only active categories)
Filter: =Categories!L:L=TRUE (is_active)
```

---

## 10. Troubleshooting Tips

### Issue 1: VLOOKUP trả về #N/A
**Nguyên nhân**: Category code không tồn tại hoặc typo

**Fix**:
```excel
=IFERROR(VLOOKUP(...), "Check category code")
```

### Issue 2: SUMIFS trả về 0 dù có data
**Nguyên nhân**: 
- Date format không match
- Status filter sai
- Category code không khớp case

**Fix**:
```excel
// Debug: Count rows first
=COUNTIFS(
  Transactions!C:C, "food_drink",
  Transactions!A:A, ">="&DATE(2026,3,1),
  Transactions!F:F, "confirmed"
)
```

### Issue 3: Circular dependency error
**Nguyên nhân**: Formula reference chính nó

**Fix**: Check cell references, đảm bảo không self-reference

### Issue 4: FILTER trả về #VALUE!
**Nguyên nhân**: Range sizes không match

**Fix**: Đảm bảo tất cả ranges cùng số rows
```excel
=FILTER(A2:A100, B2:B100="x", C2:C100="y")  // OK
=FILTER(A2:A100, B2:B50="x")                // ERROR
```

### Issue 5: Slow performance với nhiều formulas
**Fix**:
- Dùng Named Ranges thay vì hard-coded ranges
- Giới hạn range size (A2:A1000 thay vì A:A)
- Tránh nested IFERROR quá sâu
- Dùng ARRAYFORMULA khi có thể

---

## 11. Checklist Kiểm Tra Sau Khi Dán Formulas

### Setup Checklist
- [ ] Tab `Categories` đã có đầy đủ 12 Level 1 categories
- [ ] Tab `Categories` đã có ~50 Level 2 sub-categories
- [ ] Tab `CategoryKeywords` đã có mappings cho merchants phổ biến
- [ ] Named ranges đã được tạo
- [ ] Data validation đã setup cho category dropdown

### Formulas Checklist
- [ ] VLOOKUP category name hoạt động trong Transactions tab
- [ ] SUMIFS spending by category trả về đúng số liệu
- [ ] % calculation không bị divide by zero error
- [ ] Budget tracking formulas link đúng period dates
- [ ] Cashback eligible filter exclude internal transfers
- [ ] Top 5 categories SORTN formula hoạt động
- [ ] SPARKLINE charts hiển thị đúng trend

### Formatting Checklist
- [ ] Conditional formatting cho budget warnings hoạt động
- [ ] Income categories có màu xanh lá
- [ ] Uncategorized transactions highlighted
- [ ] VND format `#,##0` áp dụng cho amounts
- [ ] Percentage format áp dụng cho ratios

### Testing Checklist
- [ ] Test với 10+ sample transactions
- [ ] Verify total spend matches sum of categories
- [ ] Test edge case: transaction với category không tồn tại
- [ ] Test month boundary: transactions ngày 31/3 vs 1/4
- [ ] Test refund impact on category totals

---

## 12. Sample Data Ready-to-Test

### Sample Categories (paste vào Categories!A2)

```
cat_001	food_drink	Ăn uống	Food & Drink			1	restaurant	#FF6B6B	expense	TRUE	TRUE	1
cat_002	dining_out	Ăn ngoài	Dining out	food_drink	2	utensils	#FF8787	expense	TRUE	TRUE	10
cat_003	cafe	Cà phê & trà	Coffee & Tea	food_drink	2	cup	#FFA3A3	expense	TRUE	TRUE	11
cat_004	shopping	Mua sắm	Shopping			1	shopping_bag	#4ECDC4	expense	TRUE	TRUE	2
cat_005	online_shopping	Mua sắm online	Online Shopping	shopping	2	cart	#7EDDD3	expense	TRUE	TRUE	20
```

### Sample Keywords (paste vào CategoryKeywords!A2)

```
shopee	online_shopping	1		
lazada	online_shopping	1		
tiki	online_shopping	1		
grab	rideshare	1	food,delivery	food_delivery
grab food	food_delivery	1		
highlands	cafe	1		
starbucks	cafe	1		
vinmart	grocery	1		
circle k	grocery	1	xăng,fuel	fuel
```

### Sample Transactions for Testing

| Date | Category Code | Amount | Status | Group | Affects Cashback |
|------|---------------|--------|--------|-------|------------------|
| 01/03/2026 | dining_out | -500,000 | confirmed | expense | TRUE |
| 02/03/2026 | cafe | -85,000 | confirmed | expense | TRUE |
| 03/03/2026 | online_shopping | -1,200,000 | confirmed | expense | TRUE |
| 04/03/2026 | fuel | -300,000 | confirmed | expense | TRUE |
| 05/03/2026 | internal_transfer | -2,000,000 | confirmed | transfer | FALSE |
| 06/03/2026 | salary | +15,000,000 | confirmed | income | FALSE |

**Expected Results**:
- Total food_drink: 585,000đ
- Total shopping: 1,200,000đ
- Total transport: 300,000đ
- Total eligible for cashback: 2,085,000đ (exclude transfer & income)
