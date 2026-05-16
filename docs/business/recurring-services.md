# Recurring Services - Đặc tả nghiệp vụ

## 1. Tổng quan nghiệp vụ

Recurring Services là các khoản chi tự động phát sinh định kỳ theo lịch. Khác với transaction thông thường ở chỗ:
- Có billing_cycle (monthly/yearly/weekly)
- Có next_due_date tự động tính
- Không cần user nhập tay mỗi tháng
- n8n workflow có thể auto-create transaction khi đến ngày

### Phân loại theo billing cycle

| Cycle Type | Mô tả | Ví dụ |
|------------|-------|-------|
| **monthly** | Hàng tháng | Netflix, Spotify, tiền nhà, wifi, điện, nước, gym membership |
| **yearly** | Hàng năm | Bảo hiểm nhân thọ, domain hosting, iCloud, YouTube Premium yearly |
| **weekly** | Hàng tuần | Một số subscription đặc biệt |
| **custom** | Theo chu kỳ custom | Tiền học phí theo học kỳ |

### Phân loại theo payment method

| Payment Type | Mô tả | Ví dụ |
|--------------|-------|-------|
| **Auto-charge** | Tự động trừ tiền từ thẻ/ví đã lưu | Netflix, Spotify, Apple iCloud, Google One |
| **Manual payment** | Phải chủ động trả, cần reminder | Tiền nhà, tiền điện, tiền nước, bảo hiểm nhân thọ |

---

## 2. Thuộc tính Recurring Service Entity

| Field | Kiểu dữ liệu | Bắt buộc | Mô tả |
|-------|-------------|----------|-------|
| `id` | UUID | ✅ | Định danh duy nhất |
| `name` | String | ✅ | Tên dịch vụ (Netflix, Spotify, tiền nhà...) |
| `provider` | String | ❌ | Nhà cung cấp (ví dụ: "Netflix Inc.", "EVN") |
| `category_code` | String | ✅ | Link về business-category (streaming, electricity, rent...) |
| `account_id` | UUID | ✅ | Tài khoản bị charge (credit card, debit, ví) |
| `amount` | Integer | ✅ | Số tiền mỗi kỳ (VND), luôn dương |
| `currency` | String | ✅ | VND / USD / EUR (default: VND) |
| `billing_cycle` | Enum | ✅ | `monthly` / `yearly` / `weekly` / `custom` |
| `billing_day` | Integer | ✅ | Ngày trong tháng bị charge (1-28). Với yearly: dùng kết hợp billing_month |
| `billing_month` | Integer | ❌ | Tháng bị charge (1-12), chỉ dùng khi billing_cycle = yearly |
| `next_due_date` | Date | ✅ | Ngày charge kế tiếp (tự động tính) |
| `last_charged_date` | Date | ❌ | Ngày charge lần cuối |
| `start_date` | Date | ✅ | Ngày bắt đầu subscribe |
| `end_date` | Date | ❌ | Ngày hết hạn (nếu có, null = vô thời hạn) |
| `is_active` | Boolean | ✅ | Đang active hay không (default: true) |
| `is_auto_charge` | Boolean | ✅ | true = tự động charge, false = phải trả tay |
| `reminder_days_before` | Integer | ✅ | Số ngày nhắc nhở trước khi charge (default: 3 nếu auto, 5 nếu manual) |
| `payment_type` | Enum | ✅ | `credit_card` / `debit` / `wallet` / `cash` |
| `notes` | Text | ❌ | Ghi chú thêm |
| `created_at` | Timestamp | ✅ | Thời điểm tạo |
| `updated_at` | Timestamp | ✅ | Thời điểm cập nhật cuối |

---

## 3. Master List Recurring Services phổ biến tại Việt Nam

### Streaming & Entertainment

| name | provider | category_code | typical_amount (VND) | billing_cycle | currency | is_auto_charge | notes |
|------|----------|---------------|---------------------|---------------|----------|----------------|-------|
| Netflix | Netflix Inc. | streaming | 180,000 - 260,000 | monthly | VND | ✅ | Tùy gói Basic/Standard/Premium |
| Spotify Premium | Spotify | streaming | 59,000 | monthly | VND | ✅ | Gói cá nhân |
| YouTube Premium | Google | streaming | 79,000 | monthly | VND | ✅ | Bao gồm YouTube Music |
| Apple TV+ | Apple | streaming | ~79,000 (~3 USD) | monthly | USD | ✅ | |
| Disney+ Hotstar | Disney | streaming | 86,000 | monthly | VND | ✅ | |
| FPT Play | FPT | streaming | 59,000 - 165,000 | monthly | VND | ✅ | Tùy gói |
| Danet | Danet | streaming | 49,000 - 99,000 | monthly | VND | ✅ | Phim bản quyền |

