# 🔌 Hướng dẫn Thiết lập Nhập liệu Native qua QuickAdd & Modal Form

> Phương pháp này thay thế hoàn toàn các đoạn code HTML trong note bằng giao diện hộp thoại (pop-up modal) mượt mà và đồng bộ trực tiếp lên Supabase.

---

## 🚀 Các Bước Cấu hình trong Obsidian

### Bước 1: Cài đặt Plugin
1. Trong Obsidian, vào **Settings** -> **Community plugins** -> Bấm **Browse**.
2. Tìm và cài đặt plugin **QuickAdd** và **Modal Form**. Bấm **Enable** cả hai.

### Bước 2: Thiết lập Modal Form
1. Vào **Settings** -> **Modal Form** -> Chọn tab **Form Definitions** -> Bấm **New form**.
2. Đặt tên form là `add_transaction_form`.
3. Bổ sung các trường dữ liệu (Fields) sau:
   - `type` (Select): `🔴 Chi tiêu: expense`, `🟢 Thu nhập: income`, `🤝 Cho vay: debt`, `🤝 Thu nợ: repayment`.
   - `account` (Select): Để trống (QuickAdd macro sẽ tự động nạp dữ liệu từ DB vào).
   - `amount` (Number): Nhập số tiền (VND).
   - `note` (Text): Nội dung ghi chú.
   - `fee` (Number): Phí dịch vụ (nếu có).
   - `debt_cycle` (Text): Kỳ nợ (ví dụ: `2026-04`).

### Bước 3: Cấu hình QuickAdd Macro
1. Vào **Settings** -> **QuickAdd** -> Chọn **Manage Macros** -> Bấm **Add macro** (Tên: `Add Transaction DB`).
2. Mở macro vừa tạo -> Chọn **User Scripts** -> Tìm và chọn file `vault/99_System/QuickAdd/Add_Transaction_Macro.js`.
3. Quay lại màn hình chính của QuickAdd -> Tạo 1 command mới tên **"⚡ Nhập Giao Dịch"** với kiểu là **Macro** -> Chọn macro vừa tạo.
4. Bấm vào biểu tượng tia sét (⚡) bên cạnh command để bật gán phím tắt (Hotkey).

### Bước 4: Gán Phím Tắt (Hotkey)
1. Vào **Settings** -> **Hotkeys** -> Tìm `QuickAdd: ⚡ Nhập Giao Dịch`.
2. Gán phím tắt tùy thích (ví dụ: `Cmd + Shift + A` trên Mac).

---

## 🎉 Trải nghiệm Hoàn hảo
Mỗi khi bạn cần ghi tiêu tiền, chỉ cần bấm `Cmd + Shift + A`. Bảng nhập liệu tuyệt đẹp bật lên, bạn chọn tài khoản và điền tiền -> Xong! Không cần mở file, không tạo rác trong Obsidian.
