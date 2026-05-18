module.exports = async (params) => {
  const { app, quickAddApi } = params;
  
  const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

  new Notice("⏳ Đang kết nối Supabase tải dữ liệu...");
  
  // 1. Fetch Accounts and Categories
  const [accRes, catRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/accounts?select=id,name&status=eq.active`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/categories?select=id,name_vi`, { headers })
  ]);

  if (!accRes.ok) {
    new Notice("❌ Lỗi tải tài khoản từ Supabase: " + accRes.status);
    return;
  }

  const accounts = await accRes.json();
  const categories = catRes.ok ? await catRes.json() : [];

  const accOptions = accounts.map(a => `${a.name} [${a.id}]`);
  const catOptions = categories.map(c => `${c.name_vi} [${c.id}]`);

  // 2. Invoke Modal Form (or QuickAdd Suggester/Prompt as fallback)
  const modalFormApi = app.plugins.plugins['modal-form']?.api;
  
  let type = "expense";
  let accSelection = "";
  let amtStr = "0";
  let noteStr = "";
  let catSelection = "";
  let feeStr = "0";
  let debtCycleStr = "";

  if (modalFormApi && modalFormApi.openForm) {
    // Nếu có plugin Modal Form, mở form định nghĩa sẵn
    const formResult = await modalFormApi.openForm('add_transaction_form', {
      values: {
        account_list: accOptions,
        category_list: catOptions
      }
    });
    
    if (formResult.cancelled) return;
    
    type = formResult.getValue('type') || 'expense';
    accSelection = formResult.getValue('account') || accOptions[0];
    amtStr = formResult.getValue('amount') || '0';
    noteStr = formResult.getValue('note') || '';
    catSelection = formResult.getValue('category') || '';
    feeStr = formResult.getValue('fee') || '0';
    debtCycleStr = formResult.getValue('debt_cycle') || '';
  } else {
    // Nếu chưa cài Modal Form, dùng QuickAdd Suggester & Input gốc
    const typeSug = await quickAddApi.suggester(["🔴 Chi tiêu", "🟢 Thu nhập", "🤝 Cho mượn", "🤝 Thu nợ"], ["expense", "income", "debt", "repayment"]);
    if (!typeSug) return;
    type = typeSug;

    const accSug = await quickAddApi.suggester(accounts.map(a => a.name), accOptions);
    if (!accSug) return;
    accSelection = accSug;

    amtStr = await quickAddApi.inputPrompt("Số tiền (VND):", "Vd: 50000");
    if (!amtStr) return;

    noteStr = await quickAddApi.inputPrompt("Nội dung / Ghi chú:", "Vd: Mua đồ siêu thị");
    if (!noteStr) return;
  }

  const account_id = accSelection.split('[').pop().replace(']', '').trim();
  const category_id = catSelection ? catSelection.split('[').pop().replace(']', '').trim() : null;
  const amount = Number(amtStr) || 0;
  const service_fee = Number(feeStr) || 0;
  const final_price = amount + service_fee;

  const d = new Date();
  const currentMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const statement_cycle_tag = currentMonthStr;
  const debt_cycle_tag = debtCycleStr ? debtCycleStr : currentMonthStr;

  const payload = {
    occurred_at: d.toISOString(),
    type,
    amount,
    account_id,
    category_id,
    note: noteStr,
    cashback_mode: "none_back",
    metadata: {
      service_fee,
      final_price,
      statement_cycle_tag,
      debt_cycle_tag,
      is_installment: false,
      created_via: "QuickAdd_ModalForm"
    }
  };

  new Notice("🚀 Đang ghi giao dịch vào DB...");
  const insRes = await fetch(`${SUPABASE_URL}/rest/v1/transactions`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  if (insRes.ok) {
    new Notice(`🎉 GHI THÀNH CÔNG! Đã cập nhật số dư (${amount.toLocaleString()} VND)`);
  } else {
    const errObj = await insRes.json();
    new Notice(`❌ LỖI DB: ${errObj.message || insRes.status}`);
  }
};