### Cloud & Productivity

| name | provider | category_code | typical_amount (VND) | billing_cycle | currency | is_auto_charge | notes |
|------|----------|---------------|---------------------|---------------|----------|----------------|-------|
| iCloud 50GB | Apple | cloud_storage | 19,000 | monthly | VND | ✅ | |
| iCloud 200GB | Apple | cloud_storage | 49,000 | monthly | VND | ✅ | |
| iCloud 2TB | Apple | cloud_storage | 149,000 | monthly | VND | ✅ | |
| Google One 100GB | Google | cloud_storage | 49,000 | monthly | VND | ✅ | |
| Google One 200GB | Google | cloud_storage | 99,000 | monthly | VND | ✅ | |
| Microsoft 365 Personal | Microsoft | software_subscription | 1,690,000 | yearly | VND | ✅ | Word, Excel, PowerPoint |
| Microsoft 365 Family | Microsoft | software_subscription | 2,190,000 | yearly | VND | ✅ | Cho 6 người |

### Bills (Hóa đơn cố định)

| name | provider | category_code | typical_amount (VND) | billing_cycle | currency | is_auto_charge | notes |
|------|----------|---------------|---------------------|---------------|----------|----------------|-------|
| Tiền điện | EVN | electricity | 500,000 - 2,000,000 | monthly | VND | ❌ | Billing day ~10-15, amount dao động |
| Tiền nước | SAWACO/BWACO | water | 100,000 - 500,000 | monthly | VND | ❌ | Billing day ~5-10 |
| Internet Viettel | Viettel | telecom | 200,000 - 350,000 | monthly | VND | ✅/❌ | Tùy gói |
| Internet VNPT | VNPT | telecom | 180,000 - 300,000 | monthly | VND | ✅/❌ | |
| Internet FPT | FPT | telecom | 200,000 - 350,000 | monthly | VND | ✅/❌ | |
| Điện thoại di động | Viettel/Mobi/Vina | telecom | 100,000 - 500,000 | monthly | VND | ✅ | Trả sau |
| Tiền nhà/thuê nhà | Chủ nhà | rent | 5,000,000 - 15,000,000 | monthly | VND | ❌ | Reminder 5 ngày trước |
| Phí quản lý chung cư | Ban quản lý | housing_fee | 500,000 - 2,000,000 | monthly | VND | ❌ | |

### Fitness & Health

| name | provider | category_code | typical_amount (VND) | billing_cycle | currency | is_auto_charge | notes |
|------|----------|---------------|---------------------|---------------|----------|----------------|-------|
| California Fitness | California | fitness | 800,000 - 1,500,000 | monthly | VND | ❌ | Tùy gói |
| The Gym | The Gym | fitness | 500,000 - 700,000 | monthly | VND | ❌ | |
| Yoga class | Various | fitness | 600,000 - 1,200,000 | monthly | VND | ❌ | |
| Jetts Fitness | Jetts | fitness | 790,000 - 1,200,000 | monthly | VND | ✅ | Auto-debit |
| Elite Fitness | Elite | fitness | 1,000,000 - 2,000,000 | monthly | VND | ❌ | |

### Insurance (Bảo hiểm định kỳ)

| name | provider | category_code | typical_amount (VND) | billing_cycle | currency | is_auto_charge | notes |
|------|----------|---------------|---------------------|---------------|----------|----------------|-------|
| Bảo hiểm nhân thọ Manulife | Manulife | life_insurance | Custom (2M-10M) | monthly/yearly | VND | ❌ | Recommend VPBank Lady |
| Bảo hiểm nhân thọ Prudential | Prudential | life_insurance | Custom (2M-10M) | monthly/yearly | VND | ❌ | |
| Bảo hiểm nhân thọ AIA | AIA | life_insurance | Custom (2M-10M) | monthly/yearly | VND | ❌ | |
| Bảo hiểm sức khỏe Bảo Việt | Bảo Việt | health_insurance | Custom (1M-5M) | monthly/yearly | VND | ❌ | |
| Bảo hiểm xe máy | PVI/BIC | vehicle_insurance | 100,000 - 300,000 | yearly | VND | ❌ | Bắt buộc |
| Bảo hiểm ô tô | PVI/BIC/VBI | vehicle_insurance | Custom (5M-20M) | yearly | VND | ❌ | |

### Education

