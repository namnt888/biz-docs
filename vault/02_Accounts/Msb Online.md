---
type: account
id: 96194195-127f-45bb-8ec3-8fa4eb703875
---
# 💳 Msb Online

[👈 Trở về Dashboard](../00_Dashboard/Dashboard.md)

## 📊 Thống kê Tài khoản

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };

const accId = dv.current().id;

const [accRes, txnRes] = await Promise.all([
  fetch(`${SUPABASE_URL}/rest/v1/accounts?id=eq.${accId}`, { headers }),
  fetch(`${SUPABASE_URL}/rest/v1/transactions?account_id=eq.${accId}&status=eq.posted`, { headers })
]);

if (accRes.ok && txnRes.ok) {
  const accData = await accRes.json();
  const txns = await txnRes.json();
  
  const balance = accData[0]?.current_balance || 0;
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  
  let totalIn = 0, totalOut = 0, monthIn = 0, monthOut = 0;
  
  txns.forEach(t => {
    const amt = Number(t.amount);
    const cb = t.cashback_share_percent ? Math.round(amt * t.cashback_share_percent) : Number(t.cashback_share_fixed || 0);
    const net = amt - cb + Number(t.metadata?.service_fee || 0);
    const isPlus = ['income', 'repayment', 'refund', 'transfer_in'].includes(t.type);
    const isThisMonth = t.occurred_at >= startOfMonth;
    
    if (isPlus) {
      totalIn += amt;
      if (isThisMonth) monthIn += amt;
    } else {
      totalOut += amt;
      if (isThisMonth) monthOut += amt;
    }
  });

  dv.table(["Chỉ số", "Giá trị"], [
    ["💰 Số dư hiện tại", `**${Number(balance).toLocaleString()} VND**`],
    ["🟢 Tổng Thu (All time)", `${totalIn.toLocaleString()} VND`],
    ["🔴 Tổng Chi (All time)", `${totalOut.toLocaleString()} VND`],
    ["📈 Thu tháng này", `${monthIn.toLocaleString()} VND`],
    ["📉 Chi tháng này", `${monthOut.toLocaleString()} VND`]
  ]);
} else {
  dv.paragraph("❌ Lỗi tải dữ liệu");
}
```

## 🎁 Hoàn tiền (Cashback Cycles)

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };

const accId = dv.current().id;
const res = await fetch(`${SUPABASE_URL}/rest/v1/cashback_cycles?account_id=eq.${accId}&order=cycle_tag.desc`, { headers });

if (res.ok) {
  const cycles = await res.json();
  if (cycles.length > 0) {
    dv.table(["Kỳ sao kê", "Đã chi tiêu", "CB Dự kiến (Virtual)", "CB Thực tế (Real)"], cycles.map(c => [
      `**${c.cycle_tag}**`,
      `${Number(c.spent_amount).toLocaleString()} VND`,
      `${Number(c.virtual_profit).toLocaleString()} VND`,
      `**${Number(c.real_awarded).toLocaleString()} VND**`
    ]));
  } else {
    dv.paragraph("Không có dữ liệu hoàn tiền.");
  }
}
```

## 📜 Lịch sử Giao dịch

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };

const accId = dv.current().id;
const res = await fetch(`${SUPABASE_URL}/rest/v1/transactions?account_id=eq.${accId}&order=occurred_at.desc&limit=20`, { headers });

if (res.ok) {
  const txns = await res.json();
  dv.table(["ID", "Tháng", "Ngày", "Phân loại", "Số tiền", "CB / Net", "Ghi chú"], txns.map(t => {
    const isPlus = ['income', 'repayment', 'refund', 'transfer_in'].includes(t.type);
    const sign = isPlus ? "🟢 +" : "🔴 -";
    const d = new Date(t.occurred_at);
    const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const shortId = t.id ? t.id.substring(0, 5) : '-';
    
    const amt = Number(t.amount);
    const cb = t.cashback_share_percent ? Math.round(amt * t.cashback_share_percent) : Number(t.cashback_share_fixed || 0);
    const net = amt - cb + Number(t.metadata?.service_fee || 0);
    const cbStr = cb > 0 ? `CB: ${cb.toLocaleString()}đ<br>Net: ${net.toLocaleString()}đ` : '-';
    
    return [
      `\`${shortId}\``,
      `[[${mStr}]]`,
      d.toLocaleString('vi-VN'),
      t.type,
      `**${sign}${amt.toLocaleString()} đ**`,
      cbStr,
      t.note || "-"
    ];
  }));
}
```
