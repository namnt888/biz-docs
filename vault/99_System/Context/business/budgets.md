# Budgets — Business Specification

## 1. Tổng quan nghiệp vụ

### Budget là gì trong Money Flow?

Budget (ngân sách) là công cụ lập kế hoạch chi tiêu theo **category** và **chu kỳ thời gian**, giúp người dùng:
- Đặt giới hạn chi tiêu cho từng nhóm (ăn uống, mua sắm, đi lại, v.v.)
- Theo dõi tiến độ chi tiêu so với kế hoạch
- Nhận cảnh báo khi vượt ngân sách
- Phân tích xu hướng chi tiêu qua các kỳ

### Phân biệt Budget vs Cashback Config

| Aspect | Budget | Cashback Config |
|--------|--------|-----------------|
| **Mục đích** | Giới hạn chi tiêu của **người dùng** | Tính toán hoàn tiền từ **ngân hàng** |
| **Áp dụng** | Category (chi tiêu cá nhân) | Account (thẻ tín dụng, ví) |
| **Logic** | Simple threshold | Complex rules, tiers, policies |
| **Output** | Cảnh báo vượt budget | Cashback amount (real/virtual) |

### Khái niệm Budget Cycle

Budget có 2 loại chu kỳ:
- **Monthly**: 01/MM/YYYY → 31/MM/YYYY (phổ biến nhất)
- **Custom**: Người dùng tự định nghĩa start_date và end_date

---

## 2. Budget Role & Ownership

### Budget thuộc về ai?

- **User-level budget**: Mỗi user có thể tạo budget cho chính mình
- **Household budget**: Nhiều người cùng đóng góp vào một budget chung (future feature)

### Budget gắn với entity nào?

```
Budget → Category (many-to-one)
Budget → User/Owner (many-to-one)
Budget → Transactions (one-to-many, qua category + cycle)
```

---

## 3. Thuộc tính cốt lõi

| Field | Kiểu dữ liệu | Bắt buộc | Mô tả |
|-------|-------------|----------|-------|
| `id` | UUID | ✓ | Primary key |
| `name` | TEXT | ✓ | Tên budget (ví dụ: "Ăn uống tháng 3") |
| `category_id` | UUID | ✓ | Link tới category được áp budget |
| `owner_id` | UUID | ✓ | User sở hữu budget này |
| `amount` | DECIMAL(15,2) | ✓ | Số tiền ngân sách (VND) |
| `spent_amount` | DECIMAL(15,2) | - | Số tiền đã chi (computed) |
| `remaining_amount` | DECIMAL(15,2) | - | Số tiền còn lại (= amount - spent) |
| `cycle_type` | TEXT | ✓ | `monthly` hoặc `custom` |
| `start_date` | DATE | ✓ | Ngày bắt đầu chu kỳ |
| `end_date` | DATE | ✓ | Ngày kết thúc chu kỳ |
| `status` | TEXT | ✓ | `active`, `completed`, `exceeded`, `archived` |
| `alert_threshold_percent` | INTEGER | - | % cảnh báo (ví dụ: 80 = cảnh báo khi đạt 80%) |
| `is_rollover` | BOOLEAN | - | Có cộng dồn sang kỳ sau không |
| `rollover_to_budget_id` | UUID | - | Link tới budget kỳ sau (nếu rollover) |
| `notes` | TEXT | - | Ghi chú thêm |
| `created_at` | TIMESTAMPTZ | - | Thời gian tạo |
| `updated_at` | TIMESTAMPTZ | - | Thời gian cập nhật gần nhất |

---

## 4. Budget Status

| Status | Mô tả | Điều kiện | Hành động tiếp theo |
|--------|-------|-----------|---------------------|
| `active` | Đang trong chu kỳ, chưa vượt budget | `spent_amount < amount` AND `current_date <= end_date` | Tiếp tục track transactions |
| `completed` | Đã kết thúc chu kỳ, không vượt budget | `current_date > end_date` AND `spent_amount <= amount` | Archive hoặc tạo kỳ mới |
| `exceeded` | Đã vượt quá ngân sách | `spent_amount > amount` | Cảnh báo user, optional stop tracking |
| `archived` | Đã ẩn, không hiển thị trong UI | User manually archive | Không ảnh hưởng transactions |

### Flow chuyển trạng thái

```
[Created] → active
              ↓
    ┌─────────┴──────────┐
    ↓                    ↓
completed           exceeded
    ↓                    ↓
archived ←──────────────┘
```

---

## 5. Business Rules

### 5.1. Công thức tính spent_amount

```sql
spent_amount = SUM(|transaction.amount|)
WHERE
  transaction.category_id = budget.category_id
  AND transaction.type IN ('expense', 'debt', 'service')
  AND transaction.status != 'void'
  AND transaction.occurred_at BETWEEN budget.start_date AND budget.end_date
  AND transaction.owner_id = budget.owner_id
```

