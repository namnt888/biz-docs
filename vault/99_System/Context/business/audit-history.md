# Audit History - Nhật ký thay đổi bất biến

## 1. Tổng quan nghiệp vụ

### Mục đích
Audit History là **immutable log** (nhật ký bất biến) trong hệ thống Money Flow:
- **Chỉ APPEND** (ghi thêm), không UPDATE, không DELETE
- Ghi lại mọi thay đổi của các entity quan trọng
- Phục vụ cho việc debug, compliance, và khôi phục dữ liệu

### Entity được audit
- ✅ **transactions**: created, updated, deleted, voided
- ✅ **installment_plans**: created, payment_posted, cancelled, completed
- ✅ **debts**: created, partial_payment, settled, cancelled
- ✅ **accounts**: balance_adjusted, account_created, account_closed
- ✅ **cashback_cycles**: activated, redeemed, expired, recalculated
- ✅ **refunds**: created, approved, rejected, confirmed
- ✅ **budgets**: created, updated, reset
- ✅ **recurring_services**: created, updated, paused, resumed, cancelled

### Phân biệt với Transaction History

| Khía cạnh | Audit Log | Transaction History |
|-----------|-----------|---------------------|
| **Mục đích** | Technical/operational trail | Business event tracking |
| **Câu hỏi trả lời** | Ai làm gì, lúc nào, thay đổi gì? | Tiền đi đâu, số tiền bao nhiêu? |
| **Tính chất** | Immutable (không sửa) | Có thể void/refund |
| **Dữ liệu** | Before/after snapshots | Amount, account, category |
| **Ví dụ** | "User A sửa amount 200k→180k lúc 14:30" | "Chi 180k cho Shopee tại VIB Super" |

---

## 2. Thuộc tính AuditLog Entity

| Field | Kiểu dữ liệu | Bắt buộc | Mô tả |
|-------|--------------|----------|-------|
| `id` | UUID | ✅ | Primary key, auto-generated |
| `entity_type` | String | ✅ | Loại entity bị thay đổi: `"transaction"`, `"debt"`, `"account"`, `"cashback_cycle"`, `"refund"`, `"installment_plan"`, `"budget"`, `"recurring_service"` |
| `entity_id` | UUID | ✅ | Foreign key tới bảng gốc (ví dụ: transaction_id) |
| `action` | String | ✅ | Hành động: `"created"`, `"updated"`, `"deleted"`, `"voided"`, `"reversed"`, `"approved"`, `"rejected"`, `"settled"`, `"balance_adjusted"`, `"activated"`, `"redeemed"`, `"expired"`, `"recalculated"`, `"paused"`, `"resumed"`, `"cancelled"`, `"completed"`, `"payment_posted"` |
| `changed_by` | String | ✅ | Nguồn thay đổi: `"user"`, `"n8n_agent"`, `"system"`, `"api"` |
| `changed_at` | Timestamp | ✅ | Thời điểm thay đổi (ISO 8601, timezone UTC+7) |
| `before_snapshot` | JSON | ⚠️ | Giá trị trước thay đổi (null nếu action = "created") |
| `after_snapshot` | JSON | ⚠️ | Giá trị sau thay đổi (null nếu action = "deleted"/"voided") |
| `diff_summary` | Text | ✅ | Mô tả ngắn gọn sự thay đổi (ví dụ: `"amount: 200,000 → 180,000"`) |
| `ip_or_source` | String | ❌ | Nguồn gốc: `"telegram_bot"`, `"sheet_manual"`, `"n8n_workflow_001"`, IP address |
| `reason` | Text | ❌ | Lý do thay đổi (bắt buộc nếu changed_by = "user" và action = "deleted"/"voided") |
| `is_system_generated` | Boolean | ✅ | `true` nếu do system/n8n tự động, `false` nếu user manual |

