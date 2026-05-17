# Đặc tả nghiệp vụ: Cashback

## 1) Tổng quan nghiệp vụ

**Cashback** (Hoàn tiền) là thực thể ghi nhận các khoản tiền hoàn từ thẻ tín dụng, ví điện tử, hoặc chương trình khuyến mãi trong hệ thống Money Flow.

### Mục đích
- Track hoàn tiền từ thẻ tín dụng (Techcombank, UOB, VPBank, v.v.)
- Track hoàn tiền từ ví điện tử (MoMo, ZaloPay, v.v.)
- Track chương trình khuyến mãi có cơ chế hoàn tiền
- Tính toán projection cashback dựa trên chi tiêu thực tế
- Quản lý ngân sách cashback theo chu kỳ (cycle)

### Khái niệm Cashback Cycle (Chu kỳ)

Mỗi account có cashback được tổ chức theo **chu kỳ (cycle)**:
- **Calendar Month**: Chu kỳ theo tháng dương lịch (01/MM → cuối tháng)
- **Statement Cycle**: Chu kỳ theo kỳ sao kê thẻ (ví dụ: 25/MM → 24/MM+1)

Mỗi cycle có:
- Tag định danh: `YYYY-MM` format (ví dụ: `2026-03`)
- spent_amount: Tổng chi tiêu trong cycle
- real_awarded: Cashback thực tế đã nhận
- virtual_profit: Cashback ảo tính theo policy (projection)
- max_budget: Ngân sách cashback tối đa per cycle
- min_spend_target: Mức chi tối thiểu để qualify cashback

---

## 2) Cashback Cycle Types

| Loại | Giá trị | Date Range | Ví dụ |
|---|---|---|---|
| Calendar Month | `calendar_month` | 01/MM/YYYY → Last day of MM/YYYY | 2026-03: 01/03/2026 → 31/03/2026 |
| Statement Cycle | `statement_cycle` | (statement_day+1)/MM-1 → statement_day/MM | statement_day=25, tag=2026-03: 25/02/2026 → 24/03/2026 |

### statement_day field
- Kiểu: Integer (1-31) hoặc 0/null
- Ý nghĩa: Ngày sao kê hàng tháng
- Khi `statement_day = 0` hoặc `null`: Áp dụng calendar_month
- Khi `statement_day = 1-31`: Áp dụng statement_cycle

### Cycle tag format
- **Format chuẩn**: `YYYY-MM` (ISO 8601 month)
- **Ví dụ**: `2026-03`, `2025-12`, `2026-01`
- **Lưu ý**: Cả 2 loại cycle đều dùng cùng format tag, chỉ khác date range calculation

---

## 3) Cashback Mode

Giá trị chuẩn cho `cashback_mode` trong transactions:

| Mode | Ý nghĩa | Khi nào dùng | Calculation |
|---|---|---|---|
| `none_back` | Không chia sẻ cashback | Mặc định, không share với ai | Virtual projection only |
| `percent` | Chia sẻ theo % | Chi tiêu cho người khác, share % cashback | amount × share_percent |
| `fixed` | Chia sẻ số cố định | Chi tiêu cho người khác, share số tiền cố định | cashback_share_fixed |
| `real_fixed` | Real cashback cố định | Đã biết chính xác số cashback thực tế | Stored as real_awarded |
| `real_percent` | Real cashback theo % | Cashback thực tế tính theo % cố định | amount × share_percent → real_awarded |
| `voluntary` | Tự nguyện cho cashback | Voluntarily give cashback to someone | Not counted to budget |

### Chi tiết từng mode

#### `none_back` (Default)
- Không có cashback sharing
- Virtual profit calculated from policy rate
- Counts to budget: YES
- Example: Đi ăn trưa một mình, cashback về chủ thẻ

#### `percent`
- Virtual cashback với % chia sẻ
- Formula: `amount × cashback_share_percent`
- Counts to budget: YES
- Example: Thẻ của Nam nhưng đi ăn với Linh, share 50% cashback cho Linh

