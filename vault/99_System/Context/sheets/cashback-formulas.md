# Google Sheets Formulas: Cashback

Tài liệu này cung cấp công thức **copy-paste sẵn** cho mô hình n8n + Google Sheets, với tab `CashbackCycles` để track cashback theo chu kỳ và `CashbackEntries` để chi tiết hóa cashback entries.

---

## 1) Cấu trúc sheet đề xuất

### 1.1 Tab `CashbackCycles` — Master cycle tracking

| Cột | Tên cột | Field | Ví dụ dữ liệu |
|---|---|---|---|
| A | `cycle_id` | cycle_id | CYCLE_001, CYCLE_002... |
| B | `account_id` | account_id | ACC_TCB_001, ACC_UOB_001 |
| C | `account_name` | account_name | Techcombank, UOB |
| D | `cycle_tag` | cycle_tag | 2026-03, 2026-02 |
| E | `cycle_type` | cycle_type | calendar_month / statement_cycle |
| F | `statement_day` | statement_day | 0, 25, 15 |
| G | `start_date` | start_date | 01/03/2026, 25/02/2026 |
| H | `end_date` | end_date | 31/03/2026, 24/03/2026 |
| I | `cb_min_spend` | cb_min_spend | 3000000, 5000000 |
| J | `cb_max_budget` | cb_max_budget | 300000, 500000 |
| K | `spent_amount` | spent_amount | Formula |
| L | `real_awarded` | real_awarded | Formula |
| M | `virtual_profit` | virtual_profit | Formula |
| N | `total_earned` | total_earned | Formula |
| O | `capped_amount` | capped_amount | Formula |
| P | `loss_amount` | loss_amount | Formula |
| Q | `remaining_budget` | remaining_budget | Formula |
| R | `is_qualified` | is_qualified | Formula (TRUE/FALSE) |
| S | `remaining_to_qualify` | remaining_to_qualify | Formula |
| T | `progress_percent` | progress_percent | Formula |
| U | `status` | status | active / closed / settled |
| V | `notes` | notes | Ghi chú |
| W | `created_at` | created_at | 01/03/2026 00:00 |
| X | `updated_at` | updated_at | 20/03/2026 15:30 |

### 1.2 Tab `CashbackEntries` — Chi tiết cashback entries

| Cột | Tên cột | Field | Ví dụ dữ liệu |
|---|---|---|---|
| A | `entry_id` | entry_id | ENTRY_001, ENTRY_002 |
| B | `cycle_id` | cycle_id | CYCLE_001 |
| C | `transaction_id` | transaction_id | TXN_001 |
| D | `account_id` | account_id | ACC_TCB_001 |
| E | `mode` | mode | real / virtual / voluntary |
| F | `amount` | amount | 10000, 5000 |
| G | `counts_to_budget` | counts_to_budget | TRUE/FALSE |
| H | `policy_rate` | policy_rate | 0.01, 0.005 |
| I | `rule_name` | rule_name | Food 1%, Shopping 0.5% |
| J | `category_name` | category_name | Ăn uống, Mua sắm |
| K | `note` | note | Projected: Food rule, Manual entry |
| L | `created_at` | created_at | 05/03/2026 10:30 |

### 1.3 Tab `Transactions` — Source of truth

| Cột | Tên cột | Field | Ví dụ |
|---|---|---|---|
| A | `txn_id` | txn_id | TXN_001 |
| B | `txn_date` | txn_date | 05/03/2026 |
| C | `status` | status | posted |
| D | `type` | type | expense |
| E | `account_id` | account_id | ACC_TCB_001 |
| F | `amount` | amount | 500000 |
| Q | `cycle_tag` | cycle_tag | 2026-03 |
| ... | ... | ... | ... |

### 1.4 Tab `Summary` — Dashboard tổng hợp

