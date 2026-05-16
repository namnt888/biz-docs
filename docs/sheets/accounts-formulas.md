# Google Sheets Formulas: Accounts

Tài liệu này cung cấp công thức **copy-paste sẵn** cho mô hình n8n + Google Sheets, với `Transactions` là nguồn dữ liệu chuẩn.

## 1) Cấu trúc sheet đề xuất

## 1.1 Tab `Accounts`

| Cột | Tên cột | Ví dụ dữ liệu |
|---|---|---|
| A | `id` | ACC_TCB_001, ACC_VCB_001, ACC_MOMO_001... |
| B | `name` | Techcombank, VCB, MoMo, ZaloPay, Tiền mặt |
| C | `type` | bank / wallet / cash / credit_card / investment |
| D | `status` | active / inactive / archived |
| E | `currency` | VND |
| F | `initial_balance` | Số dư đầu |
| G | `current_balance` | Formula |
| H | `is_default` | TRUE/FALSE |
| I | `owner` | Nam / Shared... |
| J | `last_txn_date` | Formula |
| K | `total_lent_pending` | Formula |
| L | `total_borrowed_pending` | Formula |
| M | `cashback_month` | Formula |
| N | `cashback_ytd` | Formula |

## 1.2 Tab `Transactions` (source of truth)

| Cột | Tên cột | Ý nghĩa |
|---|---|---|
| A | `txn_id` | ID giao dịch |
| B | `txn_date` | Ngày giao dịch |
| C | `status` | posted / pending / void |
| D | `type` | income / expense / transfer_in / transfer_out / cashback / refund / debt / repayment |
| E | `account_id` | Account chịu tác động số dư |
| F | `amount` | Giá trị tuyệt đối (VND) |
| G | `person_id` | Liên kết People (nếu debt/repayment) |
| H | `debt_role` | lent / borrowed (chỉ dùng cho debt/repayment) |
| I | `note` | Ghi chú |

> Quy ước khuyến nghị: mỗi chiều của transfer ghi thành một dòng riêng (`transfer_out` cho nguồn, `transfer_in` cho đích) để SUMIFS đơn giản và minh bạch. Hai dòng này phải được tạo/cập nhật **atomically** trong cùng transaction boundary để luôn giữ nhất quán số dư.

---

## 2) Công thức tính số dư hiện tại (Accounts!G)

### 2.1 Công thức cho từng dòng (đặt tại `Accounts!G2`, kéo xuống)

```gs
=IF(A2="","",
  F2
  + SUMIFS(Transactions!$F:$F, Transactions!$E:$E, $A2, Transactions!$D:$D, "income",       Transactions!$C:$C, "posted")
  - SUMIFS(Transactions!$F:$F, Transactions!$E:$E, $A2, Transactions!$D:$D, "expense",      Transactions!$C:$C, "posted")
  + SUMIFS(Transactions!$F:$F, Transactions!$E:$E, $A2, Transactions!$D:$D, "transfer_in",  Transactions!$C:$C, "posted")
  - SUMIFS(Transactions!$F:$F, Transactions!$E:$E, $A2, Transactions!$D:$D, "transfer_out", Transactions!$C:$C, "posted")
  + SUMIFS(Transactions!$F:$F, Transactions!$E:$E, $A2, Transactions!$D:$D, "cashback",     Transactions!$C:$C, "posted")
  + SUMIFS(Transactions!$F:$F, Transactions!$E:$E, $A2, Transactions!$D:$D, "refund",       Transactions!$C:$C, "posted")
  + SUMIFS(Transactions!$F:$F, Transactions!$E:$E, $A2, Transactions!$D:$D, "repayment",    Transactions!$C:$C, "posted")
  - SUMIFS(Transactions!$F:$F, Transactions!$E:$E, $A2, Transactions!$D:$D, "debt",         Transactions!$C:$C, "posted")
)
```

**Giải thích (VN):**
- Lấy số dư đầu (`F2`) cộng/trừ theo từng loại giao dịch đã chốt (`posted`).
- `credit_card` không cần công thức riêng; kết quả âm là hợp lệ và thể hiện dư nợ thẻ.

---

## 3) Công thức tổng hợp tài sản/nợ/net worth

Giả sử đặt tại tab `Summary`:

### 3.1 Tổng tài sản (không tính nợ thẻ)

```gs
=SUMIFS(Accounts!$G:$G, Accounts!$D:$D, "active", Accounts!$C:$C, "<>credit_card", Accounts!$G:$G, ">0")
```

**Giải thích (VN):** chỉ cộng số dư dương của account `active`, loại trừ `credit_card`.

### 3.2 Tổng liabilities từ thẻ tín dụng

```gs
=ABS(SUMIFS(Accounts!$G:$G, Accounts!$D:$D, "active", Accounts!$C:$C, "credit_card", Accounts!$G:$G, "<0"))
```

**Giải thích (VN):** lấy phần âm của thẻ tín dụng, đổi sang số dương để biểu diễn nghĩa vụ nợ.

### 3.3 Net worth

```gs
= (SUMIFS(Accounts!$G:$G, Accounts!$D:$D, "active", Accounts!$C:$C, "<>credit_card", Accounts!$G:$G, ">0"))
  - (ABS(SUMIFS(Accounts!$G:$G, Accounts!$D:$D, "active", Accounts!$C:$C, "credit_card", Accounts!$G:$G, "<0")))
```

**Giải thích (VN):** tài sản ròng = tổng tài sản dương - tổng nghĩa vụ nợ thẻ.

---

## 4) Last transaction date theo account (Accounts!J)

