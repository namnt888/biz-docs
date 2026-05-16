# Family Accounts and Shared Credit Limit

## 1. Tổng quan nghiệp vụ

### Định nghĩa
"Family accounts" (tài khoản gia đình) là một nhóm các tài khoản thẻ tín dụng chia sẻ chung một hạn mức tín dụng (credit limit) và thuộc cùng một chủ sở hữu chính.

- **Parent account (Thẻ chính):** Thẻ gốc, thường có `parent_account_id` rỗng. Hạn mức ghi trên thẻ này là hạn mức tổng dùng chung cho cả gia đình.
- **Child account (Thẻ phụ/Thẻ bổ sung):** Các thẻ phát hành thêm dựa trên thẻ chính, có `parent_account_id` trỏ về ID của thẻ chính.

**Ví dụ điển hình:**
- Chủ thẻ mở thẻ chính **VIB Super Card**.
- Mở thêm thẻ phụ **VIB Online 2in1** cho vợ/chồng sử dụng.
- Cả hai thẻ cùng chia sẻ một hạn mức tín dụng vật lý duy nhất.

### Tại sao cần mô hình Family Accounts?
- Tránh double-counting hạn mức tín dụng khi tính available credit.
- Theo dõi chi tiêu tổng hợp của cả gia đình trên cùng một hạn mức.
- Hỗ trợ các chương trình cashback có điều kiện dựa trên tổng chi tiêu family.
- Quản lý rủi ro tín dụng ở cấp độ nhóm thay vì từng thẻ riêng lẻ.

---

## 2. Thuộc tính cốt lõi

Để mô hình hóa quan hệ family accounts, entity Account có các fields đặc biệt sau:

| Field | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `parent_account_id` | UUID | Không | - **NULL**: Nếu đây là thẻ chính (Parent).<br>- **Có giá trị**: Nếu đây là thẻ phụ (Child), giá trị này là `id` của thẻ chính.<br>- Dùng để nhóm các thẻ vào cùng một "family". |
| `secured_by_account_id` | UUID | Không | - Trỏ đến một tài khoản tiết kiệm/thế chấp (thường là `debit` hoặc `savings`).<br>- **Phân biệt với `parent_account_id`**: Field này dùng cho mục đích thế chấp số dư (collateral), không phải để gộp nhóm hạn mức thẻ tín dụng. |
| `is_primary` | Boolean | Có | - `true`: Thẻ chính, chịu trách nhiệm thanh toán toàn bộ dư nợ family.<br>- `false`: Thẻ phụ, chi tiêu nhưng không trực tiếp thanh toán. |

### Các fields kế thừa từ Account entity gốc
Family accounts vẫn giữ tất cả fields thông thường của Account:
- `id`, `account_name`, `short_name`, `aliases`
- `account_type` (credit_card, debit, savings, e-wallet, cash)
- `credit_limit`, `current_balance`, `available_credit`
- `cashback_policy`, `applicable_categories`
- `is_active`, `bank_name`, `card_type`

---

## 3. Quy tắc tính toán hạn mức chung

### 3.1. Xác định Family Group
Một family group được xác định bởi:
- **1 Parent account**: có `parent_account_id = NULL` và `account_type = credit_card`
- **N Child accounts**: có `parent_account_id = parent.id` và `is_active = true`

### 3.2. Hạn mức tín dụng (Credit Limit)
- **Đối với Parent account**: `credit_limit` là hạn mức tổng được cấp cho cả gia đình.
- **Đối với Child account**: `credit_limit` lưu trữ trong database có thể bằng với hạn mức của parent (để tham chiếu), nhưng về bản chất nghiệp vụ, đây **không phải** là một hạn mức riêng biệt cộng thêm.

**Quy tắc quan trọng:**
```
family_credit_limit = parent.credit_limit
(KHÔNG được SUM(credit_limit) của parent + children)
```

### 3.3. Dư nợ tổng hợp (Family Current Balance)
Dư nợ thực tế của cả nhóm family được tính bằng tổng dư nợ của tất cả các thẻ trong nhóm:

```
family_balance = parent.current_balance 
               + SUM(child.current_balance 
                     WHERE child.parent_account_id = parent.id 
                     AND child.is_active = true)
```

### 3.4. Hạn mức còn lại khả dụng (Available Credit)
Hạn mức khả dụng được tính chung cho toàn bộ nhóm, không tính riêng lẻ từng thẻ:

```
family_available_credit = family_credit_limit - family_balance
```

**Ví dụ tính toán:**
- Parent (VIB Super): limit 241M, balance 10M
- Child (VIB Online): limit 241M (tham chiếu), balance 5M
- **ĐÚNG**: family_limit = 241M, family_balance = 15M, available = 226M
- **SAI**: family_limit = 241M + 241M = 482M (double-counting!)

