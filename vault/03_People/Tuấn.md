---
type: person
id: 5a6d5ff2-a221-4ce5-b367-c633e29d5390
---
# 👤 Tuấn

[👈 Trở về Debt Center](../00_Dashboard/Debt_Center.md)

<style>
  table {
    border-collapse: collapse;
    width: 100%;
  }
  th, td {
    border: 1px solid var(--border-color, #d1d5db);
    padding: 8px 10px;
    vertical-align: middle;
  }
  th {
    background: var(--background-secondary-alt, #2b6cb0);
    color: var(--text-normal, #fff);
    font-weight: 700;
  }
</style>

## 📂 Giao dịch theo Năm

- [[Tuấn/2026|📅 2026]]

---

## 🤝 Tổng quan Công nợ

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };

const personId = dv.current().id;
const res = await fetch(`${SUPABASE_URL}/rest/v1/debts?person_id=eq.${personId}&order=occurred_at.desc`, { headers });

if (res.ok) {
  const rawDebts = await res.json();
  // Dedup by ID to prevent duplicate display
  const seen = new Set();
  const debts = rawDebts.filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; });

  if (debts.length > 0) {
    const totalOrig = debts.reduce((s, d) => s + Number(d.original_amount), 0);
    const totalRepaid = debts.reduce((s, d) => s + Number(d.repaid_amount), 0);
    const totalRemain = debts.reduce((s, d) => s + Number(d.remaining_amount), 0);
    dv.paragraph(`📊 **Tổng nợ:** ${totalOrig.toLocaleString()} đ &nbsp;|&nbsp; **Đã trả:** ${totalRepaid.toLocaleString()} đ &nbsp;|&nbsp; **Còn lại:** ${totalRemain.toLocaleString()} đ`);

    dv.table(["Loại", "Kỳ (Cycle)", "Ghi chú", "Tổng nợ", "Đã trả", "Còn lại", "Trạng thái"], debts.map(d => {
      const roleStr = d.debt_role === 'lent' ? '<span style="color:#f25f5c;font-weight:bold;">🔴 Out</span>' : '<span style="color:#2ec866;font-weight:bold;">🟢 In</span>';
      let statusStr = "⚪ Settled";
      if (d.status === 'pending') statusStr = "🔴 Pending";
      if (d.status === 'partial') statusStr = "🟠 Partial";
      const dt = new Date(d.occurred_at);
      const mStr = `${dt.getFullYear()}-\ ${String(dt.getMonth() + 1).padStart(2, '0')}`.replace('- ', '-');
      return [roleStr, `[[01_Monthly_Logs/${mStr}|${mStr}]]`, d.notes || "-",
        `${Number(d.original_amount).toLocaleString()} đ`,
        `${Number(d.repaid_amount).toLocaleString()} đ`,
        `**${Number(d.remaining_amount).toLocaleString()} đ**`,
        statusStr];
    }));
  } else {
    dv.paragraph("Không có công nợ nào với người này. ✅");
  }
}
```
