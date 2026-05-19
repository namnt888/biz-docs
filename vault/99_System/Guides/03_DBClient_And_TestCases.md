# 🗄️ Hướng dẫn Setup Database Client & Test Cases (Sprint 6)

> Chuẩn bị cho Sprint 6: Kết nối CSDL trực tiếp, test AI Parsing, và theo dõi dữ liệu realtime.

---

## PHẦN 1: Quản lý Supabase không cần Trình Duyệt (DBeaver / TablePlus)

Supabase bản chất là một database **PostgreSQL** mạnh mẽ. Bạn hoàn toàn có thể dùng các app quản lý DB miễn phí như **DBeaver** (Windows/Mac) hoặc **TablePlus** (Mac) để xem, sửa, xóa dữ liệu siêu mượt.

### Cách lấy thông số kết nối từ Supabase:
1. Vào Supabase Dashboard → **Project Settings** (biểu tượng bánh răng)
2. Chọn mục **Database** ở menu trái.
3. Kéo xuống phần **Connection string** → Chọn tab **URI**.
4. Copy chuỗi kết nối, nó có dạng:
   `postgresql://postgres.xxxxxx:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`

### Hướng dẫn kết nối bằng DBeaver (Miễn phí 100%)
1. Tải và cài đặt: [dbeaver.io](https://dbeaver.io)
2. Mở DBeaver, bấm icon 🔌 **New Database Connection** góc trái trên.
3. Chọn **PostgreSQL** → Next.
4. Ở tab **Main**, mục **URL**, paste chuỗi kết nối URI bạn vừa copy vào. (Hoặc chọn tab "Connect by URL" và dán vào).
5. Đảm bảo điền đúng Password của database bạn đã tạo lúc đầu.
6. Bấm **Test Connection** → Success thì bấm **Finish**.
7. *Xong! Giờ bạn có thể mở schema `public` -> `tables` để xem realtime toàn bộ bảng (debts, transactions, accounts, people).*

---

## PHẦN 2: Bộ Test Cases Thực Tế (Tháng 2025-06)

Hãy mở Hermes Agent (hoặc Claude) và yêu cầu:
*"Hãy ghi các giao dịch sau vào file `vault/01_Monthly_Logs/2025-06.md` ở mục Unsynced:"*

### Bộ Text Copy/Paste cho Agent:

```text
> - Lâm vay 500k Vpbank ngày 05/06/2025
> - Out	15-06	Tiền điện	1.200.000	0,00	Power	Vpbank
> - Ashley Vpbank Out	20-06	Đi siêu thị chung	350.000	2,00	CoopMart
> - ăn tối 150k giảm 5% Vpbank ngày 25/06/2025
```

*(Lưu ý: Ashley là người mới hoàn toàn, hệ thống sẽ phải tự detect và tạo user).*

---

## PHẦN 3: Checklist Nghiệm thu (Verification List)

Sau khi dán nội dung trên vào Obsidian (hoặc để Agent tự dán), hãy quan sát Daemon chạy (mất khoảng 5-10 giây) và kiểm tra các tiêu chí sau:

### 1. Tại Obsidian UI
- [ ] File `2025-06.md`: Mục `> [!todo] 📥 Unsynced` trở nên trống không.
- [ ] File `2025-06.md`: Mục `> [!success] 🔄 Synced` xuất hiện 4 dòng giao dịch dưới dạng bảng, có tick `[x]` và mã ID click được.
- [ ] Mở Terminal chạy: `npm run generate-pages`
- [ ] File `03_People/Lâm.md`: Sẽ xuất hiện khoản nợ 500k (Lent) trong `2025-06.md`.
- [ ] File `03_People/Ashley.md`: File này **TỰ ĐỘNG ĐƯỢC TẠO RA**, bên trong ghi nhận khoản nợ siêu thị (350.000 - 2% = 343.000 VNĐ).
- [ ] File `02_Accounts/Vpbank.md`: Bảng thống kê tổng chi tiêu (Out) và balance bị trừ đi tổng số tiền của 4 giao dịch.

### 2. Tại Database (DBeaver / TablePlus)
Mở DBeaver ấn F5 (Refresh):
- [ ] Bảng `transactions`: Thêm 4 dòng mới với `account_id` trỏ đúng về Vpbank. Dòng của CoopMart có `cashback_share_percent` = 0.02.
- [ ] Bảng `people`: Thêm 1 dòng mới tên `Ashley`.
- [ ] Bảng `debts`: Thêm 2 dòng mới (1 cho Lâm 500k, 1 cho Ashley 343k).
- [ ] Bảng `cashback_cycles`: Nếu Vpbank có cycle đang active, `spent_amount` sẽ tự động tăng lên.