### 3.5. Business Rules bắt buộc

1. **Không được xóa Parent khi còn Child:**
   - Nếu muốn xóa Parent, phải chuyển tất cả Children sang Parent khác hoặc xóa Children trước.

2. **Child không thể có Children:**
   - Quan hệ chỉ 2 cấp: Parent → Child. Child không thể có `child_account_id`.

3. **Cập nhật atomic:**
   - Khi tạo Child, phải validate Parent tồn tại và `account_type = credit_card`.
   - Khi update `credit_limit` của Parent, không cần update Children (vì là tham chiếu).

4. **Thanh toán:**
   - Thanh toán vào Parent sẽ giảm `family_balance`.
   - Thanh toán vào Child cũng giảm `family_balance` (vì thực chất là trả nợ chung).

5. **Kích hoạt/Hủy:**
   - Khi `is_active = false` ở Child: không tính vào `family_balance` nữa.
   - Khi `is_active = false` ở Parent: toàn bộ family coi như không hoạt động.

---

## 4. Ví dụ thực tế

### Ví dụ 1: Gia đình anh Nam với VIB Super Card

**Thông tin:**
- **Thẻ chính (Parent):** `VIB Super Card` (ID: `acc_super_01`)
  - `account_name`: "VIB Super Card - Anh Nam"
  - `credit_limit`: 241,395,000 VNĐ
  - `parent_account_id`: NULL
  - `current_balance`: 10,000,000 VNĐ (anh Nam đã chi tiêu)
  - `is_primary`: true
  
- **Thẻ phụ (Child):** `VIB Online 2in1` (ID: `acc_online_02`)
  - `account_name`: "VIB Online 2in1 - Chị Linh"
  - `credit_limit`: 241,395,000 VNĐ (lưu trữ cùng giá trị để tham chiếu)
  - `parent_account_id`: `acc_super_01`
  - `current_balance`: 5,000,000 VNĐ (chị Linh đã chi tiêu)
  - `is_primary`: false

**Tính toán đúng:**
- **Tổng hạn mức vật lý:** 241,395,000 VNĐ (Lấy từ thẻ chính, KHÔNG cộng 2 thẻ).
- **Tổng dư nợ gia đình:** 10,000,000 + 5,000,000 = 15,000,000 VNĐ.
- **Hạn mức còn lại khả dụng:** 241,395,000 - 15,000,000 = 226,395,000 VNĐ.

Cả anh Nam và chị Linh đều nhìn thấy hạn mức còn lại chung là 226M để chi tiêu tiếp.

### Ví dụ 2: Gia đình 3 thẻ (1 Parent + 2 Children)

**Thông tin:**
- **Parent:** MB Credit Card (limit 100M, balance 20M)
- **Child 1:** MB Online Card (balance 15M)
- **Child 2:** MB Travel Card (balance 10M)

**Tính toán:**
- family_limit = 100M
- family_balance = 20M + 15M + 10M = 45M
- available_credit = 100M - 45M = 55M

### Ví dụ 3: Hủy thẻ phụ

Khi chị Linh không dùng thẻ VIB Online nữa:
- Set `acc_online_02.is_active = false`
- `family_balance` lúc này chỉ còn 10M (của anh Nam)
- `available_credit` = 241M - 10M = 231M
- Lịch sử chi tiêu của thẻ phụ vẫn được giữ lại để báo cáo.

---

## 5. Tác động đến các Entity khác

### 5.1. Cashback (docs/business/cashback.md)

**Nguyên tắc chung:**
- Việc tính cashback thường diễn ra ở cấp độ **từng tài khoản** (per-account) dựa trên chi tiêu thực tế của thẻ đó.
- Tuy nhiên, các chương trình cashback có điều kiện **tổng chi tiêu** (min_spend) có thể áp dụng trên tổng chi tiêu của cả family nếu chính sách thẻ quy định.

**Ví dụ VPBank Lady:**
- Điều kiện: Chi tiêu ≥ 15M/kỳ → cashback 15% max 300k cho bảo hiểm.
- Nếu gia đình có 1 Parent + 1 Child cùng là VPBank Lady:
  - `family_spent` = spent(Parent) + spent(Child)
  - Nếu `family_spent` ≥ 15M → cả 2 thẻ đều được hưởng cashback 15%.

**Lưu ý implement:**
- Khi tính `spent_amount` cho cashback cycle, cần check xem account có `parent_account_id` không.
- Nếu có, có thể cần aggregate spending từ cả family để check threshold.

### 5.2. Budgets (docs/business/budgets.md)

- Budget tracking có thể thiết lập ở cấp độ family:
  - Ví dụ: "Ngân sách ăn uống gia đình tháng này: 10M"
  - Include transactions từ cả Parent và Children.
