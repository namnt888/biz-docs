# 💸 Phân tích Thu Chi Chuyên Sâu (Cashflow Analytics)

> [!NOTE] Dữ liệu thu chi được tổng hợp theo thời gian thực từ Supabase.

[👈 Trở về Dashboard](Dashboard.md) | [👤 Báo cáo của tôi](My_Report.md) | [🤝 Trung tâm Công nợ](Debt_Center.md) | [🎁 Quản lý Hoàn tiền](Cashback_Center.md)

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
    dv.table(["Loại", "Thời gian", "Số tiền", "Ghi chú", "Danh mục"], txns.slice(0, 10).map(t => {
      const isIn = ['income','repayment','refund','transfer_in'].includes(t.type);
      const typeLabel = isIn ? '<span style="color:#2ec866;font-weight:bold;">🟢 In</span>' : '<span style="color:#f25f5c;font-weight:bold;">🔴 Out</span>';
      return [
        typeLabel,
        new Date(t.occurred_at).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        `**${Number(t.amount).toLocaleString()} VND**`,
        t.note || "-",
        t.metadata?.category_name || "-"
      ];
    }));
  }
} catch (err) {
  dv.paragraph("❌ Lỗi: " + err.message);
}
```
