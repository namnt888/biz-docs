# People - Google Sheets Formulas Playbook

## 1. Tab `People` — Suggested Schema

### Column Mapping (A → O)

| Col | Field | Data Type | Width | Format | Notes |
|-----|-------|-----------|-------|--------|-------|
| A | `id` | UUID | Hidden | Plain | Unique identifier |
| B | `name` | String | 150px | Plain | Tên đầy đủ |
| C | `nickname` | String | 120px | Plain | Biệt danh (optional) |
| D | `phone` | String | 120px | Plain | Số điện thoại |
| E | `avatar` | URL | Hidden | Hyperlink | Link ảnh |
| F | `note` | Text | 200px | Wrap text | Ghi chú |
| G | `is_favorite` | Boolean | 100px | Checkbox | TRUE/FALSE |
| H | `status` | Enum | 100px | Dropdown | active/archived |
| I | `total_lent_outstanding` | Decimal | 140px | `#,##0` | **Formula** |
| J | `total_borrowed_outstanding` | Decimal | 160px | `#,##0` | **Formula** |
| K | `net_position` | Decimal | 140px | `#,##0` | **Formula** (=I2-J2) |
| L | `total_cashback_shared` | Decimal | 160px | `#,##0` | **Formula** |
| M | `last_transaction_date` | Date | 140px | dd/mm/yyyy | **Formula** |
| N | `created_at` | Timestamp | 160px | dd/mm/yyyy hh:mm | Auto-fill |
| O | `updated_at` | Timestamp | 160px | dd/mm/yyyy hh:mm | Auto-update |

---

## 2. Financial Summary Formulas

### 2.1 `total_lent_outstanding` (Column I)
**Mục đích:** Tính tổng tiền mình còn cho người này mượn chưa đòi lại được

**Formula (cell I2, copy down):**
```excel
=SUMIFS(
  Debts!$H:$H,              /* original_amount column */
  Debts!$E:$E, $A2,         /* person_id match */
  Debts!$F:$F, "lent",      /* debt_role = lent */
  Debts!$G:$G, "<>settled", /* status not settled */
  Debts!$G:$G, "<>cancelled"/* status not cancelled */
)
```

**Giải thích:**
- `Debts!$H:$H`: Cột original_amount trong tab Debts
- `Debts!$E:$E, $A2`: Lọc theo person_id (cột A của tab People)
- `Debts!$F:$F, "lent"`: Chỉ tính debts mà mình cho người khác mượn
- `Debts!$G:$G, "<>settled"`: Loại trừ debts đã trả hết
- `Debts!$G:$G, "<>cancelled"`: Loại trừ debts đã hủy

**Kết quả:** Số dư nợ mà người này còn nợ mình

---

### 2.2 `total_borrowed_outstanding` (Column J)
**Mục đích:** Tính tổng tiền mình còn nợ người này chưa trả

**Formula (cell J2, copy down):**
```excel
=SUMIFS(
  Debts!$H:$H,              /* original_amount column */
  Debts!$E:$E, $A2,         /* person_id match */
  Debts!$F:$F, "borrowed",  /* debt_role = borrowed */
  Debts!$G:$G, "<>settled", /* status not settled */
  Debts!$G:$G, "<>cancelled"/* status not cancelled */
)
```

**Giải thích:**
- Tương tự như lent, nhưng filter `debt_role = "borrowed"`
- Kết quả: Số dư nợ mà mình còn nợ người này

---

### 2.3 `net_position` (Column K)
**Mục đích:** Tính vị thế ròng (dương = họ nợ mình, âm = mình nợ họ)

**Formula (cell K2, copy down):**
```excel
=I2 - J2
```

**Diễn giải:**
- **Dương (+)**: Người này đang nợ mình nhiều hơn
- **Âm (-)**: Mình đang nợ người này nhiều hơn
- **0**: Hòa nhau hoặc không có debt nào

**Format conditional:**
- Green fill nếu K2 > 0
- Red fill nếu K2 < 0
- Gray fill nếu K2 = 0

---

### 2.4 `total_cashback_shared` (Column L)
**Mục đích:** Tính tổng cashback đã share cho người này (lifetime)

