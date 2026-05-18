import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
};

const vaultPath = path.resolve(__dirname, '../../../vault');
const accountsDir = path.join(vaultPath, '02_Accounts');
const peopleDir = path.join(vaultPath, '03_People');

if (!fs.existsSync(accountsDir)) fs.mkdirSync(accountsDir, { recursive: true });
if (!fs.existsSync(peopleDir)) fs.mkdirSync(peopleDir, { recursive: true });

// ──────────────────────────────────────────────
// ACCOUNT PAGE TEMPLATE
// ──────────────────────────────────────────────
function accountPage(acc: { id: string; name: string }) {
  return `---
type: account
id: ${acc.id}
---
# 💳 ${acc.name}

[👈 Trở về Dashboard](../00_Dashboard/Dashboard.md)

## 📊 Thống kê Tài khoản

\`\`\`dataviewjs
const SUPABASE_URL = "${SUPABASE_URL}";
const SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY}";
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': \`Bearer \${SUPABASE_ANON_KEY}\` };

const accId = dv.current().id;

const [accRes, txnRes] = await Promise.all([
  fetch(\`\${SUPABASE_URL}/rest/v1/accounts?id=eq.\${accId}\`, { headers }),
  fetch(\`\${SUPABASE_URL}/rest/v1/transactions?account_id=eq.\${accId}\`, { headers })
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
    ["💰 Số dư hiện tại", \`**\${Number(balance).toLocaleString()} VND**\`],
    ["🟢 Tổng Thu (All time)", \`\${totalIn.toLocaleString()} VND\`],
    ["🔴 Tổng Chi (All time)", \`\${totalOut.toLocaleString()} VND\`],
    ["📈 Thu tháng này", \`\${monthIn.toLocaleString()} VND\`],
    ["📉 Chi tháng này", \`\${monthOut.toLocaleString()} VND\`]
  ]);
} else {
  dv.paragraph("❌ Lỗi tải dữ liệu");
}
\`\`\`

## 🎁 Hoàn tiền (Cashback Cycles)

\`\`\`dataviewjs
const SUPABASE_URL = "${SUPABASE_URL}";
const SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY}";
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': \`Bearer \${SUPABASE_ANON_KEY}\` };

const accId = dv.current().id;
const res = await fetch(\`\${SUPABASE_URL}/rest/v1/cashback_cycles?account_id=eq.\${accId}&order=cycle_tag.desc\`, { headers });

if (res.ok) {
  const cycles = await res.json();
  if (cycles.length > 0) {
    dv.table(["Kỳ sao kê", "Đã chi tiêu", "CB Dự kiến", "CB Thực tế"], cycles.map(c => [
      \`**\${c.cycle_tag}**\`,
      \`\${Number(c.spent_amount).toLocaleString()} VND\`,
      \`\${Number(c.virtual_profit).toLocaleString()} VND\`,
      \`**\${Number(c.real_awarded).toLocaleString()} VND**\`
    ]));
  } else {
    dv.paragraph("Không có dữ liệu hoàn tiền.");
  }
}
\`\`\`

## 📜 Lịch sử Giao dịch (20 gần nhất)

\`\`\`dataviewjs
const SUPABASE_URL = "${SUPABASE_URL}";
const SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY}";
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': \`Bearer \${SUPABASE_ANON_KEY}\` };

const accId = dv.current().id;
const res = await fetch(\`\${SUPABASE_URL}/rest/v1/transactions?account_id=eq.\${accId}&order=occurred_at.desc&limit=20\`, { headers });

if (res.ok) {
  const txns = await res.json();
  dv.table(["ID", "Kỳ", "Ngày", "Loại", "Số tiền", "% CB", "CB Cố định", "Σ CB", "Final Price", "Ghi chú"], txns.map(t => {
    const isPlus = ['income', 'repayment', 'refund', 'transfer_in'].includes(t.type);
    const sign = isPlus ? "🟢 +" : "🔴 -";
    const d = new Date(t.occurred_at);
    const mStr = \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}\`;
    const shortId = t.id ? t.id.substring(0, 5) : '-';
    const amt = Number(t.amount);
    const cbPct = Number(t.cashback_share_percent || 0);
    const cbFixed = Number(t.cashback_share_fixed || 0);
    const cbSum = cbPct > 0 ? Math.round(amt * cbPct) : cbFixed;
    const fee = Number(t.metadata?.service_fee || 0);
    const net = amt - cbSum + fee;
    return [
      \`\\\`\${shortId}\\\`\`,
      \`[[\${mStr}]]\`,
      d.toLocaleDateString('vi-VN'),
      \`\${sign}\${t.type}\`,
      \`**\${amt.toLocaleString()} đ**\`,
      cbPct > 0 ? \`\${(cbPct * 100).toFixed(1)}%\` : '-',
      cbFixed > 0 ? \`\${cbFixed.toLocaleString()} đ\` : '-',
      cbSum > 0 ? \`\${cbSum.toLocaleString()} đ\` : '-',
      \`**\${net.toLocaleString()} đ**\`,
      t.note || "-"
    ];
  }));
}
\`\`\`
`;
}