| name | provider | category_code | typical_amount (VND) | billing_cycle | currency | is_auto_charge | notes |
|------|----------|---------------|---------------------|---------------|----------|----------------|-------|
| Học phí tiếng Anh | Various | tuition | Custom (2M-5M) | monthly | VND | ❌ | |
| Udemy | Udemy | online_course | Custom | one-time | USD | ✅ | Mua từng khóa |
| Coursera | Coursera | online_course | $39-$79/month | monthly | USD | ✅ | Subscription |
| Kyna.vn | Kyna | online_course | Custom | one-time | VND | ❌ | |

### Other Subscriptions

| name | provider | category_code | typical_amount (VND) | billing_cycle | currency | is_auto_charge | notes |
|------|----------|---------------|---------------------|---------------|----------|----------------|-------|
| Tinder Gold | Match Group | entertainment | ~500,000 | monthly | VND | ✅ | |
| Bumble Boost | Bumble | entertainment | ~400,000 | monthly | VND | ✅ | |
| Office 365 | Microsoft | software_subscription | Xem Microsoft 365 | monthly/yearly | VND | ✅ | |
| Adobe Creative Cloud | Adobe | software_subscription | ~300,000 | monthly | USD | ✅ | |

---

## 4. Business Rules bắt buộc

### Rule 1: Required fields
Mỗi recurring service PHẢI có:
- `account_id` hợp lệ (tồn tại trong hệ thống)
- `category_code` hợp lệ (tồn tại trong business-category.md)
- `amount` > 0
- `billing_cycle` thuộc {monthly, yearly, weekly, custom}
- `billing_day` từ 1-28 (tránh ngày 29-31 vì không phải tháng nào cũng có)

### Rule 2: Next due date calculation
`next_due_date` PHẢI được tính lại mỗi khi transaction được tạo:

```
Nếu billing_cycle = monthly:
  next_due_date = last_charged_date + 1 month (EDATE)

Nếu billing_cycle = yearly:
  next_due_date = last_charged_date + 12 months

Nếu billing_cycle = weekly:
  next_due_date = last_charged_date + 7 days
```

### Rule 3: Active status behavior
Khi `is_active = false`:
- KHÔNG tạo transaction mới
- KHÔNG gửi reminder notification
- Vẫn giữ data để xem lịch sử
- User có thể re-active bất cứ lúc nào

### Rule 4: Amount validation
- `amount = 0` không hợp lệ → reject
- `amount < 0` không hợp lệ → reject
- USD amount phải convert sang VND khi tạo transaction (dùng exchange rate tại thời điểm)

### Rule 5: Soft delete
Recurring service không bị xóa vật lý khi cancel:
- Chỉ set `is_active = false`
- Giữ nguyên lịch sử transactions đã tạo
- Set `end_date = today` nếu muốn đánh dấu kết thúc

### Rule 6: Billing day constraint
- `billing_day` phải từ 1-28
- Lý do: Tránh tháng 2 không có ngày 29-31
- Nếu service yêu cầu ngày cụ thể (ví dụ 30), fallback về 28

### Rule 7: Yearly billing
Khi `billing_cycle = yearly`:
- Dùng `billing_month` + `billing_day` để xác định ngày charge
- Ví dụ: billing_month=3, billing_day=10 → charge ngày 10/03 hàng năm

---

## 5. Reminder & Notification Rules

### Before charge: Auto-charge services

**Trigger:** `days_until_due <= reminder_days_before`

**Message template:**
```
⏰ [Tên service] sẽ tự động charge [formatted_amount] vào [account_name] vào ngày [due_date].

💡 Kiểm tra số dư tài khoản để đảm bảo giao dịch thành công.

📋 Chi tiết:
   - Dịch vụ: [name]
   - Số tiền: [amount] đ
   - Ngày charge: [due_date]
   - Tài khoản: [account_name]
```

**Default reminder_days_before:** 3 ngày

### Before charge: Manual payment services

**Trigger:** `days_until_due <= reminder_days_before`

**Message template:**
```
⚠️ [Tên service] đến hạn thanh toán ngày [due_date], số tiền [formatted_amount].

💳 Hình thức: Thanh toán thủ công (không tự động trừ tiền)

📋 Hướng dẫn:
   - Dịch vụ: [name]
   - Số tiền: [amount] đ
   - Hạn chót: [due_date]
   - Gợi ý dùng thẻ: [cashback_hint nếu có]

👉 Nhắn "confirm [service_name]" khi đã thanh toán để ghi nhận.
```

**Default reminder_days_before:** 5 ngày

### After successful charge

**Trigger:** Transaction được tạo với status = completed

