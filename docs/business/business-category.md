# Business Category Specification

## 1. Tổng quan nghiệp vụ

### Category là gì trong Money Flow

Category (danh mục) là cách phân loại giao dịch theo mục đích chi tiêu hoặc nguồn thu nhập. Đây là thành phần cốt lõi để:
- **Cashback tier calculation**: Xác định tỷ lệ hoàn tiền theo từng nhóm chi tiêu
- **Smart parsing từ chat**: Tự động phân loại khi user nhập giao dịch
- **Budget tracking**: Theo dõi ngân sách theo từng nhóm chi tiêu
- **Báo cáo chi tiêu**: Phân tích xu hướng chi tiêu hàng tháng

### Phân cấp 2 tầng

Hệ thống sử dụng mô hình phân cấp 2 tầng:

**Level 1 (Parent)** - Nhóm chính (12 categories):
- Ăn uống
- Mua sắm
- Di chuyển
- Hóa đơn & Dịch vụ
- Sức khỏe
- Giải trí
- Bảo hiểm
- Giáo dục
- Du lịch
- Thu nhập
- Chuyển khoản nội bộ
- Khác

**Level 2 (Child)** - Nhóm con chi tiết (~50 categories):
Ví dụ: `Ăn uống > Cà phê`, `Mua sắm > Online shopping`

---

## 2. Bộ Category chuẩn (Master List)

### 2.1 Ăn uống (`food_drink`)

| Code | Name VI | Name EN | Description |
|------|---------|---------|-------------|
| `dining_out` | Ăn ngoài | Dining out | Nhà hàng, quán ăn |
| `cafe` | Cà phê & trà | Coffee & tea | Highlands, Starbucks, cà phê vỉa hè |
| `food_delivery` | Đặt đồ ăn online | Food delivery | Grab Food, Shopee Food, Baemin |
| `grocery` | Siêu thị & tạp hóa | Grocery | Vinmart, Bách Hóa Xanh, Coopmart |
| `beverage` | Đồ uống đóng chai | Beverages | Nước ngọt, bia, rượu mua lẻ |

### 2.2 Mua sắm (`shopping`)

| Code | Name VI | Name EN | Description |
|------|---------|---------|-------------|
| `online_shopping` | Mua sắm online | Online shopping | Shopee, Lazada, Tiki, TikTok Shop |
| `fashion` | Thời trang & phụ kiện | Fashion | Quần áo, giày dép, túi xách |
| `electronics` | Điện tử & công nghệ | Electronics | Điện thoại, laptop, phụ kiện |
| `home_goods` | Gia dụng & nội thất | Home goods | Đồ dùng gia đình, nội thất |
| `books` | Sách & văn phòng phẩm | Books & stationery | Sách, vở, bút, dụng cụ học tập |

### 2.3 Di chuyển (`transport`)

| Code | Name VI | Name EN | Description |
|------|---------|---------|-------------|
| `fuel` | Xăng dầu | Fuel | Xăng, dầu, trạm xăng |
| `rideshare` | Taxi & ride-hailing | Rideshare | Grab, Be, Xanh SM, taxi truyền thống |
| `parking` | Gửi xe & parking | Parking | Phí gửi xe, bãi đỗ |
| `public_transit` | Phương tiện công cộng | Public transit | Xe buýt, metro, tàu hỏa |
| `vehicle_maintenance` | Bảo dưỡng xe | Vehicle maintenance | Rửa xe, sửa xe, thay nhớt |

### 2.4 Hóa đơn & Dịch vụ (`bills_services`)

| Code | Name VI | Name EN | Description |
|------|---------|---------|-------------|
| `electricity` | Điện | Electricity | Tiền điện hàng tháng |
| `water` | Nước | Water | Tiền nước hàng tháng |
| `telecom` | Internet & điện thoại | Telecom | Cước điện thoại, internet, truyền hình |
| `streaming` | Streaming | Streaming | Netflix, Spotify, YouTube Premium |
| `rent` | Thuê nhà | Rent | Tiền thuê nhà, mặt bằng |
| `bank_fee` | Phí ngân hàng | Bank fees | Phí chuyển khoản, phí thường niên thẻ |

### 2.5 Sức khỏe (`health`)

| Code | Name VI | Name EN | Description |
|------|---------|---------|-------------|
| `medical` | Khám bệnh & thuốc | Medical | Viện phí, thuốc men, xét nghiệm |
| `fitness` | Gym & thể thao | Fitness | Thẻ gym, yoga, dụng cụ thể thao |
| `beauty` | Spa & làm đẹp | Beauty | Spa, nail, tóc, mỹ phẩm |

