---
type: person
id: 67f1f69a-826c-4348-99b7-fafab0eba37a
---
# 👤 Lâm

[👈 Trở về Debt Center](../00_Dashboard/Debt_Center.md)

## 🤝 Tổng quan Công nợ

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };

const personId = dv.current().id;
const res = await fetch(`${SUPABASE_URL}/rest/v1/debts?person_id=eq.${personId}&order=occurred_at.desc`, { headers });

if (res.ok) {
  const debts = await res.json();
  if (debts.length > 0) {
    // Summary row
    const totalOrig = debts.reduce((s, d) => s + Number(d.original_amount), 0);
    const totalRepaid = debts.reduce((s, d) => s + Number(d.repaid_amount), 0);
    const totalRemain = debts.reduce((s, d) => s + Number(d.remaining_amount), 0);
    dv.paragraph(`📊 **Tổng nợ:** ${totalOrig.toLocaleString()} đ &nbsp;|&nbsp; **Đã trả:** ${totalRepaid.toLocaleString()} đ &nbsp;|&nbsp; **Còn lại:** ${totalRemain.toLocaleString()} đ`);

    dv.table(["Kỳ (Cycle)", "Loại", "Ghi chú", "Tổng nợ", "Đã trả", "Còn lại", "Trạng thái"], debts.map(d => {
      const isLent = d.debt_role === 'lent';
      const roleStr = isLent ? "🟢 Cho vay" : "🔴 Đi mượn";
      let statusStr = "⚪ Settled";
      if (d.status === 'pending') statusStr = "🔴 Pending";
      if (d.status === 'partial') statusStr = "🟠 Partial";
      const dt = new Date(d.occurred_at);
      const mStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      return [
        mStr,
        roleStr,
        d.notes || "-",
        `${Number(d.original_amount).toLocaleString()} đ`,
        `${Number(d.repaid_amount).toLocaleString()} đ`,
        `**${Number(d.remaining_amount).toLocaleString()} đ**`,
        statusStr
      ];
    }));
  } else {
    dv.paragraph("Không có công nợ nào với người này. ✅");
  }
}
```

## 📜 Giao dịch liên quan (theo tháng)

> [!info] Bấm vào từng tháng để mở rộng danh sách giao dịch

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };

const personId = dv.current().id;
const res = await fetch(`${SUPABASE_URL}/rest/v1/transactions?person_id=eq.${personId}&order=occurred_at.desc`, { headers });

if (res.ok) {
  const txns = await res.json();
  if (txns.length === 0) {
    dv.paragraph("Không có giao dịch.");
  } else {
    // Group by month
    const byMonth = {};
    txns.forEach(t => {
      const d = new Date(t.occurred_at);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[mStr]) byMonth[mStr] = [];
      byMonth[mStr].push(t);
    });

    for (const [month, monthTxns] of Object.entries(byMonth)) {
      const monthArr = monthTxns;
      const totalAmt = monthArr.reduce((s, t) => s + Number(t.amount), 0);
      const totalCB = monthArr.reduce((t2, t) => {
        const amt = Number(t.amount);
        const cb = t.cashback_share_percent ? Math.round(amt * t.cashback_share_percent) : Number(t.cashback_share_fixed || 0);
        return t2 + cb;
      }, 0);

      dv.header(3, `📅 [[${month}]] — ${monthArr.length} giao dịch | Tổng: ${totalAmt.toLocaleString()} đ | CB: ${totalCB.toLocaleString()} đ`);

      dv.table(
        ["ID", "Ngày", "Loại", "Số tiền", "% CB", "CB Cố định", "Σ CB", "Final Price", "Ghi chú"],
        monthArr.map(t => {
          const d = new Date(t.occurred_at);
          const shortId = t.id ? t.id.substring(0, 5) : '-';
          const amt = Number(t.amount);
          const cbPct = Number(t.cashback_share_percent || 0);
          const cbFixed = Number(t.cashback_share_fixed || 0);
          const cbSum = cbPct > 0 ? Math.round(amt * cbPct) : cbFixed;
          const fee = Number(t.metadata?.service_fee || 0);
          const net = amt - cbSum + fee;
          const sign = ['income','repayment','refund','transfer_in'].includes(t.type) ? '🟢 +' : '🔴 -';
          return [
            `\`${shortId}\``,
            d.toLocaleDateString('vi-VN'),
            `${sign}${t.type}`,
            `**${amt.toLocaleString()} đ**`,
            cbPct > 0 ? `${(cbPct * 100).toFixed(1)}%` : '-',
            cbFixed > 0 ? `${cbFixed.toLocaleString()} đ` : '-',
            cbSum > 0 ? `${cbSum.toLocaleString()} đ` : '-',
            `**${net.toLocaleString()} đ**`,
            t.note || "-"
          ];
        })
      );
    }
  }
}
```
