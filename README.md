# 🚀 Obsidian Money - Personal Finance Operating System

**Obsidian Money** là hệ thống quản lý tài chính cá nhân tự động hóa cao, kết hợp giao diện ghi chép tự nhiên bằng **Obsidian**, xử lý dữ liệu qua **AI Agent (9Router / OpenAI / Claude)**, và lưu trữ tập trung trên **Supabase**.

---

## 🏗 Cấu trúc dự án (Monorepo)

```text
biz-docs/
│
├── vault/                      # 📓 Thư mục mở bằng Obsidian (Obsidian Vault)
│   ├── 00_Dashboard/Dashboard.md
│   ├── 01_Daily_Logs/Today.md  # Nơi ghi chép chi tiêu tự nhiên
│   └── 99_System/Context/      # Chứa tài liệu đặc tả nghiệp vụ & từ khóa
│
├── supabase/                   # 🗄️ Database & Backend Logic
│   └── migrations/             # SQL schema (accounts, txns, debts, triggers)
│
└── agent/                      # 🤖 Tool CLI/Script TypeScript parse text thành JSON
    ├── src/index.ts            # Logic kết nối AI & đồng bộ Supabase
    ├── package.json
    └── .env.example
```

---

## ⚙️ Cơ chế hoạt động (Sync vs Unsync Mechanism)

### 1. Ghi chép tự nhiên (Unsynced)
Hàng ngày, bạn mở file `vault/01_Daily_Logs/Today.md` bằng ứng dụng Obsidian và ghi các khoản chi tiêu/thu nhập vào mục `## Unsynced Transactions` bằng ngôn ngữ tự nhiên:
```markdown
## Unsynced Transactions
- ăn sáng 45k Vpbank
- đổ xăng 60k MoMo
```

### 2. Xử lý tự động qua AI Agent
Khi chạy lệnh `npm run start` trong thư mục `agent/`:
1. **Đọc file:** Agent mở file `Today.md`, quét và gom tất cả các dòng dưới mục `## Unsynced Transactions`. Nếu không có dòng nào, Agent sẽ thông báo `No unsynced transactions found to process.` và dừng lại để tránh xử lý trùng.
2. **AI Parsing:** Gửi các dòng chưa đồng bộ qua cổng AI Gateway (ví dụ: 9Router ở `http://localhost:20128/v1` với model `rei`). AI sẽ bóc tách và loại bỏ các thẻ `<thinking>` để trả về mảng JSON chuẩn:
   ```json
   [
     { "amount": 45000, "note": "ăn sáng", "account_name": "Vpbank", "category_name": "Ăn uống" },
     { "amount": 60000, "note": "đổ xăng", "account_name": "MoMo", "category_name": "Di chuyển" }
   ]
   ```
3. **Đồng bộ DB:** Agent tìm (hoặc tạo) ID tài khoản trên Supabase và ghi dữ liệu vào bảng `transactions`.
4. **Cập nhật trạng thái (Synced):** Agent xóa sạch mục `## Unsynced Transactions` và dán nhãn thành công để chuyển xuống mục `## Synced Transactions`:
   ```markdown
   ## Synced Transactions
   - [x] ăn sáng 45k Vpbank (✅ synced at 07:57)
   - [x] đổ xăng 60k MoMo (✅ synced at 07:57)
   ```

---

## 🛠 Hướng dẫn cài đặt & sử dụng

### 1. Khởi tạo Database Supabase
1. Đăng nhập [Supabase Cloud](https://supabase.com/). Tạo 1 Project mới.
2. Mở **SQL Editor**, copy toàn bộ nội dung trong `supabase/migrations/20260516_initial_schema.sql` và chạy (Run) để khởi tạo các bảng và Triggers.

### 2. Cấu hình biến môi trường
1. `cd agent/`
2. Copy `.env.example` thành `.env`
3. Điều chỉnh các thông số trong `.env`:
   ```env
   # AI Gateway (Sử dụng 9Router local hoặc OpenRouter, Groq,...)
   AI_BASE_URL=http://localhost:20128/v1
   AI_API_KEY=your_proxy_key
   AI_MODEL=rei

   # Supabase
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_anon_key
   ```

### 3. Chạy Agent đồng bộ
```bash
cd agent
npm install
npm run start
```
*(Bạn có thể cấu hình cronjob hoặc tạo hotkey trong Obsidian để tự động chạy lệnh này).*