**Formula (cell L2, copy down):**
```excel
=SUMIFS(
  Transactions!$T:$T,       /* cashback_share_amount column */
  Transactions!$S:$S, $A2   /* cashback_share_person_id match */
)
```

**Giải thích:**
- `Transactions!$T:$T`: Cột cashback_share_amount (số tiền cashback đã share)
- `Transactions!$S:$S, $A2`: Lọc theo cashback_share_person_id
- Kết quả: Tổng cashback đã share cho người này từ trước đến nay

---

### 2.5 `last_transaction_date` (Column M)
**Mục đích:** Tìm ngày giao dịch gần nhất liên quan đến người này

**Formula (cell M2, copy down):**
```excel
=MAX(
  FILTER(
    Transactions!$B:$B,     /* txn_date column */
    (Transactions!$H:$H = $A2) + (Transactions!$S:$S = $A2) > 0
  )
)
```

**Giải thích:**
- `Transactions!$B:$B`: Cột txn_date
- `Transactions!$H:$H = $A2`: Transactions có person_id match (debt/repayment)
- `Transactions!$S:$S = $A2`: Transactions có cashback_share_person_id match
- `+` operator: OR logic trong FILTER
- `> 0`: Ít nhất 1 điều kiện đúng
- `MAX()`: Lấy ngày gần nhất

**Xử lý lỗi (nếu không có transactions):**
```excel
=IFERROR(
  MAX(
    FILTER(
      Transactions!$B:$B,
      (Transactions!$H:$H = $A2) + (Transactions!$S:$S = $A2) > 0
    )
  ),
  ""
)
```

---

## 3. Cashback Share Summary Formulas

### 3.1 `cashback_shared_ytd` (Year-to-date)
**Mục đích:** Tính cashback đã share cho người này trong năm nay

**Formula (thêm vào column P nếu cần):**
```excel
=SUMIFS(
  Transactions!$T:$T,                    /* cashback_share_amount */
  Transactions!$S:$S, $A2,               /* cashback_share_person_id match */
  Transactions!$B:$B, ">=" & DATE(YEAR(TODAY()), 1, 1),  /* từ đầu năm */
  Transactions!$B:$B, "<=" & TODAY()     /* đến hôm nay */
)
```

---

### 3.2 `cashback_shared_this_month`
**Mục đích:** Tính cashback đã share trong tháng này

**Formula (thêm vào column Q nếu cần):**
```excel
=SUMIFS(
  Transactions!$T:$T,                    /* cashback_share_amount */
  Transactions!$S:$S, $A2,               /* cashback_share_person_id match */
  Transactions!$B:$B, ">=" & EOMONTH(TODAY(), -1) + 1,  /* từ đầu tháng */
  Transactions!$B:$B, "<=" & EOMONTH(TODAY(), 0)        /* đến cuối tháng */
)
```

---

## 4. Activity Tracking Formulas

### 4.1 `total_transactions` (Count)
**Mục đích:** Đếm số lượng transactions liên quan đến người này

**Formula (thêm vào column R nếu cần):**
```excel
=COUNTIFS(
  Transactions!$H:$H, $A2    /* person_id match */
) + COUNTIFS(
  Transactions!$S:$S, $A2    /* cashback_share_person_id match */
)
```

---

### 4.2 `first_transaction_date`
**Mục đích:** Tìm ngày giao dịch đầu tiên với người này

**Formula (thêm vào column S nếu cần):**
```excel
=IFERROR(
  MIN(
    FILTER(
      Transactions!$B:$B,
      (Transactions!$H:$H = $A2) + (Transactions!$S:$S = $A2) > 0
    )
  ),
  ""
)
```

---

### 4.3 `days_since_last_transaction`
**Mục đích:** Tính số ngày kể từ giao dịch gần nhất

**Formula (thêm vào column T nếu cần):**
```excel
=IF(M2 = "", "", TODAY() - M2)
```

**Format:** Number (0 decimals)  
**Conditional formatting:** 
- Red fill nếu > 90 days (không giao dịch lâu)
- Yellow fill nếu > 30 days
- Green fill nếu <= 30 days