#### `fixed`
- Virtual cashback với số tiền cố định
- Value: `cashback_share_fixed`
- Counts to budget: YES
- Example: Share cố định 10,000đ cashback cho bạn

#### `real_fixed`
- Real cashback đã biết chính xác
- Stored directly in `real_awarded`
- Counts to budget: YES
- Example: Techcombank báo về 85,000đ cashback thực tế

#### `real_percent`
- Real cashback tính theo %
- Formula: `amount × cashback_share_percent`
- Stored in `real_awarded`
- Counts to budget: YES
- Example: UOB hoàn 1.5% thực tế trên giao dịch 5M = 75,000đ

#### `voluntary`
- Tự nguyện cho cashback (không phải obligation)
- NOT counted to budget cap
- Example: Thưởng cashback cho thành viên trong gia đình

---

## 4) Thuộc tính cốt lõi của CashbackCycle

| Field | Kiểu dữ liệu | Mô tả | Bắt buộc |
|---|---|---|---|
| `id` | UUID | Định danh duy nhất của cycle | Có |
| `account_id` | UUID | ID account sở hữu cycle | Có |
| `cycle_tag` | String | Tag chu kỳ (YYYY-MM format) | Có |
| `cycle_type` | Enum | `calendar_month` hoặc `statement_cycle` | Có |
| `statement_day` | Integer | Ngày sao kê (0-31, 0=null) | Không |
| `cb_min_spend` | Integer (VND) | Mức chi tối thiểu để qualify | Không |
| `cb_max_budget` | Integer (VND) | Ngân sách cashback tối đa per cycle | Không |
| `cb_percent` | Decimal | Tỷ lệ cashback % (legacy) | Không |
| `cb_fixed` | Integer | Số tiền cashback cố định (legacy) | Không |
| `spent_amount` | Integer (VND) | Tổng chi tiêu trong cycle | Formula |
| `real_awarded` | Integer (VND) | Cashback thực tế đã nhận | Formula |
| `virtual_profit` | Integer (VND) | Cashback ảo (projection) | Formula |
| `capped_amount` | Integer (VND) | Cashback sau khi apply cap | Formula |
| `loss_amount` | Integer (VND) | Số tiền bị mất do vượt budget | Formula |
| `status` | Enum | `active/closed/settled` | Có |
| `is_qualified` | Boolean | Đạt min spend chưa | Formula |
| `created_at` | Timestamp | Thời điểm tạo cycle | System |
| `updated_at` | Timestamp | Thời điểm cập nhật gần nhất | System |

### Fields tính toán (Formula-only)

| Field | Công thức |
|---|---|
| `spent_amount` | `=SUMIFS(Transactions!amount, Transactions!account_id, [@account_id], Transactions!cycle_tag, [@cycle_tag], Transactions!type, "expense", Transactions!status, "posted")` |
| `real_awarded` | `=SUMIFS(CashbackEntries!amount, CashbackEntries!cycle_id, [@id], CashbackEntries!mode, "real")` |
| `virtual_profit` | `=SUMIFS(CashbackEntries!amount, CashbackEntries!cycle_id, [@id], CashbackEntries!mode, "virtual")` |
| `total_earned` | `=[@real_awarded] + [@virtual_profit]` |
| `capped_amount` | `=MIN([@total_earned], [@cb_max_budget])` |
| `loss_amount` | `=MAX(0, [@total_earned] - [@cb_max_budget])` |
| `is_qualified` | `=OR([@spent_amount]>=[@cb_min_spend], [@cb_min_spend]=0, [@cb_min_spend]="")` |
| `remaining_budget` | `=MAX(0, [@cb_max_budget] - [@capped_amount])` |

---

## 5) Quy tắc nghiệp vụ bắt buộc

### 5.1 Công thức tính spent_amount

```
spent_amount = SUM(|transaction.amount|)
WHERE
  account_id = target_account
  AND type IN ('expense', 'debt', 'service')
  AND status = 'posted'
  AND persisted_cycle_tag = cycle_tag
  AND note NOT LIKE '%create initial%'
  AND note NOT LIKE '%số dư đầu%'
  AND note NOT LIKE '%opening balance%'
  AND note NOT LIKE '%rollover%'
  AND category.kind != 'internal'
```