**Action:**
1. Update `last_charged_date = today`
2. Recalculate `next_due_date` theo billing_cycle
3. Sync lên Google Sheets
4. Gửi confirmation message (optional):
   ```
   ✅ Đã tạo transaction cho [name]: [amount] đ vào [account_name].
   
   📅 Lần charge tiếp theo: [next_due_date]
   ```

### Charge failure handling

**Trigger:** Transaction creation fails (insufficient balance, card expired, etc.)

**Action:**
1. Mark transaction as `failed`
2. Gửi cảnh báo ngay lập tức:
   ```
   ❌ Charge thất bại cho [name]: [amount] đ
   
   Lý do: [reason - insufficient_balance / card_expired / etc.]
   
   👉 Vui lòng kiểm tra tài khoản [account_name] và thử lại.
   ```
3. Giữ nguyên `next_due_date` để retry
4. Retry logic (configurable):
   - Retry 1: Sau 1 ngày
   - Retry 2: Sau 2 ngày
   - Retry 3: Sau 3 ngày → Escalate (notify mạnh hơn)

---

## 6. Auto-create Transaction khi đến hạn

### n8n Workflow Trigger

**Schedule:** Chạy hàng ngày vào lúc 6:00 AM VNT

**Logic:**
```javascript
// Pseudo-code cho n8n workflow
const today = new Date();
const recurringServices = await getAllActiveRecurringServices();

recurringServices.forEach(service => {
  if (service.next_due_date === today) {
    createTransactionFromRecurringService(service);
  }
  
  // Check reminder
  const daysUntilDue = daysBetween(today, service.next_due_date);
  if (daysUntilDue === service.reminder_days_before) {
    sendReminderNotification(service);
  }
});
```

### Transaction Data Structure

Khi tạo transaction từ recurring service:

```json
{
  "type": "expense",
  "amount": -{service.amount},  // Âm vì là expense
  "account_id": "{service.account_id}",
  "category_code": "{service.category_code}",
  "note": "[service.name] - [MM/YYYY]",
  "status": "completed",  // Nếu is_auto_charge=true
  "occurred_at": "{service.next_due_date}",
  "metadata": {
    "recurring_service_id": "{service.id}",
    "billing_cycle": "{service.billing_cycle}",
    "billing_period": "MM/YYYY",
    "is_auto_generated": true
  },
  "person_id": null,  // Không áp dụng cho recurring services
  "tags": ["recurring", "{service.category_code}"]
}
```

**Status logic:**
- `is_auto_charge = true` → status = `completed` (coi như đã charge)
- `is_auto_charge = false` → status = `pending` (chờ user confirm đã thanh toán)

### Post-creation Actions

Sau khi tạo transaction thành công:

1. **Update Recurring Service:**
   ```
   last_charged_date = today
   next_due_date = calculateNextDueDate(today, billing_cycle)
   updated_at = now
   ```

2. **Trigger Budget Recalculation:**
   - Update budget spent_amount cho category này
   - Check nếu vượt budget threshold → gửi cảnh báo

3. **Trigger Cashback Cycle Update:**
   - Nếu account có cashback_policy
   - Update spent_amount trong cashback cycle hiện tại
   - Recalculate virtual_profit projection

4. **Sync Google Sheets:**
   - Update tab `RecurringServices` (last_charged_date, next_due_date)
   - Append row vào tab `Transactions`

---

## 7. Ảnh hưởng tới Budget

### Budget Calculation

Recurring service expense tham gia vào budget calculation như transaction thông thường:

```
total_expenses_this_month = 
  SUM(transactions where type=expense AND status=completed AND month=current_month)

fixed_expenses_total = 
  SUM(recurring_services where is_active=true AND billing_cycle=monthly)

variable_expenses = total_expenses_this_month - fixed_expenses_total

available_budget = monthly_budget_limit - total_expenses_this_month
```

### Budget Warning Rules

**Warning 1: High fixed expenses ratio**
```
fixed_ratio = fixed_expenses_total / monthly_budget_limit

IF fixed_ratio > 0.5:
  ⚠️ "Chi phí cố định chiếm {fixed_ratio}% ngân sách tháng. 
      Cân nhắc cắt giảm subscription không cần thiết."
```

**Warning 2: Recurring exceeds budget**
```
IF fixed_expenses_total > monthly_budget_limit:
  🚨 "Tổng chi phí cố định ({fixed_expenses_total}) vượt ngân sách tháng ({budget_limit})!"
```

### Budget Report Enhancement

Trong báo cáo chi tiêu hàng tháng, phân biệt rõ:

