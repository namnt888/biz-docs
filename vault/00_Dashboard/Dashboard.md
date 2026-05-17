# 📊 Obsidian Money Dashboard

> Hệ thống quản lý tài chính cá nhân tự động hóa. Dữ liệu được đồng bộ realtime từ Supabase.

---

## 💳 Tổng quan Tài sản & Tài khoản

```dataviewjs
try {
  const configText = await dv.io.load("99_System/config.json");
  const config = JSON.parse(configText);
  const url = config.SUPABASE_URL + "/rest/v1/accounts?select=id,name,type,current_balance,currency&order=name.asc";
  
  const res = await fetch(url, {
    headers: { 'apikey': config.SUPABASE_ANON_KEY, 'Authorization': `Bearer ${config.SUPABASE_ANON_KEY}` }
  });
  
  if (res.ok) {
    const accounts = await res.json();
    const total = accounts.reduce((acc, a) => acc + Number(a.current_balance), 0);
    
    dv.header(3, `💰 Tổng tài sản: ${total.toLocaleString()} VND`);
    dv.table(["Tài khoản", "Loại", "Số dư hiện tại"], accounts.map(a => [
      `**${a.name}**`,
      a.type.toUpperCase(),
      `${Number(a.current_balance).toLocaleString()} ${a.currency}`
    ]));
  } else {
    dv.paragraph("⚠️ Không thể tải dữ liệu tài khoản từ Supabase. (HTTP " + res.status + ")");
  }
} catch (err) {
  dv.paragraph("❌ Lỗi kết nối Supabase: " + err.message);
}
```

---

## 🤝 Quản lý Nợ & Cho Vay (Debts)

```dataviewjs
try {
  const configText = await dv.io.load("99_System/config.json");
  const config = JSON.parse(configText);
  const headers = { 'apikey': config.SUPABASE_ANON_KEY, 'Authorization': `Bearer ${config.SUPABASE_ANON_KEY}` };
  
  const [debtsRes, peopleRes] = await Promise.all([
    fetch(config.SUPABASE_URL + "/rest/v1/debts?select=*&status=in.(pending,partial)&order=occurred_at.asc", { headers }),
    fetch(config.SUPABASE_URL + "/rest/v1/people?select=id,name", { headers })
  ]);
  
  if (debtsRes.ok && peopleRes.ok) {
    const debts = await debtsRes.json();
    const people = await peopleRes.json();
    const peopleMap = Object.fromEntries(people.map(p => [p.id, p.name]));
    
    if (debts.length === 0) {
      dv.paragraph("🎉 Tuyệt vời! Bạn không có khoản nợ nào cần xử lý.");
    } else {
      dv.table(["Người liên quan", "Phân loại", "Ghi chú", "Tổng nợ", "Đã trả", "Còn lại", "Tiến độ"], debts.map(d => {
        const personName = peopleMap[d.person_id] || "Unknown";
        const role = d.debt_role === "lent" ? "🟢 Cho vay (Lent)" : "🔴 Đi mượn (Borrowed)";
        const orig = Number(d.original_amount);
        const repaid = Number(d.repaid_amount);
        const remain = Number(d.remaining_amount);
        
        const percent = Math.min(100, Math.round((repaid / orig) * 100));
        const barLength = 10;
        const filled = Math.round((percent / 100) * barLength);
        const bar = "▓".repeat(filled) + "░".repeat(barLength - filled);
        
        return [
          `**${personName}**`, role, d.notes || "-",
          `${orig.toLocaleString()} VND`, `${repaid.toLocaleString()} VND`,
          `**${remain.toLocaleString()} VND**`, `${bar} (${percent}%)`
        ];
      }));
    }
  } else {
    dv.paragraph("⚠️ Lỗi tải dữ liệu nợ từ Supabase.");
  }
} catch (err) {
  dv.paragraph("❌ Lỗi kết nối: " + err.message);
}
```

---

## 🎁 Hoàn tiền Thẻ (Cashback Cycles)

```dataviewjs
try {
  const configText = await dv.io.load("99_System/config.json");
  const config = JSON.parse(configText);
  const url = config.SUPABASE_URL + "/rest/v1/cashback_cycles?select=*&status=eq.active&order=cycle_tag.desc";
  
  const res = await fetch(url, {
    headers: { 'apikey': config.SUPABASE_ANON_KEY, 'Authorization': `Bearer ${config.SUPABASE_ANON_KEY}` }
  });
  
  if (res.ok) {
    const cycles = await res.json();
    if (cycles.length === 0) {
      dv.paragraph("ℹ️ Chưa có chu kỳ hoàn tiền nào đang hoạt động.");
    } else {
      dv.table(["Chu kỳ (Cycle)", "Loại", "Tổng chi tiêu", "Hoàn tiền dự kiến", "Đã nhận thực tế", "Ngân sách tối đa"], cycles.map(c => [
        `**${c.cycle_tag}**`, c.cycle_type,
        `${Number(c.spent_amount).toLocaleString()} VND`,
        `**${Number(c.virtual_profit).toLocaleString()} VND**`,
        `${Number(c.real_awarded).toLocaleString()} VND`,
        `${Number(c.cb_max_budget || 0).toLocaleString()} VND`
      ]));
    }
  } else {
    dv.paragraph("⚠️ Lỗi tải dữ liệu hoàn tiền từ Supabase.");
  }
} catch (err) {
  dv.paragraph("❌ Lỗi kết nối: " + err.message);
}
```