### Ghi chú về snapshot
- **before_snapshot**: Lưu JSON các field quan trọng bị ảnh hưởng, không cần toàn bộ entity
- **after_snapshot**: Tương tự, null nếu entity bị xóa/huỷ hoàn toàn
- **Fields không audit**: `updated_at`, `last_synced`, `created_at` (tránh infinite loop)

### Ví dụ snapshot

**Transaction amount change:**
```json
{
  "before_snapshot": {
    "amount": -200000,
    "note": "Shopee - ốp lưng"
  },
  "after_snapshot": {
    "amount": -180000,
    "note": "Shopee - ốp lưng (giảm giá)"
  }
}
```

**Debt settled:**
```json
{
  "before_snapshot": {
    "status": "partial",
    "remaining_balance": 500000
  },
  "after_snapshot": {
    "status": "settled",
    "remaining_balance": 0
  }
}
```

---

## 3. Business Rules

### RULE-AUDIT-001: Append Only
- Audit row **không bao giờ** được UPDATE hoặc DELETE
- Nếu có sai sót, tạo audit row mới với action = `"correction"` để ghi nhận việc sửa
- Violation của rule này sẽ làm mất tính integrity của audit trail

### RULE-AUDIT-002: Snapshot Requirements
- `before_snapshot` và `after_snapshot` phải lưu **đủ field quan trọng** để khôi phục
- Tối thiểu các field: `id`, `amount` (nếu có), `status`, `account_id`, `category_code`
- Không lưu toàn bộ entity để tránh redundancy

### RULE-AUDIT-003: Delete/Void Handling
- Khi action = `"deleted"` hoặc `"voided"`:
  - `after_snapshot` = `null`
  - `reason` field **bắt buộc** nếu changed_by = "user"
- Entity gốc vẫn tồn tại với status = voided/deleted, không physical delete

### RULE-AUDIT-004: Changed By Classification
| changed_by | Khi nào | is_system_generated |
|------------|---------|---------------------|
| `"user"` | User edit trực tiếp trên Google Sheet hoặc Telegram | `false` |
| `"n8n_agent"` | n8n workflow tự động tạo/update | `true` |
| `"system"` | System auto-calculation (ví dụ: cashback recalc) | `true` |
| `"api"` | External API call (nếu có) | `false` |

### RULE-AUDIT-005: Multiple Fields Update
- Nếu một operation update nhiều fields cùng lúc → **1 audit row duy nhất**
- `diff_summary` liệt kê tất cả changes: `"amount: 200k→180k, note: 'A'→'B'"`
- Không tạo nhiều audit row cho cùng 1 operation

### RULE-AUDIT-006: Excluded Fields
Các field sau **không được audit** (tránh noise):
- `updated_at`
- `last_synced`
- `sync_status`
- Các field metadata technical khác

### RULE-AUDIT-007: Timing
- Audit row phải được tạo **ngay sau** khi entity thay đổi thành công
- Nếu transaction rollback → audit row cũng phải rollback (cùng transaction)
- `changed_at` phải chính xác đến giây

### RULE-AUDIT-008: Reason Requirement
- `reason` field **bắt buộc** trong các trường hợp:
  - User manual delete/void
  - User manual balance adjustment > 1,000,000 VND
  - User manual change to past transactions (> 30 days)
- Khuyến khích điền reason cho mọi manual changes

---

## 4. Google Sheets Mapping (Tab `AuditLog`)

### Schema cột

| Cột | Field | Ghi chú |
|-----|-------|---------|
| A | `id` | UUID, read-only |
| B | `entity_type` | Dropdown: transaction, debt, account... |
| C | `entity_id` | UUID, link tới tab tương ứng |
| D | `action` | Dropdown: created, updated, deleted... |
| E | `changed_by` | Dropdown: user, n8n_agent, system |
| F | `changed_at` | Format: `dd/mm/yyyy hh:mm:ss` |
| G | `before_snapshot` | JSON text, có thể ẩn cột |
| H | `after_snapshot` | JSON text, có thể ẩn cột |
| I | `diff_summary` | Text hiển thị, dễ đọc |
| J | `ip_or_source` | Text, optional |
| K | `reason` | Text, optional nhưng khuyến khích |
| L | `is_system_generated` | TRUE/FALSE |