**Loại trừ:**
- Giao dịch có note chứa "create initial", "số dư đầu", "opening balance", "rollover"
- Giao dịch internal transfer (category.kind = 'internal')
- Giao dịch status = 'void'
- Giao dịch type = 'transfer_in', 'transfer_out', 'income', 'repayment'

### 5.2 Công thức tính final_cashback

```
total_earned = real_awarded + virtual_profit
final_cashback = MIN(total_earned, cb_max_budget)
```

**Trong đó:**
- `real_awarded`: Σ(cashback_entries.amount where mode = 'real')
- `virtual_profit`: Σ(cashback_entries.amount where mode = 'virtual')
- `cb_max_budget`: Giới hạn tối đa từ account config (có thể null = unlimited)

### 5.3 Min Spend Gate

```
is_qualified = (spent_amount >= cb_min_spend) OR (cb_min_spend IS NULL) OR (cb_min_spend = 0)
```

**Khi NOT qualified:**
- UI hiển thị badge vàng "Need to Spend XYZ"
- Policy rates có thể degrade về program default (tùy config)
- Cycle entry vẫn được tạo nhưng flag `met_min_spend = false`

**Remaining to qualify:**
```
remaining_to_qualify = MAX(0, cb_min_spend - spent_amount)
```

### 5.4 Budget Capping

```
capped_amount = MIN(total_earned, cb_max_budget)
loss_amount = MAX(0, total_earned - cb_max_budget)
```

**Overflow handling:**
- Capped amount được lưu vào cycle snapshot
- Loss amount được track nhưng chưa hiển thị trong UI
- Voluntary mode entries KHÔNG bị capping

### 5.5 Cashback credit về account nào

- Cashback luôn credit về **chính account phát sinh giao dịch**
- Example: Giao dịch expense từ Techcombank → cashback về Techcombank
- Không thể chọn account đích khác cho cashback

### 5.6 Cycle không overlap

- Không được tồn tại 2 cycles cùng `account_id + cycle_tag`
- Unique constraint: `(account_id, cycle_tag)`
- Khi insert cycle mới, phải check trùng tag trước

### 5.7 Transaction exclusion rules

Các transaction sau KHÔNG tính vào spent_amount:
- Note chứa: "create initial", "số dư đầu", "opening balance", "rollover"
- Category kind = 'internal'
- Status = 'void'
- Type NOT IN ('expense', 'debt', 'service')

### 5.8 Cashback entry modes

| Mode | Counts to budget | Recalculated | Use case |
|---|---|---|---|
| real | YES | NO | User đã nhập cashback thực tế |
| virtual | YES | YES | Projection dựa trên policy |
| voluntary | NO | NO | Tự nguyện cho, không bắt buộc |

---

## 6) Cashback Share (Chia sẻ cashback)

### cashback_share_percent
- Kiểu: Decimal (0.0 - 1.0)
- Ý nghĩa: Tỷ lệ % cashback chia cho người khác
- Example: 0.5 = 50% cashback share
- Applies to modes: `percent`, `real_percent`

### cashback_share_fixed
- Kiểu: Integer (VND)
- Ý nghĩa: Số tiền cashback cố định chia cho người khác
- Example: 10000 = 10,000đ share
- Applies to modes: `fixed`, `real_fixed`

### Ai được nhận cashback khi có share?
- Người được chỉ định trong `person_id` của transaction
- Cashback share không làm giảm cashback của chủ thẻ
- Example: Thẻ của Nam, chi 1M, share 50% cho Linh → Nam vẫn được tính 10k cashback (1%), Linh được 5k từ Nam

### Ví dụ thực tế