### 2.6 Giải trí (`entertainment`)

| Code | Name VI | Name EN | Description |
|------|---------|---------|-------------|
| `cinema` | Rạp chiếu phim | Cinema | Vé xem phim |
| `gaming` | Game | Gaming | Game online, mua game, in-game purchase |
| `events` | Sự kiện & concert | Events | Concert, triển lãm, workshop |

### 2.7 Bảo hiểm (`insurance`)

| Code | Name VI | Name EN | Description |
|------|---------|---------|-------------|
| `life_insurance` | Bảo hiểm nhân thọ | Life insurance | Prudential, Manulife, Dai-ichi |
| `health_insurance` | Bảo hiểm sức khỏe | Health insurance | Bảo hiểm chăm sóc sức khỏe |
| `vehicle_insurance` | Bảo hiểm xe | Vehicle insurance | Bảo hiểm ô tô, xe máy |

### 2.8 Giáo dục (`education`)

| Code | Name VI | Name EN | Description |
|------|---------|---------|-------------|
| `tuition` | Học phí | Tuition | Học phí trường học |
| `online_course` | Khóa học online | Online courses | Coursera, Udemy, MasterClass |
| `textbook` | Sách giáo khoa | Textbooks | Sách học, tài liệu học tập |

### 2.9 Du lịch (`travel`)

| Code | Name VI | Name EN | Description |
|------|---------|---------|-------------|
| `flight` | Vé máy bay | Flights | Vé máy bay trong nước và quốc tế |
| `hotel` | Khách sạn | Hotels | Đặt phòng khách sạn, homestay |
| `tour_activity` | Tour & hoạt động | Tours & activities | Tour du lịch, vé tham quan |

### 2.10 Thu nhập (`income`)

| Code | Name VI | Name EN | Description |
|------|---------|---------|-------------|
| `salary` | Lương | Salary | Lương hàng tháng |
| `bonus` | Thưởng | Bonus | Thưởng lễ, thưởng performance |
| `freelance` | Freelance | Freelance | Thu nhập tự do, project-based |
| `investment_return` | Lãi suất & đầu tư | Investment returns | Lãi ngân hàng, cổ tức, lãi bán chứng khoán |
| `refund_income` | Hoàn tiền & refund | Refunds | Tiền hoàn từ refund, reimbursement |

### 2.11 Chuyển khoản nội bộ (`internal_transfer`)

| Code | Name VI | Name EN | Description |
|------|---------|---------|-------------|
| `internal_transfer` | Chuyển giữa các tài khoản của mình | Internal transfer | Chuyển từ Techcombank sang MoMo, v.v. |

### 2.12 Khác (`other`)

| Code | Name VI | Name EN | Description |
|------|---------|---------|-------------|
| `uncategorized` | Không xác định | Uncategorized | Chưa phân loại, mặc định khi không rõ |
| `donation` | Từ thiện & quyên góp | Donations | Quyên góp, từ thiện |
| `gift` | Quà tặng | Gifts | Quà tặng người khác, quà biếu |

---

## 3. Category và Cashback Policy

### Tại sao category ảnh hưởng cashback

Mỗi thẻ tín dụng/ví điện tử có chính sách cashback khác nhau cho từng nhóm chi tiêu:

| Card/Wallet | Category | Cashback Rate | Conditions |
|-------------|----------|---------------|------------|
| **VPBank Lady** | `life_insurance`, `health_insurance` | 15% | Max 300k/tháng khi total spend ≥ 15M |
| **VPBank Lady** | `fashion`, `beauty` | 10% | Max 200k/tháng |
| **VIB Super** | `online_shopping`, `food_delivery` | 5% | Max 500k/tháng |
| **Techcombank** | `fuel`, `rideshare` | 1% | Không giới hạn |
| **UOB ONE** | `grocery`, `dining_out` | 5% | Max 400k/tháng |

### Mapping structure

```typescript
interface CashbackPolicy {
  account_id: string;
  applicable_categories: string[]; // ['life_insurance', 'health_insurance']
  category_key: string; // 'insurance'
  percent: number; // 15
  max_budget: number; // 300000
  min_spend_target?: number; // 15000000
}
```

### Ví dụ tính toán

**Scenario**: VPBank Lady, chi 14.9M tháng này (chưa bao gồm bảo hiểm), mua thêm 5M bảo hiểm nhân thọ

1. **Trước khi mua bảo hiểm**:
   - Total spend: 14.9M
   - Dưới threshold 15M → Tier 1: 7.5% max 100k

