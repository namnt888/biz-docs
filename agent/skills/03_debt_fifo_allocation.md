# Skill 03: Debt FIFO Repayment Allocation

## Mục tiêu
Tự động hóa toàn bộ vòng đời quản lý nợ (`debts`) và phân bổ tiền trả nợ (`repayment`) một cách thông minh mà không cần sự can thiệp thủ công.

## Vòng đời trạng thái (Status Lifecycle)
```text
[New Debt] (pending) ---> [Partial Repayment] (partial) ---> [Full Repay] (settled)
```
- Mọi giao dịch `type = debt` hoặc `repayment` bắt buộc phải gắn với một `person_id`.
- Trạng thái của khoản nợ được tính tự động:
  - `remaining_amount > 0 && repaid_amount == 0` -> **`pending`**
  - `remaining_amount > 0 && repaid_amount > 0` -> **`partial`**
  - `remaining_amount <= 0` -> **`settled`**

## Thuật toán phân bổ FIFO (First-In-First-Out)
Khi người dùng tạo một giao dịch trả nợ (`type = repayment`) mang tên một người (`person_id`) nhưng không chỉ định đích danh trả cho khoản nợ cụ thể nào:
1. Hệ thống tìm tất cả các khoản nợ của người đó có trạng thái `pending` hoặc `partial`, sắp xếp theo thứ tự thời gian tạo cũ nhất trước (`occurred_at ASC`).
2. Trừ dần số tiền trả vào khoản nợ cũ nhất. Nếu khoản nợ cũ nhất tất toán xong (`remaining_amount = 0`), số dư còn lại tiếp tục được phân bổ cho khoản nợ liền kề.
3. **Overpayment (Trả dư)**: Nếu số tiền trả lớn hơn tổng nợ còn lại, khoản nợ cuối cùng được tất toán về 0. Phần dư thừa được lưu vào `metadata.overpayment` để khấu trừ cho các lần phát sinh nợ tiếp theo hoặc tính là tiền lãi/tip.
