# ⚡ Biểu mẫu Nhập liệu Trực quan (Quick Form)

> Biểu mẫu tương tác trực tiếp với Supabase. Bạn không cần nhớ tên tài khoản hay cú pháp văn bản.

[👈 Trở về Ghi chép Hôm nay](Today.md)  |  [📊 Xem Dashboard](../00_Dashboard/Dashboard.md)

---

```dataviewjs
const SUPABASE_URL = "https://fyrgmsfsqzofqduiidrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";
const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

const container = dv.container;
container.innerHTML = `
<div class="quick-entry-box" style="background: #1e1e1e; padding: 25px; border-radius: 12px; border: 1px solid #333; box-shadow: 0 4px 20px rgba(0,0,0,0.5); max-width: 650px; margin: 20px auto; color: #eee; font-family: sans-serif;">
  <h3 style="margin-top: 0; color: #60a5fa; border-bottom: 1px solid #333; padding-bottom: 10px; display: flex; align-items: center; gap: 8px;">
    <span>⚡</span> Nhập Giao Dịch Tức Thì
  </h3>
  
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
    <div>
      <label style="display: block; font-size: 13px; color: #9ca3af; margin-bottom: 5px;">Loại giao dịch *</label>
      <select id="qe-type" style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 6px; color: #fff;">
        <option value="expense">🔴 Chi tiêu (Expense)</option>
        <option value="income">🟢 Thu nhập (Income)</option>
        <option value="debt">🤝 Cho mượn (Lent)</option>
        <option value="repayment">🤝 Thu nợ (Repayment)</option>
        <option value="transfer_out">Chuyển tiền (Transfer)</option>
      </select>
    </div>
    
    <div>
      <label style="display: block; font-size: 13px; color: #9ca3af; margin-bottom: 5px;">Tài khoản nguồn *</label>
      <select id="qe-acc" style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 6px; color: #fff;">
        <option value="">⏳ Đang tải tài khoản...</option>
      </select>
    </div>
  </div>

  <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 15px; margin-bottom: 15px;">
    <div>
      <label style="display: block; font-size: 13px; color: #9ca3af; margin-bottom: 5px;">Số tiền (VND) *</label>
      <input type="number" id="qe-amt" placeholder="Vd: 150000" required style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 6px; color: #fff; font-size: 16px; font-weight: bold;">
    </div>
    
    <div>
      <label style="display: block; font-size: 13px; color: #9ca3af; margin-bottom: 5px;">Phí dịch vụ (nếu có)</label>
      <input type="number" id="qe-fee" placeholder="Vd: 3300" style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 6px; color: #fff;">
    </div>
  </div>

  <div style="margin-bottom: 15px;">
    <label style="display: block; font-size: 13px; color: #9ca3af; margin-bottom: 5px;">Nội dung / Ghi chú *</label>
    <input type="text" id="qe-note" placeholder="Vd: Ăn trưa cơm tấm tiệm cô Ba" required style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 6px; color: #fff;">
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
    <div>
      <label style="display: block; font-size: 13px; color: #9ca3af; margin-bottom: 5px;">Danh mục</label>
      <select id="qe-cat" style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 6px; color: #fff;">
        <option value="">(Không chọn)</option>
      </select>
    </div>

    <div>
      <label style="display: block; font-size: 13px; color: #9ca3af; margin-bottom: 5px;">Người liên quan (nếu vay/trả)</label>
      <select id="qe-person" style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 6px; color: #fff;">
        <option value="">(Không chọn)</option>
      </select>
    </div>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; background: #262626; padding: 15px; border-radius: 8px;">
    <div>
      <label style="display: block; font-size: 13px; color: #9ca3af; margin-bottom: 5px;">Chế độ Hoàn tiền (Cashback Mode)</label>
      <select id="qe-cb-mode" style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 6px; color: #fff;">
        <option value="none_back">Mặc định (1% Virtual)</option>
        <option value="real_percent">Real % (Tiền hoàn thực tế)</option>
        <option value="real_fixed">Real Fixed (Tiền hoàn cố định)</option>
        <option value="percent">Share % (Chia sẻ với bạn bè)</option>
      </select>
    </div>
    
    <div>
      <label style="display: block; font-size: 13px; color: #9ca3af; margin-bottom: 5px;">Tỷ lệ / Số tiền chia sẻ</label>
      <input type="number" step="0.01" id="qe-cb-val" placeholder="Vd: 0.05 (5%)" style="width: 100%; padding: 10px; background: #2d2d2d; border: 1px solid #444; border-radius: 6px; color: #fff;">
    </div>
  </div>

  <button id="qe-submit" style="width: 100%; padding: 14px; background: #3b82f6; hover: #2563eb; color: #fff; font-size: 16px; font-weight: bold; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);">
    🚀 Ghi Vào Cơ Sở Dữ Liệu
  </button>
  
  <div id="qe-status" style="margin-top: 15px; padding: 12px; border-radius: 6px; text-align: center; display: none; font-weight: bold;"></div>
