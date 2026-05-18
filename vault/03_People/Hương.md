---
type: person
id: 00c71cfc-b336-4e94-9362-23b30344bdf4
---
# 👤 Hương

[👈 Trở về Debt Center](../00_Dashboard/Debt_Center.md)

## 🤝 Tình trạng Công nợ

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };

const personId = dv.current().id;
const res = await fetch(`${SUPABASE_URL}/rest/v1/debts?person_id=eq.${personId}&order=occurred_at.desc`, { headers });

if (res.ok) {
  const debts = await res.json();
  if (debts.length > 0) {
    dv.table(["Ngày", "Loại", "Ghi chú", "Tổng nợ", "Đã trả", "Còn lại", "Trạng thái"], debts.map(d => {
      const isLent = d.debt_role === 'lent';
      const roleStr = isLent ? "🟢 Cho vay" : "🔴 Đi mượn";
      let statusStr = "⚪ Đã trả hết (Settled)";
      if (d.status === 'pending') statusStr = "🔴 Chưa trả (Pending)";
      if (d.status === 'partial') statusStr = "🟠 Đang trả (Partial)";
      
      return [
        new Date(d.occurred_at).toLocaleDateString('vi-VN'),
        roleStr,
        d.notes || "-",
        `${Number(d.original_amount).toLocaleString()} đ`,
        `${Number(d.repaid_amount).toLocaleString()} đ`,
        `**${Number(d.remaining_amount).toLocaleString()} đ**`,
        statusStr
      ];
    }));
  } else {
    dv.paragraph("Không có công nợ nào với người này.");
  }
}
```

## 📜 Giao dịch liên quan

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };

const personId = dv.current().id;
const res = await fetch(`${SUPABASE_URL}/rest/v1/transactions?person_id=eq.${personId}&order=occurred_at.desc`, { headers });

if (res.ok) {
  const txns = await res.json();
  if (txns.length > 0) {
    dv.table(["Ngày", "Phân loại", "Số tiền", "Ghi chú"], txns.map(t => [
      new Date(t.occurred_at).toLocaleString('vi-VN'),
      t.type,
      `**${Number(t.amount).toLocaleString()} đ**`,
      t.note || "-"
    ]));
  } else {
    dv.paragraph("Không có giao dịch.");
  }
}
```