**Scenario 1: Thẻ của A nhưng chi tiêu cho B**
```
Transaction:
- account_id: ACC_TCB_NAM (thẻ của Nam)
- amount: 1,000,000
- person_id: PER_LINH (đi với Linh)
- cashback_mode: percent
- cashback_share_percent: 0.5 (50%)
- policy_rate: 0.01 (1%)

Result:
- Total cashback: 1,000,000 × 1% = 10,000đ
- Nam's share: 10,000đ (vẫn về thẻ Nam)
- Linh's share: 10,000 × 50% = 5,000đ (Nam chuyển cho Linh)
```

**Scenario 2: Real cashback cố định**
```
Transaction:
- account_id: ACC_UOB_HUNG
- amount: 5,000,000
- cashback_mode: real_fixed
- cashback_share_fixed: 75000 (UOB báo về 75k thực tế)

Result:
- real_awarded: 75,000đ (stored directly)
- Không recalculated từ policy
```

---

## 7) Cycle Status

| Status | Ý nghĩa | Điều kiện | UI Badge |
|---|---|---|---|
| `active` | Đang trong chu kỳ | Current date within cycle range | 🟢 Xanh |
| `closed` | Đã kết thúc, chờ cashback thực tế | Current date > cycle end date AND real_awarded = 0 | 🟡 Vàng |
| `settled` | Đã nhận cashback thực tế | real_awarded > 0 OR user manually settled | 🔵 Xanh dương |

### Điều kiện chuyển trạng thái

```
active → closed:
  WHEN current_date > cycle_end_date AND real_awarded = 0

closed → settled:
  WHEN real_awarded > 0 (ngân hàng báo cashback về)
  OR user manually marks as settled

active → settled:
  WHEN real_awarded > 0 (trong trường hợp early settlement)
```

---

## 8) Vòng đời cycle

### Diagram dạng text

```text
[New Cycle Created]
        ↓
    active ──────────────┐
        ↓                │
  (cycle ends)           │
        ↓                │
    closed ──────────────┤
        ↓                │
  (cashback received)    │
        ↓                │
   settled ←─────────────┘
        ↓
 [Archive after N months]
```

### Khi nào tạo cycle mới?
- Tự động tạo khi có transaction đầu tiên trong chu kỳ mới
- Hoặc tạo preemptively khi vào trang account details
- Check tồn tại cycle trước khi insert (race condition handling)

### Khi nào đóng cycle?
- Khi current_date > cycle_end_date
- Hoặc user manually close cycle
- Khi đóng cycle, spent_amount được freeze

### Khi nào settle (nhận cashback thực tế)?
- Khi ngân hàng báo cashback về (user nhập manual hoặc sync tự động)
- User nhập `real_awarded` amount
- Status chuyển sang `settled`

---

## 9) Quan hệ dữ liệu

### 9.1 CashbackCycle → Account
- **ManyToOne**: Nhiều cycles thuộc về 1 account
- Foreign key: `account_id`
- Account config quyết định: cb_max_budget, cb_min_spend, cycle_type, statement_day

### 9.2 CashbackCycle → Transactions
- **OneToMany**: 1 cycle chứa nhiều transactions
- Link qua: `transactions.persisted_cycle_tag = cashback_cycles.cycle_tag`
- Chỉ tính transactions: expense, debt, service (posted status)

### 9.3 CashbackCycle → CashbackEntries
- **OneToMany**: 1 cycle chứa nhiều cashback entries
- Foreign key: `cashback_entries.cycle_id`
- Entries phân loại theo mode: real, virtual, voluntary

### 9.4 CashbackCycle → People (indirect)
- **Indirect ManyToMany**: Qua cashback_entries và transactions
- Person nhận cashback share qua `transactions.person_id`
- Track total cashback given to each person

### 9.5 CashbackEntries → Transactions
- **ManyToOne**: Nhiều entries có thể link 1 transaction (hiếm)
- Foreign key: `cashback_entries.transaction_id`
- Mode và amount được xác định từ transaction config

---

## 10) Google Sheets column mapping

### Tab `CashbackCycles` — Master cycle tracking

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

### Tab `CashbackEntries` — Chi tiết cashback entries

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

### Tab `People` — Link với cashback share