</div>
`;

// Fetch data from Supabase and populate selects
setTimeout(async () => {
  try {
    const [accRes, catRes, pRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/accounts?select=id,name`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/categories?select=id,name_vi`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/people?select=id,name`, { headers })
    ]);

    const accSelect = document.getElementById("qe-acc");
    const catSelect = document.getElementById("qe-cat");
    const pSelect = document.getElementById("qe-person");

    if (accRes.ok) {
      const accounts = await accRes.json();
      accSelect.innerHTML = accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    }
    if (catRes.ok) {
      const categories = await catRes.json();
      catSelect.innerHTML = `<option value="">(Không chọn)</option>` + categories.map(c => `<option value="${c.id}">${c.name_vi}</option>`).join('');
    }
    if (pRes.ok) {
      const people = await pRes.json();
      pSelect.innerHTML = `<option value="">(Không chọn)</option>` + people.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }

    // Add submit event listener
    document.getElementById("qe-submit").addEventListener("click", async () => {
      const statusDiv = document.getElementById("qe-status");
      statusDiv.style.display = "block";
      statusDiv.style.background = "#374151";
      statusDiv.style.color = "#fbbf24";
      statusDiv.innerHTML = "⏳ Đang ghi dữ liệu lên Supabase...";

      const type = document.getElementById("qe-type").value;
      const account_id = document.getElementById("qe-acc").value;
      const amountStr = document.getElementById("qe-amt").value;
      const feeStr = document.getElementById("qe-fee").value;
      const note = document.getElementById("qe-note").value;
      const category_id = document.getElementById("qe-cat").value || null;
      const person_id = document.getElementById("qe-person").value || null;
      const cashback_mode = document.getElementById("qe-cb-mode").value;
      const cbValStr = document.getElementById("qe-cb-val").value;

      if (!amountStr || !note) {
        statusDiv.style.background = "#7f1d1d";
        statusDiv.style.color = "#fca5a5";
        statusDiv.innerHTML = "❌ Vui lòng nhập đầy đủ Số tiền và Nội dung!";
        return;
      }

      const amount = Number(amountStr);
      const service_fee = feeStr ? Number(feeStr) : 0;
      const final_price = amount + service_fee;
      
      const d = new Date();
      const statement_cycle_tag = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      let cashback_share_percent = null;
      let cashback_share_fixed = null;
      if (cbValStr) {
        const v = Number(cbValStr);
        if (v < 1) cashback_share_percent = v;
        else cashback_share_fixed = v;
      }

      const payload = {
        occurred_at: d.toISOString(),
        type,
        amount,
        account_id,
        category_id,
        person_id,
        note,
        cashback_mode,
        cashback_share_percent,
        cashback_share_fixed,
        metadata: {
          service_fee,
          final_price,
          statement_cycle_tag,
          debt_cycle_tag: statement_cycle_tag,
          is_installment: false,
          created_via: "QuickForm"
        }
      };

      const insRes = await fetch(`${SUPABASE_URL}/rest/v1/transactions`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      if (insRes.ok) {
        statusDiv.style.background = "#065f46";
        statusDiv.style.color = "#6ee7b7";
        statusDiv.innerHTML = "🎉 LƯU THÀNH CÔNG! Số dư tài khoản đã được tự động cập nhật.";
        document.getElementById("qe-amt").value = "";
        document.getElementById("qe-note").value = "";
        document.getElementById("qe-fee").value = "";
      } else {
        const errObj = await insRes.json();
        statusDiv.style.background = "#7f1d1d";
        statusDiv.style.color = "#fca5a5";
        statusDiv.innerHTML = "❌ Lỗi lưu dữ liệu: " + (errObj.message || insRes.status);
      }
    });
  } catch (e) {
    console.error("Quick Form init error:", e);
  }
}, 500);
```
