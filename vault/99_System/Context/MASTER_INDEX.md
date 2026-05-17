# MASTER INDEX — Money Flow Documentation

**Entry Point duy nhất cho mọi AI Agent làm việc với repo money-flow**

Cập nhật: 2026-04-21  
Branch: `copilot/add-accounts-business-spec-doc`

---

## Section 1: Giới thiệu hệ thống

Money Flow là hệ thống quản lý tài chính cá nhân với kiến trúc serverless:
- **n8n**: Automation engine thay thế server code
- **Google Sheets**: Storage + Calculation engine
- **AI Agent**: Parsing + Advice qua Telegram chat

Flow hoạt động: User nhắn chat → AI parse → tạo transaction → sync Google Sheets → formulas tự tính balance, cashback, debt summary. Không phụ thuộc web app hay server truyền thống.

---

## Section 2: Sơ đồ quan hệ Entity (ASCII)

```
┌──────────┐         ┌─────────────────┐
│  People  │────────▶│  Transactions   │◄──────┐
└──────────┘         └────────┬────────┘       │
      │                       │                │
      │ (person_id)           │ (account_id)   │ (original_txn_id)
      ▼                       ▼                ▼
┌──────────┐         ┌─────────────────┐  ┌──────────┐
│   Debt   │         │    Accounts     │  │  Refund  │
└──────────┘         └────────┬────────┘  └──────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
     ┌────────────────┐ ┌──────────┐  ┌──────────────┐
     │ CashbackCycles │ │ Budgets  │  │ Recurring    │
     └────────────────┘ └────┬─────┘  │ Services     │
                             │        └──────────────┘
                             │
                      ┌──────┴──────┐
                      │  Business   │
                      │  Category   │
                      └─────────────┘
```

---

## Section 3: Entity Summary Table

| Entity | File | Mô tả | Fields chính |
|--------|------|-------|--------------|
| **Accounts** | [docs/business/accounts.md](business/accounts.md) | Tài khoản ngân hàng, ví điện tử, tiền mặt | id, name, account_type, balance, cashback_policy |
| **Transactions** | [docs/business/transactions.md](business/transactions.md) | Giao dịch chi tiêu/thu nhập/chuyển khoản | id, type, amount, account_id, category_id, person_id, occurred_at, status |
| **CashbackCycles** | [docs/business/cashback.md](business/cashback.md) | Chu kỳ tính cashback theo thẻ | id, account_id, cycle_tag, spent_amount, real_awarded, virtual_profit, is_qualified |
| **Debt** | [docs/business/debt.md](business/debt.md) | Khoản nợ/cho mượn | id, person_id, debt_role, original_amount, repaid_amount, remaining_amount, status |
| **People** | [docs/business/people.md](business/people.md) | Danh bạ tài chính (người vay/cho vay/nhận cashback) | id, name, phone, total_lent_outstanding, total_borrowed_outstanding |
| **Refund** | [docs/business/refund.md](business/refund.md) | Hoàn trả giao dịch (GD2/GD3) | id, original_txn_id, refund_type, refund_amount, status |
| **Budgets** | [docs/business/budgets.md](business/budgets.md) | Ngân sách theo tháng/category | id, month, category_id, allocated_amount, spent_amount, remaining_amount |
| **BusinessCategory** | [docs/business/business-category.md](business/business-category.md) | Danh mục chi tiêu 2 cấp | id, code, name_vi, parent_id, level, affects_cashback |
| **RecurringServices** | [docs/business/recurring-services.md](business/recurring-services.md) | Dịch vụ định kỳ (subscription) | id, name, amount, billing_cycle, next_due_date, is_auto_charge |

---

## Section 4: Cross-Entity Business Rules

### Cashback Rules

