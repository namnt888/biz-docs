---
type: monthly_log
month: "{{title}}"
---
# 📅 Ghi chép Chi tiêu Tháng {{title}}

> Ghi chép các khoản thu chi bằng văn bản tự nhiên dưới mục **Unsynced**. Bạn có thể chỉ định tài khoản, kỳ nợ hoặc phí (Vd: `- ăn trưa 55k Vpbank phí 2k`).
> **⚡ Bấm phím tắt Modal Form để nhập qua giao diện trực quan gốc của Obsidian.**

[👈 Xem Dashboard](../00_Dashboard/Dashboard.md)  |  [💸 Phân tích Thu Chi](../00_Dashboard/Cashflow_Analytics.md)

---

## 📥 Unsynced Transactions

> [!todo] Gõ hoặc paste các giao dịch chưa đồng bộ vào đây:

## ⚡ Recent Added (Vừa thêm gần đây)

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };

const [txnRes, peopleRes, accRes] = await Promise.all([
  fetch(`${SUPABASE_URL}/rest/v1/transactions?order=created_at.desc&limit=5`, { headers }),
  fetch(`${SUPABASE_URL}/rest/v1/people?select=id,name`, { headers }),
  fetch(`${SUPABASE_URL}/rest/v1/accounts?select=id,name`, { headers })
]);

if (txnRes.ok && peopleRes.ok && accRes.ok) {
  const txns = await txnRes.json();
  const people = await peopleRes.json();
  const accounts = await accRes.json();
  const peopleMap = Object.fromEntries(people.map(p => [p.id, p.name]));
  const accMap = Object.fromEntries(accounts.map(a => [a.id, a.name]));

  if (txns.length > 0) {
    dv.table(
      ["ID", "Ngày GD", "Thời gian Thêm", "Người", "Tài khoản", "Loại", "Số tiền", "% CB", "Final Price", "Ghi chú"],
      txns.map(t => {
        const d = new Date(t.occurred_at);
        const c = new Date(t.created_at);
        const shortId = t.id ? t.id.substring(0, 5) : '-';
        const amt = Number(t.amount);
        const cbPct = Number(t.cashback_share_percent || 0);
        const cbFixed = Number(t.cashback_share_fixed || 0);
        const cbSum = cbPct > 0 ? Math.round(amt * cbPct) : cbFixed;
        const fee = Number(t.metadata?.service_fee || 0);
        const net = amt - cbSum + fee;
        const isIn = ['income','repayment','refund','transfer_in'].includes(t.type);
        const typeLabel = isIn ? '<span style="color:#2ec866;font-weight:bold;">🟢 In</span>' : '<span style="color:#f25f5c;font-weight:bold;">🔴 Out</span>';
        const pLink = peopleMap[t.person_id] ? `[[${peopleMap[t.person_id]}]]` : '-';
        const accLink = accMap[t.account_id] ? `[[${accMap[t.account_id]}]]` : '-';

        return [
          `\`${shortId}\``,
          d.toLocaleDateString('vi-VN'),
          c.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          pLink,
          accLink,
          typeLabel,
          `**${amt.toLocaleString()} đ**`,
          cbPct > 0 ? `${(cbPct * 100).toFixed(1)}%` : '-',
          `**${net.toLocaleString()} đ**`,
          t.note || "-"
        ];
      })
    );
  } else {
    dv.paragraph("Chưa có giao dịch nào được thêm gần đây.");
  }
} else {
  dv.paragraph("❌ Lỗi tải dữ liệu gần đây từ Supabase.");
}
```

---

## 🔄 Synced Transactions

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };

const monthVal = dv.current().month;
let month = "";
if (monthVal) {
  if (typeof monthVal === 'string') {
    month = monthVal;
  } else if (monthVal.toFormat) {
    month = monthVal.toFormat("yyyy-MM");
  } else if (monthVal.toISOString) {
    month = monthVal.toISOString().substring(0, 7);
  } else {
    month = String(monthVal);
  }
}

if (!month) {
  dv.paragraph("❌ Thiếu hoặc sai định dạng thuộc tính `month` trong YAML frontmatter.");
} else {
  const year = parseInt(month.split('-')[0]);
  const m = parseInt(month.split('-')[1]);
  const lastDay = new Date(year, m, 0).getDate();
  const startDate = `${month}-01T00:00:00Z`;
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}T23:59:59Z`;

  const [txnRes, peopleRes, accRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/transactions?occurred_at=gte.${startDate}&occurred_at=lte.${endDate}&order=occurred_at.desc`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/people?select=id,name`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/accounts?select=id,name`, { headers })
  ]);

  if (txnRes.ok && peopleRes.ok && accRes.ok) {
    const txns = await txnRes.json();
    const people = await peopleRes.json();
    const accounts = await accRes.json();

    const peopleMap = Object.fromEntries(people.map(p => [p.id, p.name]));
    const accMap = Object.fromEntries(accounts.map(a => [a.id, a.name]));

    if (txns.length === 0) {
      dv.paragraph("Chưa có giao dịch nào được đồng bộ trong tháng này.");
    } else {
      let totalIn = 0, totalOut = 0, totalCB = 0;
      txns.forEach(t => {
        const amt = Number(t.amount);
        const cbPct = Number(t.cashback_share_percent || 0);
        const cbFixed = Number(t.cashback_share_fixed || 0);
        const cbSum = cbPct > 0 ? Math.round(amt * cbPct) : cbFixed;
        
        const isPlus = ['income', 'repayment', 'refund', 'transfer_in'].includes(t.type);
        if (isPlus) {
          totalIn += amt;
        } else {
          totalOut += amt;
          totalCB += cbSum;
        }
      });
      
      dv.paragraph(`📊 **Tổng Thu:** ${totalIn.toLocaleString()} đ &nbsp;|&nbsp; **Tổng Chi:** ${totalOut.toLocaleString()} đ &nbsp;|&nbsp; **Tổng Hoàn tiền:** ${totalCB.toLocaleString()} đ`);

      dv.table(
        ["ID", "Ngày", "Người", "Tài khoản", "Loại", "Số tiền", "% CB", "CB Cố định", "Σ CB", "Final Price", "Ghi chú"],
        txns.map(t => {
          const d = new Date(t.occurred_at);
          const shortId = t.id ? t.id.substring(0, 5) : '-';
          const amt = Number(t.amount);
          const cbPct = Number(t.cashback_share_percent || 0);
          const cbFixed = Number(t.cashback_share_fixed || 0);
          const cbSum = cbPct > 0 ? Math.round(amt * cbPct) : cbFixed;
          const fee = Number(t.metadata?.service_fee || 0);
          const net = amt - cbSum + fee;
          const isIn = ['income','repayment','refund','transfer_in'].includes(t.type);
          const typeLabel = isIn ? '<span style="color:#2ec866;font-weight:bold;">🟢 In</span>' : '<span style="color:#f25f5c;font-weight:bold;">🔴 Out</span>';
          
          const pLink = peopleMap[t.person_id] ? `[[${peopleMap[t.person_id]}]]` : '-';
          const accLink = accMap[t.account_id] ? `[[${accMap[t.account_id]}]]` : '-';

          return [
            `\`${shortId}\``,
            d.toLocaleDateString('vi-VN'),
            pLink,
            accLink,
            typeLabel,
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
  } else {
    dv.paragraph("❌ Lỗi tải dữ liệu giao dịch từ Supabase.");
  }
}
```
