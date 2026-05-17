# 🧠 Agent Skills & Workflows (Obsidian Money)

Tài liệu này lưu trữ các kỹ năng (skills) và quy tắc (guidelines) dành cho bất kỳ AI Agent nào làm việc trên repository này trong tương lai.

---

## Skill 1: Transaction Parsing & Cleanup (Natural Language -> SQL)

### Workflow
1. Khi nhận nhiệm vụ xử lý giao dịch tự nhiên, luôn kiểm tra file `vault/01_Daily_Logs/Today.md`.
2. Bóc tách phần text dưới header `## Unsynced Transactions`.
3. Bắt buộc yêu cầu AI Gateway xuất ra mảng JSON theo chuẩn:
   ```json
   {
     "occurred_at": "ISO-8601",
     "type": "expense | income | transfer_in | transfer_out | debt | repayment",
     "amount": number,
     "note": string,
     "account_name": string,
     "category_name": string
   }
   ```
4. **Xử lý đặc thù (Claude 3.5 / 3.7 Thinking Models):** Khi chạy qua 9Router hoặc OpenRouter, AI có thể sinh ra thẻ `<thinking>...</thinking>`. Phải dùng regex dọn sạch các thẻ này trước khi `JSON.parse`.
5. Sau khi insert DB thành công, di chuyển text gốc xuống `## Synced Transactions` với nhãn `- [x] <text> (✅ synced at <time>)`.

---

## Skill 2: Supabase Schema & Triggers Interaction

### Quy tắc ACID
- Mọi biến động số dư tài khoản (`current_balance`) KHÔNG BAO GIỜ được update thủ công từ client hay agent. Luôn dựa vào Trigger `calculate_account_balance()` trong PostgreSQL.
- Khi tạo 1 giao dịch chuyển tiền (`transfer`), bắt buộc tạo 2 records: `transfer_out` cho tài khoản nguồn và `transfer_in` cho tài khoản đích.
- Khi làm việc với `debts` (khoản nợ / cho vay), Trigger `calculate_debt_remaining_amount()` sẽ tự động trừ `repaid_amount` và chuyển `status` sang `partial` hoặc `settled`.

---

## Skill 3: Obsidian DataviewJS Dashboarding

### Workflow hiển thị
- Giao diện người dùng hoàn toàn nằm trong Obsidian (thư mục `vault/00_Dashboard`).
- Khi phát triển UI mới, không tạo React / Vue app.
- Sử dụng code block `dataviewjs` kết hợp `fetch()` gọi trực tiếp REST API (PostgREST) của Supabase để query dữ liệu realtime và dùng bảng markdown hoặc SVG để vẽ biểu đồ.

---

## Skill 4: Automation & Sync (n8n & Google Sheets)

### Workflow Webhook Sync
- Database Supabase sử dụng **Database Webhooks** (bắn HTTP POST khi table `transactions` có insert mới mang `status = posted`).
- Agent hoặc n8n lắng nghe webhook này để định dạng ngày tháng/số tiền và gọi API **Append Row** vào Google Sheets gốc để đảm bảo tính năng lưu trữ append-only.