| Cột | Tên cột | Field | Ví dụ dữ liệu |
|---|---|---|---|
| A | `person_id` | person_id | PER_001, PER_002 |
| B | `person_name` | person_name | Nam, Linh, Hùng |
| C | `total_cashback_received` | total_cashback_received | Formula |
| D | `last_cashback_date` | last_cashback_date | Formula |
| E | `favorite` | favorite | TRUE/FALSE |

---

## 11) Ví dụ thực tế

### 11.1 Thẻ Techcombank cashback 1% tối đa 500k/tháng, min spend 3M

**Account Config:**
```
account_id: ACC_TCB_001
account_name: Techcombank
cb_type: simple
cb_base_rate: 0.01 (1%)
cb_max_budget: 500000 (500k)
cb_min_spend: 3000000 (3M)
cb_cycle_type: calendar_month
statement_day: 0
```

**Cycle tháng 3/2026:**
```
cycle_id: CYCLE_TCB_2026_03
cycle_tag: 2026-03
cycle_type: calendar_month
start_date: 01/03/2026
end_date: 31/03/2026
```

**Transactions trong cycle:**
| Date | Amount | Category | Note |
|---|---|---|---|
| 05/03/2026 | 500,000 | Ăn uống | Ăn trưa |
| 10/03/2026 | 1,200,000 | Mua sắm | Mua áo |
| 15/03/2026 | 800,000 | Xăng xe | Đổ xăng |
| 20/03/2026 | 2,500,000 | Điện máy | Mua quạt |
| 25/03/2026 | 3,000,000 | Du lịch | Đặt tour |

**Tính toán:**
```
spent_amount = 500k + 1.2M + 800k + 2.5M + 3M = 8,000,000đ
min_spend_target = 3,000,000đ
→ is_qualified = TRUE (8M >= 3M)

virtual_profit = 8,000,000 × 1% = 80,000đ
real_awarded = 0 (chưa có cashback thực tế)
total_earned = 0 + 80,000 = 80,000đ
cb_max_budget = 500,000đ
capped_amount = MIN(80,000, 500,000) = 80,000đ
loss_amount = MAX(0, 80,000 - 500,000) = 0đ (không bị capping)
remaining_budget = 500,000 - 80,000 = 420,000đ
```

**UI Display:**
```
💳 Earned This Cycle: 80,000 ₫
📊 Remaining Budget: 420,000 ₫ (out of 500,000 ₫)
✅ Min Spend Met: 8,000,000 / 3,000,000 ₫
📈 Projection: 80,000 × 4 = 320,000 ₫/year at current rate
```

### 11.2 Thẻ UOB statement cycle 25/02 - 24/03/2026

**Account Config:**
```
account_id: ACC_UOB_001
account_name: UOB
cb_type: tiered
cb_base_rate: 0.005 (0.5%)
cb_max_budget: 300000 (300k)
cb_min_spend: 0 (no min spend)
cb_cycle_type: statement_cycle
statement_day: 25
```

**Cycle tag 2026-03:**
```
cycle_tag: 2026-03
cycle_type: statement_cycle
statement_day: 25
start_date: 25/02/2026 (ngày 25 tháng trước)
end_date: 24/03/2026 (ngày 25 tháng hiện tại - 1 ngày)
```

**Tính date range từ statement_day:**
```
IF cycle_type = 'statement_cycle':
  start_date = DATE(YEAR(tag), MONTH(tag)-1, statement_day)
  end_date = DATE(YEAR(tag), MONTH(tag), statement_day) - 1
ELSE:
  start_date = DATE(YEAR(tag), MONTH(tag), 1)
  end_date = EOMONTH(start_date, 0)
```

### 11.3 Budget capping scenario

**Scenario:** Chi tiêu vượt budget cap

```
Account Config:
- cb_max_budget: 200,000đ (200k)
- cb_base_rate: 1%

Transactions:
- Total spent: 30,000,000đ (30M)
- virtual_profit: 30M × 1% = 300,000đ

Calculation:
- total_earned: 300,000đ
- capped_amount: MIN(300,000, 200,000) = 200,000đ
- loss_amount: 300,000 - 200,000 = 100,000đ (bị mất!)
- remaining_budget: 0đ

UI Warning:
⚠️ Budget Capped! You earned 300,000đ but only get 200,000đ
💸 Lost 100,000đ due to monthly cap
```

