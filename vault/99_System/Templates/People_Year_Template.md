---
type: person_year
person_id: ""
person_name: "{{title}}"
year: {{date:YYYY}}
---
# 👤 [[{{title}}]] — {{date:YYYY}}

[← Trở về trang chính](../{{title}}.md)

## 📜 Giao dịch {{date:YYYY}} (phân theo tháng)

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

const personId = dv.current().person_id || dv.current().id;
const year = dv.current().year;
const startDate = `${year}-01-01T00:00:00Z`;
const endDate = `${year}-12-31T23:59:59Z`;

const accRes = await fetch(`${SUPABASE_URL}/rest/v1/accounts`, { headers });
const accounts = accRes.ok ? await accRes.json() : [];
const accMap = {};
accounts.forEach(a => accMap[a.id] = a.name);

const res = await fetch(
  `${SUPABASE_URL}/rest/v1/transactions?person_id=eq.${personId}&occurred_at=gte.${startDate}&occurred_at=lte.${endDate}&order=occurred_at.desc`,
  { headers }
);

if (!res.ok) {
  dv.paragraph("❌ Không thể tải giao dịch từ Supabase.");
} else {
  const txns = await res.json();
  if (txns.length === 0) {
    dv.paragraph("Không có giao dịch nào trong năm này.");
  } else {
    const byMonth = {};
    txns.forEach(t => {
      const d = new Date(t.occurred_at);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[mStr]) byMonth[mStr] = [];
      byMonth[mStr].push(t);
    });

    const formatAmount = value => Number(value || 0).toLocaleString('vi-VN');
    const statusStyles = {
      posted: { bg: 'rgba(46,200,102,0.15)', color: '#2ec866' },
      pending: { bg: 'rgba(244,208,63,0.12)', color: '#f4d03f' },
      void: { bg: 'rgba(120,120,120,0.08)', color: '#6b7280' }
    };

    const months = Object.keys(byMonth).sort().reverse();
    for (const month of months) {
      const monthTxns = byMonth[month];
      const expenses = monthTxns.filter(t => !['income','repayment','refund','transfer_in'].includes(t.type));
      const repayments = monthTxns.filter(t => ['income','repayment','refund','transfer_in'].includes(t.type));

      const totalOut = expenses.reduce((s, t) => s + Number(t.amount), 0);
      const totalIn = repayments.reduce((s, t) => s + Number(t.amount), 0);
      const totalCB = expenses.reduce((s, t) => {
        const amt = Number(t.amount);
        const cb = t.cashback_share_percent ? Math.round(amt * t.cashback_share_percent) : Number(t.cashback_share_fixed || 0);
        return s + cb;
      }, 0);
      const netExpense = totalOut - totalCB;
      const remains = netExpense - totalIn;

      dv.paragraph(`📅 [[01_Monthly_Logs/${month}|${month}]]`);

      const section = dv.el("div", "");
      section.style.margin = "18px 0 10px";
      section.style.padding = "12px 14px";
      section.style.borderRadius = "10px";
      section.style.borderLeft = `5px solid ${remains > 0 ? '#e63946' : '#2ec866'}`;
      section.style.background = "var(--background-secondary, rgba(255,255,255,0.03))";

      section.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-weight:700;line-height:1.4;">
          <span style="opacity:0.75;">${monthTxns.length} txn</span>
          <span style="padding:2px 8px;border-radius:999px;background:rgba(242,95,92,0.15);color:#f25f5c;">Out ${formatAmount(totalOut)}</span>
          <span style="padding:2px 8px;border-radius:999px;background:rgba(46,200,102,0.15);color:#2ec866;">CB ${formatAmount(totalCB)}</span>
          <span style="padding:2px 8px;border-radius:999px;background:rgba(233,196,106,0.15);color:#e9c46a;">Net ${formatAmount(netExpense)}</span>
          <span style="padding:2px 8px;border-radius:999px;background:rgba(69,123,157,0.15);color:#457b9d;">Repay ${formatAmount(totalIn)}</span>
          <span style="padding:2px 8px;border-radius:999px;background:${remains > 0 ? 'rgba(230,57,70,0.15)' : 'rgba(46,200,102,0.15)'};color:${remains > 0 ? '#e63946' : '#2ec866'};">Remain ${formatAmount(remains)}</span>
        </div>
      `;

      dv.table(
        ["ID", "Type", "Status", "Date", "Shop", "Notes", "Amount", "% Back", "đ Back", "Σ Back", "Final Price", "Flow", "Account"],
        monthTxns.map(t => {
          const amount = Number(t.amount);
          const cashbackPercent = Number(t.cashback_share_percent || 0);
          const cashbackFixed = Number(t.cashback_share_fixed || 0);
          const cashbackTotal = cashbackPercent > 0 ? Math.round(amount * cashbackPercent) : cashbackFixed;
          const fee = Number(t.metadata?.service_fee || 0);
          const finalPrice = amount - cashbackTotal + fee;
          const status = (t.status || 'posted').toLowerCase();
          const shopName = t.metadata?.shop_source || t.shop_source || '-';
          const accountName = accMap[t.account_id] || '-';
          const accountLink = accountName !== '-' ? `[[02_Accounts/${accountName}|${accountName}]]` : '-';
          const isIn = ['income','repayment','refund','transfer_in'].includes(t.type);
          const typeLabel = isIn ? '<span style="color:#2ec866;font-weight:700;">In</span>' : '<span style="color:#f25f5c;font-weight:700;">Out</span>';
          const flowIcon = isIn ? '🟢' : '🔴';
          const sc = statusStyles[status] || statusStyles.posted;
          const statusBadge = `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${sc.bg};color:${sc.color};font-weight:700;">${status}</span>`;
          const strikeStart = status === 'void' ? '<span style="text-decoration:line-through;opacity:0.6;">' : '';
          const strikeEnd = status === 'void' ? '</span>' : '';

          return [
            `\`${(t.id || '-').substring(0, 5)}\``,
            typeLabel,
            statusBadge,
            new Date(t.occurred_at).toLocaleDateString('vi-VN'),
            shopName,
            `${strikeStart}${t.note || "-"}${strikeEnd}`,
            `${strikeStart}**${formatAmount(amount)}**${strikeEnd}`,
            cashbackPercent > 0 ? `${(cashbackPercent * 100).toFixed(1)}%` : '-',
            cashbackFixed > 0 ? `${formatAmount(cashbackFixed)}` : '-',
            cashbackTotal > 0 ? `${formatAmount(cashbackTotal)}` : '-',
            `${strikeStart}**${formatAmount(finalPrice)}**${strikeEnd}`,
            flowIcon,
            accountLink
          ];
        })
      );

      setTimeout(() => {
        const tables = dv.container.querySelectorAll('table');
        const table = tables[tables.length - 1];
        if (!table) return;
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';
        table.querySelectorAll('th, td').forEach(cell => {
          cell.style.border = '1px solid var(--border-color, #d1d5db)';
          cell.style.padding = '7px 9px';
          cell.style.verticalAlign = 'middle';
        });
        table.querySelectorAll('th').forEach(th => {
          th.style.background = 'var(--background-secondary-alt, #2b6cb0)';
          th.style.color = 'var(--text-normal, #fff)';
          th.style.fontWeight = '700';
        });
      }, 50);
    }
  }
}
```
