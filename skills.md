# 🤖 Agent Skills & Workflows (Obsidian Money)

Tài liệu này định nghĩa các kỹ năng (skills), quy tắc nghiệp vụ (business rules) và luồng xử lý (workflows) dành cho bất kỳ AI Agent nào khi tham gia phát triển hoặc bảo trì repo `obsidian-money`.

---

## 🛠️ Kỹ năng Hiện tại (Implemented Skills)

### 1. Natural Language Transaction Parsing (`agent/src/index.ts`)
- **Mục tiêu:** Chuyển đổi text tự nhiên thành dữ liệu JSON có cấu trúc.
- **Khả năng tự động:** Tự đoán `account_name` (Vpbank, Techcombank, MoMo, Tiền mặt) và `category_name` (Ăn uống, Mua sắm, Di chuyển).
- **Workaround Kỹ thuật:** Đã tích hợp thuật toán lọc bỏ các thẻ `<thinking>...</thinking>` của các dòng model tư duy (Claude 3.7 / 3.5), đảm bảo `JSON.parse()` không bị lỗi cú pháp.

### 2. Auto Account Seeding
- **Mục tiêu:** Khi giao dịch phát sinh trên một tài khoản mới chưa từng có trong DB Supabase, Agent tự động tạo mới record tài khoản đó với `type = cash` và `balance = 0` trước khi insert giao dịch.

### 3. State Transition in Markdown
- **Mục tiêu:** Quản lý vòng đời dữ liệu trực tiếp trên file text.
- **Quy tắc:** Chỉ đọc dữ liệu từ mục `## Unsynced Transactions`. Sau khi xử lý xong, bắt buộc phải dọn sạch mục này và dán nhãn `[x]` chuyển sang `## Synced Transactions`.

---

## 🔮 Kỹ năng & Workflows Cần Mở Rộng (Future Skills)

### Workflow 1: N8N to Google Sheets Sync
- **Trigger:** Webhook từ Supabase khi có bản ghi mới trong bảng `transactions` (`status = posted`).
- **Action:** Gửi payload sang n8n -> Format dữ liệu -> Gọi node Google Sheets (Append Row).
- **Yêu cầu AI Agent:** Khi phát triển tính năng này, cần xuất file JSON của workflow n8n và lưu vào thư mục `n8n/workflows/`.

### Workflow 2: DataviewJS Realtime Dashboard
- **Mục tiêu:** Biến file `Dashboard.md` trong Obsidian thành một màn hình quản lý tài chính động.
- **Skill cần thiết:** Viết đoạn mã JavaScript nhúng trong block `\`\`\`dataviewjs`. Mã này sẽ gọi Supabase REST API (đọc `current_balance` từ bảng `accounts` và `remaining_amount` từ bảng `debts`) và hiển thị thành bảng số liệu, thanh tiến trình (progress bar `▓▓▓░░`) ngay trong Obsidian.

### Workflow 3: Debt & Cashback Lifecycle Management
- **Mục tiêu:** Xử lý nghiệp vụ phức tạp của việc trả nợ (FIFO) và chu kỳ hoàn tiền (Statement cycle).
- **Skill cần thiết:** Xây dựng các Supabase Edge Functions (TypeScript). Khi có giao dịch trả nợ (`repayment`), tự động trừ số tiền còn nợ của các khoản vay cũ nhất theo logic FIFO.
