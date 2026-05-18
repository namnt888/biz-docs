# 🏛️ Obsidian Money System Blueprint

Tài liệu này lưu trữ toàn bộ kiến trúc, mục tiêu và tiến độ của hệ thống quản lý tài chính cá nhân trong Obsidian kết hợp AI và Supabase. Hãy đọc file này trước mỗi Sprint để nắm bắt bối cảnh.

## 🎯 Mục đích (Purpose)
Xây dựng một hệ thống quản lý chi tiêu (Personal Finance) ngay trong Obsidian:
- Tận dụng thói quen ghi chú hàng ngày (Daily/Monthly Logs) bằng văn bản tự nhiên.
- Dùng AI (LLM) bóc tách văn bản thành dữ liệu có cấu trúc.
- Lưu trữ trên PostgreSQL (Supabase) để truy vấn nhanh qua Dataview.
- Hỗ trợ nghiệp vụ phức tạp: Công nợ (Debt FIFO), Hoàn tiền (Cashback), và Phân tích Dòng tiền.

## 🏗️ Kiến trúc Hệ thống
- **Frontend (Obsidian):** Nơi người dùng ghi chép (vào file Monthly Log). Sử dụng `DataviewJS` để render Dashboard, thông kê thẻ, công nợ. Có `QuickAdd` và `Modal Form` để nhập liệu nâng cao.
- **Background Daemon (Node.js/Chokidar):** Theo dõi sự thay đổi của file `Monthly Logs/*.md`. Gửi đoạn text chưa đồng bộ (Unsynced) sang AI.
- **AI Gateway:** Chuyển đổi text tự nhiên -> JSON payload (`index.ts`).
- **Backend Services:**
  - `transaction.ts`: Xử lý giao dịch cơ bản.
  - `cashback.ts`: Tính toán % hoàn tiền, hoàn tiền cố định, tạo chu kỳ hoàn tiền.
  - `debt.ts`: Khấu trừ FIFO, tạo công nợ (Lent/Borrowed) cho các chi tiêu có gán `person_name`.
- **Database (Supabase):** Chứa các bảng `accounts`, `categories`, `transactions`, `cashback_cycles`, `debts`, `people`.
- **Sync (n8n):** Webhook đẩy realtime từ Supabase sang Google Sheets.

## 🚀 Tiến độ (Progress & Sprints)
- ✅ **Phase 1-3:** Bootstrapping DDL, AI Parsing Engine, Cơ sở hạ tầng Backend.
- ✅ **Phase 4:** Tích hợp Obsidian (Chokidar Daemon, Monthly Logs, QuickAdd).
- ✅ **Phase 5:** Advanced Business Logic (Net Final Price, Cashback % tính toán tự động, FIFO Debt Engine). Đồng bộ Webhook n8n Google Sheets.
- ✅ **Phase 6:** Obsidian Ecosystem (Tự động sinh page Accounts/People, Callouts, Backlinks, Dataview Dashboards).
- 🔄 **Phase 6.5 (Refinements):**
  - Chuyển `Synced Transactions` thành Markdown Table.
  - Sửa cột Dataview trong People/Accounts để có Deep-link và Cashback/Net Price.
  - Đóng gói lệnh `npm run generate-pages` vào `package.json`.
- ⏳ **Future Phases:**
  - Batch transfer (chuyển khoản theo lô).
  - Phân tích chi tiết Cashflow Chart (Obsidian Charts).

## 📝 Quy trình phát triển (Guide cho AI)
1. Luôn check `Blueprint.md` để hiểu kiến trúc.
2. Code Typescript nằm trong `agent/src/`.
3. Khi sửa Database, nhớ viết Migration/DDL sql nếu cần.
4. Đảm bảo mọi tính năng Obsidian đều hoạt động mượt mà offline-first, sync background.