2. **Sau khi mua bảo hiểm 5M**:
   - Total spend: 19.9M
   - Vượt threshold 15M → Tier 2: 15% max 300k
   - Insurance spend: 5M × 15% = 750k
   - **Capped at 300k** → Real cashback: 300k

3. **Net gain từ việc mua thêm bảo hiểm**:
   - Nếu chỉ mua 5M bảo hiểm (không có 14.9M kia): 5M × 7.5% = 37.5k
   - Với total 19.9M: 300k
   - **Lợi ích thêm**: 300k - 37.5k = 262.5k

---

## 4. Smart Keyword Mapping

### Bảng mapping từ khóa → category code

| Keywords | Category Code | Notes |
|----------|---------------|-------|
| `shopee`, `lazada`, `tiki`, `tiktok shop` | `online_shopping` | E-commerce platforms |
| `grab food`, `shopee food`, `baemin`, `now` | `food_delivery` | Food delivery apps |
| `grab`, `grab car`, `be`, `xanh sm`, `taxi` | `rideshare` | Ride-hailing services |
| `netflix`, `spotify`, `youtube premium`, `disney+` | `streaming` | Streaming services |
| `bảo hiểm`, `insurance`, `prudential`, `manulife`, `dai-ichi` | `life_insurance` or `health_insurance` | Cần context thêm |
| `xăng`, `petrol`, `petrolimex`, `shell`, `pv oil` | `fuel` | Gas stations |
| `highlands`, `starbucks`, `cà phê`, `coffee`, `trà` | `cafe` | Coffee shops |
| `vinmart`, `bách hóa xanh`, `coopmart`, `go`, `big c` | `grocery` | Supermarkets |
| `circle k`, `family mart`, `ministop` | `grocery` or `beverage` | Tùy mặt hàng mua |
| `điện`, `evn`, `tiền điện` | `electricity` | Electricity bills |
| `nước`, `sawaco`, `tiền nước` | `water` | Water bills |
| `viettel`, `mobifone`, `vinaphone`, `internet`, `wifi` | `telecom` | Telecom bills |
| `phòng khám`, `bệnh viện`, `thuốc`, `khám bệnh` | `medical` | Healthcare |
| `gym`, `yoga`, `cali`, `elite`, `fit24` | `fitness` | Fitness centers |

### Merchant name mapping

```typescript
interface MerchantMapping {
  merchant_name: string; // "SHOPEE", "GRAB", "HIGHLANDS"
  default_category: string; // "online_shopping"
  context_rules?: Array<{
    keywords: string[]; // ["food", "delivery"]
    override_category: string; // "food_delivery"
  }>;
}
```

### Ambiguous cases xử lý thế nào

**Case 1: "GRAB"**
- Nếu note có "food", "cơm", "trà sữa" → `food_delivery`
- Nếu note có "car", "bike", "taxi", "di chuyển" → `rideshare`
- Nếu không có context → Default: `rideshare` (phổ biến hơn)

**Case 2: "CIRCLE K"**
- Nếu note có "mì", "cơm", "bánh", "nước" → `food_drink` sub-category
- Nếu note có "xăng", "đổ xăng" → `fuel`
- Nếu không có context → Default: `grocery`

---

## 5. Business Rules

### Rule 1: Bắt buộc có category
```
MỖI transaction PHẢI có category_id (NOT NULL)
Nếu không xác định được → Default: uncategorized
```

### Rule 2: Ưu tiên Level 2
```
Khi categorize, ưu tiên chọn Level 2 (chi tiết nhất có thể)
Chỉ fallback về Level 1 khi không thể xác định Level 2
```

### Rule 3: Agent parsing flow
```
1. Extract merchant name từ input
2. Lookup trong MerchantMapping table
3. Nếu có context rules, check keywords trong note
4. Nếu không match → Fallback Level 1 dựa trên amount/context
5. Nếu vẫn không rõ → uncategorized
```

### Rule 4: Không xóa category có transactions
```
Một category KHÔNG được xóa nếu đã có transactions liên kết
Chỉ được đánh dấu is_active = false để ẩn khỏi UI
```

### Rule 5: Custom categories
```
User có thể tạo custom sub-categories dưới Level 1 parents
Custom categories không có sẵn cashback mapping
→ Cần manual mapping vào cashback policy
```

### Rule 6: Internal transfers không tính cashback
```
Transactions với category = internal_transfer
KHÔNG được tính vào spent_amount cho cashback calculation
```

### Rule 7: Income categories không tính cashback
```
Transactions với category thuộc group = income
KHÔNG được tính vào spent_amount
(Chỉ expense categories mới eligible cho cashback)
```

---