| Category | Fixed (Recurring) | Variable (Ad-hoc) | Total |
|----------|------------------|-------------------|-------|
| Streaming | 180k (Netflix) | - | 180k |
| Electricity | - | 650k | 650k |
| Food & Drink | - | 3,500k | 3,500k |
| Rent | 8,000k | - | 8,000k |
| **Total** | **8,180k** | **4,150k** | **12,330k** |

---

## 8. Ảnh hưởng tới Cashback

### General Rule

Recurring charge bằng thẻ credit → vẫn tính vào `spent_amount` của cashback cycle đó.

### Category-specific Cashback Analysis

| Category | Typical Cashback | Best Card Recommendation |
|----------|-----------------|-------------------------|
| **streaming** | 0% (hầu hết thẻ) | Một số thẻ có ưu đãi đặc biệt (cần check) |
| **telecom** | 0-1% | Techcombank (1% general) |
| **electricity/water** | 0% | Không có cashback đặc biệt |
| **life_insurance** | 7.5%-15% | **VPBank Lady** (xem chi tiết bên dưới) |
| **health_insurance** | 7.5%-15% | **VPBank Lady** |
| **fitness** | 0-5% | UOB ONE (5% lifestyle) |
| **cloud_storage** | 0% | Không có cashback đặc biệt |
| **software_subscription** | 0-5% | VIB Super (5% online) |

### VPBank Lady - Insurance Cashback Detail

**Policy:**
- Tier 1: 7.5% cashback, max 100k/kỳ, khi total spend < 15M/kỳ
- Tier 2: 15% cashback, max 300k/kỳ, khi total spend ≥ 15M/kỳ
- Applicable categories: `life_insurance`, `health_insurance`

**Example Calculation:**
```
Scenario: Chi 5M cho bảo hiểm nhân thọ hàng tháng

Case A: Total spend kỳ = 10M (< 15M threshold)
→ Cashback = min(5M * 7.5%, 100k) = min(375k, 100k) = 100k

Case B: Total spend kỳ = 20M (≥ 15M threshold)
→ Cashback = min(5M * 15%, 300k) = min(750k, 300k) = 300k

Recommendation: Cố gắng đạt threshold 15M để được tier 2
```

### Internal Transfer Recurring

Ví dụ: Tiết kiệm định kỳ hàng tháng
- `category_code` = `internal_transfer` hoặc `savings`
- `is_auto_charge` = true
- **KHÔNG tính vào cashback spent_amount** (không phải chi tiêu thực tế)

---

## 9. Quan hệ dữ liệu

```
┌─────────────────────┐
│ RecurringService    │
│ - id                │
│ - name              │
│ - account_id ───────┼──→ Account (many-to-one)
│ - category_code ────┼──→ Category (many-to-one)
│ - amount            │
│ - billing_cycle     │
│ - next_due_date     │
│ - is_active         │
└─────────┬───────────┘
          │
          │ one-to-many
          ↓
┌─────────────────────┐
│ Transaction         │
│ - id                │
│ - recurring_service_id ← FK
│ - amount            │
│ - occurred_at       │
│ - metadata          │
└─────────────────────┘

Indirect relationships:
- RecurringService → Budget (qua Transactions)
- RecurringService → CashbackCycle (qua Transactions → Account)
```

---

## 10. Google Sheets Column Mapping

### Tab `RecurringServices`

| Cột | Field | Mô tả | Example |
|-----|-------|-------|---------|
| A | `id` | UUID | `rec_abc123` |
| B | `name` | Tên dịch vụ | `Netflix` |
| C | `provider` | Nhà cung cấp | `Netflix Inc.` |
| D | `category_code` | Category | `streaming` |
| E | `category_name` | Tên category (VLOOKUP) | `Streaming` |
| F | `amount` | Số tiền (VND) | `180,000` |
| G | `currency` | Đơn vị tiền | `VND` |
| H | `billing_cycle` | Chu kỳ | `monthly` |
| I | `billing_day` | Ngày charge | `15` |
| J | `account_id` | Account UUID | `acc_xyz789` |
| K | `account_name` | Tên account (VLOOKUP) | `VIB Super Card` |
| L | `is_auto_charge` | Tự động charge | `TRUE` |
| M | `last_charged_date` | Lần charge cuối | `15/04/2026` |
| N | `next_due_date` | Ngày charge tới | `15/05/2026` |
| O | `is_active` | Đang active | `TRUE` |
| P | `reminder_days` | Số ngày nhắc | `3` |
| Q | `days_until_due` | Còn bao nhiêu ngày | `=DATEDIF(TODAY(),N2,"D")` |
| R | `status_display` | Trạng thái hiển thị | Formula-based |
| S | `notes` | Ghi chú | `Gói Standard` |

### Formula cho cột R (status_display)