**Lưu ý quan trọng:**
- Chỉ tính expense/debt/service (không tính transfer, income)
- Loại bỏ transactions có status = 'void'
- Dùng absolute value (luôn dương)
- Filter theo owner_id để tránh tính nhầm của người khác

### 5.2. Công thức remaining_amount

```
remaining_amount = MAX(0, amount - spent_amount)
```

**Tại sao dùng MAX(0)?** → Để tránh số âm khi exceeded, thay vào đó hiển thị 0 và status = exceeded.

### 5.3. Alert Threshold

```
is_alert_triggered = (spent_amount / amount) >= (alert_threshold_percent / 100)
```

**Ví dụ:**
- Budget: 5,000,000đ
- Alert threshold: 80%
- Spent: 4,200,000đ → 84% > 80% → Trigger alert

### 5.4. Rollover Logic (cộng dồn)

Nếu `is_rollover = true`:
```
next_period_budget_amount = base_amount + remaining_amount_from_previous
```

**Ví dụ:**
- Tháng 3: Budget 5M, spent 4M → remaining 1M
- Tháng 4: Base 5M + rollover 1M = 6M

**Điều kiện rollover:**
- Chỉ rollover nếu status = completed (không exceeded)
- Chỉ rollover sang kỳ ngay tiếp theo (không cumulative nhiều kỳ)

### 5.5. Budget Overlap Validation

**Rule:** Không cho phép 2 budgets cùng category + cùng owner + overlapping date ranges.

```sql
-- Validation query trước khi create/update
SELECT COUNT(*) FROM budgets
WHERE category_id = NEW.category_id
  AND owner_id = NEW.owner_id
  AND status != 'archived'
  AND (
    (NEW.start_date <= end_date AND NEW.end_date >= start_date)
  )
```

Nếu count > 0 → Reject với error: "Budget for this category already exists in the selected period"

### 5.6. Budget Deletion Rules

- **Soft delete only:** Update status = 'archived', không xóa vật lý
- **Cascade behavior:** Khi budget archived, transactions vẫn giữ nguyên (không bị ảnh hưởng)
- **Validation:** Không thể archive budget đang có status = 'active' (phải wait until end_date hoặc manual complete)

### 5.7. Multiple Budgets per Category

**Không cho phép** cùng 1 category có nhiều budgets active cùng lúc cho cùng 1 owner.

**Ngoại lệ:** 
- Budgets của các kỳ khác nhau (tháng 3 vs tháng 4) → OK
- Budgets của 2 owners khác nhau cho cùng 1 category → OK

---

## 6. Quan hệ dữ liệu

### 6.1. Budget → Category

```
Budget (many) → Category (one)
```

- Một category có thể có nhiều budgets (các kỳ khác nhau)
- Một budget chỉ thuộc về 1 category duy nhất

### 6.2. Budget → User/Owner

```
Budget (many) → User (one)
```

- Mỗi budget thuộc về đúng 1 user
- User có thể xem budgets của người khác nếu được share (future feature)

### 6.3. Budget → Transactions

```
Budget (one) → Transactions (many)
```

- Transactions được link gián tiếp qua:
  - `category_id` match
  - `owner_id` match
  - `occurred_at` trong range [start_date, end_date]

### 6.4. Budget → Budget (Rollover)

```
Budget (one) → Budget (one, optional)
via rollover_to_budget_id
```

- Link từ budget kỳ trước sang kỳ sau
- Chỉ tồn tại nếu `is_rollover = true`

---

## 7. Google Sheets Column Mapping

### Tab `Budgets`

| Column | Field | Formula/Notes |
|--------|-------|---------------|
| A | id | UUID (hidden) |
| B | name | Tên budget |
| C | category_id | UUID (link tới Categories!A) |
| D | category_name | `=VLOOKUP(C2, Categories!$A:$B, 2, FALSE)` |
| E | owner_id | UUID (link tới People!A) |
| F | owner_name | `=VLOOKUP(E2, People!$A:$B, 2, FALSE)` |
| G | amount | Số tiền ngân sách (format: `#,##0`) |
| H | spent_amount | `=SUMIFS(Transactions!$C:$C, Transactions!$D:$D, C2, Transactions!$E:$E, E2, Transactions!$F:$F, ">="&I2, Transactions!$F:$F, "<="&J2, Transactions!$G:$G, "expense")` |
| I | start_date | Ngày bắt đầu |
| J | end_date | Ngày kết thúc |
| K | remaining_amount | `=MAX(0, G2-H2)` |
| L | utilization_percent | `=IF(G2>0, H2/G2, 0)` (format: percentage) |
| M | status | `=IF(TODAY()>J2, IF(H2<=G2, "completed", "exceeded"), IF(H2>G2, "exceeded", "active"))` |
| N | alert_threshold_percent | Ngưỡng cảnh báo (%) |
| O | is_alert_triggered | `=IF(L2>=N2/100, "⚠️ ALERT", "")` |
| P | is_rollover | TRUE/FALSE |
| Q | rollover_to_budget_id | UUID kỳ sau |
| R | notes | Ghi chú |