### Quy tắc sử dụng tab AuditLog

⚠️ **READ-ONLY TAB**
- **Không edit thủ công** bất kỳ row nào
- **Không delete** bất kỳ row nào
- n8n workflow tự động **append** vào cuối sheet mỗi khi có event
- User chỉ có quyền **xem** (view-only permission)

### n8n Workflow Integration

**Workflow: `audit-log-appender`**
```
Trigger: Webhook từ Google Apps Script (onEdit/onSubmit)
   ↓
Check: Entity type & action valid?
   ↓
Build: before_snapshot & after_snapshot
   ↓
Append: Row mới vào AuditLog tab
   ↓
Log: Success/failure status
```

**Google Apps Script trigger:**
```javascript
function onEdit(e) {
  // Detect changes in Transactions, Debts, etc.
  // Call n8n webhook với before/after data
}
```

---

## 5. Ví dụ thực tế

### Ví dụ 1: User sửa amount transaction từ 200k → 180k

**Context:** User nhập nhầm 200k, phát hiện và sửa thành 180k sau 5 phút.

**Audit row:**
| Field | Giá trị |
|-------|---------|
| `entity_type` | `"transaction"` |
| `entity_id` | `"txn_abc123..."` |
| `action` | `"updated"` |
| `changed_by` | `"user"` |
| `changed_at` | `"2026-04-21T14:30:45+07:00"` |
| `before_snapshot` | `{"amount": -200000, "note": "Shopee"}` |
| `after_snapshot` | `{"amount": -180000, "note": "Shopee"}` |
| `diff_summary` | `"amount: -200,000 → -180,000"` |
| `ip_or_source` | `"sheet_manual"` |
| `reason` | `"Nhập nhầm số tiền"` |
| `is_system_generated` | `FALSE` |

---

### Ví dụ 2: n8n auto-post installment kỳ 3/10

**Context:** Installment plan mua iPhone, đến ngày 15/4 n8n tự động tạo transaction kỳ 3.

**Audit row:**
| Field | Giá trị |
|-------|---------|
| `entity_type` | `"transaction"` |
| `entity_id` | `"txn_install_003..."` |
| `action` | `"created"` |
| `changed_by` | `"n8n_agent"` |
| `changed_at` | `"2026-04-15T07:00:00+07:00"` |
| `before_snapshot` | `null` |
| `after_snapshot` | `{"amount": -2000000, "account_id": "acc_vib_super", "category_code": "electronics", "metadata": {"installment_plan_id": "plan_iphone_001", "installment_number": 3}}` |
| `diff_summary` | `"Created installment #3: -2,000,000 VND for iPhone plan"` |
| `ip_or_source` | `"n8n_workflow_recurring_auto_charge"` |
| `reason` | `null` |
| `is_system_generated` | `TRUE` |

---

### Ví dụ 3: User void một transaction duplicate

**Context:** User vô tình nhập 2 lần cùng 1 giao dịch, phát hiện và void 1 cái.

**Audit row:**
| Field | Giá trị |
|-------|---------|
| `entity_type` | `"transaction"` |
| `entity_id` | `"txn_duplicate_002..."` |
| `action` | `"voided"` |
| `changed_by` | `"user"` |
| `changed_at` | `"2026-04-21T16:45:00+07:00"` |
| `before_snapshot` | `{"amount": -500000, "status": "posted", "note": "Grab Food"}` |
| `after_snapshot` | `null` |
| `diff_summary` | `"Transaction voided: -500,000 VND"` |
| `ip_or_source` | `"telegram_bot"` |
| `reason` | `"Giao dịch trùng lặp (duplicate)"` |
| `is_system_generated` | `FALSE` |

---

### Ví dụ 4: Debt được mark settled sau khi trả hết