- Hoặc thiết lập per-card:
  - "Ngân sách cá nhân của chị Linh: 5M" (chỉ tính từ Child card).

### 5.3. Reports & Dashboard

Hệ thống báo cáo cần hỗ trợ 2 chế độ xem:

1. **Per-card view:**
   - Thống kê chi tiêu, cashback riêng biệt cho từng thẻ.
   - Ví dụ: Vợ muốn xem riêng thẻ của mình chi những gì.

2. **Family-level view:**
   - Tổng hợp dư nợ, hạn mức còn lại và tổng chi tiêu của cả nhóm.
   - Biểu đồ phân bổ chi tiêu giữa các thành viên.
   - Cảnh báo khi `family_available_credit` dưới ngưỡng an toàn (ví dụ < 20% limit).

### 5.4. Risk Exposure (Quản lý rủi ro)

- Giới hạn rủi ro tín dụng được tính ở cấp độ **Family** (tổng dư nợ của cả nhóm so với hạn mức chung).
- Khi xét duyệt tăng hạn mức, ngân hàng sẽ nhìn vào `family_balance` chứ không phải riêng lẻ từng thẻ.
- Tỷ lệ sử dụng hạn mức (utilization ratio) tính cho cả family:
  ```
  utilization_ratio = family_balance / family_credit_limit
  ```
  - > 80%: Cảnh báo rủi ro cao.
  - > 100%: Vượt hạn mức (có thể bị phí over-limit).

---

## 6. Google Sheets Mapping

### Tab `Accounts` — mở rộng columns

Thêm các cột sau vào tab Accounts hiện có:

| Cột | Field | Mô tả | Formula/Ghi chú |
| :--- | :--- | :--- | :--- |
| ... | ... | ... | ... |
| K | `parent_account_id` | ID thẻ chính | Để trống nếu là Parent |
| L | `is_primary` | Thẻ chính hay phụ | TRUE/FALSE |
| M | `family_credit_limit` | Hạn mức chung | `=IF(ISBLANK(K2), J2, VLOOKUP(K2, Accounts!A:J, 10, FALSE))` |
| N | `family_balance` | Dư nợ gia đình | Xem formula bên dưới |
| O | `family_available` | Hạn mức còn lại | `=M2 - N2` |

### Formula tính `family_balance` (cột N)

```excel
=J2 + SUMIFS(J:J, K:K, A2, L:L, TRUE)
```

Trong đó:
- `J2`: current_balance của chính account này
- `K:K`: cột parent_account_id
- `A2`: account_id của dòng hiện tại (nếu là Parent)
- `L:L`: cột is_active (chỉ tính account đang hoạt động)

**Giải thích:**
- Nếu là Parent: lấy balance của mình + SUM(balance của tất cả Children có parent_id = mình).
- Nếu là Child: chỉ lấy balance của chính mình (hoặc có thể copy từ Parent tùy nhu cầu hiển thị).

### Tab `FamilySummary` (mới, optional)

Tab riêng để theo dõi tổng hợp family:

| Cột | Field | Formula |
| :--- | :--- | :--- |
| A | `family_id` | ID của Parent account |
| B | `family_name` | Tên Parent account |
| C | `total_cards` | `=COUNTIFS(Accounts!K:K, A2) + 1` |
| D | `family_credit_limit` | `=VLOOKUP(A2, Accounts!A:J, 10, FALSE)` |
| E | `family_balance` | `=SUMIFS(Accounts!J:J, Accounts!K:K, A2) + VLOOKUP(A2, Accounts!A:J, 10, FALSE)` |
| F | `available_credit` | `=D2 - E2` |
| G | `utilization_pct` | `=E2/D2` (format %) |
| H | `status` | `=IF(G2>0.8, "⚠️ Cao", IF(G2>0.5, "✅ Ổn", "✅ Tốt"))` |

### Conditional Formatting

