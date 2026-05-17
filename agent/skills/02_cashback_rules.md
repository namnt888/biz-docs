# Skill 02: Cashback Calculation Engine (6 Modes)

## Mục tiêu
Theo dõi các chu kỳ hoàn tiền (cashback cycles) và tự động tính toán số tiền hoàn thực nhận / dự kiến dựa trên các quy tắc thẻ tín dụng hoặc chương trình khuyến mãi.

## Phân loại chu kỳ (Cycle Types)
- **`calendar_month`**: Tính từ ngày 01 đến ngày cuối cùng của tháng dương lịch (Ví dụ: 01/05 - 31/05).
- **`statement_cycle`**: Tính theo ngày sao kê thẻ tín dụng. Nếu ngày sao kê là 25, chu kỳ tháng 5 (`2026-05`) sẽ bắt đầu từ 25/04 đến 24/05.

## 6 Chế độ Cashback (Cashback Modes)
1. **`none_back`** (Mặc định): Không chia sẻ hoàn tiền với ai. Tiền hoàn tính theo % thẻ và chỉ ghi nhận vào `virtual_profit` (dự kiến).
2. **`percent`**: Chia sẻ hoàn tiền theo % cho một người khác (`person_id`). Ví dụ: Đi ăn chung, share 50% hoàn tiền cho bạn.
3. **`fixed`**: Chia sẻ một số tiền hoàn cố định cho người khác.
4. **`real_fixed`**: Đã nhận chính xác số tiền hoàn thực tế từ ngân hàng. Ghi nhận trực tiếp vào `real_awarded`.
5. **`real_percent`**: Tiền hoàn thực tế tính theo % trên giao dịch.
6. **`voluntary`**: Tiền hoàn tự nguyện thưởng cho người khác, không bị giới hạn bởi `cb_max_budget`.

## Quy tắc giới hạn (Budget & Min Spend)
- **Min Spend Gate (`cb_min_spend`)**: Nếu tổng chi tiêu trong chu kỳ (`spent_amount`) chưa đạt ngưỡng tối thiểu, chu kỳ sẽ bị đánh cờ `is_qualified = false`.
- **Budget Cap (`cb_max_budget`)**: Số tiền hoàn tối đa nhận được per chu kỳ. Nếu vượt ngưỡng, phần chênh lệch sẽ được tính vào `loss_amount`.
