# Đặc tả nghiệp vụ: Accounts

## 1) Tổng quan nghiệp vụ

`Account` là thực thể đại diện cho nơi giữ tiền/ghi nhận số dư trong hệ thống Money Flow, gồm:
- Tài khoản ngân hàng (ví dụ: **Techcombank**, **VCB**)
- Ví điện tử (ví dụ: **MoMo**, **ZaloPay**)
- Ví tiền mặt (**Tiền mặt**)
- Tài khoản thẻ tín dụng
- Tài khoản đầu tư

Accounts là điểm vào/ra của mọi dòng tiền. Mọi tính toán tài sản, nợ, cashback, debt/loan đều quy chiếu từ giao dịch gắn với account.

## 2) Kiểu tài khoản (Account Type)

Giá trị chuẩn cho `type`:
- `bank`
- `wallet`
- `cash`
- `credit_card`
- `investment`

## 3) Trạng thái tài khoản (Account Status)

Giá trị chuẩn cho `status`:
- `active`: dùng bình thường, cho phép tạo giao dịch mới
- `inactive`: tạm khóa, không cho tạo giao dịch mới
- `archived`: lưu trữ (soft-delete), ẩn khỏi UI chính nhưng vẫn giữ toàn bộ lịch sử

## 4) Thuộc tính cốt lõi

| Thuộc tính | Ý nghĩa nghiệp vụ |
|---|---|
| `id` | Định danh duy nhất của account |
| `name` | Tên hiển thị (VD: Techcombank, VCB, MoMo, ZaloPay, Tiền mặt) |
| `type` | Nhóm tài khoản theo enum chuẩn |
| `currency` | Mặc định `VND` |
| `initial_balance` | Số dư đầu kỳ/đầu hệ thống |
| `current_balance` | Số dư hiện tại (tính từ công thức nghiệp vụ) |
| `icon` | URL hoặc key icon nhận diện tài khoản |
| `color` | Màu nhận diện trên UI/report |
| `is_default` | `true` nếu là account mặc định khi mở form tạo giao dịch |
| `owner` | Chủ sở hữu account (cá nhân/nhóm) |

## 5) Quy tắc nghiệp vụ bắt buộc

### 5.1 Công thức số dư

`current_balance = initial_balance + income - expense - transfer_out + transfer_in + cashback + refund + debt_inflow - debt_outflow`

Trong đó:
- `income`: dòng tiền vào account
- `expense`: dòng tiền ra account
- `transfer_out`: chuyển khoản ra account khác
- `transfer_in`: nhận chuyển khoản từ account khác
- `cashback`: hoàn tiền thẻ/tài khoản vào chính account phát sinh
- `refund`: tiền hoàn trả vào account đã chi trước đó
- `debt_outflow`: tiền cho người khác mượn (ra khỏi account)
- `debt_inflow`: tiền thu nợ/nhận lại tiền (vào account)

> Ghi chú: Nếu hệ thống dùng type `debt`/`repayment` thì quy đổi `debt_outflow` và `debt_inflow` theo chiều dòng tiền của transaction.

### 5.2 Chuyển tiền giữa accounts phải atomic

Một giao dịch chuyển tiền phải cập nhật **đồng thời**:
1. Ghi nợ account nguồn (`transfer_out`)
2. Ghi có account đích (`transfer_in`)

Không được cho phép trạng thái “trừ nguồn nhưng chưa cộng đích” hoặc ngược lại.

### 5.3 Thẻ tín dụng

- Account `type = credit_card` được phép có `current_balance` âm
- Số âm thể hiện nợ phải trả cho ngân hàng phát hành thẻ

### 5.4 Cashback & Refund

- Cashback luôn cộng vào account phát sinh giao dịch đủ điều kiện
- Refund luôn cộng vào account đã bị trừ tiền trong giao dịch gốc

### 5.5 Debt/Loan

