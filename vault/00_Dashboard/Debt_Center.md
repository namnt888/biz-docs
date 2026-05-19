# 🤝 Trung tâm Quản lý Nợ & Vị thế Ròng (Debt Center)

> [!NOTE] Bảng vị thế ròng (Net Position) cho biết bạn đang dương tiền hay âm tiền với từng đối tác/bạn bè.

[👈 Trở về Dashboard](Dashboard.md) | [👤 Báo cáo của tôi](My_Report.md) | [💸 Phân tích Thu Chi](Cashflow_Analytics.md) | [🎁 Quản lý Hoàn tiền](Cashback_Center.md)

---

## 👥 Bảng Vị thế Công nợ Tổng hợp

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";

try {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };
  const [debtsRes, peopleRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/debts?select=*`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/people?select=*`, { headers })
  ]);
  
  if (debtsRes.ok && peopleRes.ok) {
    const debts = await debtsRes.json();
    const people = await peopleRes.json();
    const personMap = {};
    
    people.forEach(p => {
      personMap[p.id] = { name: p.name, lent: 0, borrowed: 0, repaidLent: 0, repaidBorrow: 0 };
    });
    
    debts.forEach(d => {
      const p = personMap[d.person_id];
      if (!p) return;
      const orig = Number(d.original_amount);
      const rep = Number(d.repaid_amount);
      
      if (d.debt_role === 'lent') {
        p.lent += orig;
        p.repaidLent += rep;
      } else {
        p.borrowed += orig;
        p.repaidBorrow += rep;
      }
    });
    
    const activePeople = Object.entries(personMap).filter(([_, p]) => p.lent > 0 || p.borrowed > 0);
    
    dv.table(["Người liên quan", "Tổng cho mượn", "Họ đã trả", "Tổng đi mượn", "Mình đã trả", "Vị thế ròng (Net Position)"], activePeople.map(([id, p]) => {
      const outLent = p.lent - p.repaidLent;
      const outBorrow = p.borrowed - p.repaidBorrow;
      const net = outLent - outBorrow;
      
      let netStr = "";
      if (net > 0) netStr = `**🟢 +${net.toLocaleString()} VND (Họ nợ mình)**`;
      else if (net < 0) netStr = `**🔴 ${net.toLocaleString()} VND (Mình nợ họ)**`;
      else netStr = "⚪ Tất toán (0 VND)";
      
      return [
        `**[[${p.name}]]**`,
        `${p.lent.toLocaleString()} VND`, `${p.repaidLent.toLocaleString()} VND`,
        `${p.borrowed.toLocaleString()} VND`, `${p.repaidBorrow.toLocaleString()} VND`,
        netStr
      ];
    }));
  }
} catch (err) {
  dv.paragraph("❌ Lỗi: " + err.message);
}
```

---

## 📜 Danh sách các khoản nợ đang xử lý (Pending & Partial)

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";

try {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };
  const [debtsRes, peopleRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/debts?select=*&status=in.(pending,partial)&order=occurred_at.asc`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/people?select=id,name`, { headers })
  ]);
  
  if (debtsRes.ok && peopleRes.ok) {
    const debts = await debtsRes.json();
    const people = await peopleRes.json();
    const peopleMap = Object.fromEntries(people.map(p => [p.id, p.name]));
    
    dv.table(["Loại", "Thời gian phát sinh", "Đối tác", "Ghi chú", "Tổng số tiền", "Đã trả", "Còn nợ"], debts.map(d => [
      d.debt_role === 'lent' ? '<span style="color:#f25f5c;font-weight:bold;">🔴 Out</span>' : '<span style="color:#2ec866;font-weight:bold;">🟢 In</span>',
      new Date(d.occurred_at).toLocaleDateString('vi-VN'),
      `**[[${peopleMap[d.person_id] || "Unknown"}]]**`,
      d.notes || "-",
      `${Number(d.original_amount).toLocaleString()} VND`,
      `${Number(d.repaid_amount).toLocaleString()} VND`,
      `**${Number(d.remaining_amount).toLocaleString()} VND**`
    ]));
  }
} catch (err) {
  dv.paragraph("❌ Lỗi: " + err.message);
}
```