```excel
=IF(O2=FALSE, "Đã hủy",
  IF(Q2<0, "Quá hạn",
    IF(Q2<=3, "Sắp đến hạn",
      "Đang active")))
```

### Conditional Formatting cho tab RecurringServices

| Condition | Format |
|-----------|--------|
| `status_display = "Quá hạn"` | Background đỏ #FF6B6B |
| `status_display = "Sắp đến hạn"` | Background vàng #FFD93D |
| `status_display = "Đang active"` | Background xanh lá #6BCB77 |
| `status_display = "Đã hủy"` | Background xám #D3D3D3, strikethrough |

---

## 11. Ví dụ thực tế

### Ví dụ 1: Netflix monthly (Auto-charge)

**Setup:**
```json
{
  "name": "Netflix",
  "provider": "Netflix Inc.",
  "category_code": "streaming",
  "amount": 180000,
  "currency": "VND",
  "billing_cycle": "monthly",
  "billing_day": 15,
  "account_id": "acc_vib_super",
  "account_name": "VIB Super Card",
  "is_auto_charge": true,
  "reminder_days_before": 3,
  "start_date": "2025-01-15",
  "is_active": true
}
```

**Timeline:**
- **12/05/2026** (3 ngày trước): Gửi reminder
  ```
  ⏰ Netflix sẽ tự động charge 180,000đ vào VIB Super Card vào ngày 15/05/2026.
  💡 Kiểm tra số dư tài khoản.
  ```
  
- **15/05/2026**: n8n auto-create transaction
  ```json
  {
    "type": "expense",
    "amount": -180000,
    "account_id": "acc_vib_super",
    "category_code": "streaming",
    "note": "Netflix - 05/2026",
    "status": "completed",
    "occurred_at": "2026-05-15",
    "metadata": {
      "recurring_service_id": "rec_netflix_001",
      "billing_cycle": "monthly",
      "billing_period": "05/2026"
    }
  }
  ```
  
- **Post-creation:**
  - Update `last_charged_date = 15/05/2026`
  - Calculate `next_due_date = 15/06/2026`
  - Sync Sheet

---

### Ví dụ 2: Bảo hiểm nhân thọ Manulife (Manual payment)

**Setup:**
```json
{
  "name": "Bảo hiểm nhân thọ Manulife",
  "provider": "Manulife Vietnam",
  "category_code": "life_insurance",
  "amount": 5000000,
  "currency": "VND",
  "billing_cycle": "monthly",
  "billing_day": 10,
  "account_id": "acc_vpbank_lady",
  "account_name": "VPBank Lady Card",
  "is_auto_charge": false,
  "reminder_days_before": 5,
  "start_date": "2025-01-10",
  "is_active": true,
  "notes": "Dùng VPBank Lady để lấy cashback 7.5%-15%"
}
```

**Timeline:**
- **05/05/2026** (5 ngày trước): Gửi reminder
  ```
  ⚠️ Bảo hiểm nhân thọ Manulife đến hạn thanh toán ngày 10/05/2026, số tiền 5,000,000đ.
  
  💳 Hình thức: Thanh toán thủ công
  
  💡 Gợi ý: Dùng VPBank Lady Card để được cashback 7.5%-15% (tùy tổng chi tiêu kỳ)
  
  👉 Nhắn "confirm Manulife" khi đã thanh toán.
  ```
  
- **10/05/2026**: User nhắn confirm
  ```
  User: "confirm Manulife"
  Agent: Tạo transaction pending → completed
  ```
  
- **Transaction created:**
  ```json
  {
    "type": "expense",
    "amount": -5000000,
    "account_id": "acc_vpbank_lady",
    "category_code": "life_insurance",
    "note": "Bảo hiểm nhân thọ Manulife - 05/2026",
    "status": "completed",
    "occurred_at": "2026-05-10",
    "metadata": {
      "recurring_service_id": "rec_manulife_001"
    }
  }
  ```
  
- **Cashback impact:**
  - VPBank Lady cycle spent_amount += 5,000,000
  - Nếu total spend ≥ 15M: cashback = min(5M*15%, 300k) = 300k
  - Nếu total spend < 15M: cashback = min(5M*7.5%, 100k) = 100k

---

### Ví dụ 3: Tiền nhà (Manual, high amount)

**Setup:**
```json
{
  "name": "Tiền nhà tháng",
  "category_code": "rent",
  "amount": 8000000,
  "billing_cycle": "monthly",
  "billing_day": 1,
  "account_id": "acc_tcb_debit",
  "account_name": "Techcombank Account",
  "is_auto_charge": false,
  "reminder_days_before": 5,
  "is_active": true
}
```

