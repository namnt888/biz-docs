# 📊 Obsidian Money Dashboard

> Hệ thống điều hành tài chính cá nhân tự động hóa. Dữ liệu đồng bộ realtime từ Supabase.

| 👤 [Báo cáo của tôi](My_Report.md) | 💸 [Phân tích Thu Chi](Cashflow_Analytics.md) | 🤝 [Trung tâm Công nợ](Debt_Center.md) | 🎁 [Quản lý Hoàn tiền](Cashback_Center.md) |
| :---: | :---: | :---: | :---: |

---

## 💳 Tổng quan Tài sản & Tài khoản

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";

try {
  const url = SUPABASE_URL + "/rest/v1/accounts?select=id,name,type,current_balance,currency&order=name.asc";
  const res = await fetch(url, {
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
  });
  
  if (res.ok) {
    const accounts = await res.json();
    const total = accounts.reduce((acc, a) => acc + Number(a.current_balance), 0);
    
    dv.header(3, `💰 Tổng tài sản: ${total.toLocaleString()} VND`);
    dv.table(["Tài khoản", "Loại", "Số dư hiện tại"], accounts.map(a => [
      `**[[${a.name}]]**`,
      a.type.toUpperCase(),
      `${Number(a.current_balance).toLocaleString()} ${a.currency}`
    ]));
  } else {
    dv.paragraph("⚠️ Không thể tải dữ liệu tài khoản từ Supabase. (HTTP " + res.status + ")");
  }
} catch (err) {
  dv.paragraph("❌ Lỗi kết nối Supabase: " + err.message);
}
```

---

## 📊 Dòng tiền ròng trong tháng (Net Cashflow)

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";

try {
  // Lấy ngày đầu tháng này
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  
  const url = `${SUPABASE_URL}/rest/v1/transactions?select=type,amount&occurred_at=gte.${firstDay}`;
  const res = await fetch(url, {
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
  });
  
  if (res.ok) {
    const txns = await res.json();
    let income = 0;
    let expense = 0;
    
    txns.forEach(t => {
      if (t.type === 'income') income += Number(t.amount);
      if (t.type === 'expense' || t.type === 'service') expense += Number(t.amount);
    });
    
    const net = income - expense;
    const burnRate = income > 0 ? Math.round((expense / income) * 100) : (expense > 0 ? 100 : 0);
    
    // Tạo thanh biểu diễn tỷ lệ tiêu hao
    const barLength = 20;
    const filled = Math.min(barLength, Math.round((burnRate / 100) * barLength));
    const bar = "█".repeat(filled) + "░".repeat(barLength - filled);
    
    dv.paragraph(`**🟢 Tổng Thu:** ${income.toLocaleString()} VND  |  **🔴 Tổng Chi:** ${expense.toLocaleString()} VND`);
    dv.header(4, `📈 Dòng tiền ròng: ${net >= 0 ? '+' : ''}${net.toLocaleString()} VND`);
    dv.paragraph(`🔥 Tỷ lệ tiêu hao (Burn Rate): \`${bar}\` **${burnRate}%**`);
  }
} catch (err) {
  dv.paragraph("❌ Lỗi tải dữ liệu dòng tiền: " + err.message);
}
```

---

## 🤝 Quản lý Nợ & Cho Vay (Debts)

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";

try {
  const headers = { 
  'apikey': SUPABASE_ANON_KEY, 
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};
  
  const [debtsRes, peopleRes] = await Promise.all([
    fetch(SUPABASE_URL + "/rest/v1/debts?select=*&status=in.(pending,partial)&order=occurred_at.asc", { headers }),
    fetch(SUPABASE_URL + "/rest/v1/people?select=id,name", { headers })
  ]);
  
  if (debtsRes.ok && peopleRes.ok) {
    const debts = await debtsRes.json();
    const people = await peopleRes.json();
    const peopleMap = Object.fromEntries(people.map(p => [p.id, p.name]));
    
    if (debts.length === 0) {
      dv.paragraph("🎉 Tuyệt vời! Bạn không có khoản nợ nào cần xử lý.");
    } else {
      dv.table(["Loại", "Người liên quan", "Ghi chú", "Tổng nợ", "Đã trả", "Còn lại", "Tiến độ"], debts.map(d => {
        const personName = peopleMap[d.person_id] || "Unknown";
        const role = d.debt_role === "lent" ? '<span style="color:#f25f5c;font-weight:bold;">🔴 Out</span>' : '<span style="color:#2ec866;font-weight:bold;">🟢 In</span>';
        const orig = Number(d.original_amount);
        const repaid = Number(d.repaid_amount);
        const remain = Number(d.remaining_amount);
        
        const percent = Math.min(100, Math.round((repaid / orig) * 100));
        const barLength = 10;
        const filled = Math.round((percent / 100) * barLength);
        const bar = "▓".repeat(filled) + "░".repeat(barLength - filled);
        
        return [
          role, `**[[${personName}]]**`, d.notes || "-",
          `${orig.toLocaleString()} VND`, `${repaid.toLocaleString()} VND`,
          `**${remain.toLocaleString()} VND**`, `${bar} (${percent}%)`
        ];
      }));
    }
  }
} catch (err) {
  dv.paragraph("❌ Lỗi kết nối: " + err.message);
}
```

---

## 🎁 Hoàn tiền Thẻ (Cashback Cycles)

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";

try {
  const url = SUPABASE_URL + "/rest/v1/cashback_cycles?select=*&status=eq.active&order=cycle_tag.desc";
  const res = await fetch(url, {
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
  });
  
  if (res.ok) {
    const cycles = await res.json();
    if (cycles.length === 0) {
      dv.paragraph("ℹ️ Chưa có chu kỳ hoàn tiền nào đang hoạt động.");
    } else {
      dv.table(["Chu kỳ (Cycle)", "Loại", "Tổng chi tiêu", "Hoàn tiền dự kiến", "Đã nhận thực tế", "Ngân sách tối đa"], cycles.map(c => [
        `**${c.cycle_tag}**`, c.cycle_type,
        `${Number(c.spent_amount).toLocaleString()} VND`,
        `**${Number(c.virtual_profit).toLocaleString()} VND**`,
        `${Number(c.real_awarded).toLocaleString()} VND`,
        `${Number(c.cb_max_budget || 0).toLocaleString()} VND`
      ]));
    }
  }
} catch (err) {
  dv.paragraph("❌ Lỗi kết nối: " + err.message);
}
```