## 6. Thuộc tính Category Entity

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `code` | String | Yes | Unique code (snake_case): `dining_out` |
| `name_vi` | String | Yes | Tên tiếng Việt: "Ăn ngoài" |
| `name_en` | String | No | Tên tiếng Anh: "Dining out" |
| `parent_id` | UUID | No | Reference to parent category (Level 1) |
| `level` | Integer | Yes | 1 (parent) hoặc 2 (child) |
| `icon` | String | No | Icon name: `restaurant`, `shopping_bag` |
| `color` | String | No | Hex color: `#FF6B6B` |
| `group` | Enum | Yes | `expense`, `income`, `transfer` |
| `affects_cashback` | Boolean | Yes | Có tính vào cashback spent_amount không |
| `is_system` | Boolean | Yes | System category (không được xóa/sửa) |
| `is_active` | Boolean | Yes | Đang sử dụng hay đã ẩn |
| `sort_order` | Integer | Yes | Thứ tự hiển thị |
| `created_at` | DateTime | Yes | Timestamp tạo |
| `updated_at` | DateTime | Yes | Timestamp cập nhật |

---

## 7. Quan hệ dữ liệu

### 7.1 Category → Transactions
```
Category (1) ──< Transactions (N)
- Một category có nhiều transactions
- Mỗi transaction thuộc đúng 1 category
```

### 7.2 Category → CashbackPolicy
```
Category (N) >──< CashbackPolicy (N)
- Nhiều categories có thể share cùng 1 cashback policy
- Một cashback policy áp dụng cho nhiều categories
- Link qua field: applicable_categories (array of category codes)
```

### 7.3 Category → Budget
```
Category (1) ──< Budget (N)
- Một category có thể có nhiều budgets (theo tháng/năm)
- Budget track spending limit per category
```

### 7.4 Parent → Children (Self-referencing)
```
Category (Parent, Level 1) ──< Category (Children, Level 2)
- Level 1 categories có thể có nhiều Level 2 children
- Level 2 categories có đúng 1 parent
```

---

## 8. Google Sheets Column Mapping

### Tab `Categories`

| Column | Field | Example | Notes |
|--------|-------|---------|-------|
| A | `id` | `cat_001` | Primary key |
| B | `code` | `dining_out` | Unique, snake_case |
| C | `name_vi` | `Ăn ngoài` | Hiển thị UI |
| D | `name_en` | `Dining out` | Optional |
| E | `parent_code` | `food_drink` | Empty nếu Level 1 |
| F | `level` | `2` | 1 hoặc 2 |
| G | `group` | `expense` | expense/income/transfer |
| H | `icon` | `restaurant` | Material icon name |
| I | `color` | `#FF6B6B` | Hex color |
| J | `affects_cashback` | `TRUE` | TRUE/FALSE |
| K | `is_system` | `TRUE` | System categories |
| L | `is_active` | `TRUE` | Active/Inactive |
| M | `sort_order` | `10` | Display order |

### Tab `CategoryKeywords` (cho smart parsing)

| Column | Field | Example |
|--------|-------|---------|
| A | `keyword` | `shopee` |
| B | `category_code` | `online_shopping` |
| C | `priority` | `1` |
| D | `context_keywords` | `food,delivery` |
| E | `override_category` | `food_delivery` |

### VLOOKUP formula trong Transactions tab

```excel
=L2!B2:B, Categories!B:C, 2, FALSE)
```
- Cột B trong Transactions chứa `category_code`
- Formula trả về `name_vi` để hiển thị

---

## 9. Ví dụ thực tế

### Example 1: Parse Shopee transaction
**Input**: "shopee, ốp lưng iPhone -500k super"

**Parsing flow**:
1. Merchant: "shopee" → Lookup → `online_shopping`
2. Amount: -500,000 (expense)
3. Account: "super" → VIB Super
4. Category: `online_shopping`

**Cashback calculation**:
- VIB Super: 5% cho online_shopping
- Cashback: 500,000 × 5% = **25,000đ**

### Example 2: Parse Highlands transaction
**Input**: "highlands, cà phê sáng -85k tcb"

**Parsing flow**:
1. Merchant: "highlands" → Lookup → `cafe`
2. Amount: -85,000 (expense)
3. Account: "tcb" → Techcombank
4. Category: `cafe`

**Cashback calculation**:
- Techcombank: 0% cho cafe (không có policy)
- Cashback: **0đ**

### Example 3: Parse insurance transaction
**Input**: "bảo hiểm nhân thọ Prudential -5M vpbank"

**Parsing flow**:
1. Keywords: "bảo hiểm", "prudential" → Lookup → `life_insurance`
2. Amount: -5,000,000 (expense)
3. Account: "vpbank" → VPBank Lady
4. Category: `life_insurance`