- `utilization_pct` > 80%: Background đỏ (#FF6B6B).
- `utilization_pct` 50-80%: Background vàng (#FFD93D).
- `utilization_pct` < 50%: Background xanh (#6BCB77).
- `available_credit` < 5M: Bold + đỏ.

---

## 7. Edge Cases

### 7.1. Chuyển thẻ từ Family này sang Family khác
- User muốn chuyển thẻ phụ từ family A sang family B.
- **Xử lý:**
  1. Validate family B có tồn tại và là credit card.
  2. Update `parent_account_id` của Child = ID của Parent mới.
  3. Recalculate `family_balance` cho cả 2 families.
  4. Ghi audit log về thay đổi này.

### 7.2. Parent bị khóa/hủy
- Khi Parent bị khóa (lost/stolen) và được cấp thẻ mới:
  - Tạo account mới với `parent_account_id = NULL`.
  - Chuyển tất cả Children sang Parent mới.
  - Giữ nguyên `credit_limit` nếu ngân hàng approve.

### 7.3. Over-limit do chi tiêu từ nhiều Children
- Family limit 100M, nhưng total balance = 105M (do nhiều người chi tiêu).
- **Xử lý:**
  - Tính phí over-limit theo chính sách ngân hàng.
  - Gửi cảnh báo khẩn cấp cho chủ thẻ chính.
  - Tạm khóa Children cho đến khi giảm balance.

### 7.4. Refund vào Child card
- Refund 2M vào Child card trong family.
- **Impact:**
  - Giảm `family_balance` xuống 2M.
  - Tăng `family_available_credit` lên 2M.
  - Cashback clawback (nếu có) tính vào family spending.

### 7.5. Thanh toán từ tài khoản khác
- User thanh toán 10M từ tài khoản Debit vào Child card.
- **Xử lý:**
  - Tạo transaction transfer từ Debit → Child card.
  - Giảm `family_balance` xuống 10M.
  - Không tạo cashback (vì là repayment, không phải spending).

---

## 8. Checklist cho Agent/Codegen

### Khi tạo Family Account mới:
- [ ] Validate `account_type = credit_card`.
- [ ] Nếu là Child: check Parent tồn tại và là credit card.
- [ ] Set `parent_account_id` đúng (NULL cho Parent, ID cho Child).
- [ ] Set `is_primary = true` cho Parent, `false` cho Child.
- [ ] Copy `credit_limit` từ Parent sang Child (để tham chiếu).
- [ ] Sync lên Google Sheets tab Accounts.
- [ ] Ghi audit log: "Created family account with parent_id = X".

### Khi tính Available Credit:
- [ ] Check account có `parent_account_id` không.
- [ ] Nếu là Parent: tính `family_balance` = balance + SUM(children balances).
- [ ] Nếu là Child: có thể hiển thị available credit chung của family.
- [ ] Tránh double-counting `credit_limit`.
- [ ] Làm tròn xuống hàng nghìn gần nhất.

### Khi tạo Transaction spending:
- [ ] Check `family_available_credit` trước khi approve.
- [ ] Nếu spending > available: reject hoặc flag over-limit.
- [ ] Update `current_balance` của account được chi tiêu.
- [ ] Trigger recalculate `family_balance` và `family_available`.
- [ ] Nếu account có cashback policy: tính cashback theo rules.

### Khi thanh toán (repayment):
- [ ] Accept payment vào Parent hoặc Child đều được.
- [ ] Giảm `current_balance` của account nhận payment.
- [ ] Recalculate `family_balance`.
- [ ] Nếu `family_balance` = 0: mark family là "fully paid".

### Khi sync Google Sheets:
- [ ] Update cột `parent_account_id` và `is_primary`.
- [ ] Apply formulas tính `family_credit_limit`, `family_balance`.
- [ ] Conditional formatting theo utilization ratio.
- [ ] Refresh Pivot Table family summary (nếu có).

---

## 9. Tham chiếu chéo (Cross-references)

- **Entity Account:** docs/business/accounts.md
- **Cashback Calculation:** docs/business/cashback.md (section ảnh hưởng family spending)
- **Transaction Flow:** docs/business/transactions.md
- **Audit History:** docs/business/audit-history.md (log thay đổi parent_account_id)
- **Google Sheets Formulas:** docs/sheets/accounts-formulas.md (nếu có)

---

## 10. Glossary

| Thuật ngữ | Giải thích |
| :--- | :--- |
| Family Account | Nhóm thẻ tín dụng chia sẻ hạn mức chung |
| Parent Account | Thẻ chính, khởi tạo family, giữ hạn mức gốc |
| Child Account | Thẻ phụ, phát hành từ Parent, dùng chung hạn mức |
| Shared Credit Limit | Hạn mức tín dụng dùng chung cho cả family |
| Family Balance | Tổng dư nợ của tất cả thẻ trong family |
| Available Credit | Hạn mức còn lại có thể chi tiêu |
| Utilization Ratio | Tỷ lệ sử dụng hạn mức (%) |
| Over-limit | Vượt quá hạn mức tín dụng được cấp |
| Primary Cardholder | Chủ thẻ chính, chịu trách nhiệm thanh toán |
| Supplementary Cardholder | Chủ thẻ phụ, được ủy quyền chi tiêu |

---

## Changelog

### [1.0.0] - 2026-04-21
#### Added
- Đặc tả đầy đủ về Family Accounts và Shared Credit Limit
- Business rules tính toán available credit tránh double-counting
- Ví dụ thực tế với VIB Super Card + VIB Online 2in1
- Mapping Google Sheets với formulas tính family_balance
- Edge cases: transfer family, over-limit, refund
- Checklist cho Agent/Codegen implement
- Cross-references tới cashback, budget, audit history