### Tab liên kết

- **Categories**: Chứa danh mục category (id, name, type, icon, color)
- **People**: Chứa owner information (id, name, role)
- **Transactions**: Source of truth cho spent_amount calculation

---

## 8. Ví dụ thực tế

### Example 1: Budget Ăn Uống Tháng 3/2026

```
Name: "Ăn uống - Tháng 3/2026"
Category: Ăn uống (ID: cat_food_001)
Owner: Nam (ID: person_nam_001)
Amount: 5,000,000đ
Cycle: 01/03/2026 → 31/03/2026
Alert threshold: 80%

Transactions trong kỳ:
- 05/03: Ăn trưa 150,000đ
- 07/03: Đi siêu thị 850,000đ
- 12/03: Ăn tối với bạn 320,000đ
- 15/03: Cafe 45,000đ
- 20/03: Ăn gia đình 1,200,000đ
Total spent: 2,565,000đ

Calculations:
- Remaining: 5,000,000 - 2,565,000 = 2,435,000đ
- Utilization: 2,565,000 / 5,000,000 = 51.3%
- Status: active (chưa đến 31/03)
- Alert: KHÔNG trigger (51.3% < 80%)
```

### Example 2: Budget Mua Sắm Bị Vượt

```
Name: "Mua sắm - Tháng 3/2026"
Category: Mua sắm (ID: cat_shopping_001)
Owner: Linh (ID: person_linh_001)
Amount: 3,000,000đ
Cycle: 01/03/2026 → 31/03/2026
Alert threshold: 75%

Transactions:
- 10/03: Mua quần áo 1,800,000đ
- 18/03: Mua giày 950,000đ
- 25/03: Mua túi xách 600,000đ
Total spent: 3,350,000đ

Calculations:
- Remaining: MAX(0, 3,000,000 - 3,350,000) = 0đ
- Utilization: 3,350,000 / 3,000,000 = 111.7%
- Status: exceeded (spent > amount)
- Alert: ĐÃ trigger (111.7% > 75%)
```

### Example 3: Budget Rollover

```
Tháng 2/2026:
- Name: "Đi lại - Tháng 2/2026"
- Amount: 2,000,000đ
- Spent: 1,600,000đ
- Remaining: 400,000đ
- Status: completed (hết tháng)
- is_rollover: TRUE
- rollover_to_budget_id: [UUID của budget tháng 3]

Tháng 3/2026:
- Name: "Đi lại - Tháng 3/2026"
- Base amount: 2,000,000đ
- Rollover from Feb: 400,000đ
- Effective amount: 2,400,000đ
```

---

## 9. Edge Cases

### 9.1. Transaction được thêm retroactively

**Scenario:** Budget tháng 3 đã closed (status = completed), sau đó user thêm transaction với occurred_at = 15/03/2026.

**Xử lý:**
- Recalculate spent_amount của budget tháng 3
- Nếu spent_amount mới > amount → Update status = exceeded
- Send notification cho user: "Budget [name] đã vượt sau khi thêm transaction ngày [date]"

### 9.2. Category bị đổi tên hoặc archived

**Scenario:** Category "Ăn uống" được rename thành "Ăn uống & Giải trí" hoặc bị archived.

**Xử lý:**
- Budget vẫn giữ category_id cũ (không break link)
- Khi hiển thị, dùng category name tại thời điểm hiện tại
- Nếu category archived: Warning badge trên budget, nhưng không tự động archive budget

### 9.3. Owner bị xóa hoặc archived

**Scenario:** Person (owner) bị archive hoặc delete.

**Xử lý:**
- Soft delete only: Budget vẫn tồn tại, status chuyển sang archived
- Hiển thị "Owner no longer available" thay vì tên
- Không cho phép create budget mới cho owner đã archived

### 9.4. Timezone issues

**Scenario:** User ở múi giờ khác (VN vs US), transaction xảy ra lúc 23:30 31/03 VN nhưng là 01/04 US.

**Xử lý:**
- Lưu trữ occurred_at dưới dạng UTC
- Khi filter theo budget cycle, convert sang timezone của user
- Consistent rule: "Ngày giao dịch" = ngày theo giờ Việt Nam (UTC+7)

### 9.5. Budget created mid-cycle

**Scenario:** Hôm nay là 15/03, user tạo budget với cycle 01/03 → 31/03.

