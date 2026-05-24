---
type: person
id: 67f1f69a-826c-4348-99b7-fafab0eba37a
---
# 👤 Lâm

[👈 Trở về Debt Center](../00_Dashboard/Debt_Center.md)

## 📂 Giao dịch theo Năm

- [[Lâm/2026|📅 2026]]
- [[Lâm/2025|📅 2025]]
- [[Lâm/2024|📅 2024]]

---

## ⚡ Đồng bộ Giao dịch (GSheet Sync)

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

const container = dv.el("div", "");
container.style.padding = "15px";
container.style.border = "1px solid var(--border-color, #cbd5e1)";
container.style.borderRadius = "8px";
container.style.backgroundColor = "var(--background-secondary, #f8fafc)";
container.style.marginBottom = "20px";

const statusText = dv.el("p", "🔄 Đang kiểm tra trạng thái...", { container });
statusText.style.fontWeight = "bold";

const btnSync = dv.el("button", "🚀 Đồng bộ Giao dịch Chưa Sync", { container });
btnSync.style.marginRight = "10px";
btnSync.style.padding = "6px 12px";
btnSync.style.borderRadius = "4px";
btnSync.style.cursor = "pointer";

const btnReset = dv.el("button", "⚠️ Reset trạng thái Sync", { container });
btnReset.style.padding = "6px 12px";
btnReset.style.borderRadius = "4px";
btnReset.style.cursor = "pointer";
btnReset.style.backgroundColor = "rgba(230,57,70,0.1)";
btnReset.style.color = "#e63946";
btnReset.style.border = "1px solid #e63946";

async function checkStatus() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/transactions?person_id=eq.${personId}&synced_at=is.null&t=${Date.now()}`, { headers });
  if (res.ok) {
    const data = await res.json();
    statusText.innerText = `📊 Trạng thái: Có ${data.length} giao dịch chưa đồng bộ lên Google Sheet.`;
    btnSync.disabled = data.length === 0;
    btnSync.style.opacity = data.length === 0 ? "0.5" : "1";
  } else {
    statusText.innerText = "❌ Không thể kết nối Supabase.";
  }
}

btnSync.onclick = async () => {
  btnSync.disabled = true;
  statusText.innerText = "⏳ Đang gửi yêu cầu đồng bộ...";
  
  const res = await fetch(`${SUPABASE_URL}/rest/v1/transactions?person_id=eq.${personId}&synced_at=is.null&select=*,people(sheet_id,name)&t=${Date.now()}`, { headers });
  if (!res.ok) {
    statusText.innerText = "❌ Lỗi khi tải danh sách giao dịch.";
    btnSync.disabled = false;
    return;
  }
  
  const txns = await res.json();
  if (txns.length === 0) {
    statusText.innerText = "✅ Không có giao dịch nào cần đồng bộ.";
    return;
  }
  
  let count = 0;
  for (const t of txns) {
    const payload = {
      table: "transactions",
      record: {
        id: t.id,
        occurred_at: t.occurred_at,
        type: t.type,
        type_display: t.type === 'expense' ? 'Out' : 'In',
        amount: t.amount,
        cashback_share_percent: t.cashback_share_percent ? Number(t.cashback_share_percent) : null,
        cashback_share_fixed: t.cashback_share_fixed ? Number(t.cashback_share_fixed) : null,
        note: t.note,
        metadata: {
          ...t.metadata,
          person_name: t.people?.name,
          sheet_id: t.people?.sheet_id
        }
      }
    };
    
    try {
      const syncRes = await fetch("http://localhost:5678/webhook/JIfwZP5txIaEsyvZ/webhook/supabase-multi-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (syncRes.ok) {
        count++;
        await fetch(`${SUPABASE_URL}/rest/v1/transactions?id=eq.${t.id}&t=${Date.now()}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ synced_at: new Date().toISOString() })
        });
      }
    } catch (e) {
      console.error(e);
    }
  }
  
  statusText.innerText = `✅ Đã đồng bộ thành công ${count}/${txns.length} giao dịch!`;
  await checkStatus();
};

btnReset.onclick = async () => {
  if (!confirm("Bạn có chắc chắn muốn đặt lại trạng thái đồng bộ? Tất cả giao dịch sẽ được chuyển thành 'Chưa Sync' để có thể đồng bộ lại.")) {
    return;
  }
  
  statusText.innerText = "⏳ Đang reset...";
  const res = await fetch(`${SUPABASE_URL}/rest/v1/transactions?person_id=eq.${personId}&t=${Date.now()}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ synced_at: null })
  });
  
  if (res.ok) {
    statusText.innerText = "✅ Đã reset trạng thái đồng bộ thành công!";
    await checkStatus();
  } else {
    statusText.innerText = "❌ Không thể reset trạng thái.";
  }
};

checkStatus();
```

---

## 🤝 Tổng quan Công nợ

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

const personId = dv.current().id;
const res = await fetch(`${SUPABASE_URL}/rest/v1/debts?person_id=eq.${personId}&order=occurred_at.desc&t=${Date.now()}`, { headers });

if (res.ok) {
  const rawDebts = await res.json();
  // Dedup by ID to prevent duplicate display
  const seen = new Set();
  const debts = rawDebts.filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; });

  if (debts.length > 0) {
    const totalOrig = debts.reduce((s, d) => s + Number(d.original_amount), 0);
    const totalRepaid = debts.reduce((s, d) => s + Number(d.repaid_amount), 0);
    const totalRemain = debts.reduce((s, d) => s + Number(d.remaining_amount), 0);
    dv.paragraph(`📊 **Tổng nợ:** ${totalOrig.toLocaleString()} đ &nbsp;|&nbsp; **Đã trả:** ${totalRepaid.toLocaleString()} đ &nbsp;|&nbsp; **Còn lại:** ${totalRemain.toLocaleString()} đ`);

    dv.table(["Loại", "Kỳ (Cycle)", "Ghi chú", "Tổng nợ", "Đã trả", "Còn lại", "Trạng thái"], debts.map(d => {
      const roleStr = d.debt_role === 'lent' ? '<span style="color:#f25f5c;font-weight:bold;">🔴 Out</span>' : '<span style="color:#2ec866;font-weight:bold;">🟢 In</span>';
      let statusStr = "⚪ Settled";
      if (d.status === 'pending') statusStr = "🔴 Pending";
      if (d.status === 'partial') statusStr = "🟠 Partial";
      const dt = new Date(d.occurred_at);
      const mStr = `${dt.getFullYear()}-\ ${String(dt.getMonth() + 1).padStart(2, '0')}`.replace('- ', '-');
      return [roleStr, `[[01_Monthly_Logs/${mStr}|${mStr}]]`, d.notes || "-",
        `${Number(d.original_amount).toLocaleString()} đ`,
        `${Number(d.repaid_amount).toLocaleString()} đ`,
        `**${Number(d.remaining_amount).toLocaleString()} đ**`,
        statusStr];
    }));
  } else {
    dv.paragraph("Không có công nợ nào với người này. ✅");
  }
}
```