### 11.4 Min spend not met scenario

```
Account Config:
- cb_min_spend: 5,000,000đ (5M)
- cb_base_rate: 1%

Current State:
- spent_amount: 3,500,000đ (3.5M)

Calculation:
- is_qualified: FALSE (3.5M < 5M)
- remaining_to_qualify: 5M - 3.5M = 1,500,000đ

UI Display:
⚠️ Need to Spend: 1,500,000 ₫ more to qualify for cashback
📊 Current Spend: 3,500,000 ₫ / 5,000,000 ₫
```

---

## 12) Edge cases

### 12.1 Chi tiêu dưới ngưỡng min_spend

**Problem:** spent_amount < cb_min_spend

**Handling:**
- `is_qualified = FALSE`
- UI hiển thị badge vàng "Need to Spend XYZ"
- Cashback rate có thể reduce về program default (tùy config)
- Vẫn track virtual_profit nhưng flag là "not qualified"

**Formula:**
```gs
=IF(K2>=I2, TRUE, IF(I2=0, TRUE, FALSE))
// K2 = spent_amount, I2 = cb_min_spend
```

### 12.2 Chi tiêu vượt budget cap

**Problem:** total_earned > cb_max_budget

**Handling:**
- `capped_amount = cb_max_budget`
- `loss_amount = total_earned - cb_max_budget`
- UI cảnh báo đỏ "Budget Capped"
- Loss amount được track để user biết đã mất bao nhiêu

**Formula:**
```gs
capped_amount: =MIN(N2, J2)  // N2=total_earned, J2=cb_max_budget
loss_amount: =MAX(0, N2-J2)
```

### 12.3 Cashback chia cho nhiều người

**Problem:** Một transaction share cashback cho nhiều people

**Handling:**
- Hiện tại chỉ support 1 person_id per transaction
- Muốn share cho nhiều người: tách thành nhiều transactions con
- Hoặc dùng metadata JSON để lưu danh sách shares

**Metadata format:**
```json
{
  "cashback_shares": [
    {"person_id": "PER_001", "percent": 0.5},
    {"person_id": "PER_002", "percent": 0.3},
    {"person_id": "PER_003", "percent": 0.2}
  ]
}
```

### 12.4 Cycle bị điều chỉnh retroactively

**Problem:** User thêm transaction vào cycle đã closed

**Handling:**
- Khi transaction mới được thêm vào cycle cũ → trigger recompute
- `recomputeCashbackCycle()` được gọi tự động
- spent_amount, real_awarded, virtual_profit được recalculated
- Status có thể chuyển từ `closed` về `active` nếu cần

**Best Practice:**
- Lock cycle sau N ngày kể từ end_date
- Require manual override để edit locked cycle

### 12.5 Transaction được thêm vào cycle đã closed

**Problem:** Transaction date thuộc cycle đã closed/settled

**Scenarios:**
1. **Closed但未settled**: Recompute bình thường
2. **Settled**: Cảnh báo user, require confirmation
3. **Archived**: Block hoàn toàn, không cho phép

**Workflow:**
```
IF cycle.status = 'settled':
  SHOW warning: "Adding transaction to settled cycle will recalculate cashback. Continue?"
  IF user confirms:
    recomputeCashbackCycle()
    UPDATE cycle.status = 'active' (temporary)
ELSE IF cycle.status = 'archived':
  SHOW error: "Cannot modify archived cycle"
ELSE:
  recomputeCashbackCycle() normally
```

### 12.6 Interest-bearing cashback (future)

**Problem:** Cashback có lãi suất nếu không rút

**Future Enhancement:**
- Thêm field `interest_rate` vào cycle
- Tính interest từ settlement date đến withdrawal date
- `total_withdrawable = capped_amount + interest`

---

## 13) Checklist cho Agent/codegen