// ──────────────────────────────────────────────
// PEOPLE INDEX PAGE (main page with debt + year links)
// ──────────────────────────────────────────────
function peopleIndexPage(p: { id: string; name: string }, years: number[]) {
  const yearLinks = years.map(y => `- [[${p.name}/${y}|📅 ${y}]]`).join('\n');
  return `---
type: person
id: ${p.id}
---
# 👤 ${p.name}

[👈 Trở về Debt Center](../00_Dashboard/Debt_Center.md)

## 📂 Giao dịch theo Năm

${yearLinks || '_Chưa có giao dịch nào._'}

---

## 🤝 Tổng quan Công nợ

\`\`\`dataviewjs
const SUPABASE_URL = "${SUPABASE_URL}";
const SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY}";
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': \`Bearer \${SUPABASE_ANON_KEY}\` };

const personId = dv.current().id;
const res = await fetch(\`\${SUPABASE_URL}/rest/v1/debts?person_id=eq.\${personId}&order=occurred_at.desc\`, { headers });

if (res.ok) {
  const rawDebts = await res.json();
  // Dedup by ID to prevent duplicate display
  const seen = new Set();
  const debts = rawDebts.filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; });

  if (debts.length > 0) {
    const totalOrig = debts.reduce((s, d) => s + Number(d.original_amount), 0);
    const totalRepaid = debts.reduce((s, d) => s + Number(d.repaid_amount), 0);
    const totalRemain = debts.reduce((s, d) => s + Number(d.remaining_amount), 0);
    dv.paragraph(\`📊 **Tổng nợ:** \${totalOrig.toLocaleString()} đ &nbsp;|&nbsp; **Đã trả:** \${totalRepaid.toLocaleString()} đ &nbsp;|&nbsp; **Còn lại:** \${totalRemain.toLocaleString()} đ\`);

    dv.table(["Kỳ (Cycle)", "Loại", "Ghi chú", "Tổng nợ", "Đã trả", "Còn lại", "Trạng thái"], debts.map(d => {
      const roleStr = d.debt_role === 'lent' ? "🟢 Cho vay" : "🔴 Đi mượn";
      let statusStr = "⚪ Settled";
      if (d.status === 'pending') statusStr = "🔴 Pending";
      if (d.status === 'partial') statusStr = "🟠 Partial";
      const dt = new Date(d.occurred_at);
      const mStr = \`\${dt.getFullYear()}-\${String(dt.getMonth() + 1).padStart(2, '0')}\`;
      return [mStr, roleStr, d.notes || "-",
        \`\${Number(d.original_amount).toLocaleString()} đ\`,
        \`\${Number(d.repaid_amount).toLocaleString()} đ\`,
        \`**\${Number(d.remaining_amount).toLocaleString()} đ**\`,
        statusStr];
    }));
  } else {
    dv.paragraph("Không có công nợ nào với người này. ✅");
  }
}
\`\`\`
`;
}