**Context:** Nam trả hết khoản vay 2,000,000đ, debt status chuyển từ "partial" sang "settled".

**Audit row:**
| Field | Giá trị |
|-------|---------|
| `entity_type` | `"debt"` |
| `entity_id` | `"debt_nam_001..."` |
| `action` | `"settled"` |
| `changed_by` | `"n8n_agent"` |
| `changed_at` | `"2026-04-20T10:15:00+07:00"` |
| `before_snapshot` | `{"status": "partial", "remaining_balance": 500000, "repaid_amount": 1500000}` |
| `after_snapshot` | `{"status": "settled", "remaining_balance": 0, "repaid_amount": 2000000}` |
| `diff_summary` | `"Debt settled: remaining 500,000 → 0"` |
| `ip_or_source` | `"n8n_workflow_debt_repayment_tracker"` |
| `reason` | `null` |
| `is_system_generated` | `TRUE` |

---

### Ví dụ 5: Cashback cycle recalculated do refund

**Context:** User refund 1 transaction 3,000,000đ trong cycle, spent_amount giảm xuống dưới min_spend, cashback bị clawback.

**Audit row:**
| Field | Giá trị |
|-------|---------|
| `entity_type` | `"cashback_cycle"` |
| `entity_id` | `"cycle_vpbank_2026_03..."` |
| `action` | `"recalculated"` |
| `changed_by` | `"system"` |
| `changed_at` | `"2026-04-21T18:00:00+07:00"` |
| `before_snapshot` | `{"spent_amount": 18000000, "is_qualified": true, "virtual_profit": 270000}` |
| `after_snapshot` | `{"spent_amount": 15000000, "is_qualified": false, "virtual_profit": 0, "clawback_amount": 270000}` |
| `diff_summary` | `"Recalculated due to refund: spent 18M→15M, qualified TRUE→FALSE, clawback 270k"` |
| `ip_or_source` | `"system_cashback_recalc_engine"` |
| `reason` | `"Refund txn_xyz reduced spent_amount below min_spend threshold"` |
| `is_system_generated` | `TRUE` |

---

## 6. Query Patterns trên Google Sheets

### 6.1. Xem lịch sử 1 transaction cụ thể

**Mục đích:** Review toàn bộ changes của 1 transaction từ khi tạo đến nay.

**Formula:**
```excel
=FILTER(
  AuditLog!A:L,
  AuditLog!C:C = "txn_abc123...",  // entity_id
  AuditLog!B:B = "transaction"      // entity_type
)
```

**Kết quả:** Tất cả audit rows của transaction đó, sorted by `changed_at`.

---

### 6.2. Review manual changes trong tháng

**Mục đích:** Kiểm tra những gì user đã sửa tay (potential errors).

**Formula:**
```excel
=FILTER(
  AuditLog!A:L,
  AuditLog!E:E = "user",                    // changed_by
  AuditLog!F:F >= DATE(2026,4,1),          // from date
  AuditLog!F:F <= DATE(2026,4,30),         // to date
  OR(AuditLog!D:D = "updated", AuditLog!D:D = "deleted")
)
```

**Ứng dụng:** Monthly audit review, data quality check.

---

### 6.3. Đếm số lượng deleted transactions trong tháng

**Mục đích:** Monitor data quality, phát hiện abnormal deletions.

**Formula:**
```excel
=COUNTIFS(
  AuditLog!B:B, "transaction",
  AuditLog!D:D, "deleted",
  AuditLog!F:F, ">=" & DATE(2026,4,1),
  AuditLog!F:F, "<=" & DATE(2026,4,30)
)
```

**Alert:** Nếu count > 5 trong tháng → investigate.

---

### 6.4. Xem recent changes (7 ngày qua)

**Mục đích:** Daily standup review, catch issues early.

**Formula:**
```excel
=FILTER(
  AuditLog!A:L,
  AuditLog!F:F >= TODAY() - 7,
  AuditLog!F:F <= TODAY()
)
```

