# Đặc tả nghiệp vụ: Transactions

## 1) Tổng quan nghiệp vụ

`Transaction` (Giao dịch) là thực thể ghi nhận mọi dòng tiền vào/ra trong hệ thống Money Flow, bao gồm:
- Thu nhập (**income**): lương, thưởng, hoàn nhập
- Chi tiêu (**expense**): ăn uống, mua sắm, thanh toán hóa đơn
- Chuyển khoản (**transfer_in/transfer_out**): chuyển giữa các accounts
- Hoàn tiền (**cashback**): cashback từ thẻ tín dụng, chương trình khuyến mãi
- Hoàn trả (**refund**): tiền hoàn từ giao dịch đã hủy/trả lại
- Cho vay (**debt**): tiền cho người khác mượn
- Trả nợ (**repayment**): tiền trả lại khi đi vay hoặc thu hồi nợ
- Dịch vụ (**service**): thanh toán dịch vụ định kỳ (subscription)

Transactions là nguồn dữ liệu chuẩn (source of truth) để tính số dư accounts, cashback cycles, debt tracking, và mọi báo cáo tài chính.

## 2) Loại giao dịch (Transaction Type)

Giá trị chuẩn cho `type`:
- `income`: Dòng tiền vào account
- `expense`: Dòng tiền ra account
- `transfer_in`: Nhận chuyển khoản từ account khác
- `transfer_out`: Chuyển khoản ra account khác
- `cashback`: Hoàn tiền vào account
- `refund`: Tiền hoàn trả vào account
- `debt`: Tiền cho vay ra (làm giảm số dư account)
- `repayment`: Tiền trả nợ/nhận lại (làm tăng số dư account)
- `service`: Thanh toán dịch vụ định kỳ

## 3) Trạng thái giao dịch (Transaction Status)

Giá trị chuẩn cho `status`:
- `posted`: Đã chốt - giao dịch hoàn tất, ảnh hưởng số dư
- `pending`: Chờ xử lý - giao dịch tạm thời, chưa ảnh hưởng số dư cuối cùng
- `void`: Hủy - giao dịch bị hủy, không ảnh hưởng số dư

> **Nguyên tắc:** Chỉ transaction `status = posted` mới được tính vào `current_balance` của accounts.

## 4) Thuộc tính cốt lõi

| Thuộc tính | Kiểu dữ liệu | Mô tả |
|---|---|---|
| `id` | UUID | Định danh duy nhất của giao dịch |
| `occurred_at` | Date/Timestamp | Thời điểm phát sinh giao dịch |
| `type` | Enum | Loại giao dịch theo enum chuẩn |
| `status` | Enum | Trạng thái giao dịch |
| `amount` | Integer (VND) | Số tiền tuyệt đối (luôn dương) |
| `source_account_id` | UUID | Account nguồn (bị trừ tiền) |
| `destination_account_id` | UUID | Account đích (nhận tiền) - dùng cho transfer |
| `category_id` | UUID | Danh mục chi tiêu/thu nhập |
| `shop_id` | UUID | Cửa hàng/nhà cung cấp (nếu có) |
| `person_id` | UUID | Người liên quan (cho debt/repayment) |
| `note` | String | Ghi chú mô tả giao dịch |
| `persisted_cycle_tag` | String | Tag chu kỳ cashback (YYYY-MM format) |
| `cashback_mode` | Enum | Chế độ cashback áp dụng |
| `cashback_share_percent` | Decimal | Tỷ lệ % cashback chia sẻ |
| `cashback_share_fixed` | Integer | Số tiền cashback cố định chia sẻ |
| `is_installment` | Boolean | Có phải giao dịch trả góp không |
| `installment_plan_id` | UUID | ID kế hoạch trả góp (nếu có) |
| `metadata` | JSON | Dữ liệu mở rộng |
| `created_at` | Timestamp | Thời điểm tạo record |
| `updated_at` | Timestamp | Thời điểm cập nhật gần nhất |

## 5) Quy tắc nghiệp vụ bắt buộc

### 5.1 Công thức tính số dư từ transactions

Mọi biến động số dư account đều được tính từ transactions:

```
current_balance = initial_balance 
  + Σ(income posted) 
  - Σ(expense posted) 
  + Σ(transfer_in posted) 
  - Σ(transfer_out posted) 
  + Σ(cashback posted) 
  + Σ(refund posted) 
  + Σ(repayment posted) 
  - Σ(debt posted)
```

> **Lưu ý:** Chỉ tính transactions có `status = posted`. Giao dịch `pending` hoặc `void` không ảnh hưởng số dư.

### 5.2 Transfer phải atomic

Một giao dịch chuyển tiền PHẢI tạo 2 records riêng biệt:
1. **Transfer Out** (account nguồn): `type = transfer_out`, `source_account_id = A`
2. **Transfer In** (account đích): `type = transfer_in`, `source_account_id = B`

Hai records này phải được tạo/cập nhật trong cùng một transaction boundary (atomic). Không được phép tồn tại trạng thái "trừ nguồn nhưng chưa cộng đích".

### 5.3 Debt/Repayment yêu cầu person_id

- Giao dịch `type = debt` BẮT BUỘC phải có `person_id` (người vay)
- Giao dịch `type = repayment` BẮT BUỘC phải có `person_id` (người trả)
- `amount` luôn là số dương, chiều dòng tiền xác định bởi `type` và `source_account_id`

### 5.4 Cashback calculation

Cashback được tính dựa trên:
- **Real Awarded**: Số tiền cashback thực tế do user nhập hoặc cố định
- **Virtual Profit**: Số tiền cashback ảo tính theo policy (dùng để projection)

Công thức:
```
final_cashback = MIN(real_awarded + virtual_profit, cb_max_budget)
```

### 5.5 Cycle Tag Format

`persisted_cycle_tag` tuân theo chuẩn ISO 8601 month:
- Format: `YYYY-MM` (ví dụ: `2026-03`)
- Áp dụng cho cả calendar_month và statement_cycle
- Statement cycle vẫn dùng tag `YYYY-MM` nhưng date range khác (xem phần cashback cycles)

### 5.6 Loại trừ giao dịch đặc biệt

Các giao dịch sau KHÔNG được tính vào spent_amount cho cashback:
- Giao dịch có `note` chứa "create initial" hoặc "số dư đầu"
- Giao dịch có `category.kind = internal` (chuyển nội bộ)
- Giao dịch `status = void`

### 5.7 Min Spend Gate

Để đạt điều kiện cashback:
```
is_qualified = (spent_amount >= cb_min_spend) OR (cb_min_spend IS NULL)
```

Khi NOT qualified:
- UI hiển thị badge vàng "Need to Spend XYZ"
- Cashback rate có thể giảm về program default (tùy config)

### 5.8 Budget Capping

Mỗi chu kỳ có giới hạn cashback tối đa:
```
capped_amount = MIN(total_earned, cb_max_budget)
loss = total_earned - capped_amount
```

Overflow amount được lưu trong cycle snapshot nhưng không hiển thị trong UI.

### 5.9 Credit Card Balance âm là hợp lệ

Account `type = credit_card` được phép có `current_balance` âm:
- Số âm thể hiện dư nợ phải trả cho ngân hàng
- Không vi phạm business rule khi balance < 0

### 5.10 Xóa giao dịch

- Không được xóa cứng (hard delete) transaction đã ảnh hưởng số dư
- Thay vào đó đặt `status = void` để giữ audit trail
- Void transaction không được tính vào số dư

## 6) Vòng đời trạng thái

```text
pending -> posted
pending -> void
posted  -> void (hiếm, chỉ khi hoàn/hủy)
```

- `pending`: Giao dịch khởi tạo, chờ xác nhận (ví dụ: chờ bank processing)
- `posted`: Giao dịch hoàn tất, số dư được cập nhật
- `void`: Giao dịch hủy, rollback số dư (giữ record để audit)

## 7) Quan hệ dữ liệu

### 7.1 Transaction → Account
- **ManyToOne**: Nhiều transactions thuộc về 1 account (qua `source_account_id`)
- **ManyToOne**: Nhiều transfers thuộc về 1 account đích (qua `destination_account_id`)

### 7.2 Transaction → Category
- **ManyToOne**: Nhiều transactions thuộc về 1 category
- Category xác định loại chi tiêu/thu nhập và áp dụng cashback policy