### Data Model
- [ ] CashbackCycle entity có đầy đủ fields: id, account_id, cycle_tag, cycle_type, statement_day, spent_amount, real_awarded, virtual_profit, capped_amount, loss_amount, status, is_qualified
- [ ] CashbackEntry entity có: id, cycle_id, transaction_id, mode, amount, counts_to_budget, metadata
- [ ] Unique constraint: (account_id, cycle_tag) trên CashbackCycle
- [ ] Index: (account_id, cycle_tag) cho fast lookup
- [ ] Index: (cycle_id, mode) cho aggregation

### Business Logic
- [ ] spent_amount calculation exclude: initial balance, internal transfers, void transactions
- [ ] final_cashback = MIN(real_awarded + virtual_profit, cb_max_budget)
- [ ] is_qualified = spent_amount >= cb_min_spend OR cb_min_spend IS NULL
- [ ] Auto-update cycle status based on date and real_awarded
- [ ] Trigger recompute when transaction added/updated/deleted
- [ ] Handle race condition when creating cycle (check-then-insert)

### Cashback Modes
- [ ] none_back: virtual projection only, no sharing
- [ ] percent: virtual × share_percent
- [ ] fixed: fixed amount sharing
- [ ] real_fixed: stored as real_awarded
- [ ] real_percent: amount × share_percent → real_awarded
- [ ] voluntary: not counted to budget

### Cycle Types
- [ ] calendar_month: 1st → last day of month
- [ ] statement_cycle: statement_day(prev month) → statement_day(current month) - 1
- [ ] Correctly calculate start_date and end_date from cycle_tag and statement_day

### Google Sheets Integration
- [ ] Tab CashbackCycles với đầy đủ columns A-X
- [ ] Tab CashbackEntries với columns A-L
- [ ] Formulas cho: spent_amount, real_awarded, virtual_profit, capped_amount, loss_amount
- [ ] Formulas cho: is_qualified, remaining_to_qualify, progress_percent
- [ ] Conditional formatting: qualified (xanh), not qualified (vàng), capped (đỏ)

### Edge Cases
- [ ] Handle over-spending (budget cap)
- [ ] Handle under-spending (min spend gate)
- [ ] Handle multiple debts per person
- [ ] Handle retroactive transaction additions
- [ ] Handle settled cycle modifications

### API/Service Layer
- [ ] upsertTransactionCashback(transaction) function
- [ ] recomputeCashbackCycle(cycleId) function
- [ ] getAccountSpendingStats(accountId, date) function
- [ ] getCashbackCycleOptions(accountId, limit) function
- [ ] Proper error handling for race conditions

### UI/UX
- [ ] Display min spend badge when not qualified
- [ ] Display budget cap warning when capped
- [ ] Show progress bar for spending vs min_spend
- [ ] Show projection: monthly × 12 = yearly estimate
- [ ] Color coding: active (green), closed (yellow), settled (blue)

---

## Summary Formulas (cho tab Summary)

### Total cashback YTD
```gs
=SUMIFS(CashbackCycles!L:L, CashbackCycles!D:D, ">="&DATE(YEAR(TODAY()),1,1), CashbackCycles!D:D, "<="&TODAY())
// Sum real_awarded year-to-date
```

### Total cashback by account
```gs
=SUMIFS(CashbackCycles!L:L, CashbackCycles!B:B, $A2)
// A2 = account_id
```

### Total cashback by month
```gs
=SUMIFS(CashbackCycles!L:L, CashbackCycles!D:D, "2026-03")
// Specific month tag
```

### Total loss (bị capping)
```gs
=SUM(CashbackCycles!P:P)
// Sum loss_amount column
```

### Count overdue cycles (closed but not settled)
```gs
=COUNTIFS(CashbackCycles!U:U, "closed", CashbackCycles!H:H, "<"&TODAY())
// Status = closed AND end_date < today
```

### Per-person cashback received
```gs
=SUMIFS(CashbackEntries!F:F, Transactions!L:L, $A2, CashbackEntries!E:E, "real")
// A2 = person_id, sum real cashback entries linked to person
```