**Tip:** Sort by `changed_at` descending để xem cái mới nhất trước.

---

### 6.5. Track balance adjustments

**Mục đích:** Audit các thay đổi số dư tài khoản (risk management).

**Formula:**
```excel
=FILTER(
  AuditLog!A:L,
  AuditLog!B:B = "account",
  AuditLog!D:D = "balance_adjusted",
  AuditLog!I:I <> ""  // has diff_summary
)
```

---

### 6.6. Tìm audit rows có reason field

**Mục đích:** Review lý do các manual changes quan trọng.

**Formula:**
```excel
=FILTER(
  AuditLog!A:L,
  AuditLog!K:K <> "",  // reason is not empty
  AuditLog!E:E = "user"
)
```

---

### 6.7. Pivot: Actions per entity type (tháng này)

**Mục đích:** Overview distribution of actions.

**Pivot Table setup:**
- **Rows:** `entity_type` (cột B)
- **Columns:** `action` (cột D)
- **Values:** COUNTA of `id` (cột A)
- **Filter:** `changed_at` >= first day of month

**Kết quả mẫu:**

| entity_type | created | updated | deleted | voided | settled |
|-------------|---------|---------|---------|--------|---------|
| transaction | 150 | 12 | 2 | 3 | - |
| debt | 5 | 8 | 0 | 0 | 2 |
| account | 1 | 3 | 0 | 0 | - |
| cashback_cycle | 10 | 25 | 0 | 0 | 0 |

---

## 7. Dashboard Audit Metrics (Tab Summary)

### 7.1. Total audit entries this month
```excel
=COUNTIFS(
  AuditLog!F:F, ">=" & DATE(YEAR(TODAY()), MONTH(TODAY()), 1),
  AuditLog!F:F, "<=" & TODAY()
)
```

### 7.2. Manual vs System ratio
```excel
=TEXT(
  COUNTIFS(AuditLog!L:L, FALSE) / COUNTA(AuditLog!A:A),
  "0%"
) & " manual"
```

### 7.3. Top 5 most modified entities
```excel
=QUERY(
  AuditLog!B:C,
  "SELECT B, C, COUNT(C) 
   WHERE F >= date '" & TEXT(DATE(2026,4,1),"yyyy-mm-dd") & "' 
   GROUP BY B, C 
   ORDER BY COUNT(C) DESC 
   LIMIT 5",
  1
)
```

### 7.4. Deletions trend (last 6 months)
```excel
=ARRAYFORMULA(
  QUERY(
    AuditLog!D:F,
    "SELECT FORMAT(F, 'YYYY-MM'), COUNT(D) 
     WHERE D = 'deleted' 
     GROUP BY FORMAT(F, 'YYYY-MM') 
     ORDER BY FORMAT(F, 'YYYY-MM') 
     LABEL FORMAT(F, 'YYYY-MM') 'Month', COUNT(D) 'Deletions'",
    1
  )
)
```

---

## 8. Named Ranges đề xuất

| Named Range | Range | Mục đích |
|-------------|-------|----------|
| `AuditLog_EntityType` | `AuditLog!B:B` | Validate dropdown |
| `AuditLog_Action` | `AuditLog!D:D` | Filter by action |
| `AuditLog_ChangedBy` | `AuditLog!E:E` | Filter by source |
| `AuditLog_ChangedAt` | `AuditLog!F:F` | Date filtering |
| `AuditLog_DiffSummary` | `AuditLog!I:I` | Quick view |

---

## 9. Conditional Formatting

### 9.1. Highlight manual changes
- **Range:** `AuditLog!A:L`
- **Condition:** `$L2 = FALSE` (is_system_generated = FALSE)
- **Format:** Background màu vàng nhạt `#FFF3CD`

### 9.2. Highlight deletions/voids
- **Range:** `AuditLog!D:D`
- **Condition:** `OR($D2="deleted", $D2="voided")`
- **Format:** Background màu đỏ nhạt `#F8D7DA`, text màu đỏ đậm

