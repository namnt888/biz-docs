# 🎁 Trung tâm Hoàn tiền Thẻ (Cashback Center)

> [!NOTE] Theo dõi tiến độ đạt ngưỡng chi tiêu tối thiểu (`min_spend`) và đối soát hoàn tiền thực tế nhận từ ngân hàng.

[👈 Trở về Dashboard](Dashboard.md)

---

## 💳 Tiến độ Chu kỳ Hiện tại & Hạn mức Hoàn tiền

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";

try {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };
  const [cyclesRes, accountsRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/cashback_cycles?select=*&status=eq.active&order=cycle_tag.desc`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/accounts?select=id,name`, { headers })
  ]);
  
  if (cyclesRes.ok && accountsRes.ok) {
    const cycles = await cyclesRes.json();
    const accounts = await accountsRes.json();
    const accMap = Object.fromEntries(accounts.map(a => [a.id, a.name]));
    
    dv.table(["Tài khoản / Thẻ", "Chu kỳ", "Tổng chi tiêu", "Min Spend (Tối thiểu)", "Trạng thái", "Hoàn tiền dự kiến", "Đã nhận thực tế", "Hạn mức tối đa"], cycles.map(c => {
      const spent = Number(c.spent_amount);
      const minSpend = Number(c.cb_min_spend);
      const isQual = spent >= minSpend;
      
      const qualStr = isQual ? "✅ Đạt chuẩn" : `⏳ Thiếu ${(minSpend - spent).toLocaleString()} VND`;
      
      return [
        `**${accMap[c.account_id] || "Card"}**`,
        `\`${c.cycle_tag}\` (${c.cycle_type})`,
        `${spent.toLocaleString()} VND`,
        `${minSpend.toLocaleString()} VND`,
        qualStr,
        `**${Number(c.virtual_profit).toLocaleString()} VND**`,
        `${Number(c.real_awarded).toLocaleString()} VND`,
        `${Number(c.cb_max_budget || 0).toLocaleString()} VND`
      ];
    }));
  }
} catch (err) {
  dv.paragraph("❌ Lỗi: " + err.message);
}
```

---

## 📜 Chi tiết các khoản giao dịch tính Cashback

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";

try {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/cashback_entries?select=*,transactions(note,amount,occurred_at)&order=created_at.desc&limit=15`, { headers });
  
  if (res.ok) {
    const entries = await res.json();
    
    dv.table(["Ngày giao dịch", "Giao dịch gốc", "Chế độ (Mode)", "Số tiền giao dịch", "Tiền hoàn tính toán", "Tính vào Budget"], entries.map(e => [
      new Date(e.transactions?.occurred_at).toLocaleDateString('vi-VN'),
      e.transactions?.note || "-",
      `\`${e.mode}\``,
      `${Number(e.transactions?.amount || 0).toLocaleString()} VND`,
      `**${Number(e.amount).toLocaleString()} VND**`,
      e.counts_to_budget ? "☑️ Có" : "◻️ Không"
    ]));
  }
} catch (err) {
  dv.paragraph("❌ Lỗi: " + err.message);
}
```