| Cột | Metric | Value | Note |
|---|---|---|---|
| A | Total Cashback YTD | Formula | Real awarded year-to-date |
| B | Total Cashback This Month | Formula | Current month real awarded |
| C | Total Budget Remaining | Formula | Sum remaining_budget |
| D | Total Loss (Capped) | Formula | Sum loss_amount |
| E | Qualified Cycles Count | Formula | Count is_qualified = TRUE |
| F | Overdue Cycles Count | Formula | Closed but not settled |

---

## 2) Công thức tính spent_amount (CashbackCycles!K)

### 2.1 Công thức cơ bản (đặt tại `CashbackCycles!K2`, kéo xuống)

```gs
=IF(A2="", "",
  SUMIFS(
    Transactions!$F:$F,           // Cột amount
    Transactions!$E:$E, $B2,      // Match account_id
    Transactions!$Q:$Q, $D2,      // Match cycle_tag
    Transactions!$D:$D, "expense", // Chỉ expense type
    Transactions!$C:$C, "posted"   // Chỉ posted status
  )
)
```

**Giải thích (VN):**
- Tính tổng tất cả transactions expense đã chốt trong cycle này
- Exclude: income, transfer, debt, repayment, void transactions
- Amount luôn dương, không cần xét dấu

### 2.2 Công thức đầy đủ (include debt & service types)

```gs
=IF(A2="", "",
  SUMIFS(Transactions!$F:$F, Transactions!$E:$E, $B2, Transactions!$Q:$Q, $D2, Transactions!$D:$D, "expense", Transactions!$C:$C, "posted")
  + SUMIFS(Transactions!$F:$F, Transactions!$E:$E, $B2, Transactions!$Q:$Q, $D2, Transactions!$D:$D, "debt", Transactions!$C:$C, "posted")
  + SUMIFS(Transactions!$F:$F, Transactions!$E:$E, $B2, Transactions!$Q:$Q, $D2, Transactions!$D:$D, "service", Transactions!$C:$C, "posted")
)
```

**Giải thích (VN):**
- Include thêm debt và service transactions (theo business rule)
- 3 SUMIFS cộng lại cho 3 loại transactions eligible

### 2.3 Với named ranges (cleaner)

Đặt named ranges trước:
- `txnAmount` = `Transactions!$F:$F`
- `txnAccountId` = `Transactions!$E:$E`
- `txnCycleTag` = `Transactions!$Q:$Q`
- `txnType` = `Transactions!$D:$D`
- `txnStatus` = `Transactions!$C:$C`

```gs
=IF(A2="", "",
  SUMIFS(txnAmount, txnAccountId, $B2, txnCycleTag, $D2, txnType, "expense", txnStatus, "posted")
  + SUMIFS(txnAmount, txnAccountId, $B2, txnCycleTag, $D2, txnType, "debt", txnStatus, "posted")
  + SUMIFS(txnAmount, txnAccountId, $B2, txnCycleTag, $D2, txnType, "service", txnStatus, "posted")
)
```

---

## 3) Công thức tính real_awarded (CashbackCycles!L)

### 3.1 Từ CashbackEntries tab

```gs
=IF(A2="", "",
  SUMIFS(
    CashbackEntries!$F:$F,        // Cột amount
    CashbackEntries!$B:$B, $A2,   // Match cycle_id
    CashbackEntries!$E:$E, "real" // Chỉ real mode
  )
)
```

**Giải thích (VN):**
- Tổng cashback thực tế đã nhận từ entries
- Chỉ tính mode = 'real' (user đã nhập hoặc sync từ bank)

---

## 4) Công thức tính virtual_profit (CashbackCycles!M)

```gs
=IF(A2="", "",
  SUMIFS(
    CashbackEntries!$F:$F,          // Cột amount
    CashbackEntries!$B:$B, $A2,     // Match cycle_id
    CashbackEntries!$E:$E, "virtual"// Chỉ virtual mode
  )
)
```

**Giải thích (VN):**
- Tổng cashback ảo (projection) từ policy calculation
- Chỉ tính mode = 'virtual'

---

## 5) Công thức tính total_earned (CashbackCycles!N)

```gs
=IF(A2="", "", L2 + M2)
```

**Giải thích (VN):**
- total_earned = real_awarded + virtual_profit

