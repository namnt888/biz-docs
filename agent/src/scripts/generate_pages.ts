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
  fetch(\`\${SUPABASE_URL}/rest/v1/transactions?account_id=eq.\${accId}&status=eq.posted\`, { headers })
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
const res = await fetch(\`\${SUPABASE_URL}/rest/v1/transactions?account_id=eq.\${accId}&order=occurred_at.desc&limit=20&select=*,people(name)\`, { headers });

if (res.ok) {
  const txns = await res.json();
  dv.table(["ID", "Tháng", "Ngày", "Người", "Loại", "Số tiền", "% CB", "CB Cố định", "Σ CB", "Final Price", "Ghi chú"], txns.map(t => {
    const isPlus = ['income', 'repayment', 'refund', 'transfer_in'].includes(t.type);
    const sign = isPlus ? "🟢 +" : "🔴 -";
    const d = new Date(t.occurred_at);
    const mStr = \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}\`;
    const shortId = t.id ? t.id.substring(0, 5) : '-';
    const personLink = t.people && t.people.name ? \`[[\${t.people.name}]]\` : '-';
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
      personLink,
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
// PEOPLE PAGE TEMPLATE
// ──────────────────────────────────────────────
function peoplePage(p: { id: string; name: string }) {
  return `---
type: person
id: ${p.id}
---
# 👤 ${p.name}

[👈 Trở về Debt Center](../00_Dashboard/Debt_Center.md)

## 🤝 Tổng quan Công nợ (Theo Kỳ)

\`\`\`dataviewjs
const SUPABASE_URL = "${SUPABASE_URL}";
const SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY}";
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': \`Bearer \${SUPABASE_ANON_KEY}\` };

const personId = dv.current().id;
const res = await fetch(\`\${SUPABASE_URL}/rest/v1/debts?person_id=eq.\${personId}&order=occurred_at.desc\`, { headers });

if (res.ok) {
  const debts = await res.json();
  if (debts.length > 0) {
    // Summary row
    const totalOrig = debts.reduce((s, d) => s + Number(d.original_amount), 0);
    const totalRepaid = debts.reduce((s, d) => s + Number(d.repaid_amount), 0);
    const totalRemain = debts.reduce((s, d) => s + Number(d.remaining_amount), 0);
    dv.paragraph(\`📊 **Tổng nợ:** \${totalOrig.toLocaleString()} đ &nbsp;|&nbsp; **Đã trả:** \${totalRepaid.toLocaleString()} đ &nbsp;|&nbsp; **Còn lại:** \${totalRemain.toLocaleString()} đ\`);

    // Group by cycle tag to prevent duplicate individual rows
    const byCycle = {};
    debts.forEach(d => {
      const dt = new Date(d.occurred_at);
      const mStr = \`\${dt.getFullYear()}-\${String(dt.getMonth() + 1).padStart(2, '0')}\`;
      const cycle = mStr; // use month string as cycle identifier
      if (!byCycle[cycle]) {
        byCycle[cycle] = {
          cycle: cycle,
          mLink: \`[[\${mStr}]]\`,
          roleStr: d.debt_role === 'lent' ? "🟢 Cho vay" : "🔴 Đi mượn",
          orig: 0,
          repaid: 0,
          remain: 0,
          status: "⚪ Settled",
          count: 0
        };
      }
      byCycle[cycle].orig += Number(d.original_amount);
      byCycle[cycle].repaid += Number(d.repaid_amount);
      byCycle[cycle].remain += Number(d.remaining_amount);
      byCycle[cycle].count += 1;
      if (d.status === 'pending' || d.status === 'partial') {
        byCycle[cycle].status = d.status === 'pending' ? "🔴 Pending" : "🟠 Partial";
      }
    });

    dv.table(["Kỳ (Cycle)", "Link Tháng", "Loại", "Số mục", "Tổng nợ", "Đã trả", "Còn lại", "Trạng thái"], Object.values(byCycle).map(c => {
      const item = c;
      return [
        \`**\${item.cycle}**\`,
        item.mLink,
        item.roleStr,
        \`\${item.count} khoản\`,
        \`\${item.orig.toLocaleString()} đ\`,
        \`\${item.repaid.toLocaleString()} đ\`,
        \`**\${item.remain.toLocaleString()} đ**\`,
        item.status
      ];
    }));
  } else {
    dv.paragraph("Không có công nợ nào với người này. ✅");
  }
}
\`\`\`

## 📜 Giao dịch liên quan (Phân cấp Năm > Tháng)

> [!tip] Mẹo: Bấm mũi tên lề trái cạnh các dòng tiêu đề (Năm / Tháng) để thu gọn (Collapse) hoặc mở rộng (Expand)!

\`\`\`dataviewjs
const SUPABASE_URL = "${SUPABASE_URL}";
const SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY}";
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': \`Bearer \${SUPABASE_ANON_KEY}\` };

const personId = dv.current().id;
const res = await fetch(\`\${SUPABASE_URL}/rest/v1/transactions?person_id=eq.\${personId}&order=occurred_at.desc&select=*,accounts!transactions_account_id_fkey(name)\`, { headers });

if (res.ok) {
  const txns = await res.json();
  if (txns.length === 0) {
    dv.paragraph("Không có giao dịch.");
  } else {
    // Group by Year then by Month
    const byYear = {};
    txns.forEach(t => {
      const d = new Date(t.occurred_at);
      const yStr = String(d.getFullYear());
      const mStr = \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}\`;
      if (!byYear[yStr]) byYear[yStr] = {};
      if (!byYear[yStr][mStr]) byYear[yStr][mStr] = [];
      byYear[yStr][mStr].push(t);
    });

    for (const [year, monthMap] of Object.entries(byYear)) {
      dv.header(2, \`🗓️ Năm \${year}\`);
      
      for (const [month, monthTxns] of Object.entries(monthMap)) {
        const monthArr = monthTxns;
        const totalAmt = monthArr.reduce((s, t) => s + Number(t.amount), 0);
        const totalCB = monthArr.reduce((t2, t) => {
          const amt = Number(t.amount);
          const cb = t.cashback_share_percent ? Math.round(amt * t.cashback_share_percent) : Number(t.cashback_share_fixed || 0);
          return t2 + cb;
        }, 0);

        dv.header(3, \`📅 [[\${month}]] — \${monthArr.length} giao dịch | Tổng: \${totalAmt.toLocaleString()} đ | CB: \${totalCB.toLocaleString()} đ\`);

        dv.table(
          ["ID", "Ngày", "Tài khoản", "Loại", "Số tiền", "% CB", "CB Cố định", "Σ CB", "Final Price", "Ghi chú"],
          monthArr.map(t => {
            const d = new Date(t.occurred_at);
            const shortId = t.id ? t.id.substring(0, 5) : '-';
            const accLink = t.accounts && t.accounts.name ? \`[[\${t.accounts.name}]]\` : '-';
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
              accLink,
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
      console.log(`Created/Updated ${filePath}`);
    }
  }

  if (pplRes.ok) {
    const pplData = await pplRes.json();
    for (const p of pplData) {
      const safeName = p.name.replace(/\//g, '-');
      const filePath = path.join(peopleDir, `${safeName}.md`);
      fs.writeFileSync(filePath, peoplePage(p), 'utf8');
      console.log(`Created/Updated ${filePath}`);
    }
  }

  console.log("Done generating Obsidian Ecosystem Pages!");
}

generate().catch(console.error);