### 7.3 Transaction → Shop
- **ManyToOne**: Nhiều transactions thuộc về 1 shop
- Shop có thể mapping mặc định với category

### 7.4 Transaction → Person
- **ManyToOne**: Nhiều debt/repayment transactions thuộc về 1 person
- Chỉ áp dụng cho `type = debt` hoặc `repayment`

### 7.5 Transaction → CashbackCycle
- **ManyToOne**: Nhiều transactions thuộc về 1 cashback cycle (qua `persisted_cycle_tag`)
- Cycle group by `account_id + persisted_cycle_tag`

### 7.6 Transaction → InstallmentPlan
- **OneToMany**: 1 transaction gốc có thể tạo nhiều installment records
- `is_installment = true` đánh dấu giao dịch trả góp

## 8) Tích hợp Google Sheets (Transactions master tab)

### 8.1 Mục tiêu

`Transactions` tab là source of truth để:
- Ghi nhận mọi giao dịch tài chính
- Cung cấp dữ liệu tính số dư cho `Accounts` tab
- Tính cashback earned theo cycle
- Track debt/loan theo person
- Làm báo cáo thu/chi/net worth

### 8.2 Mapping cột khuyến nghị cho tab `Transactions`

| Cột | Field | Bắt buộc | Ghi chú |
|---|---|---|---|
| A | `txn_id` | Có | UUID duy nhất |
| B | `txn_date` | Có | Ngày giao dịch (dd/mm/yyyy) |
| C | `status` | Có | `posted/pending/void` |
| D | `type` | Có | `income/expense/transfer_in/transfer_out/cashback/refund/debt/repayment/service` |
| E | `account_id` | Có | Account chịu tác động số dư |
| F | `account_name` | Không | Tên account (để display) |
| G | `amount` | Có | Giá trị tuyệt đối (VND, không decimal) |
| H | `category_id` | Không | ID danh mục |
| I | `category_name` | Không | Tên category (để display) |
| J | `shop_id` | Không | ID cửa hàng |
| K | `shop_name` | Không | Tên shop (để display) |
| L | `person_id` | Không | ID người (cho debt/repayment) |
| M | `person_name` | Không | Tên người (để display) |
| N | `debt_role` | Không | `lent/borrowed` (chỉ dùng cho debt/repayment) |
| O | `target_account_id` | Không | Account đích (cho transfer) |
| P | `note` | Không | Ghi chú |
| Q | `cycle_tag` | Không | Tag chu kỳ cashback (YYYY-MM) |
| R | `cashback_amount` | Không | Số tiền cashback (nếu có) |
| S | `is_installment` | Không | TRUE/FALSE |
| T | `created_at` | Không | Timestamp tạo |
| U | `updated_at` | Không | Timestamp cập nhật |

### 8.3 Nguyên tắc nhập liệu

- Mỗi dòng là 1 giao dịch độc nhất
- Transfer phải có 2 dòng riêng (transfer_out + transfer_in)
- Amount luôn nhập số dương, chiều dòng tiền xác định bởi `type`
- Chỉ `status = posted` mới tính vào số dư cuối kỳ
- Date format: `dd/mm/yyyy`
- VND format: `#,##0` (không decimal)

## 9) Ví dụ dữ liệu transaction thực tế

### 9.1 Income (Lương)

| txn_id | txn_date | status | type | account_id | account_name | amount | category_name | note |
|---|---|---|---|---|---|---:|---|---|
| TXN_INC_001 | 05/03/2026 | posted | income | ACC_TCB_001 | Techcombank | 25000000 | Lương | Lương tháng 3/2026 |

### 9.2 Expense (Ăn uống)

| txn_id | txn_date | status | type | account_id | account_name | amount | category_name | shop_name | note |
|---|---|---|---|---|---|---:|---|---|---|
| TXN_EXP_001 | 06/03/2026 | posted | expense | ACC_MOMO_001 | MoMo | 150000 | Ăn uống | Pizza Hut | Ăn trưa với Linh |

### 9.3 Transfer (Chuyển khoản)

**Dòng 1 - Transfer Out:**
| txn_id | txn_date | status | type | account_id | account_name | amount | target_account_id | note |
|---|---|---|---|---|---|---:|---|---|
| TXN_TRF_OUT_001 | 07/03/2026 | posted | transfer_out | ACC_TCB_001 | Techcombank | 5000000 | ACC_VCB_001 | Chuyển cho VCB |