**Xử lý:**
- Allowed: User có thể tạo budget cho kỳ đang diễn ra
- spent_amount sẽ include tất cả transactions từ 01/03 (retroactively)
- Warning message: "Budget được tạo giữa kỳ, spent_amount sẽ bao gồm transactions từ đầu kỳ"

### 9.6. Negative spending (refunds)

**Scenario:** User mua hàng 500k, sau đó refund 200k trong cùng budget cycle.

**Xử lý:**
- Refund transaction có type = 'refund' hoặc amount âm
- spent_amount = SUM(expense amounts) - SUM(refund amounts)
- Đảm bảo spent_amount không âm: `MAX(0, calculated_spent)`

---

## 10. Checklist cho Agent/Codegen

### Schema & Types

- [ ] Định nghĩa Budget interface/type với đầy đủ 17 fields
- [ ] Tạo enum `BudgetStatus` = ['active', 'completed', 'exceeded', 'archived']
- [ ] Tạo enum `BudgetCycleType` = ['monthly', 'custom']
- [ ] Database migration: CREATE TABLE budgets với indexes phù hợp
- [ ] Indexes: (category_id, owner_id, start_date, end_date, status)

### Business Logic

- [ ] Implement spent_amount calculation function (exclude void, internal transfers)
- [ ] Implement remaining_amount formula với MAX(0, ...)
- [ ] Implement alert threshold check
- [ ] Implement rollover logic (tạo budget mới với amount = base + remaining)
- [ ] Implement overlap validation trước khi create/update
- [ ] Implement soft delete (archive) thay vì hard delete

### API/Server Actions

- [ ] `createBudget(input)`: Validate overlap, create new budget
- [ ] `updateBudget(id, input)`: Recalculate spent_amount nếu dates/categories thay đổi
- [ ] `archiveBudget(id)`: Set status = archived, validate không phải active
- [ ] `getBudgetsByOwner(ownerId, filters)`: Filter by status, date range, category
- [ ] `getBudgetById(id)`: Include computed fields (spent, remaining, utilization)
- [ ] `recalculateBudgetSpent(budgetId)`: Manual trigger recalculation

### UI Components

- [ ] BudgetCard component: Hiển thị name, amount, spent, remaining, progress bar
- [ ] BudgetProgressBar: Visual progress bar với màu sắc theo status (xanh/vàng/đỏ)
- [ ] BudgetAlertBadge: Hiển thị ⚠️ khi vượt threshold
- [ ] BudgetForm: Create/edit form với validation
- [ ] BudgetList: Danh sách budgets với filter theo status/category/month
- [ ] BudgetDetailView: Chi tiết budget + list transactions trong kỳ

### Google Sheets Integration

- [ ] Export budgets tab với đầy đủ columns mapping
- [ ] Formula cho spent_amount (SUMIFS với multiple criteria)
- [ ] Formula cho status (nested IF logic)
- [ ] Conditional formatting: Xanh (active), Vàng (gần vượt), Đỏ (exceeded)
- [ ] Named ranges cho các công thức quan trọng

### Testing

- [ ] Unit test: spent_amount calculation với various transaction types
- [ ] Unit test: overlap validation (positive & negative cases)
- [ ] Integration test: create budget → add transaction → verify spent_amount updates
- [ ] Edge case test: refund handling, retroactive transactions, timezone
- [ ] Performance test: Query budgets với large dataset (1000+ transactions)

---

## 11. Summary Formulas (cho Dashboard)

### Total Budget Overview

```
Tổng ngân sách tháng này: =SUMIFS(Budgets!G:G, Budgets!I:I, "<="&TODAY(), Budgets!J:J, ">="&TODAY(), Budgets!M:M, "active")
Tổng đã chi: =SUMIFS(Budgets!H:H, Budgets!I:I, "<="&TODAY(), Budgets!J:J, ">="&TODAY(), Budgets!M:M, "active")
Tổng còn lại: =SUMIFS(Budgets!K:K, Budgets!I:I, "<="&TODAY(), Budgets!J:J, ">="&TODAY(), Budgets!M:M, "active")
```

### Budget Health Score

```
=BVERAGEIFS(Budgets!L:L, Budgets!M:M, "active")
→ Trung bình % utilization của tất cả active budgets
→ Score tốt: 50-80%, Quá thấp: <30% (chưa tận dụng), Quá cao: >90% (rủi ro vượt)
```

### Top Overspent Categories

```
=FILTER(Budgets!D:D, Budgets!M:M="exceeded")
→ List các category đang vượt budget
```

---

## 12. Tài liệu tham khảo

- `docs/business/accounts.md`: Hiểu account structure
- `docs/business/transactions.md`: Hiểu transaction types và cách filter
- `docs/business/cashback.md`: So sánh cashback cycles vs budget cycles
- `database/latest_schema.sql`: Schema definition cho budgets table
- `src/lib/budget.ts` (nếu có): Implementation details