**Note:** Rent category không có cashback, dùng debit card để tránh interest.

---

## 12. Edge Cases

### Case 1: Số tiền thay đổi theo tháng (điện, nước)

**Problem:** Tiền điện dao động 500k-2M/tháng tùy mức độ sử dụng.

**Solution:**
1. Setup recurring với `amount = estimated_amount` (ví dụ 1,000,000)
2. Khi transaction được tạo (status=pending cho manual payment):
   - User nhận reminder với estimated amount
   - User có thể override amount thực tế khi confirm
   ```
   User: "confirm electricity amount=1,250,000"
   Agent: Update transaction amount trước khi commit
   ```
3. Ghi chú trong notes: "Số tiền ước tính, cập nhật theo hóa đơn thực tế"

**Formula trong Sheet:**
```excel
// Cột amount hiển thị cả estimated và actual
=IF(actual_amount<>estimated_amount, 
   TEXT(estimated_amount,"#,##0")&" (est) → "&TEXT(actual_amount,"#,##0"),
   TEXT(amount,"#,##0"))
```

---

### Case 2: Service tạm ngưng (pause)

**Scenario:** User đi du lịch 2 tháng, muốn pause gym membership.

**Solution:**
1. Set `is_active = false`
2. Thêm field `paused_until_date = 2026-07-01`
3. n8n workflow check hàng ngày:
   ```javascript
   if (service.paused_until_date && service.paused_until_date <= today) {
     service.is_active = true;
     service.paused_until_date = null;
     notifyUser("Dịch vụ [name] đã được active lại.");
   }
   ```
4. Không tạo transaction trong thời gian pause
5. Billing cycle vẫn giữ nguyên, không bị lệch

---

### Case 3: Billing cycle thay đổi

**Scenario:** Chuyển từ Netflix monthly sang Netflix yearly (tiết kiệm hơn).

**Solution:**
1. Tạo recurring service MỚI:
   ```json
   {
     "name": "Netflix (Yearly)",
     "billing_cycle": "yearly",
     "amount": 1,800,000,  // ~150k/tháng, rẻ hơn 180k
     "billing_month": 1,
     "billing_day": 15
   }
   ```
2. Deactivate service cũ:
   ```
   is_active = false
   end_date = today
   notes = "Chuyển sang yearly plan"
   ```
3. Giữ nguyên lịch sử transactions cũ (để báo cáo)
4. User không mất data chi tiêu quá khứ

---

### Case 4: Thẻ hết hạn / đổi thẻ

**Scenario:** Thẻ VIB Super hết hạn, user được cấp thẻ mới với số khác.