Đặt tại `Accounts!J2`, kéo xuống:

```gs
=IF(A2="","",MAXIFS(Transactions!$B:$B, Transactions!$E:$E, $A2, Transactions!$C:$C, "posted"))
```

**Giải thích (VN):** trả về ngày giao dịch gần nhất đã chốt của từng account.

---

## 5) Debt/Loan tracking (cross People)

> Yêu cầu dữ liệu: tab `People` có cột `person_id` để đối chiếu; tab `Transactions` lưu `person_id` (cột G) cho debt/repayment.

### 5.1 Tổng tiền đã cho vay còn pending theo account (Accounts!K)

Đặt tại `Accounts!K2`, kéo xuống:

```gs
=IF(A2="","",
  SUMIFS(Transactions!$F:$F, Transactions!$E:$E, $A2, Transactions!$D:$D, "debt",      Transactions!$H:$H, "lent",     Transactions!$C:$C, "posted")
  -
  SUMIFS(Transactions!$F:$F, Transactions!$E:$E, $A2, Transactions!$D:$D, "repayment", Transactions!$H:$H, "lent",     Transactions!$C:$C, "posted")
)
```

**Giải thích (VN):** pending cho vay = tiền giải ngân cho vay - tiền đã thu hồi (theo vai trò `lent`).

### 5.2 Tổng tiền đã vay còn pending theo account (Accounts!L)

Đặt tại `Accounts!L2`, kéo xuống:

```gs
=IF(A2="","",
  SUMIFS(Transactions!$F:$F, Transactions!$E:$E, $A2, Transactions!$D:$D, "debt",      Transactions!$H:$H, "borrowed", Transactions!$C:$C, "posted")
  -
  SUMIFS(Transactions!$F:$F, Transactions!$E:$E, $A2, Transactions!$D:$D, "repayment", Transactions!$H:$H, "borrowed", Transactions!$C:$C, "posted")
)
```

**Giải thích (VN):** pending đi vay = tiền đã nhận vay - tiền đã trả lại.

---

## 6) Cashback tracking

### 6.1 Cashback tháng hiện tại theo account (Accounts!M)

Đặt tại `Accounts!M2`, kéo xuống:

```gs
=IF(A2="","",
  SUMIFS(
    Transactions!$F:$F,
    Transactions!$E:$E, $A2,
    Transactions!$D:$D, "cashback",
    Transactions!$C:$C, "posted",
    Transactions!$B:$B, ">="&EOMONTH(TODAY(),-1)+1,
    Transactions!$B:$B, "<="&EOMONTH(TODAY(),0)
  )
)
```

**Giải thích (VN):** cộng toàn bộ cashback `posted` trong tháng hiện tại của account.

### 6.2 Cashback YTD theo account (Accounts!N)

Đặt tại `Accounts!N2`, kéo xuống:

```gs
=IF(A2="","",
  SUMIFS(
    Transactions!$F:$F,
    Transactions!$E:$E, $A2,
    Transactions!$D:$D, "cashback",
    Transactions!$C:$C, "posted",
    Transactions!$B:$B, ">="&DATE(YEAR(TODAY()),1,1),
    Transactions!$B:$B, "<="&TODAY()
  )
)
```

**Giải thích (VN):** tổng cashback từ đầu năm đến hôm nay theo account.

---

## 7) Named Ranges (khuyến nghị)

Để công thức dễ đọc, tạo Named Ranges:
- `txnDate` = `Transactions!$B:$B`
- `txnStatus` = `Transactions!$C:$C`
- `txnType` = `Transactions!$D:$D`
- `txnAccount` = `Transactions!$E:$E`
- `txnAmount` = `Transactions!$F:$F`
- `txnPerson` = `Transactions!$G:$G`
- `txnDebtRole` = `Transactions!$H:$H`

Ví dụ phiên bản rút gọn của công thức số dư:

```gs
=IF(A2="","",
  F2
  + SUMIFS(txnAmount, txnAccount, $A2, txnType, "income",       txnStatus, "posted")
  - SUMIFS(txnAmount, txnAccount, $A2, txnType, "expense",      txnStatus, "posted")
  + SUMIFS(txnAmount, txnAccount, $A2, txnType, "transfer_in",  txnStatus, "posted")
  - SUMIFS(txnAmount, txnAccount, $A2, txnType, "transfer_out", txnStatus, "posted")
  + SUMIFS(txnAmount, txnAccount, $A2, txnType, "cashback",     txnStatus, "posted")
  + SUMIFS(txnAmount, txnAccount, $A2, txnType, "refund",       txnStatus, "posted")
  + SUMIFS(txnAmount, txnAccount, $A2, txnType, "repayment",    txnStatus, "posted")
  - SUMIFS(txnAmount, txnAccount, $A2, txnType, "debt",         txnStatus, "posted")
)
```

---

## 8) Formatting notes (VND)

- Định dạng cột tiền: `#,##0` (không thập phân)
- Định dạng ngày: `dd/mm/yyyy`
- Conditional formatting gợi ý:
  - `Accounts!G:G < 0` tô đỏ cho `credit_card`
  - `Accounts!D:D = "inactive"` hoặc `"archived"` tô xám hàng

---

## 9) Kiểm tra nhanh sau khi dán công thức

1. Tạo thử account: Techcombank, VCB, MoMo, ZaloPay, Tiền mặt
2. Thêm giao dịch mẫu đủ loại: income/expense/transfer_in/transfer_out/cashback/refund/debt/repayment
3. So sánh tổng biến động với `current_balance`
4. Kiểm tra account `credit_card` có thể xuống âm đúng như kỳ vọng
