# 🚀 Obsidian Money (Personal Finance Architecture)

Hệ thống quản lý tài chính cá nhân ứng dụng AI và phương pháp **Text-First** trên Obsidian.

## 🌟 Kiến trúc Tổng quan (Architecture)

```text
┌────────────────────────────────────────────────────────┐
│                   OBSIDIAN VAULT                       │
│  (01_Daily_Logs/Today.md -> Nhập liệu text tự nhiên)   │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼ (npm run start / watch)
┌────────────────────────────────────────────────────────┐
│                    AI PARSING AGENT                    │
│   (TypeScript + OpenAI Gateway -> Bóc tách JSON chuẩn) │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼ (Supabase REST API)
┌────────────────────────────────────────────────────────┐
│                SUPABASE CLOUD DATABASE                 │
│  (PostgreSQL -> Lưu trữ ACID + Triggers tính Balance)  │
└────────────────────────────────────────────────────────┘
```

---

## 🛠️ Hướng dẫn Cài đặt & Vận hành

### 1. Cấu hình biến môi trường
Trong thư mục `agent/`, copy file `.env.example` thành `.env` và điền cấu hình:
```env
AI_BASE_URL=http://localhost:20128/v1  # Gateway 9Router hoặc proxy của bạn
AI_API_KEY=your_key_here
AI_MODEL=rei                           # Combo model

SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
OBSIDIAN_VAULT_PATH=../vault
```

### 2. Cài đặt thư viện
```bash
cd agent
npm install
```

### 3. Vận hành Agent (Đồng bộ giao dịch)
```bash
npm run start
```

---

## 🔄 Cơ chế Đồng bộ (Sync vs Unsync Mechanism)

Để mang lại trải nghiệm gõ phím mượt mà và tự nhiên nhất cho người dùng, hệ thống sử dụng cơ chế **State-based Section Separation** trực tiếp trên file Markdown (`Today.md`).

### Quy trình hoạt động:

1. **Nhập liệu (Unsynced State):** Người dùng mở file `vault/01_Daily_Logs/Today.md` bằng Obsidian và gõ các giao dịch mới dưới header `## Unsynced Transactions`.
   ```markdown
   ## Unsynced Transactions
   - ăn trưa cơm tấm 50k Vpbank
   - mua sách 150k MoMo
   ```

2. **Bóc tách (AI Extraction):** Khi chạy `npm run start`, script sẽ phân tích nội dung file, gom tất cả các dòng text dưới mục Unsynced, gửi cho AI (đã cấu hình system prompt cực chặt) để chuyển hóa sang JSON array.

3. **Ghi DB (Supabase Sync):** Script tra cứu hoặc tạo mới Account tương ứng trong Supabase, sau đó ghi các bản ghi vào bảng `transactions`. DB Triggers tự động cập nhật số dư `current_balance` của các tài khoản ngay lập tức.

4. **Dọn dẹp & Chuyển trạng thái (State Transition):** Sau khi ghi DB thành công, script sẽ:
   - Xóa sạch các dòng dưới mục `## Unsynced Transactions` để ngăn việc đồng bộ lại (ngăn double-sync).
   - Dán nhãn markdown hoàn thành `[x]` kèm theo mốc thời gian `(✅ synced at hh:mm)`.
   - Bổ sung các dòng đã xử lý xuống mục `## Synced Transactions`.
   ```markdown
   ## Synced Transactions
   - [x] ăn trưa cơm tấm 50k Vpbank (✅ synced at 12:30)
   - [x] mua sách 150k MoMo (✅ synced at 12:30)
   ```

Cơ chế này đảm bảo dữ liệu luôn toàn vẹn, cho phép người dùng kiểm tra lịch sử đồng bộ trực quan ngay trên Obsidian mà không cần bất kỳ giao diện Web phức tạp nào.