---

## 5. Debt History Per Person

### 5.1 `count_debts_settled`
**Mục đích:** Đếm số debts đã trả hết (settled)

**Formula (thêm vào column U nếu cần):**
```excel
=COUNTIFS(
  Debts!$E:$E, $A2,         /* person_id match */
  Debts!$G:$G, "settled"    /* status = settled */
)
```

---

### 5.2 `count_debts_pending`
**Mục đích:** Đếm số debts đang pending/partial

**Formula (thêm vào column V nếu cần):**
```excel
=COUNTIFS(
  Debts!$E:$E, $A2,                     /* person_id match */
  Debts!$G:$G, "pending"                /* status = pending */
) + COUNTIFS(
  Debts!$E:$E, $A2,                     /* person_id match */
  Debts!$G:$G, "partial"                /* status = partial */
)
```

---

### 5.3 `count_debts_total`
**Mục đích:** Tổng số debts (tất cả status)

**Formula (thêm vào column W nếu cần):**
```excel
=COUNTIF(Debts!$E:$E, $A2)
```

---

### 5.4 `lifetime_volume`
**Mục đích:** Tổng tiền đã qua lại với người này (lifetime)

**Formula (thêm vào column X nếu cần):**
```excel
=SUMIFS(
  Debts!$H:$H,              /* original_amount */
  Debts!$E:$E, $A2          /* person_id match */
)
```

---

## 6. Dashboard Formulas (Tab `Summary`)

### 6.1 Top 5 người còn nợ mình nhiều nhất
**Mục đích:** Liệt kê 5 people có net_position dương lớn nhất

**Formula (trong tab Summary, cell A2):**
```excel
=SORT(
  FILTER(People!$B:$K, People!$K:$K > 0, People!$H:$H = "active"),
  10,  /* sort by net_position (column K = 10th in range B:K) */
  FALSE /* descending */
)
```

**Hiển thị:** Top 5 rows đầu tiên

---

### 6.2 Top 5 người mình còn nợ nhiều nhất
**Mục đích:** Liệt kê 5 people có net_position âm lớn nhất (mình nợ họ)

**Formula (trong tab Summary, cell A10):**
```excel
=SORT(
  FILTER(People!$B:$K, People!$K:$K < 0, People!$H:$H = "active"),
  10,  /* sort by net_position */
  TRUE /* ascending (âm nhất lên đầu) */
)
```

---

### 6.3 Total outstanding lent across all people
**Mục đích:** Tổng tiền tất cả mọi người còn nợ mình

**Formula (trong tab Summary, cell E2):**
```excel
=SUMIF(People!$K:$K, ">0", People!$K:$K)
```

Hoặc chính xác hơn:
```excel
=SUMIFS(
  Debts!$H:$H,              /* original_amount */
  Debts!$F:$F, "lent",      /* debt_role = lent */
  Debts!$G:$G, "<>settled", /* not settled */
  Debts!$G:$G, "<>cancelled"/* not cancelled */
)
```

---

### 6.4 Total outstanding borrowed across all people
**Mục đích:** Tổng tiền mình còn nợ tất cả mọi người

**Formula (trong tab Summary, cell E3):**
```excel
=SUMIFS(
  Debts!$H:$H,              /* original_amount */
  Debts!$F:$F, "borrowed",  /* debt_role = borrowed */
  Debts!$G:$G, "<>settled", /* not settled */
  Debts!$G:$G, "<>cancelled"/* not cancelled */
)
```

---

### 6.5 Net debt position (overall)
**Mục đích:** Vị thế ròng tổng thể (dương = mình đang cho vay nhiều hơn)

**Formula (trong tab Summary, cell E4):**
```excel
=E2 - E3
```

---

### 6.6 Count of people with outstanding debts
**Mục đích:** Đếm số người còn nợ mình hoặc mình còn nợ

**Formula (trong tab Summary, cell E5):**
```excel
=COUNTIF(People!$K:$K, "<>0")
```

---

## 7. Named Ranges Suggestions

