---
type: account
id: 23ea6f55-3826-4a4c-aef3-7bdb496a3e6d
---
# 💳 Uob

[👈 Trở về Dashboard](../00_Dashboard/Dashboard.md)

## 📊 Thống kê Tài khoản

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";
const headers = { 
  'apikey': SUPABASE_ANON_KEY, 
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

const accId = dv.current().id;

const [accRes, txnRes] = await Promise.all([
  fetch(`${SUPABASE_URL}/rest/v1/accounts?id=eq.${accId}`, { headers }),
  fetch(`${SUPABASE_URL}/rest/v1/transactions?account_id=eq.${accId}`, { headers })
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
    const isPlus = ['income', 'repayment', 'refund', 'transfer_in'].includes(t.type);
    const isThisMonth = t.occurred_at >= startOfMonth;
    if (isPlus) { totalIn += amt; if (isThisMonth) monthIn += amt; }
    else { totalOut += amt; if (isThisMonth) monthOut += amt; }
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
const headers = { 
  'apikey': SUPABASE_ANON_KEY, 
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

const accId = dv.current().id;
const res = await fetch(`${SUPABASE_URL}/rest/v1/cashback_cycles?account_id=eq.${accId}&order=cycle_tag.desc`, { headers });

if (res.ok) {
  const cycles = await res.json();
  if (cycles.length > 0) {
    dv.table(["Kỳ sao kê", "Đã chi tiêu", "CB Dự kiến", "CB Thực tế"], cycles.map(c => [
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

## 📜 Lịch sử Giao dịch (20 gần nhất)

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";
const headers = { 
  'apikey': SUPABASE_ANON_KEY, 
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

const accId = dv.current().id;
const res = await fetch(`${SUPABASE_URL}/rest/v1/transactions?account_id=eq.${accId}&order=occurred_at.desc&limit=20`, { headers });

if (res.ok) {
  const txns = await res.json();
  dv.table(["ID", "Loại", "Kỳ", "Ngày", "Số tiền", "% CB", "CB Cố định", "Σ CB", "Final Price", "Ghi chú"], txns.map(t => {
    const isPlus = ['income', 'repayment', 'refund', 'transfer_in'].includes(t.type);
    const typeLabel = isPlus ? '<span style="color:#2ec866;font-weight:bold;">🟢 In</span>' : '<span style="color:#f25f5c;font-weight:bold;">🔴 Out</span>';
    const d = new Date(t.occurred_at);
    const mStr = `${d.getFullYear()}-\ ${String(d.getMonth() + 1).padStart(2, '0')}`.replace('- ', '-');
    const shortId = t.id ? t.id.substring(0, 5) : '-';
    const amt = Number(t.amount);
    const cbPct = Number(t.cashback_share_percent || 0);
    const cbFixed = Number(t.cashback_share_fixed || 0);
    const cbSum = cbPct > 0 ? Math.round(amt * cbPct) : cbFixed;
    const fee = Number(t.metadata?.service_fee || 0);
    const net = amt - cbSum + fee;
    return [
      `\`${shortId}\``,
      typeLabel,
      `[[01_Monthly_Logs/${mStr}|${mStr}]]`,
      d.toLocaleDateString('vi-VN'),
      `**${amt.toLocaleString()} đ**`,
      cbPct > 0 ? `${(cbPct * 100).toFixed(1)}%` : '-',
      cbFixed > 0 ? `${cbFixed.toLocaleString()} đ` : '-',
      cbSum > 0 ? `${cbSum.toLocaleString()} đ` : '-',
      `**${net.toLocaleString()} đ**`,
      t.note || "-"
    ];
  }));
}
```
