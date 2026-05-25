# 💸 Phân tích Thu Chi Chuyên Sâu (Cashflow Analytics)

> [!NOTE] Dữ liệu thu chi được tổng hợp theo thời gian thực từ Supabase.

[👈 Trở về Dashboard](Dashboard.md) | [👤 Báo cáo của tôi](My_Report.md) | [🤝 Trung tâm Công nợ](Debt_Center.md) | [🎁 Quản lý Hoàn tiền](Cashback_Center.md)

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

---

## 📅 Tổng kết Dòng tiền Tháng này

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";

try {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  
  const headers = { 
  'apikey': SUPABASE_ANON_KEY, 
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};
  const res = await fetch(`${SUPABASE_URL}/rest/v1/transactions?select=*&occurred_at=gte.${firstDay}&order=occurred_at.desc`, { headers });
  
  if (res.ok) {
    const txns = await res.json();
    let income = 0;
    let expense = 0;
    const catMap = {};
    
    txns.forEach(t => {
      const amt = Number(t.amount);
      const cat = t.metadata?.category_name || "Khác";
      
      if (t.type === 'income') income += amt;
      if (t.type === 'expense' || t.type === 'service') {
        expense += amt;
        catMap[cat] = (catMap[cat] || 0) + amt;
      }
    });
    
    const net = income - expense;
    dv.header(3, `📊 Thu: ${income.toLocaleString()} VND  |  Chi: ${expense.toLocaleString()} VND`);
    dv.header(4, `🎯 Dòng tiền ròng: ${net >= 0 ? '+' : ''}${net.toLocaleString()} VND`);
    
    dv.header(3, "pie_chart: Phân bổ Chi tiêu theo Danh mục");
    const sortedCats = Object.entries(catMap).sort((a,b) => b[1] - a[1]);
    dv.table(["Danh mục", "Tổng chi tiêu", "Tỷ trọng"], sortedCats.map(([cat, amt]) => {
      const pct = Math.round((amt / expense) * 100);
      return [`**${cat}**`, `${amt.toLocaleString()} VND`, `${pct}%`];
    }));
    
    dv.header(3, "📝 Ghi chép giao dịch gần đây");
    const statusStyles = {
      posted: { bg: 'rgba(46,200,102,0.15)', color: '#2ec866' },
      pending: { bg: 'rgba(244,208,63,0.12)', color: '#f4d03f' },
      void: { bg: 'rgba(120,120,120,0.08)', color: '#6b7280' }
    };

    dv.table(["Status", "Loại", "Thời gian", "Số tiền", "Ghi chú", "Danh mục"], txns.slice(0, 10).map(t => {
      const isIn = ['income','repayment','refund','transfer_in'].includes(t.type);
      const typeLabel = isIn ? '<span style="color:#2ec866;font-weight:bold;">🟢 In</span>' : '<span style="color:#f25f5c;font-weight:bold;">🔴 Out</span>';
      const status = (t.status || 'posted').toLowerCase();
      const sc = statusStyles[status] || statusStyles.posted;
      const statusBadge = `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${sc.bg};color:${sc.color};font-weight:700;">${status.toUpperCase()}</span>`;
      const strikeStart = status === 'void' ? '<span style="text-decoration:line-through;opacity:0.6;">' : '';
      const strikeEnd = status === 'void' ? '</span>' : '';
      return [
        statusBadge,
        typeLabel,
        new Date(t.occurred_at).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        `${strikeStart}**${Number(t.amount).toLocaleString()} VND**${strikeEnd}`,
        `${strikeStart}${t.note || "-"}${strikeEnd}`,
        t.metadata?.category_name || "-"
      ];
    }));
  }
} catch (err) {
  dv.paragraph("❌ Lỗi: " + err.message);
}
```