| Named Range | Refers To | Purpose |
|-------------|-----------|---------|
| `People_List` | `People!$B:$O` | Toàn bộ danh sách people |
| `People_Names` | `People!$B:$B` | Danh sách tên để validate |
| `People_Favorites` | `FILTER(People!$B:$H, People!$G:$G=TRUE)` | Chỉ favorites |
| `Debts_All` | `Debts!$A:$Z` | Toàn bộ debts data |
| `Transactions_All` | `Transactions!$A:$Z` | Toàn bộ transactions data |
| `Lent_Outstanding` | `Debts!$H:$H` (filtered) | Dùng trong SUMIFS |
| `Borrowed_Outstanding` | `Debts!$H:$H` (filtered) | Dùng trong SUMIFS |

**Cách tạo named range:**
1. Chọn range cần đặt tên
2. Vào menu **Data** → **Named ranges**
3. Nhập tên và click **Done**

---

## 8. Formatting Guidelines

### 8.1 Number Format
- **VND amounts:** `#,##0` (không decimal, có thousands separator)
- **Dates:** `dd/mm/yyyy`
- **Timestamps:** `dd/mm/yyyy hh:mm`
- **Percentages:** `0%` (không decimal)

### 8.2 Conditional Formatting Rules

#### Rule 1: Net Position Positive (Green)
**Apply to:** `People!$K:$K`
**Format rule:** Custom formula
```excel
=$K2 > 0
```
**Formatting:** Green fill (#d9ead3), Dark green text

---

#### Rule 2: Net Position Negative (Red)
**Apply to:** `People!$K:$K`
**Format rule:** Custom formula
```excel
=$K2 < 0
```
**Formatting:** Red fill (#f4cccc), Dark red text

---

#### Rule 3: Favorite Highlight
**Apply to:** `People!$B:$O`
**Format rule:** Custom formula
```excel
=$G2 = TRUE
```
**Formatting:** Light yellow fill (#fff2cc)

---

#### Rule 4: Archived Status (Gray)
**Apply to:** `People!$B:$O`
**Format rule:** Custom formula
```excel
=$H2 = "archived"
```
**Formatting:** Gray fill (#eeeeee), Gray text, Strikethrough

---

#### Rule 5: No Transaction in 90 Days
**Apply to:** `People!$M:$M`
**Format rule:** Custom formula
```excel
=AND($M2 <> "", TODAY() - $M2 > 90)
```
**Formatting:** Orange fill (#fce5cd)

---

#### Rule 6: High Outstanding Balance
**Apply to:** `People!$I:$I` (lent outstanding)
**Format rule:** Custom formula
```excel
=$I2 > 5000000
```
**Formatting:** Bold text, Red border

---

### 8.3 Data Validation

#### Column G (is_favorite):
- **Type:** Checkbox
- **Checked value:** TRUE
- **Unchecked value:** FALSE

#### Column H (status):
- **Type:** Dropdown
- **Options:** `active`, `archived`

---

## 9. Troubleshooting Tips

### Issue 1: SUMIFS returns 0 khi chắc chắn có data
**Nguyên nhân:** person_id không match (khác case, khoảng trắng)
**Giải pháp:**
```excel
=SUMIFS(
  Debts!$H:$H,
  Debts!$E:$E, TRIM($A2),  /* Trim whitespace */
  ...
)
```

---

### Issue 2: #VALUE! error trong FILTER
**Nguyên nhân:** Range sizes không match
**Giải pháp:** Kiểm tra tất cả ranges trong FILTER phải cùng số rows

---

### Issue 3: Circular dependency warning
**Nguyên nhân:** Formula reference chính nó
**Giải pháp:** Đảm bảo formula trong People không reference People column khác có formula dependency

---

### Issue 4: MAX/MIN returns 0 thay vì date
**Nguyên nhân:** Dates stored as text
**Giải pháp:** Convert dates:
```excel
=MAX(FILTER(DATEVALUE(Transactions!$B:$B), ...))
```

---

### Issue 5: Named range không hoạt động
**Nguyên nhân:** Named range scope (sheet vs workbook)
**Giải pháp:** Khi tạo named range, chọn scope là workbook (toàn file)

---

## 10. Checklist Sau Khi Dán Formulas

### Structural Checks
- [ ] Tất cả columns A-O đều có data hoặc formula
- [ ] Formulas copy xuống ít nhất 100 rows (để dự phòng)
- [ ] Named ranges đã tạo và test
- [ ] Data validation đã setup cho dropdowns/checkboxes

### Formula Verification
- [ ] total_lent_outstanding: Test với person có known debts
- [ ] total_borrowed_outstanding: Test với person có known borrowings
- [ ] net_position: Verify = lent - borrowed
- [ ] total_cashback_shared: Cross-check với Transactions tab
- [ ] last_transaction_date: Verify đúng ngày gần nhất

### Formatting Checks
- [ ] VND format áp dụng cho tất cả amount columns
- [ ] Date format đúng dd/mm/yyyy
- [ ] Conditional formatting hiển thị đúng màu
- [ ] Favorites highlight hoạt động
- [ ] Archived rows grayed out

### Edge Case Testing
- [ ] Person không có debts: totals = 0
- [ ] Person chỉ có cashback shares: lent/borrowed = 0
- [ ] Person archived: formulas vẫn tính đúng
- [ ] Person mới tạo (chưa transactions): last_transaction_date = blank

### Performance
- [ ] Sheet load time < 3 seconds
- [ ] No #REF! errors
- [ ] No circular dependencies
- [ ] Formulas auto-update khi thêm data mới

---

## 11. Sample Data Ready-to-Test

### Tab `People` - Sample Rows

| Row | name | nickname | phone | is_favorite | status | total_lent_outstanding | total_borrowed_outstanding | net_position |
|-----|------|----------|-------|-------------|--------|------------------------|----------------------------|--------------|
| 2 | Nguyễn Văn Nam | Nam "cạ cứng" | 0901234567 | TRUE | active | 2,300,000 | 0 | 2,300,000 |
| 3 | Trần Thị Linh | Linh "tài chính" | 0907654321 | TRUE | active | 0 | 3,000,000 | -3,000,000 |
| 4 | Lê Văn Hùng | Hùng "đồng nghiệp" | 0909876543 | FALSE | active | 0 | 0 | 0 |
| 5 | Phạm Thị Lan | Lan "chị gái" | 0901112223 | TRUE | active | 3,000,000 | 1,000,000 | 2,000,000 |
| 6 | Tuấn "hàng xóm" | Tuấn | 0905556666 | FALSE | archived | 0 | 0 | 0 |

### Expected Results After Formulas:
- Row 2 (Nam): lent=2,300,000, borrowed=0, net=+2,300,000 (green)
- Row 3 (Linh): lent=0, borrowed=3,000,000, net=-3,000,000 (red)
- Row 4 (Hùng): lent=0, borrowed=0, net=0 (gray)
- Row 5 (Lan): lent=3,000,000, borrowed=1,000,000, net=+2,000,000 (green)
- Row 6 (Tuấn): archived, gray strikethrow

---

## 12. Quick Reference Card

| Need | Formula Location | Column |
|------|------------------|--------|
| Tiền người này còn nợ mình | Section 2.1 | I |
| Tiền mình còn nợ người này | Section 2.2 | J |
| Vị thế ròng (ai nợ ai) | Section 2.3 | K |
| Tổng cashback đã share | Section 2.4 | L |
| Ngày giao dịch gần nhất | Section 2.5 | M |
| Cashback share YTD | Section 3.1 | P (add) |
| Cashback share tháng này | Section 3.2 | Q (add) |
| Số transactions | Section 4.1 | R (add) |
| Ngày giao dịch đầu tiên | Section 4.2 | S (add) |
| Số ngày không giao dịch | Section 4.3 | T (add) |
| Số debts đã settle | Section 5.1 | U (add) |
| Số debts pending | Section 5.2 | V (add) |
| Tổng số debts | Section 5.3 | W (add) |
| Lifetime volume | Section 5.4 | X (add) |

---

*Document version: 1.0*  
*Last updated: 2026-04-20*  
*Author: AI Agent*  
*Reference: people.md, debt-formulas.md, transactions-formulas.md*
