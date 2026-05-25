---
type: account
id: d823304a-3784-4dd4-b165-dff2203362c5
---
# 💳 Tiền mặt

[👈 Trở về Dashboard](../00_Dashboard/Dashboard.md)

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

## 📊 Thống kê Tài khoản

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };

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
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };

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
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };

const accId = dv.current().id;
const res = await fetch(`${SUPABASE_URL}/rest/v1/transactions?account_id=eq.${accId}&order=occurred_at.desc&limit=20`, { headers });

if (res.ok) {
  const txns = await res.json();
  const statusStyles = {
    posted: { bg: 'rgba(46,200,102,0.15)', color: '#2ec866' },
    pending: { bg: 'rgba(244,208,63,0.12)', color: '#f4d03f' },
    void: { bg: 'rgba(120,120,120,0.08)', color: '#6b7280' }
  };

  dv.table(["ID", "Status", "Loại", "Kỳ", "Ngày", "Số tiền", "% CB", "CB Cố định", "Σ CB", "Final Price", "Ghi chú"], txns.map(t => {
    const isPlus = ['income', 'repayment', 'refund', 'transfer_in'].includes(t.type);
    const typeLabel = isPlus ? '<span style="color:#2ec866;font-weight:bold;">🟢 In</span>' : '<span style="color:#f25f5c;font-weight:bold;">🔴 Out</span>';
    const status = (t.status || 'posted').toLowerCase();
    const sc = statusStyles[status] || statusStyles.posted;
    const statusBadge = '<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:' + sc.bg + ';color:' + sc.color + ';font-weight:700;">' + status.toUpperCase() + '</span>';
    const strikeStart = status === 'void' ? '<span style="text-decoration:line-through;opacity:0.6;">' : '';
    const strikeEnd = status === 'void' ? '</span>' : '';
    const d = new Date(t.occurred_at);
    const mStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const shortId = t.id ? t.id.substring(0, 5) : '-';
    const amt = Number(t.amount);
    const cbPct = Number(t.cashback_share_percent || 0);
    const cbFixed = Number(t.cashback_share_fixed || 0);
    const cbSum = cbPct > 0 ? Math.round(amt * cbPct) : cbFixed;
    const fee = Number(t.metadata?.service_fee || 0);
    const net = amt - cbSum + fee;
    return [
      shortId,
      statusBadge,
      typeLabel,
      '[[' + '01_Monthly_Logs/' + mStr + '|' + mStr + ']]',
      d.toLocaleDateString('vi-VN'),
      strikeStart + '**' + amt.toLocaleString() + ' đ**' + strikeEnd,
      cbPct > 0 ? (cbPct * 100).toFixed(1) + '%' : '-',
      cbFixed > 0 ? cbFixed.toLocaleString() + ' đ' : '-',
      cbSum > 0 ? cbSum.toLocaleString() + ' đ' : '-',
      strikeStart + '**' + net.toLocaleString() + ' đ**' + strikeEnd,
      strikeStart + (t.note || '-') + strikeEnd
    ];
  }));
}
```
