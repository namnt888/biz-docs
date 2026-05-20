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
  let cbMode = "none_back";
  let cbPercentStr = "0";
  let cbFixedStr = "0";
  let personName = "";

  if (modalFormApi && modalFormApi.openForm) {
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
    cbMode = formResult.getValue('cb_mode') || 'none_back';
    cbPercentStr = formResult.getValue('cb_percent') || '0';
    cbFixedStr = formResult.getValue('cb_fixed') || '0';
    personName = formResult.getValue('person_name') || '';
  } else {
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
  
  // Calculate Cashback and Net Final Price
  let rawPercent = Number(cbPercentStr) || 0;
  const cashback_share_percent = rawPercent > 1 ? rawPercent / 100 : rawPercent; // 10 -> 0.1
  const cashback_share_fixed = Number(cbFixedStr) || 0;
  const cbAmount = cashback_share_percent > 0 ? Math.round(amount * cashback_share_percent) : cashback_share_fixed;
  const final_price = amount - cbAmount + service_fee;

  // Resolve person_id if personName is provided
  let person_id = null;
  if (personName) {
    const pRes = await fetch(`${SUPABASE_URL}/rest/v1/people?select=id,name&name=ilike.*${encodeURIComponent(personName)}*&limit=1`, { headers });
    if (pRes.ok) {
      const pData = await pRes.json();
      if (pData && pData.length > 0) person_id = pData[0].id;
    }
  }

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
    person_id: person_id || undefined,
    note: noteStr,
    cashback_mode: cbMode,
    cashback_share_percent: cashback_share_percent || undefined,
    cashback_share_fixed: cashback_share_fixed || undefined,
    metadata: {
      service_fee,
      final_price,
      statement_cycle_tag,
      debt_cycle_tag,
      person_name: personName,
      is_installment: false,
      created_via: "QuickAdd_ModalForm"
    }
  };

  new Notice("🚀 Đang ghi giao dịch vào DB Supabase...");
  const insRes = await fetch(`${SUPABASE_URL}/rest/v1/transactions`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  if (insRes.ok) {
    // Explicitly update account balance instantly
    const accQuery = await fetch(`${SUPABASE_URL}/rest/v1/accounts?select=current_balance&id=eq.${account_id}`, { headers });
    if (accQuery.ok) {
      const accData = await accQuery.json();
      if (accData && accData.length > 0) {
        const isPlus = type === 'income' || type === 'repayment' || type === 'refund' || type === 'transfer_in';
        const newBal = isPlus ? Number(accData[0].current_balance) + amount : Number(accData[0].current_balance) - amount;
        await fetch(`${SUPABASE_URL}/rest/v1/accounts?id=eq.${account_id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ current_balance: newBal, updated_at: new Date().toISOString() })
        });
      }
    }
    new Notice(`🎉 GHI THÀNH CÔNG! [💸 Net: ${final_price.toLocaleString()}đ | 🎁 CB: ${cbAmount.toLocaleString()}đ]`);
  } else {
    const errObj = await insRes.json();
    new Notice(`❌ LỖI DB: ${errObj.message || insRes.status}`);
  }
};