**Dòng 2 - Transfer In:**
| txn_id | txn_date | status | type | account_id | account_name | amount | target_account_id | note |
|---|---|---|---|---|---|---:|---|---|
| TXN_TRF_IN_001 | 07/03/2026 | posted | transfer_in | ACC_VCB_001 | VCB | 5000000 | ACC_TCB_001 | Nhận từ TCB |

### 9.4 Cashback (Hoàn tiền)

| txn_id | txn_date | status | type | account_id | account_name | amount | category_name | cycle_tag | cashback_amount | note |
|---|---|---|---|---|---|---:|---|---|---|---|
| TXN_CB_001 | 31/03/2026 | posted | cashback | ACC_UOB_001 | Uob | 150000 | Hoàn tiền | 2026-03 | 150000 | Cashback T3/2026 |

### 9.5 Debt (Cho vay)

| txn_id | txn_date | status | type | account_id | account_name | amount | person_id | person_name | debt_role | note |
|---|---|---|---|---|---|---:|---|---|---|---|
| TXN_DEBT_001 | 10/03/2026 | posted | debt | ACC_CASH_001 | Tiền mặt | 2000000 | PER_001 | Nam | lent | Cho Nam mượn |

### 9.6 Repayment (Trả nợ)

| txn_id | txn_date | status | type | account_id | account_name | amount | person_id | person_name | debt_role | note |
|---|---|---|---|---|---|---:|---|---|---|---|
| TXN_REPAY_001 | 20/03/2026 | posted | repayment | ACC_CASH_001 | Tiền mặt | 1000000 | PER_001 | Nam | lent | Nam trả nợ lần 1 |

## 10) Checklist triển khai cho agent/codegen

- [ ] Mọi transaction phải có `status` rõ ràng (posted/pending/void)
- [ ] Transfer luôn tạo 2 records (out + in) trong cùng boundary
- [ ] Debt/repayment BẮT BUỘC có `person_id`
- [ ] Chỉ tính `posted` transactions khi tính số dư
- [ ] Cashback cycle tag format `YYYY-MM`
- [ ] Exclude transactions có note chứa "create initial" hoặc "số dư đầu" khỏi spent_amount
- [ ] Internal category transactions không tính cashback
- [ ] Credit card balance có thể âm (hợp lệ)
- [ ] Không hard delete, chỉ set `status = void`
- [ ] Amount luôn lưu số dương, chiều dòng tiền xác định bởi `type`

## 11) Edge cases cần handle

### 11.1 Giao dịch âm (refund tự động)

Trường hợp hiếm: merchant refund trực tiếp vào statement thẻ tín dụng.
- Xử lý: Tạo transaction `type = refund` với amount dương
- Không lưu amount âm trong database

### 11.2 Transfer circular (A → B → A)

User chuyển A → B rồi ngay lập tức B → A.
- Xử lý: Vẫn tạo 4 records bình thường (2 out + 2 in)
- Không optimize/gộp vì mỗi giao dịch có ý nghĩa nghiệp vụ riêng

### 11.3 Debt repayment > original debt

User trả nhiều hơn số đã vay (ví dụ: trả lãi thêm).
- Xử lý: Vẫn ghi nhận full repayment amount
- Có thể thêm field `interest_amount` nếu cần track riêng

### 11.4 Multiple cashback entries cho 1 transaction

1 transaction có thể chia cashback cho nhiều people.
- Xử lý: Dùng `cashback_entries` table riêng (one-to-many)
- Transaction gốc lưu `cashback_share_percent` hoặc `cashback_share_fixed`

### 11.5 Transaction date vs created date

`occurred_at` (ngày giao dịch thực tế) khác `created_at` (ngày nhập vào hệ thống).
- Luôn dùng `occurred_at` để tính cycle tag và reporting
- `created_at` chỉ dùng cho audit trail

### 11.6 Statement cycle跨越 2 tháng

Statement cycle 25/11 - 24/12 vẫn dùng tag `2025-12` (tháng kết thúc).
- Logic: `cycle_tag = YYYY-MM của ngày kết thúc cycle`
- Date range tính toán dựa vào `statement_day` của account
