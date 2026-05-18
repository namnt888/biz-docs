# Skill 01: Natural Language Transaction Parsing

## Mục tiêu
Chuyển đổi văn bản ghi chép chi tiêu tự nhiên của người dùng thành cấu trúc JSON chuẩn xác để lưu trữ vào cơ sở dữ liệu.

## Quy trình thực thi (Agentic Workflow)
1. **Lấy dữ liệu đầu vào:** Quét file `vault/01_Daily_Logs/Today.md`. Chỉ lấy các dòng nằm dưới mục `## Unsynced Transactions`.
2. **Tiền xử lý ngữ cảnh:** Đọc danh sách tài khoản (`accounts`) và danh mục (`categories`) hiện có trong hệ thống để thực hiện đối chiếu (fuzzy matching).
3. **Gọi LLM (9Router/Claude/OpenAI):** Gửi prompt yêu cầu xuất dữ liệu theo định dạng JSON chuẩn.
4. **Bóc tách JSON (Robust Parser):** Do các LLM dòng suy luận (Thinking models) thường trả về khối `<thinking>...</thinking>`, Agent phải loại bỏ toàn bộ các thẻ này bằng regex và trích xuất chuỗi nằm giữa `[` và `]` đầu tiên/cuối cùng trước khi gọi `JSON.parse`.
5. **Đồng bộ và Dán nhãn:** Sau khi ghi nhận thành công lên Supabase, Agent chuyển các dòng đã xử lý xuống mục `## Synced Transactions` với định dạng:
   `- [x] <nội dung gốc> (✅ synced at <thời gian>)`
