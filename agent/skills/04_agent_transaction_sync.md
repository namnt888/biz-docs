# Skill 04: Thêm và Đồng bộ Giao dịch Tự động (Agent Workflow)

## Mục tiêu
Khi người dùng nhập một câu giao dịch tự nhiên (Ví dụ: `Lâm Tpbank Out 06-05 Điện T4 1.971.346`) trực tiếp vào CLI Chat của Agent, Agent phải tự động nhận diện tháng, ghi nhận vào file ghi chép tháng tương ứng của Obsidian và gọi lệnh đồng bộ trực tiếp lên Supabase mà không cần người dùng thao tác thủ công.

## Quy trình thực thi (Agentic Workflow)

1. **Phân tích Thời gian & Xác định File Ghi Chép:**
   * Dựa trên chuỗi giao dịch người dùng nhập (Ví dụ có chứa ngày tháng `06-05` hoặc `15/06`), Agent kết hợp với năm hiện tại (Ví dụ: `2026`) để xác định tháng ghi nhận là `2026-05` hoặc `2025-06`.
   * Tìm file monthly log tương ứng tại: `vault/01_Monthly_Logs/<YYYY-MM>.md`.

2. **Khởi tạo file nếu chưa tồn tại:**
   * Nếu file `<YYYY-MM>.md` chưa tồn tại, Agent chạy lệnh:
     `npm run start -- ../vault/01_Monthly_Logs/<YYYY-MM>.md`
     (Chạy lần đầu không có giao dịch thì `index.ts` sẽ tự động tạo file log trống theo template chuẩn).

3. **Ghi đè giao dịch vào mục Unsynced:**
   * Đọc nội dung file `<YYYY-MM>.md`.
   * Định vị section `## 📥 Unsynced Transactions` và hộp thoại `> [!todo] Gõ hoặc paste...`.
   * Thêm dòng giao dịch mới của người dùng vào ngay dưới hộp thoại đó dưới dạng list item:
     `> - <Nội dung giao dịch tự nhiên>`
   * Lưu lại file.

4. **Kích hoạt đồng bộ trực tiếp:**
   * Chạy lệnh command terminal để đồng bộ ngay lập tức:
     `npm run start -- ../vault/01_Monthly_Logs/<YYYY-MM>.md`
   * Việc chạy lệnh này sẽ parse giao dịch bằng LLM, đẩy lên Supabase, cập nhật công nợ/hoàn tiền và tự dọn sạch mục `Unsynced` trong file Obsidian.
