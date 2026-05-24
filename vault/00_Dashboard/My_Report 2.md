# 👤 Báo cáo Tài chính Cá nhân (My Personal Report)

> Báo cáo phân tích chuyên sâu dành riêng cho bạn. Tự động tách biệt thu chi thực tế của cá nhân (Internal Cashflow) khỏi các giao dịch nợ nần đối ngoại và chuyển khoản nội bộ.

[👈 Trở về Dashboard](Dashboard.md) | [💸 Phân tích Thu Chi](Cashflow_Analytics.md) | [🤝 Trung tâm Công nợ](Debt_Center.md)

---

<style>
  .report-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 15px;
    margin-bottom: 20px;
  }
  .card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    text-align: center;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0,0,0,0.15);
  }
  .card-title {
    font-size: 0.9em;
    color: #a0a0a0;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .card-value {
    font-size: 1.6em;
    font-weight: bold;
    margin-bottom: 5px;
  }
  .card-subtext {
    font-size: 0.8em;
    color: #707070;
  }
  .income-card { border-left: 5px solid #2ec866; }
  .expense-card { border-left: 5px solid #f25f5c; }
  .savings-card { border-left: 5px solid #4895ef; }
  .rate-card { border-left: 5px solid #f7b2bd; }
</style>

## 📊 Chỉ số Tài chính Tháng này (Thực tế)

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

try {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  
  const [txnRes, peopleRes, accRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/transactions?occurred_at=gte.${firstDay}&order=occurred_at.desc`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/people?select=id,name`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/accounts?select=id,name`, { headers })
  ]);
  
  if (txnRes.ok && peopleRes.ok && accRes.ok) {
    const txns = await txnRes.json();
    const people = await peopleRes.json();
    const accounts = await accRes.json();
    const peopleMap = Object.fromEntries(people.map(p => [p.id, p.name]));
    const accMap = Object.fromEntries(accounts.map(a => [a.id, a.name]));

    let realIncome = 0;
    let realExpense = 0;

    txns.forEach(t => {
      // LOẠI BỎ: nợ nần (có person_id) hoặc các kiểu nợ/trả nợ/chuyển khoản
      const isDebtRelated = t.person_id !== null || ['debt', 'repayment'].includes(t.type);
      const isTransfer = ['transfer_in', 'transfer_out'].includes(t.type);
      
      if (!isDebtRelated && !isTransfer) {
        const amt = Number(t.amount);
        const cbPct = Number(t.cashback_share_percent || 0);
        const cbFixed = Number(t.cashback_share_fixed || 0);
        const cbSum = cbPct > 0 ? Math.round(amt * cbPct) : cbFixed;
        const fee = Number(t.metadata?.service_fee || 0);
        
        if (t.type === 'income' || t.type === 'cashback' || t.type === 'refund') {
          realIncome += amt;
        } else if (t.type === 'expense' || t.type === 'service') {
          realExpense += (amt - cbSum + fee); // Net expense
        }
      }
    });

    const netSavings = realIncome - realExpense;
    const savingsRate = realIncome > 0 ? Math.round((netSavings / realIncome) * 100) : 0;

    // Render HTML Cards
    dv.paragraph(`
      <div class="report-container">
        <div class="card income-card">
          <div class="card-title">🟢 Thực Thu Cá Nhân</div>
          <div class="card-value">${realIncome.toLocaleString()} đ</div>
          <div class="card-subtext">Thu nhập thực tế trong tháng</div>
        </div>
        <div class="card expense-card">
          <div class="card-title">🔴 Thực Chi Cá Nhân</div>
          <div class="card-value">${realExpense.toLocaleString()} đ</div>
          <div class="card-subtext">Đã khấu trừ hoàn tiền & phí</div>
        </div>
        <div class="card savings-card">
          <div class="card-title">🔵 Tích Lũy Ròng</div>
          <div class="card-value">${netSavings >= 0 ? '+' : ''}${netSavings.toLocaleString()} đ</div>
          <div class="card-subtext">Dòng tiền ròng thực tế dư ra</div>
        </div>
        <div class="card rate-card">
          <div class="card-title">🎯 Tỷ Lệ Tiết Kiệm</div>
          <div class="card-value">${savingsRate}%</div>
          <div class="card-subtext">Phần trăm thu nhập tích lũy</div>
        </div>
      </div>
    `);
  }
} catch (err) {
  dv.paragraph("❌ Lỗi tải chỉ số tài chính: " + err.message);
}
```

---

## 🥗 1. Thu Chi Cá Nhân Thực Tế (Internal Cashflow)
> Chỉ bao gồm các khoản ăn uống, mua sắm, lương lậu, chi phí phát sinh cá nhân của riêng bạn (loại trừ hoàn toàn nợ nần và chuyển khoản ví/thẻ).

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

try {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  
  const [txnRes, accRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/transactions?occurred_at=gte.${firstDay}&order=occurred_at.desc`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/accounts?select=id,name`, { headers })
  ]);

  if (txnRes.ok && accRes.ok) {
    const txns = await txnRes.json();
    const accounts = await accRes.json();
    const accMap = Object.fromEntries(accounts.map(a => [a.id, a.name]));

    const internalTxns = txns.filter(t => {
      const isDebtRelated = t.person_id !== null || ['debt', 'repayment'].includes(t.type);
      const isTransfer = ['transfer_in', 'transfer_out'].includes(t.type);
      return !isDebtRelated && !isTransfer;
    });

    if (internalTxns.length === 0) {
      dv.paragraph("Không có giao dịch cá nhân thực tế nào trong tháng này.");
    } else {
      dv.table(
        ["ID", "Loại", "Ngày", "Tài khoản", "Số tiền", "% CB", "Final Price", "Ghi chú", "Danh mục"],
        internalTxns.map(t => {
          const d = new Date(t.occurred_at);
          const shortId = t.id ? t.id.substring(0, 5) : '-';
          const amt = Number(t.amount);
          const cbPct = Number(t.cashback_share_percent || 0);
          const cbFixed = Number(t.cashback_share_fixed || 0);
          const cbSum = cbPct > 0 ? Math.round(amt * cbPct) : cbFixed;
          const fee = Number(t.metadata?.service_fee || 0);
          const net = amt - cbSum + fee;
          const isIn = ['income','cashback','refund'].includes(t.type);
          const typeLabel = isIn ? '<span style="color:#2ec866;font-weight:bold;">🟢 In</span>' : '<span style="color:#f25f5c;font-weight:bold;">🔴 Out</span>';
          const accLink = accMap[t.account_id] ? `[[${accMap[t.account_id]}]]` : '-';

          return [
            `\`${shortId}\``,
            typeLabel,
            d.toLocaleDateString('vi-VN'),
            accLink,
            `**${amt.toLocaleString()} đ**`,
            cbPct > 0 ? `${(cbPct * 100).toFixed(1)}%` : '-',
            `**${net.toLocaleString()} đ**`,
            t.note || "-",
            t.metadata?.category_name || "Khác"
          ];
        })
      );
    }
  }
} catch (err) {
  dv.paragraph("❌ Lỗi: " + err.message);
}
```

---

## 🤝 2. Giao dịch Quan hệ Nợ nần & Chuyển tiền (External Debt & Transfers)
> Bao gồm tất cả các giao dịch cho vay, trả nợ, vay mượn và các giao dịch chuyển tiền nội bộ giữa các tài khoản của bạn.

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

try {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  
  const [txnRes, peopleRes, accRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/transactions?occurred_at=gte.${firstDay}&order=occurred_at.desc`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/people?select=id,name`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/accounts?select=id,name`, { headers })
  ]);

  if (txnRes.ok && peopleRes.ok && accRes.ok) {
    const txns = await txnRes.json();
    const people = await peopleRes.json();
    const accounts = await accRes.json();
    
    const peopleMap = Object.fromEntries(people.map(p => [p.id, p.name]));
    const accMap = Object.fromEntries(accounts.map(a => [a.id, a.name]));

    const externalTxns = txns.filter(t => {
      const isDebtRelated = t.person_id !== null || ['debt', 'repayment'].includes(t.type);
      const isTransfer = ['transfer_in', 'transfer_out'].includes(t.type);
      return isDebtRelated || isTransfer;
    });

    if (externalTxns.length === 0) {
      dv.paragraph("Không có giao dịch nợ nần hay chuyển khoản nào trong tháng này.");
    } else {
      dv.table(
        ["ID", "Phân loại", "Ngày", "Đối tác/Ví", "Tài khoản", "Số tiền", "Ghi chú"],
        externalTxns.map(t => {
          const d = new Date(t.occurred_at);
          const shortId = t.id ? t.id.substring(0, 5) : '-';
          const amt = Number(t.amount);
          
          let subType = "Chuyển tiền";
          let labelColor = "#4895ef";
          if (t.type === 'debt') { subType = "Cho vay"; labelColor = "#f25f5c"; }
          else if (t.type === 'repayment') { subType = "Trả nợ / Thu hồi"; labelColor = "#2ec866"; }
          else if (t.type === 'transfer_in') { subType = "Chuyển nhận"; labelColor = "#4895ef"; }
          else if (t.type === 'transfer_out') { subType = "Chuyển gửi"; labelColor = "#f72585"; }
          
          const typeLabel = `<span style="color:${labelColor};font-weight:bold;">${subType}</span>`;
          const partnerLink = peopleMap[t.person_id] ? `[[${peopleMap[t.person_id]}]]` : '-';
          const accLink = accMap[t.account_id] ? `[[${accMap[t.account_id]}]]` : '-';

          return [
            `\`${shortId}\``,
            typeLabel,
            d.toLocaleDateString('vi-VN'),
            partnerLink,
            accLink,
            `**${amt.toLocaleString()} đ**`,
            t.note || "-"
          ];
        })
      );
    }
  }
} catch (err) {
  dv.paragraph("❌ Lỗi: " + err.message);
}
```
