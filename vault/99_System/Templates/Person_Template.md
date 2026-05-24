---
type: person
id: {{PERSON_UUID_FROM_SUPABASE_PEOPLE_TABLE}}
---
# 👤 {{PERSON_NAME}}

[👈 Trở về Debt Center](../00_Dashboard/Debt_Center.md)

> [!NOTE] **Hướng dẫn agent tạo người mới** — Xóa block này sau khi tạo xong
> 1. Thay `{{PERSON_NAME}}` bằng tên thật (vd: `Tuấn`)
> 2. Thay `id:` bằng UUID từ bảng `people` trong Supabase (INSERT nếu chưa có)
> 3. Tạo subfolder `vault/03_People/{{PERSON_NAME}}/` và copy `People_Year_Template.md` vào thành `{{YEAR}}.md`
> 4. Điền `person_id` vào frontmatter của file năm đó
> 5. Đảm bảo người này đã có `sheet_id` trong bảng `people` (link đến Google Sheet riêng)
> 6. Xóa block NOTE này trước khi lưu file chính thức

## 📂 Giao dịch theo Năm

- [[{{PERSON_NAME}}/2026|📅 2026]]
- [[{{PERSON_NAME}}/2025|📅 2025]]

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
  const res = await fetch(`${SUPABASE_URL}/rest/v1/transactions?person_id=eq.${personId}&synced_at=is.null`, { headers });
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
  
  const res = await fetch(`${SUPABASE_URL}/rest/v1/transactions?person_id=eq.${personId}&synced_at=is.null&select=*,people(sheet_id,name)`, { headers });
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
        await fetch(`${SUPABASE_URL}/rest/v1/transactions?id=eq.${t.id}`, {
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
  const res = await fetch(`${SUPABASE_URL}/rest/v1/transactions?person_id=eq.${personId}`, {
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

## 📋 Giao dịch gần đây (10 mới nhất)

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' };

const personId = dv.current().id;

const [txnRes, accRes] = await Promise.all([
  fetch(`${SUPABASE_URL}/rest/v1/transactions?person_id=eq.${personId}&order=occurred_at.desc&limit=10`, { headers }),
  fetch(`${SUPABASE_URL}/rest/v1/accounts`, { headers })
]);

if (!txnRes.ok) {
  dv.paragraph("❌ Không thể tải giao dịch.");
} else {
  const txns = await txnRes.json();
  const accounts = accRes.ok ? await accRes.json() : [];
  const accMap = {};
  accounts.forEach(a => accMap[a.id] = a.name);

  if (txns.length === 0) {
    dv.paragraph("Chưa có giao dịch nào.");
  } else {
    dv.table(
      ["Ngày", "Loại", "Tài khoản", "Ghi chú", "Số tiền", "Synced"],
      txns.map(t => {
        const d = new Date(t.occurred_at);
        const dateStr = `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
        const isIn = ['income','repayment','refund','transfer_in'].includes(t.type);
        const typeLabel = isIn
          ? '<span style="color:#2ec866;font-weight:bold;">🟢 In</span>'
          : '<span style="color:#f25f5c;font-weight:bold;">🔴 Out</span>';
        return [dateStr, typeLabel, accMap[t.account_id] || '-', t.note || '-', `**${Number(t.amount).toLocaleString()} đ**`, t.synced_at ? '✅' : '⏳'];
      })
    );
  }
}
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
const res = await fetch(`${SUPABASE_URL}/rest/v1/debts?person_id=eq.${personId}&order=occurred_at.desc`, { headers });

if (res.ok) {
  const rawDebts = await res.json();
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
      const mStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      return [roleStr, `[[01_Monthly_Logs/${mStr}|${mStr}]]`, d.notes || "-",
        `${Number(d.original_amount).toLocaleString()} đ`,
        `${Number(d.repaid_amount).toLocaleString()} đ`,
        `**${Number(d.remaining_amount).toLocaleString()} đ**`,
        statusStr];
    }));
  }
  // If no debts: render nothing (section header remains but no content clutter)
}
```