**Solution:**
1. Update `account_id` trong recurring service:
   ```
   old_account_id: acc_vib_super_old
   new_account_id: acc_vib_super_new
   notes += "Updated account on 2026-05-01 do thay the"`
   ```
2. Các transactions cũ GIỮ NGUYÊN `account_id` cũ (lịch sử không đổi)
3. Transactions mới dùng `account_id` mới
4. Cashback cycle vẫn track đúng vì cùng 1 account entity (chỉ update card number)

---

### Case 5: Charge thất bại (insufficient balance)

**Scenario:** Đến ngày charge nhưng tài khoản không đủ số dư.

**Flow:**
1. n8n attempt tạo transaction → failed
2. Mark transaction status = `failed`
3. Gửi alert ngay:
   ```
   ❌ Charge thất bại cho Netflix: 180,000đ
   
   Lý do: Số dư không đủ trong VIB Super Card
   
   👉 Vui lòng nạp tiền và thử lại.
   ```
4. Retry schedule:
   - Retry 1: +1 ngày (16/05)
   - Retry 2: +2 ngày (17/05)
   - Retry 3: +3 ngày (18/05) → Escalate
5. Escalation message:
   ```
   🚨 Charge thất bại 3 lần cho Netflix!
   
   Vui lòng kiểm tra:
   - Số dư tài khoản
   - Thẻ còn hạn không
   - Hạn mức giao dịch
   
   Hoặc tạm pause service nếu không dùng nữa.
   ```

---

### Case 6: Recurring kết hợp với Debt Repayment

**Scenario:** Trả góp iPhone 15 Pro Max, 3M/tháng trong 12 tháng.

**Approach 1: Pure Recurring Service**
```json
{
  "name": "Trả góp iPhone 15 PM",
  "category_code": "electronics",
  "amount": 3000000,
  "billing_cycle": "monthly",
  "is_auto_charge": true
}
```
→ Đơn giản, nhưng không track được tổng nợ còn lại.

**Approach 2: Recurring + Debt Record (Recommended)**
1. Tạo Debt record:
   ```json
   {
     "person_id": "person_fpt_shop",
     "debt_role": "borrowed",
     "original_amount": 36000000,
     "repaid_amount": 0
   }
   ```
2. Tạo Recurring Service link với Debt:
   ```json
   {
     "name": "Trả góp iPhone 15 PM",
     "category_code": "electronics",
     "amount": 3000000,
     "metadata": {
       "debt_id": "debt_iphone_001"
     }
   }
   ```
3. Khi transaction được tạo:
   - Tạo expense transaction (electronics)
   - Đồng thời tạo repayment transaction link với debt
   - Update `debt.repaid_amount += 3M`

**Benefit:** Track được cả chi tiêu tháng VÀ tổng nợ còn lại.

---

## 13. Checklist cho Agent/Codegen

### Tạo recurring service mới

- [ ] Validate `billing_day` từ 1-28
- [ ] Nếu `billing_cycle = yearly`, validate `billing_month` từ 1-12
- [ ] Tính `next_due_date` từ `start_date` + `billing_cycle`
- [ ] Set `reminder_days_before` (default: 3 nếu auto, 5 nếu manual)
- [ ] Validate `account_id` tồn tại trong hệ thống
- [ ] Validate `category_code` tồn tại trong business-category.md
- [ ] Validate `amount > 0`
- [ ] Convert USD/EUR sang VND nếu cần (lưu cả original currency)
- [ ] Sync lên Google Sheet tab `RecurringServices`
- [ ] Gửi confirmation message cho user

### Auto-create transaction (n8n trigger)

- [ ] Check `is_active = true`
- [ ] Check `next_due_date = TODAY()`
- [ ] Create transaction với đầy đủ fields từ Section 6
- [ ] Set `metadata.recurring_service_id`
- [ ] Set `metadata.is_auto_generated = true`
- [ ] Nếu `is_auto_charge = false` → set status = `pending`
- [ ] Update `last_charged_date` trong RecurringService
- [ ] Recalculate `next_due_date` theo công thức Section 4
- [ ] Trigger budget recalculation
- [ ] Trigger cashback cycle update (nếu account có policy)
- [ ] Sync cả 2 tabs: `RecurringServices` và `Transactions`
- [ ] Log action vào audit trail

### Reminder notification

- [ ] Chạy daily check vào 8:00 AM VNT
- [ ] Filter services có `days_until_due = reminder_days_before`
- [ ] Check `is_active = true`
- [ ] Generate message theo template Section 5 (phân biệt auto/manual)
- [ ] Thêm cashback hint nếu applicable (ví dụ insurance → VPBank Lady)
- [ ] Gửi qua Telegram/Zalo/Email (tùy config user)
- [ ] Flag `reminder_sent = true` để tránh duplicate trong cùng ngày
- [ ] Log vào notification history

### Handle user confirm (manual payment)

- [ ] Parse message: "confirm [service_name]" hoặc "confirm [service_name] amount=X"
- [ ] Tìm recurring service match (fuzzy match tên)
- [ ] Nếu user cung cấp amount → override transaction amount
- [ ] Tạo transaction với status = `completed`
- [ ] Update recurring service (`last_charged_date`, `next_due_date`)
- [ ] Sync Sheet
- [ ] Gửi confirmation + cashback earned (nếu có)

### Handle edge cases

- [ ] Duplicate detection: Không tạo 2 transactions cùng 1 service cùng ngày
- [ ] Timezone handling: Tất cả dates dùng VNT (UTC+7)
- [ ] Currency conversion: Dùng exchange rate tại thời điểm charge
- [ ] Failed transaction retry: Implement retry queue với exponential backoff
- [ ] Service pause/resume: Support `paused_until_date` field
- [ ] Account change: Allow bulk update account_id cho multiple services

---

## Tóm tắt nhanh cho Agent

**Recurring Service là gì?**
→ Khoản chi định kỳ tự động (Netflix, điện, nước, bảo hiểm...)

**Khi nào tạo transaction?**
→ Khi `next_due_date = TODAY` (n8n trigger 6AM hàng ngày)

**Reminder gửi khi nào?**
→ Trước `reminder_days_before` ngày (3 ngày cho auto, 5 ngày cho manual)

**Cashback impact?**
→ Có! Đặc biệt insurance dùng VPBank Lady được 7.5%-15%

**Sheet columns quan trọng?**
→ `next_due_date`, `days_until_due`, `status_display`, `is_active`

**Edge case thường gặp?**
→ Amount thay đổi (điện/nước), charge failed, card expired, service pause