// ──────────────────────────────────────────────
// PEOPLE YEAR PAGE (one page per year with transactions)
// ──────────────────────────────────────────────
function peopleYearPage(p: { id: string; name: string }, year: number) {
  return `---
type: person_year
person_id: ${p.id}
person_name: ${p.name}
year: ${year}
---
# 👤 [[${p.name}]] — ${year}

[← Trở về trang chính](../${p.name}.md)

## 📜 Giao dịch ${year} (phân theo tháng)

\`\`\`dataviewjs
const SUPABASE_URL = "${SUPABASE_URL}";
const SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY}";
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': \`Bearer \${SUPABASE_ANON_KEY}\` };

const personId = dv.current().person_id;
const year = dv.current().year;
const startDate = \`\${year}-01-01T00:00:00Z\`;
const endDate = \`\${year}-12-31T23:59:59Z\`;

const res = await fetch(
  \`\${SUPABASE_URL}/rest/v1/transactions?person_id=eq.\${personId}&occurred_at=gte.\${startDate}&occurred_at=lte.\${endDate}&order=occurred_at.desc\`,
  { headers }
);

if (res.ok) {
  const txns = await res.json();
  if (txns.length === 0) {
    dv.paragraph("Không có giao dịch nào trong năm này.");
  } else {
    // Group by month
    const byMonth = {};
    txns.forEach(t => {
      const d = new Date(t.occurred_at);
      const mStr = \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}\`;
      if (!byMonth[mStr]) byMonth[mStr] = [];
      byMonth[mStr].push(t);
    });

    const months = Object.keys(byMonth).sort().reverse();
    for (const month of months) {
      const monthTxns = byMonth[month];
      const totalAmt = monthTxns.reduce((s, t) => s + Number(t.amount), 0);
      const totalCB = monthTxns.reduce((s, t) => {
        const amt = Number(t.amount);
        const cb = t.cashback_share_percent ? Math.round(amt * t.cashback_share_percent) : Number(t.cashback_share_fixed || 0);
        return s + cb;
      }, 0);
      const totalNet = totalAmt - totalCB;

      dv.header(3, \`📅 [[\${month}]] — \${monthTxns.length} txn | 💰 \${totalAmt.toLocaleString()} đ | 🎁 CB: \${totalCB.toLocaleString()} đ | Net: \${totalNet.toLocaleString()} đ\`);

      dv.table(
        ["ID", "Ngày", "Loại", "Số tiền", "% CB", "CB Cố định", "Σ CB", "Final Price", "Ghi chú"],
        monthTxns.map(t => {
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
            \`\\\`\${shortId}\\\`\`,
            d.toLocaleDateString('vi-VN'),
            \`\${sign}\${t.type}\`,
            \`**\${amt.toLocaleString()} đ**\`,
            cbPct > 0 ? \`\${(cbPct * 100).toFixed(1)}%\` : '-',
            cbFixed > 0 ? \`\${cbFixed.toLocaleString()} đ\` : '-',
            cbSum > 0 ? \`\${cbSum.toLocaleString()} đ\` : '-',
            \`**\${net.toLocaleString()} đ**\`,
            t.note || "-"
          ];
        })
      );
    }
  }
}
\`\`\`
`;
}

async function generate() {
  console.log('Fetching Accounts and People from Supabase...');
  const [accRes, pplRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/accounts?select=id,name`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/people?select=id,name`, { headers })
  ]);

  if (accRes.ok) {
    const accData = await accRes.json();
    for (const acc of accData) {
      const safeName = acc.name.replace(/\//g, '-');
      const filePath = path.join(accountsDir, `${safeName}.md`);
      fs.writeFileSync(filePath, accountPage(acc), 'utf8');
      console.log(`✅ Account: ${safeName}.md`);
    }
  }

  if (pplRes.ok) {
    const pplData = await pplRes.json();
    for (const p of pplData) {
      const safeName = p.name.replace(/\//g, '-');
      
      // Fetch transactions to determine which years exist
      const txnRes = await fetch(
        `${SUPABASE_URL}/rest/v1/transactions?person_id=eq.${p.id}&select=occurred_at&order=occurred_at.desc`,
        { headers }
      );
      
      let years: number[] = [];
      if (txnRes.ok) {
        const txns = await txnRes.json();
        const yearSet = new Set<number>(txns.map((t: any) => new Date(t.occurred_at).getFullYear()));
        years = Array.from(yearSet).sort().reverse();
      }

      // Create People sub-folder for year pages
      const personDir = path.join(peopleDir, safeName);
      if (!fs.existsSync(personDir)) fs.mkdirSync(personDir, { recursive: true });

      // Write main index page
      const indexPath = path.join(peopleDir, `${safeName}.md`);
      fs.writeFileSync(indexPath, peopleIndexPage(p, years), 'utf8');
      console.log(`✅ People index: ${safeName}.md (${years.length} năm: ${years.join(', ')})`);

      // Write year pages
      for (const year of years) {
        const yearPath = path.join(personDir, `${year}.md`);
        fs.writeFileSync(yearPath, peopleYearPage(p, year), 'utf8');
        console.log(`   📅 Year page: ${safeName}/${year}.md`);
      }
    }
  }

  console.log("\n✅ Done generating Obsidian Ecosystem Pages!");
}

generate().catch(console.error);