**RULE-CB-001: Refund ảnh hưởng cashback cycle**
- **Entities:** Refund → CashbackCycle
- **Mô tả:** Khi refund confirmed (GD3), spent_amount trong cycle giảm theo refund_amount. Nếu xuống dưới min_spend → clawback toàn bộ cashback đã awarded.
- **Chi tiết:** [docs/business/refund.md#section-6](business/refund.md)

**RULE-CB-002: Internal transfer không tính cashback**
- **Entities:** Transaction → CashbackCycle
- **Mô tả:** Transactions loại `transfer_in`/`transfer_out` có `affects_cashback = false`, không计入 spent_amount.
- **Chi tiết:** [docs/business/cashback.md#section-5](business/cashback.md)

**RULE-CB-003: Income không tính cashback**
- **Entities:** Transaction → CashbackCycle
- **Mô tả:** Transactions loại `income` không tính vào spent_amount của cashback cycle.
- **Chi tiết:** [docs/business/cashback.md#section-5](business/cashback.md)

**RULE-CB-004: Recurring expense tính cashback**
- **Entities:** RecurringService → Transaction → CashbackCycle
- **Mô tả:** recurring service expense dùng thẻ credit vẫn tính vào spent_amount bình thường.
- **Chi tiết:** [docs/business/recurring-services.md#section-8](business/recurring-services.md)

### Debt Rules

**RULE-DBT-001: Expense với person_id tạo debt**
- **Entities:** Transaction → People → Debt
- **Mô tả:** Khi tạo expense transaction có person_id và debt_role=lent → tự động tạo debt record.
- **Chi tiết:** [docs/business/debt.md#section-5](business/debt.md)

**RULE-DBT-002: Repayment reduce debt balance**
- **Entities:** Transaction → Debt
- **Mô tả:** Repayment transaction (type=repayment) tự động reduce remaining_amount của debt liên quan.
- **Chi tiết:** [docs/business/debt.md#section-5](business/debt.md)

**RULE-DBT-003: Full refund clear person obligation**
- **Entities:** Refund → Transaction → Debt
- **Mô tả:** Nếu original transaction bị full refund, person_id obligation được clear khỏi debt.
- **Chi tiết:** [docs/business/refund.md#section-7](business/refund.md)

### Refund Rules

**RULE-RFD-001: GD2 không ảnh hưởng balance**
- **Entities:** Refund → Account
- **Mô tả:** Refund status=pending (GD2) không cộng vào account balance. Chỉ GD3 (confirmed) mới ảnh hưởng.
- **Chi tiết:** [docs/business/refund.md#section-5](business/refund.md)

**RULE-RFD-002: Cannot refund over original amount**
- **Entities:** Refund → Transaction
- **Mô tả:** Cumulative refunds ≤ original_amount. Validation bắt buộc khi tạo refund.
- **Chi tiết:** [docs/business/refund.md#section-7](business/refund.md)

**RULE-RFD-003: Refund sau cycle settled**
- **Entities:** Refund → CashbackCycle
- **Mô tả:** TODO: Xử lý refund xảy ra sau khi cashback cycle đã closed/settled.
- **Chi tiết:** [docs/business/refund.md#section-11](business/refund.md)

### Budget Rules

**RULE-BDG-001: Recurring expense tính vào budget**
- **Entities:** RecurringService → Transaction → Budget
- **Mô tả:** Recurring service expenses tính vào budget như expense thông thường.
- **Chi tiết:** [docs/business/recurring-services.md#section-7](business/recurring-services.md)

**RULE-BDG-002: Internal transfer không tính budget**
- **Entities:** Transaction → Budget
- **Mô tả:** Transfer transactions không计入 spent_amount của budget.
- **Chi tiết:** [docs/business/budgets.md](business/budgets.md)

**RULE-BDG-003: Refund confirmed giảm budget spent**
- **Entities:** Refund → Transaction → Budget
- **Mô tả:** GD3 confirmed refund làm giảm spent_amount trong budget tháng hiện tại.
- **Chi tiết:** [docs/business/refund.md#section-5](business/refund.md)

### Category Rules

**RULE-CAT-001: Transaction phải có category**
- **Entities:** Transaction → BusinessCategory
- **Mô tả:** Mọi transaction PHẢI có category_id. Default: uncategorized nếu không xác định.
- **Chi tiết:** [docs/business/business-category.md#section-5](business/business-category.md)

**RULE-CAT-002: Insurance → VPBank Lady**
- **Entities:** BusinessCategory → Account
- **Mô tả:** Category insurance nên dùng VPBank Lady để tối ưu cashback (7.5%-15%).
- **Chi tiết:** [docs/keywords/account-keywords.md#section-4](keywords/account-keywords.md)

**RULE-CAT-003: Online shopping → VIB Super**
- **Entities:** BusinessCategory → Account
- **Mô tả:** Category online_shopping nên dùng VIB Super Card (5% cashback).
- **Chi tiết:** [docs/keywords/account-keywords.md#section-4](keywords/account-keywords.md)

---

## Section 5: Google Sheets Architecture

| Tab | Mô tả | Formula Doc |
|-----|-------|-------------|
| **Transactions** | Tất cả giao dịch | - |
| **Accounts** | Danh sách tài khoản, balance | - |
| **CashbackCycles** | Tracking cashback theo kỳ | [cashback-formulas.md](sheets/cashback-formulas.md) |
| **Categories** | Master list danh mục | [category-formulas.md](sheets/category-formulas.md) |
| **RecurringServices** | Dịch vụ định kỳ, next_due_date | [recurring-formulas.md](sheets/recurring-formulas.md) |
| **Refunds** | Tracking GD2/GD3 | [refund-formulas.md](sheets/refund-formulas.md) |
| **People** | Danh sách người, debt summary | [people-formulas.md](sheets/people-formulas.md) |
| **Debts** | Chi tiết nợ/cho mượn | [debt-formulas.md](sheets/debt-formulas.md) |
| **Budgets** | Budget theo tháng/category | [budgets-formulas.md](sheets/budgets-formulas.md) |
| **CategoryKeywords** | Keyword → category mapping | [account-keywords.md](keywords/account-keywords.md) |
| **Summary Dashboard** | Tổng hợp tất cả chỉ số | - |

---

## Section 6: n8n Workflow Map

### WORKFLOW-01: Chat to Transaction
- **Trigger:** Telegram message
- **Flow:** User nhắn → AI parse → validate → append Transactions tab → update balance
- **Doc:** `docs/n8n/chat-to-transaction.md` (TODO)

### WORKFLOW-02: Recurring Auto-charge
- **Trigger:** Cron job hàng ngày 07:00
- **Flow:** Check next_due_date = TODAY → create transaction → update RecurringServices tab
- **Doc:** `docs/n8n/recurring-trigger.md` (TODO)

### WORKFLOW-03: Reminder Notification
- **Trigger:** Cron job hàng ngày 08:00
- **Flow:** Check days_until_due <= N → gửi Telegram reminder
- **Doc:** `docs/n8n/reminder-flow.md` (TODO)

### WORKFLOW-04: Image Capture to Transaction
- **Trigger:** Ảnh gửi qua Telegram
- **Flow:** GPT-4o Vision parse ảnh → extract amount, merchant, date → tạo transaction draft → user confirm
- **Doc:** `docs/n8n/image-capture.md` (TODO)

---

## Section 7: Keyword Lookup Quick Reference

### Account Keywords phổ biến
| Keyword | Account | Type |
|---------|---------|------|
| super, vib super | VIB Super Card | Credit |
| lady, vpbank lady | VPBank Lady Card | Credit |
| tcb, techcombank | Techcombank | Credit/Debit |
| vcb, vietcombank | Vietcombank | Credit/Debit |
| momo | MoMo Wallet | E-wallet |
| cash, tiền mặt | Cash | Cash |

👉 **Đầy đủ:** [docs/keywords/account-keywords.md#section-2](keywords/account-keywords.md)

### Category Keywords phổ biến
| Keyword | Category | Affects Cashback |
|---------|----------|------------------|
| shopee, lazada, tiki | online_shopping | ✅ |
| grab food, baemin | food_delivery | ✅ |
| highlands, cà phê | cafe | ✅ |
| bảo hiểm, manulife | insurance | ✅ |
| netflix, spotify | streaming | ✅ |
| xăng, petrol | fuel | ✅ |

👉 **Đầy đủ:** [docs/keywords/account-keywords.md#section-3](keywords/account-keywords.md)

### Card Advice Quick Ref
| Category | Best Card | Cashback | Condition |
|----------|-----------|----------|-----------|
| insurance | VPBank Lady | 15% max 300k | spend ≥ 15M/kỳ |
| insurance | VPBank Lady | 7.5% max 100k | spend < 15M/kỳ |
| online_shopping | VIB Super | 5% | Shopee/Lazada/Tiki |
| dining_out | UOB ONE | 5% | - |

👉 **Đầy đủ:** [docs/keywords/account-keywords.md#section-4](keywords/account-keywords.md)

---

## Section 8: Agent Decision Tree

| Task | Đọc file nào trước |
|------|-------------------|
| Tạo/sửa transaction | [transactions.md](business/transactions.md) |
| Tính cashback, check cycle | [cashback.md](business/cashback.md) → [cashback-formulas.md](sheets/cashback-formulas.md) |
| Cho mượn/nợ/trả nợ | [debt.md](business/debt.md) → [people.md](business/people.md) |
| Hoàn trả đơn hàng | [refund.md](business/refund.md) |
| Dịch vụ định kỳ | [recurring-services.md](business/recurring-services.md) |
| Phân loại chi tiêu | [business-category.md](business/business-category.md) |
| Ngân sách tháng | [budgets.md](business/budgets.md) |
| Parse text → account/category | [account-keywords.md](keywords/account-keywords.md) (Section 2, 3, 5) |
| Tư vấn thẻ tốt nhất | [account-keywords.md#section-4](keywords/account-keywords.md) |
| Google Sheets formula | [sheets/](sheets/) (chọn theo entity) |

---

## Section 9: Constants & Special IDs

```javascript
// Refund
REFUND_PENDING_ACCOUNT_ID = '99999999-9999-9999-9999-999999999999'
// Dùng cho GD2 pending refund holding account

// Budget defaults
DEFAULT_BUDGET_WARNING_THRESHOLD = 0.8  // 80%
DEFAULT_BUDGET_EXCEEDED_THRESHOLD = 1.0  // 100%

// Cashback defaults
DEFAULT_MIN_SPEND_THRESHOLD = 3000000  // 3M VND
DEFAULT_CASHBACK_CYCLE_TYPE = 'calendar_month'

// Debt defaults
DEBT_STATUS_PENDING = 'pending'
DEBT_STATUS_PARTIAL = 'partial'
DEBT_STATUS_SETTLED = 'settled'
DEBT_STATUS_CANCELLED = 'cancelled'

// Transaction status
TXN_STATUS_POSTED = 'posted'
TXN_STATUS_PENDING = 'pending'
TXN_STATUS_VOID = 'void'
```

---

## Section 10: Glossary (Thuật ngữ)

| Thuật ngữ | Giải thích |
|-----------|------------|
| **GD1** | Giao dịch gốc trong flow refund |
| **GD2** | Pending refund request (chưa nhận tiền) |
| **GD3** | Confirmed refund transaction (tiền đã về) |
| **cycle** | Kỳ tính cashback (thường 1 tháng) |
| **spent_amount** | Tổng chi tiêu eligible cho cashback |
| **virtual_profit** | Cashback dự kiến chưa thực nhận |
| **real_awarded** | Cashback đã thực nhận từ ngân hàng/ví |
| **clawback** | Thu hồi cashback khi refund làm spent < min_spend |
| **min_spend** | Ngưỡng chi tối thiểu để qualify cashback |
| **is_qualified** | Đạt ngưỡng min_spend hay chưa |
| **person_id** | ID người liên quan đến transaction (vay/cho vay) |
| **recurring** | Chi tiêu định kỳ tự động (subscription) |
| **n8n** | Automation platform thay thế server code |
| **affects_cashback** | Category có tính vào cashback không |
| **debt_role** | lent (mình cho vay) vs borrowed (mình đi vay) |
| **billing_cycle** | Chu kỳ thanh toán (monthly/yearly/weekly) |
| **statement_day** | Ngày sao kê thẻ tín dụng |
| **internal_transfer** | Chuyển khoản giữa các account của mình |

---

## Section 11: Changelog

### [1.0.0] - 2026-04-21
#### Added
- Initial MASTER_INDEX covering 9 business docs, 3 sheets docs, 1 keywords doc
- Cross-entity business rules (15+ rules in Section 4)
- Agent decision tree (Section 8)
- n8n workflow map (4 workflows in Section 6)
- Entity relationship diagram (Section 2)
- Google Sheets architecture map (Section 5)
- Keyword quick reference (Section 7)
- Constants & special IDs (Section 9)
- Glossary with 18+ terms (Section 10)

---

## License

Internal documentation for money-flow project.