---

## 6) Công thức tính capped_amount (CashbackCycles!O)

```gs
=IF(A2="", "", MIN(N2, IF(J2=0, N2, J2)))
```

**Giải thích (VN):**
- capped_amount = MIN(total_earned, cb_max_budget)
- Nếu cb_max_budget = 0 (unlimited) → lấy total_earned

---

## 7) Công thức tính loss_amount (CashbackCycles!P)

```gs
=IF(A2="", "", MAX(0, N2 - IF(J2=0, N2, J2)))
```

**Giải thích (VN):**
- loss = total_earned - cb_max_budget (nếu vượt budget)
- Nếu không vượt → loss = 0

---

## 8) Công thức tính remaining_budget (CashbackCycles!Q)

```gs
=IF(A2="", "", MAX(0, IF(J2=0, N2, J2) - O2))
```

**Giải thích (VN):**
- remaining = cb_max_budget - capped_amount
- Nếu unlimited (J2=0) → remaining = total_earned (không có cap)

---

## 9) Công thức kiểm tra is_qualified (CashbackCycles!R)

### 9.1 Công thức cơ bản

```gs
=IF(A2="", "", OR(K2>=I2, I2=0, I2=""))
```

**Giải thích (VN):**
- Qualified khi: spent_amount >= cb_min_spend
- HOẶC cb_min_spend = 0 (không yêu cầu)
- HOẶC cb_min_spend rỗng (không yêu cầu)

### 9.2 Với badge text (column S)

```gs
=IF(A2="", "",
  IF(OR(I2=0, I2=""), "No min spend",
    IF(K2>=I2, "✅ Qualified",
      "⚠️ Need " & TEXT(I2-K2, "#,##0") & " more"
    )
  )
)
```

**Giải thích (VN):**
- Hiển thị badge text thay vì TRUE/FALSE
- "Need XYZ more" khi chưa qualified

---

## 10) Công thức tính remaining_to_qualify (CashbackCycles!S)

```gs
=IF(A2="", "", MAX(0, I2 - K2))
```

**Giải thích (VN):**
- Số tiền cần chi thêm để qualify
- Nếu đã qualified → 0

---

## 11) Công thức tính progress_percent (CashbackCycles!T)

### 11.1 Progress so với min_spend

```gs
=IF(A2="", "", IF(I2=0, 1, K2/I2))
```

**Giải thích (VN):**
- % chi tiêu so với min_spend target
- Nếu không có min_spend → 100%

### 11.2 Progress bar visualization (column AA)

```gs
=IF(A2="", "",
  REPT("▓", ROUND(T2*10, 0)) & REPT("░", 10-ROUND(T2*10, 0)) & " " & TEXT(T2, "0%")
)
```

**Giải thích (VN):**
- Hiển thị progress bar dạng text: ▓▓▓▓▓░░░░░ 50%
- 10 blocks total, tỷ lệ theo progress_percent

---

## 12) Công thức tính start_date và end_date từ cycle_tag

### 12.1 Cho calendar_month (cycle_type = "calendar_month")

**start_date (CashbackCycles!G2):**
```gs
=IF(A2="", "", DATE(VALUE(LEFT($D2,4)), VALUE(RIGHT($D2,2)), 1))
```

**end_date (CashbackCycles!H2):**
```gs
=IF(A2="", "", EOMONTH(G2, 0))
```

**Giải thích (VN):**
- start_date = ngày 1 của tháng trong cycle_tag
- end_date = ngày cuối tháng (EOMONTH)
- Example: tag=2026-03 → start=01/03/2026, end=31/03/2026

### 12.2 Cho statement_cycle (cycle_type = "statement_cycle")

**start_date (CashbackCycles!G2):**
```gs
=IF(A2="", "",
  IF($E2="statement_cycle",
    DATE(VALUE(LEFT($D2,4)), VALUE(RIGHT($D2,2))-1, $F2),
    DATE(VALUE(LEFT($D2,4)), VALUE(RIGHT($D2,2)), 1)
  )
)
```