- Tiền cho vay ra (lent out) làm **giảm** số dư account
- Tiền thu hồi/nhận vào (repayment/inflow) làm **tăng** số dư account

### 5.6 Xóa account

- Không được xóa cứng account nếu đã có giao dịch liên kết
- Thay vào đó chuyển `status = archived`

### 5.7 Account mặc định

- `is_default = true` nghĩa là account được pre-select trong form tạo giao dịch mới
- Chỉ nên có tối đa 1 account mặc định trên mỗi phạm vi owner/currency (khuyến nghị quản trị dữ liệu)

## 6) Vòng đời trạng thái

```text
active  -> inactive  -> active
active  -> archived
inactive -> archived
```

- `active`: trạng thái vận hành chính
- `inactive`: tạm dừng, không nhận giao dịch mới
- `archived`: lưu trữ lịch sử, không hiển thị ở luồng thao tác thường ngày

## 7) Quan hệ dữ liệu

- **Account → Transactions**: one-to-many (một account có nhiều transactions)
- **Account → People**: quan hệ gián tiếp qua transactions debt/loan
- **Account → Cashback cycles**: quan hệ gián tiếp qua cashback transactions/entries

## 8) Tích hợp Google Sheets (Accounts master tab)

### 8.1 Mục tiêu

`Accounts` tab là bảng master để:
- Quản lý metadata account
- Tính/hiển thị `current_balance` từ `Transactions` tab (source of truth)
- Cung cấp dữ liệu cho dashboard tài sản, nợ, net worth

### 8.2 Mapping cột khuyến nghị cho tab `Accounts`

| Cột | Field | Bắt buộc | Ghi chú |
|---|---|---|---|
| A | `id` | Có | ID duy nhất, dùng join với Transactions |
| B | `name` | Có | VD: Techcombank, VCB, MoMo, ZaloPay, Tiền mặt |
| C | `type` | Có | `bank/wallet/cash/credit_card/investment` |
| D | `status` | Có | `active/inactive/archived` |
| E | `currency` | Có | Mặc định `VND` |
| F | `initial_balance` | Có | Số dư ban đầu |
| G | `current_balance` | Có (formula) | Tính từ Transactions |
| H | `icon` | Không | URL hoặc icon key |
| I | `color` | Không | Màu hiển thị |
| J | `is_default` | Có | TRUE/FALSE |
| K | `owner` | Không | Chủ account |
| L | `last_txn_date` | Không (formula) | Ngày giao dịch gần nhất |
| M | `updated_at` | Không | Timestamp đồng bộ |

### 8.3 Nguyên tắc tính số dư trên Google Sheets

- Không nhập tay `current_balance` ở cột G
- Luôn tính từ `initial_balance` + tổng hợp giao dịch theo `account_id`
- Chỉ tính transaction `status = posted` (hoặc trạng thái đã chốt tương đương)
- Giao dịch transfer phải tách rõ chiều vào/ra để tránh double-count

## 9) Ví dụ dữ liệu account thực tế

| id | name | type | status | currency | initial_balance |
|---|---|---|---|---|---:|
| ACC_TCB_001 | Techcombank | bank | active | VND | 50000000 |
| ACC_VCB_001 | VCB | bank | active | VND | 12000000 |
| ACC_MOMO_001 | MoMo | wallet | active | VND | 800000 |
| ACC_ZALOPAY_001 | ZaloPay | wallet | active | VND | 350000 |
| ACC_CASH_001 | Tiền mặt | cash | active | VND | 2000000 |

## 10) Checklist triển khai cho agent/codegen

- Dùng `Transactions` làm source of truth khi tính số dư
- Không cho delete cứng account có transactions
- Tôn trọng trạng thái `inactive`/`archived` khi tạo giao dịch
- Đảm bảo transfer cập nhật 2 chiều theo cùng transaction boundary (atomic)
- Cashback/refund luôn credit về account gốc