### 9.3. Highlight large balance adjustments
- **Range:** `AuditLog!I:I`
- **Condition:** `REGEXMATCH($I:I, "[0-9]{7,}")` (có số >= 1,000,000)
- **Format:** Background màu cam `#FFC107`

### 9.4. System-generated rows
- **Range:** `AuditLog!A:L`
- **Condition:** `$L2 = TRUE`
- **Format:** Background màu xanh nhạt `#D1ECF1`

---

## 10. Troubleshooting

### Issue 1: Audit log không có data mới
**Nguyên nhân:** n8n workflow bị lỗi hoặc Google Apps Script trigger bị disable.

**Khắc phục:**
1. Check n8n workflow execution logs
2. Verify Google Apps Script trigger còn active
3. Test manual webhook call

---

### Issue 2: before_snapshot null khi không nên
**Nguyên nhân:** Logic capture before state bị lỗi.

**Khắc phục:**
1. Ensure snapshot captured **trước** khi apply change
2. Add logging để debug timing

---

### Issue 3: Audit row bị duplicate
**Nguyên nhân:** Trigger fire nhiều lần cho cùng 1 event.

**Khắc phục:**
1. Add debounce logic trong Google Apps Script
2. Use unique event ID để deduplicate

---

### Issue 4: Sheet quá chậm khi nhiều audit rows
**Nguyên nhân:** Hàng nghìn rows, formulas phức tạp.

**Khắc phục:**
1. Archive old rows (> 6 months) sang sheet riêng
2. Simplify formulas, avoid entire column references
3. Use pivot tables thay vì FILTER array formulas

---

## 11. Checklist cho Agent/Codegen

### Tạo audit row mới:
- [ ] Xác định entity_type và entity_id chính xác
- [ ] Chọn đúng action từ danh sách allowed values
- [ ] Set changed_by = "user" | "n8n_agent" | "system"
- [ ] Capture before_snapshot (JSON) trước khi change
- [ ] Apply change
- [ ] Capture after_snapshot (JSON) sau khi change
- [ ] Generate diff_summary (text ngắn gọn)
- [ ] Set changed_at = NOW() (timezone UTC+7)
- [ ] Điền reason nếu là manual delete/void/large adjustment
- [ ] Set is_system_generated = TRUE/FALSE phù hợp
- [ ] Append row vào AuditLog tab (không insert giữa)
- [ ] Verify row được tạo thành công

### Review audit log (hàng tuần):
- [ ] COUNT deletions trong tuần > 5? → Investigate
- [ ] Có manual changes nào không có reason? → Follow up
- [ ] Có balance adjustments lớn bất thường? → Verify
- [ ] Có audit rows missing? → Check n8n workflow health

### Setup ban đầu:
- [ ] Tạo tab AuditLog với schema 12 cột
- [ ] Setup data validation cho dropdown columns
- [ ] Apply conditional formatting rules
- [ ] Configure Google Apps Script onEdit trigger
- [ ] Setup n8n webhook endpoint
- [ ] Test với 1-2 sample changes
- [ ] Document access control (view-only cho users)

---

## 12. Security & Access Control

### Permission levels:
| Role | Permissions |
|------|-------------|
| **Admin** | Full access (view + export) |
| **User** | View-only (không edit, không delete) |
| **n8n Agent** | Append-only (chỉ thêm row mới) |
| **System** | Append-only (auto-calculations) |

### Best practices:
- Không share edit access cho tab AuditLog
- Export định kỳ (monthly) sang PDF/CSV để backup
- Enable version history trên Google Sheet
- Setup alert nếu có ai attempt to edit/delete audit rows

---

## Tài liệu liên quan
- [Transactions](transactions.md) - Entity được audit nhiều nhất
- [Debt](debt.md) - Audit debt lifecycle events
- [Cashback](cashback.md) - Audit recalculation events
- [Installment](installment.md) - Audit payment posting events