**Cashback calculation**:
- Check current month total spend (excluding this txn): 14.9M
- Add this txn: 14.9M + 5M = 19.9M
- Threshold check: 19.9M ≥ 15M → Tier 2 (15%)
- Base cashback: 5,000,000 × 15% = 750,000
- Max budget: 300,000
- **Final cashback: 300,000đ** (capped)

---

## 10. Edge Cases

### Case 1: Transaction có 2 categories
**Scenario**: Đi siêu thị mua grocery + thuốc cùng hóa đơn

**Giải pháp**:
- Option A: Split thành 2 transactions (recommended)
  - Txn 1: Grocery -800k → `grocery`
  - Txn 2: Thuốc -200k → `medical`
- Option B: Chọn category chiếm tỷ trọng lớn nhất
  - Total 1M, grocery 800k → Use `grocery`

### Case 2: Shopee bán cả thực phẩm và điện tử
**Scenario**: Mua iPhone (electronics) và bánh kẹo (grocery) cùng đơn Shopee

**Giải pháp**:
- Dựa vào product description trong note
- Nếu note có "iPhone", "điện thoại" → `electronics`
- Nếu note có "bánh", "kẹo", "thực phẩm" → `grocery`
- Nếu mixed → Split transactions hoặc chọn dominant category

### Case 3: Refund của insurance transaction
**Scenario**: Hoàn hủy hợp đồng bảo hiểm, nhận lại 3M

**Impact**:
- Refund transaction category: `refund_income` (income group)
- Original insurance transaction vẫn giữ `life_insurance`
- Cashback recalculation:
  - Spent_amount giảm 3M
  - Nếu xuống dưới threshold → Clawback cashback đã nhận

### Case 4: Custom category không có cashback mapping
**Scenario**: User tạo custom category "Pet supplies" (đồ thú cưng)

**Giải pháp**:
- Default: `affects_cashback = FALSE`
- User phải manual map vào cashback policy:
  - Vào CashbackPolicy settings
  - Thêm "pet_supplies" vào `applicable_categories`
  - Set percent và max_budget

---

## 11. Checklist cho Agent/Codegen

### Categorization Checklist

- [ ] Mọi transaction đều có `category_id` (không null)
- [ ] Ưu tiên Level 2 categories khi có thể
- [ ] Fallback về Level 1 nếu không xác định được Level 2
- [ ] Default về `uncategorized` nếu hoàn toàn không rõ
- [ ] Internal transfers luôn có category = `internal_transfer`
- [ ] Income transactions có category thuộc group = `income`

### Smart Parsing Checklist

- [ ] Extract merchant name từ input text
- [ ] Lookup merchant trong CategoryKeywords table
- [ ] Check context keywords trong note để refine category
- [ ] Handle ambiguous cases (Grab, Circle K)
- [ ] Log những case không match để improve mapping

### Cashback Calculation Checklist

- [ ] Filter ra chỉ expense categories có `affects_cashback = TRUE`
- [ ] Exclude `internal_transfer` và income categories
- [ ] Áp dụng correct cashback policy dựa trên category
- [ ] Handle tier thresholds (VPBank Lady 15M)
- [ ] Apply max_budget cap
- [ ] Recalculate khi có refund

### Data Integrity Checklist

- [ ] Không xóa system categories (`is_system = TRUE`)
- [ ] Không xóa categories đã có transactions
- [ ] Chỉ đánh dấu `is_active = FALSE` để ẩn
- [ ] Validate `parent_id` tồn tại trước khi tạo child category
- [ ] Ensure `code` là unique across all categories

### Reporting Checklist

- [ ] Group transactions by Level 1 category cho overview
- [ ] Drill down vào Level 2 cho chi tiết
- [ ] Calculate % of total spend per category
- [ ] Compare month-over-month category trends
- [ ] Highlight categories exceeding budget

---

## Summary Formulas Quick Reference

```excel
// Tổng chi theo category trong tháng
=SUMIFS(Transactions!E:E, Transactions!C:C, "dining_out", 
        Transactions!A:A, ">="&DATE(2026,3,1), 
        Transactions!A:A, "<="&DATE(2026,3,31),
        Transactions!F:F, "confirmed")

// % chi tiêu của category so với tổng
=category_spend / total_spend

// Số categories đã chi trong tháng
=COUNTUNIQUE(FILTER(Transactions!C:C, Transactions!A:A>=month_start))

// Top 5 categories chi nhiều nhất
=SORT(UNIQUE(categories), 2, FALSE)
```