**end_date (CashbackCycles!H2):**
```gs
=IF(A2="", "",
  IF($E2="statement_cycle",
    DATE(VALUE(LEFT($D2,4)), VALUE(RIGHT($D2,2)), $F2) - 1,
    EOMONTH(G2, 0)
  )
)
```

**Giải thích (VN):**
- Statement cycle: start = statement_day của tháng trước
- end = statement_day của tháng hiện tại - 1 ngày
- Example: tag=2026-03, statement_day=25 → start=25/02/2026, end=24/03/2026

### 12.3 Unified formula (tự động detect cycle_type)

**start_date:**
```gs
=IF(A2="", "",
  IF($E2="statement_cycle",
    DATE(VALUE(LEFT($D2,4)), VALUE(RIGHT($D2,2))-1, $F2),
    DATE(VALUE(LEFT($D2,4)), VALUE(RIGHT($D2,2)), 1)
  )
)
```

**end_date:**
```gs
=IF(A2="", "",
  IF($E2="statement_cycle",
    DATE(VALUE(LEFT($D2,4)), VALUE(RIGHT($D2,2)), $F2) - 1,
    EOMONTH(
      IF($E2="statement_cycle",
        DATE(VALUE(LEFT($D2,4)), VALUE(RIGHT($D2,2))-1, $F2),
        DATE(VALUE(LEFT($D2,4)), VALUE(RIGHT($D2,2)), 1)
      ),
      0
    )
  )
)
```

---

## 13) Summary Dashboard Formulas (tab Summary)

### 13.1 Total cashback YTD (real awarded only)

```gs
=SUMIFS(
  CashbackCycles!$L:$L,                    // real_awarded column
  CashbackCycles!$D:$D, ">="&DATE(YEAR(TODAY()),1,1),  // cycle_tag >= Jan 1
  CashbackCycles!$D:$D, "<="&TEXT(TODAY(),"yyyy-mm")   // cycle_tag <= current month
)
```

**Lưu ý:** Cycle_tag là text (YYYY-MM), so sánh text-based

**Alternative (parse year from tag):**
```gs
=SUMPRODUCT(
  --(VALUE(LEFT(CashbackCycles!$D$2:$D$100,4))=YEAR(TODAY())),
  CashbackCycles!$L$2:$L$100
)
```

### 13.2 Total cashback this month

```gs
=SUMIFS(
  CashbackCycles!$L:$L,
  CashbackCycles!$D:$D, TEXT(TODAY(),"yyyy-mm")
)
```

### 13.3 Total budget remaining

```gs
=SUM(CashbackCycles!$Q:$Q)
```

### 13.4 Total loss (capped amount)

```gs
=SUM(CashbackCycles!$P:$P)
```

### 13.5 Qualified cycles count

```gs
=COUNTIF(CashbackCycles!$R:$R, TRUE)
```

### 13.6 Overdue cycles count (closed but not settled)

```gs
=COUNTIFS(
  CashbackCycles!$U:$U, "closed",
  CashbackCycles!$H:$H, "<"&TODAY()
)
```

### 13.7 Total cashback by account

Đặt tại tab khác, với account_id ở column A:

```gs
=SUMIFS(CashbackCycles!$L:$L, CashbackCycles!$B:$B, $A2)
```

### 13.8 Total cashback by month

```gs
=SUMIFS(CashbackCycles!$L:$L, CashbackCycles!$D:$D, "2026-03")
```

---

## 14) Named Ranges khuyến nghị

| Name | Refers to | Purpose |
|---|---|---|
| `cycleAccountId` | `CashbackCycles!$B:$B` | Account ID lookup |
| `cycleTag` | `CashbackCycles!$D:$D` | Cycle tag lookup |
| `cycleMinSpend` | `CashbackCycles!$I:$I` | Min spend targets |
| `cycleMaxBudget` | `CashbackCycles!$J:$J` | Max budgets |
| `cycleSpentAmount` | `CashbackCycles!$K:$K` | Spent amounts |
| `cycleRealAwarded` | `CashbackCycles!$L:$L` | Real awarded |
| `cycleVirtualProfit` | `CashbackCycles!$M:$M` | Virtual profit |
| `cycleIsQualified` | `CashbackCycles!$R:$R` | Qualification status |
| `entryCycleId` | `CashbackEntries!$B:$B` | Entry cycle lookup |
| `entryMode` | `CashbackEntries!$E:$E` | Entry mode lookup |
| `entryAmount` | `CashbackEntries!$F:$F` | Entry amounts |
| `txnAccountId` | `Transactions!$E:$E` | Transaction account |
| `txnCycleTag` | `Transactions!$Q:$Q` | Transaction cycle tag |
| `txnAmount` | `Transactions!$F:$F` | Transaction amounts |
| `txnType` | `Transactions!$D:$D` | Transaction type |
| `txnStatus` | `Transactions!$C:$C` | Transaction status |

---

## 15) Conditional Formatting

### 15.1 is_qualified column (R)

**Rule 1: Qualified (xanh lá)**
- Apply to: `CashbackCycles!$R$2:$R$1000`
- Condition: `=$R2=TRUE`
- Format: Background green (#4CAF50), text white

**Rule 2: Not qualified (vàng)**
- Apply to: `CashbackCycles!$R$2:$R$1000`
- Condition: `=$R2=FALSE`
- Format: Background yellow (#FFC107), text black

### 15.2 status column (U)

**Rule 1: Active (xanh dương)**
- Apply to: `CashbackCycles!$U$2:$U$1000`
- Condition: `=$U2="active"`
- Format: Background blue (#2196F3), text white

**Rule 2: Closed (vàng cam)**
- Apply to: `CashbackCycles!$U$2:$U$1000`
- Condition: `=$U2="closed"`
- Format: Background orange (#FF9800), text white

**Rule 3: Settled (xanh lá đậm)**
- Apply to: `CashbackCycles!$U$2:$U$1000`
- Condition: `=$U2="settled"`
- Format: Background green (#4CAF50), text white

### 15.3 Budget capping warning (O vs N)

**Rule: Capped (đỏ)**
- Apply to: `CashbackCycles!$O$2:$O$1000`
- Condition: `=$O2<$N2` (capped < earned)
- Format: Background red (#F44336), text white, bold

### 15.4 Progress bar color scale (T)

**Color Scale:**
- Apply to: `CashbackCycles!$T$2:$T$1000`
- Min (0%): Red (#F44336)
- Mid (50%): Yellow (#FFC107)
- Max (100%): Green (#4CAF50)

---

## 16) Format Notes

### 16.1 Number formats

| Column | Format | Example |
|---|---|---|
| Amount columns (F, K-P) | `#,##0` | 1,000,000 |
| Percent columns (H, T) | `0.00%` | 1.50% |
| Date columns (G, H) | `dd/mm/yyyy` | 01/03/2026 |
| Boolean columns (R, G) | Automatic | TRUE/FALSE |

### 16.2 VND formatting

Tất cả amount columns dùng format:
```
#,##0
```
- Không decimal places
- Thousands separator: comma
- Example: 1000000 → 1,000,000

---

## 17) Troubleshooting

### 17.1 #VALUE! error trong SUMIFS

**Nguyên nhân:** Data type mismatch (text vs number)

**Fix:**
```gs
=SUMIFS(VALUE(Transactions!$F:$F), ...)
```

Hoặc ensure data consistency:
- Check Transactions!F:F toàn numbers
- Remove leading/trailing spaces

### 17.2 SUMIFS returns 0 unexpectedly

**Check:**
1. Cycle_tag format match? (2026-03 vs 2026-3)
2. Status spelling? ("posted" vs "Posted")
3. Account_id exact match?

**Debug formula:**
```gs
=COUNTIFS(
  Transactions!$E:$E, $B2,
  Transactions!$Q:$Q, $D2,
  Transactions!$D:$D, "expense",
  Transactions!$C:$C, "posted"
)
```
→ Should return count > 0

### 17.3 Circular dependency warning

**Nguyên nhân:** Formula references itself directly or indirectly

**Fix:**
- Check formula không reference column chính nó
- Use helper columns nếu cần

### 17.4 MAXIFS/MINIFS not available

Google Sheets hỗ trợ MAXIFS/MINIFS từ 2020. Nếu không có:

**Alternative for MAX:**
```gs
=MAX(FILTER(range, condition1, condition2, ...))
```

**Alternative for MIN:**
```gs
=MIN(FILTER(range, condition1, condition2, ...))
```

### 17.5 Progress bar hiển thị sai

**Check:**
- progress_percent (T) phải là decimal (0.0 - 1.0)
- Nếu đang là percentage (0% - 100%), adjust formula:

```gs
=REPT("▓", ROUND(T2*100/10, 0)) & REPT("░", 10-ROUND(T2*100/10, 0))
```

---

## 18) Checklist kiểm tra sau khi dán formulas

- [ ] spent_amount (K) tính đúng tổng expense transactions
- [ ] real_awarded (L) sum đúng real mode entries
- [ ] virtual_profit (M) sum đúng virtual mode entries
- [ ] total_earned (N) = L + M
- [ ] capped_amount (O) = MIN(N, J) với handling unlimited
- [ ] loss_amount (P) = MAX(0, N - J)
- [ ] remaining_budget (Q) = J - O
- [ ] is_qualified (R) TRUE/FALSE correct
- [ ] remaining_to_qualify (S) = MAX(0, I - K)
- [ ] progress_percent (T) = K / I (với handling divide by zero)
- [ ] start_date (G) correct cho calendar_month và statement_cycle
- [ ] end_date (H) correct cho calendar_month và statement_cycle
- [ ] Conditional formatting applied đúng
- [ ] Number formats đúng (VND #,##0, dates dd/mm/yyyy)
- [ ] No #VALUE!, #REF!, #DIV/0! errors
- [ ] Named ranges defined (optional nhưng recommended)

---

## 19) Sample Data để test

### CashbackCycles sample:

| cycle_id | account_id | account_name | cycle_tag | cycle_type | statement_day | cb_min_spend | cb_max_budget |
|---|---|---|---|---|---|---|---|
| CYCLE_001 | ACC_TCB_001 | Techcombank | 2026-03 | calendar_month | 0 | 3000000 | 500000 |
| CYCLE_002 | ACC_UOB_001 | UOB | 2026-03 | statement_cycle | 25 | 0 | 300000 |
| CYCLE_003 | ACC_VPB_001 | VPBank | 2026-02 | calendar_month | 0 | 5000000 | 200000 |

### CashbackEntries sample:

| entry_id | cycle_id | transaction_id | mode | amount | counts_to_budget | policy_rate | category_name |
|---|---|---|---|---:|---|---:|---|
| ENTRY_001 | CYCLE_001 | TXN_001 | virtual | 5000 | TRUE | 0.01 | Ăn uống |
| ENTRY_002 | CYCLE_001 | TXN_002 | virtual | 12000 | TRUE | 0.01 | Mua sắm |
| ENTRY_003 | CYCLE_001 | TXN_003 | real | 80000 | TRUE | 0.01 | Điện máy |
| ENTRY_004 | CYCLE_002 | TXN_004 | virtual | 2500 | TRUE | 0.005 | Ăn uống |

### Expected Results:

**CYCLE_001 (Techcombank 2026-03):**
- spent_amount: 8,000,000 (giả sử từ Transactions)
- real_awarded: 80,000
- virtual_profit: 17,000
- total_earned: 97,000
- capped_amount: 97,000 (MIN(97k, 500k))
- loss_amount: 0
- is_qualified: TRUE (8M >= 3M)

**CYCLE_002 (UOB 2026-03):**
- spent_amount: 500,000 (giả sử)
- real_awarded: 0
- virtual_profit: 2,500
- total_earned: 2,500
- capped_amount: 2,500
- loss_amount: 0
- is_qualified: TRUE (no min spend)

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-20  
**Author:** Money Flow Team
