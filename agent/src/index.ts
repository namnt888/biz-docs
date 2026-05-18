import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import OpenAI from 'openai';
import * as path from 'path';
import WebSocket from 'ws';
import { CashbackService } from './services/cashback';
import { DebtService } from './services/debt';
import { exec } from 'child_process';

const notifyMac = (title: string, subtitle: string, message: string) => {
  exec(`osascript -e 'display notification "${message}" with title "${title}" subtitle "${subtitle}"'`, (err) => {
    if (err) console.error("Notification error:", err);
  });
};

dotenv.config();

const openai = new OpenAI({
  baseURL: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
  apiKey: process.env.AI_API_KEY || 'dummy_key',
});

const modelName = process.env.AI_MODEL || 'google/gemini-2.5-flash';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'placeholder',
  {
    auth: { persistSession: false },
    realtime: { transport: WebSocket as any },
  }
);

const cashbackService = new CashbackService(supabase);
const debtService = new DebtService(supabase);

const SYSTEM_PROMPT = `
You are a financial transaction parsing AI agent for 'Obsidian Money'.
Your job is to parse natural language spending/income inputs into a structured JSON array.

Each transaction should conform strictly to the following JSON schema:
{
  "occurred_at": "ISO-8601 timestamp (use current time if not specified, try to infer date from context like '06-05' -> current year)",
  "type": "expense" | "income" | "transfer_in" | "transfer_out" | "cashback" | "debt" | "repayment",
  "amount": number (integer, positive absolute value in VND, e.g., 45k = 45000, 500k = 500000, "1.971.346" = 1971346),
  "note": string (the description of what was bought or done),
  "account_name": string (guessed name of account, e.g., "Vpbank", "Techcombank", "MoMo", "Tiền mặt". Use ShopSource column as account hint if present),
  "category_name": string (guessed category, e.g., "Ăn uống", "Mua sắm", "Di chuyển", "Cho vay", "Điện nước"),
  "person_name": string (optional, if the transaction involves a person),
  "cashback_mode": string (optional: "none_back" | "percent" | "fixed" | "real_fixed" | "real_percent" | "voluntary"),
  "cashback_share_percent": number (optional, decimal representation of percent, e.g. "-8%" -> 0.08, "1,00" in % column -> 0.01),
  "cashback_share_fixed": number (optional, integer amount if fixed cashback),
  "service_fee": number (optional, integer in VND if the note mentions fees/surcharges),
  "is_installment": boolean (optional, true if mentioned as installment/trả góp)
}

SHEET FORMAT SUPPORT:
You can also parse tab-separated Google Sheet rows in the format:
  Type[TAB]Date[TAB]Notes[TAB]Amount[TAB]%Back[TAB]ShopSource[TAB]Account(optional)
Where:
  - Type: "Out" = expense, "In" = income
  - Date: "DD-MM" format (assume current year ${new Date().getFullYear()})
  - Amount: may use dots as thousands separator e.g. "1.971.346" = 1971346
  - %Back: cashback percent e.g. "1,00" = 1% -> cashback_share_percent: 0.01, "0,00" = 0
  - ShopSource: the service/shop name, use as note or category hint
  - Account (7th column, optional): explicit bank/wallet name, ALWAYS prefer this over ShopSource for account_name
  - If no 7th column, use ShopSource as account_name

Examples:
- Natural: "Lâm shopee zakka 115k -8% Tpbank" -> { "type": "expense", "amount": 115000, "note": "shopee zakka", "person_name": "Lâm", "cashback_mode": "percent", "cashback_share_percent": 0.08, "account_name": "Tpbank" }
- Natural: "Nam mua đồ 200k +20k Vpbank" -> { "type": "expense", "amount": 200000, "note": "mua đồ", "person_name": "Nam", "cashback_mode": "fixed", "cashback_share_fixed": 20000, "account_name": "Vpbank" }
- Sheet (6 cols, no account): "Out\t06-05\tĐiện T4\t1.971.346\t1,00\tPower" -> { "type": "expense", "amount": 1971346, "note": "Điện T4", "cashback_share_percent": 0.01, "cashback_mode": "percent", "account_name": "Power", "category_name": "Điện nước" }
- Sheet (7 cols, with account): "Out\t06-05\tĐiện T4\t1.971.346\t1,00\tPower\tTpbank" -> { "type": "expense", "amount": 1971346, "note": "Điện T4", "cashback_share_percent": 0.01, "cashback_mode": "percent", "account_name": "Tpbank", "category_name": "Điện nước" }
- Sheet (6 cols): "Out\t01-05\tYoutube 2026-05 [2 slots] [29,243]/6\t58.485\t0,00\tYoutube" -> { "type": "expense", "amount": 58485, "note": "Youtube 2026-05 [2 slots]", "cashback_share_percent": 0, "cashback_mode": "none_back", "account_name": "Youtube" }
- Mixed (Person + Account + Sheet): "Lâm Tpbank Out\t06-05\tĐiện T4\t1.971.346\t1,00\tPower" -> { "type": "expense", "amount": 1971346, "note": "Điện T4", "person_name": "Lâm", "account_name": "Tpbank", "cashback_share_percent": 0.01, "cashback_mode": "percent", "category_name": "Điện nước" }
- Mixed: "My Tpbank Out\t06-05\tĐiện T4\t1.971.346\t1,00\tPower" -> { "type": "expense", "amount": 1971346, "note": "Điện T4", "person_name": "My", "account_name": "Tpbank", "cashback_share_percent": 0.01, "cashback_mode": "percent" }

Return ONLY valid JSON array [ { ... } ]. Do not include markdown formatting or any explanations.
`;

async function parseTransactionsWithAI(lines: string[]) {
  const promptText = `Parse the following raw lines into a JSON array:\n` + lines.join('\n');
  try {
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: promptText },
      ],
      temperature: 0.1,
    });

    let content = response.choices[0]?.message?.content?.trim() || '[]';
    console.log('--- Raw AI Response ---');
    console.log(content);

    content = content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();

    const startIndex = content.indexOf('[');
    const endIndex = content.lastIndexOf(']');

    if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
      content = content.substring(startIndex, endIndex + 1);
    }

    return JSON.parse(content);
  } catch (error) {
    console.error('AI Parsing Error:', error);
    return null;
  }
}

export async function processDailyLog() {
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH || '../vault';
  const d = new Date();
  const currentMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const monthlyFile = path.resolve(vaultPath, '01_Monthly_Logs', `${currentMonthStr}.md`);
  
  if (!fs.existsSync(monthlyFile)) {
    console.log(`Creating new monthly log for ${currentMonthStr}...`);
    const dir = path.dirname(monthlyFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const template = `# 📅 Ghi chép Chi tiêu Tháng ${d.getMonth() + 1}/${d.getFullYear()}\n\n[👈 Xem Dashboard](../00_Dashboard/Dashboard.md)  |  [💸 Phân tích Thu Chi](../00_Dashboard/Cashflow_Analytics.md)\n\n---\n\n> [!todo] 📥 Unsynced Transactions\n> Ghi chép các khoản thu chi bằng văn bản tự nhiên ở dưới.\n\n\n> [!success] 🔄 Synced Transactions\n> AI Daemon sẽ tự động bóc tách và chuyển các giao dịch đã đồng bộ xuống đây.\n`;
    fs.writeFileSync(monthlyFile, template, 'utf8');
  }

  const content = fs.readFileSync(monthlyFile, 'utf8');

  const lines = content.split('\n');
  let isUnsyncedSection = false;
  let isSyncedSection = false;
  
  const headerLines: string[] = [];
  const unsyncedLines: string[] = [];
  const syncedLines: string[] = [];
  const footerLines: string[] = [];

  for (const line of lines) {
    if (line.includes('Unsynced Transactions')) {
      isUnsyncedSection = true;
      isSyncedSection = false;
      headerLines.push(line);
      continue;
    }
    if (line.includes('Synced Transactions')) {
      isUnsyncedSection = false;
      isSyncedSection = true;
      syncedLines.push(line);
      continue;
    }

    if (isUnsyncedSection) {
      const trimmed = line.trim();
      // Extract transactions from unsynced section
      // Match lines that look like a list item: `- something` or `> - something`
      const match = trimmed.match(/^>?\s*-\s+(.*)/);
      if (match) {
        unsyncedLines.push(match[1].trim());
      } else {
        headerLines.push(line);
      }
    } else if (isSyncedSection) {
      syncedLines.push(line);
    } else {
      headerLines.push(line);
    }
  }

  if (unsyncedLines.length === 0) {
    return; // Silent if nothing to sync
  }

  console.log(`\n--- Processing content in Today.md ---`);
  console.log(`Found ${unsyncedLines.length} unsynced transactions:`, unsyncedLines);
  console.log(`Connecting to AI Gateway (${process.env.AI_BASE_URL}) using model ${modelName}...`);
  notifyMac('Obsidian Money', 'AI Daemon', `Đang phân tích ${unsyncedLines.length} giao dịch...`);

  const parsedTxns = await parseTransactionsWithAI(unsyncedLines);
  if (!parsedTxns || !Array.isArray(parsedTxns)) {
    console.error('Failed to parse valid JSON from AI output.');
    return;
  }

  console.log('--- Successfully parsed JSON ---');
  console.log(JSON.stringify(parsedTxns, null, 2));

  console.log(`[Supabase sync ready] Attempting DB insertion & advanced services...`);
  const syncWarnings: string[] = [];
  
  // Fetch all accounts once for fuzzy space-stripped matching
  const { data: allAccounts } = await supabase.from('accounts').select('id, name, current_balance');

  for (const item of parsedTxns) {
    let accountId = null;
    let resolvedName = item.account_name || 'Cash';
    let warningNote = "";

    const matches = (allAccounts || []).filter(a => {
      const cleanTarget = (item.account_name || 'Cash').toLowerCase().replace(/[\s\-_]+/g, '');
      const cleanAcc = a.name.toLowerCase().replace(/[\s\-_]+/g, '');
      return cleanAcc.includes(cleanTarget) || cleanTarget.includes(cleanAcc);
    });

    if (matches && matches.length === 1) {
      accountId = matches[0].id;
      resolvedName = matches[0].name;
    } else if (matches && matches.length > 1) {
      const exact = matches.find(a => a.name.toLowerCase().replace(/\s+/g, '') === (item.account_name || '').toLowerCase().replace(/\s+/g, ''));
      if (exact) {
        accountId = exact.id;
        resolvedName = exact.name;
      } else {
        accountId = matches[0].id;
        resolvedName = matches[0].name;
        warningNote = ` [⚠️ Ambiguous '${item.account_name}', auto-picked '${resolvedName}']`;
        console.warn(`[!] Ambiguous account '${item.account_name}'. Matches: ${matches.map(a => a.name).join(', ')}. Auto-picked '${resolvedName}'.`);
      }
    } else {
      console.log(`Account '${item.account_name}' not found. Creating dummy account...`);
      const { data: newAcc } = await supabase
        .from('accounts')
        .insert({ name: item.account_name || 'Cash', type: 'cash', current_balance: 0 })
        .select()
        .single();
      if (newAcc) accountId = newAcc.id;
    }
    
    // Store resolved account name for backlink formatting
    item.resolved_account = resolvedName;
    syncWarnings.push(warningNote);

    let personId = null;
    if (item.person_name) {
      const { data: people } = await supabase
        .from('people')
        .select('id, name')
        .ilike('name', `%${item.person_name}%`)
        .limit(1);

      if (people && people.length > 0) {
        personId = people[0].id;
      } else {
        console.log(`Person '${item.person_name}' not found. Creating new contact...`);
        const { data: newPerson } = await supabase
          .from('people')
          .insert({ name: item.person_name, status: 'active' })
          .select()
          .single();
        if (newPerson) personId = newPerson.id;
      }
    }

      const occurredAt = item.occurred_at || new Date().toISOString();
      const amt = item.amount || 0;
      const fee = item.service_fee || 0;
      const finalPrice = amt + fee;
      const d = new Date(occurredAt);
      const tag = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      const { data: insertedTxn, error: insErr } = await supabase
        .from('transactions')
        .insert({
          occurred_at: occurredAt,
          type: item.type || 'expense',
          amount: amt,
          note: item.note || '',
          account_id: accountId,
          person_id: personId,
          cashback_mode: item.cashback_mode || 'none_back',
          cashback_share_percent: item.cashback_share_percent,
          cashback_share_fixed: item.cashback_share_fixed,
          metadata: {
            category_name: item.category_name,
            service_fee: fee,
            final_price: finalPrice,
            statement_cycle_tag: tag,
            debt_cycle_tag: tag,
            is_installment: item.is_installment || false,
            created_via: 'AIDaemon'
          },
        })
        .select()
        .single();

      if (insErr) {
        console.error(`❌ DB Insert Error:`, insErr.message);
        syncWarnings.push(` [❌ DB Error: ${insErr.message}]`);
      } else {
        item.inserted_id = insertedTxn.id;
        console.log(`✅ Inserted '${item.note}' (${amt} VND) successfully!`);
        
        // Explicitly update account balance via Node.js to ensure 100% reliability
        const { data: acc } = await supabase.from('accounts').select('current_balance').eq('id', accountId).single();
        if (acc) {
          const isPlus = item.type === 'income' || item.type === 'repayment' || item.type === 'refund' || item.type === 'transfer_in';
          const delta = Number(amt);
          const newBalance = isPlus ? Number(acc.current_balance) + delta : Number(acc.current_balance) - delta;
          await supabase.from('accounts').update({ current_balance: newBalance, updated_at: new Date().toISOString() }).eq('id', accountId);
          console.log(`💲 Account '${resolvedName}' balance updated to ${newBalance.toLocaleString()} VND`);
        }
        
        const payload = {
          id: insertedTxn.id,
          account_id: accountId,
          amount: insertedTxn.amount,
          type: insertedTxn.type,
          occurred_at: insertedTxn.occurred_at,
          cashback_mode: insertedTxn.cashback_mode,
          cashback_share_percent: insertedTxn.cashback_share_percent,
          cashback_share_fixed: insertedTxn.cashback_share_fixed,
          person_id: personId || undefined,
          note: insertedTxn.note,
        };

        await cashbackService.processTransactionCashback(payload);
        await debtService.processTransactionDebt(payload);
      }
  }

  const timestamp = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const hasTable = syncedLines.some(l => l.includes('|---|') || l.includes('| ---'));
  
  if (!hasTable && unsyncedLines.length > 0) {
    syncedLines.push(`\n| ID | ⏰ Giờ | 👤 Người | 💳 Thẻ | 📊 Loại | 💰 Số tiền | 📝 Ghi chú | 🎁 Hoàn / Phí |`);
    syncedLines.push(`|---|---|---|---|---|---|---|---|`);
  }

  for (let i = 0; i < unsyncedLines.length; i++) {
    const raw = unsyncedLines[i];
    const warn = syncWarnings[i] || "";
    const item = parsedTxns[i];
    
    if (!item) {
      syncedLines.push(`| - | ${timestamp} | - | - | ❓ | - | ${raw} ${warn} | - |`);
      continue;
    }

    // Attempt to extract or generate short ID. Supabase uses UUIDs, but if we don't have it here yet because we inserted it in a different loop...
    // Wait, we don't have the inserted UUID in `parsedTxns` because `parsedTxns` is just the AI parsed JSON!
    // But wait! We DO have `item.inserted_id` if we modify the insertion loop to add it!

    let pLink = item.person_name ? `[[${item.person_name}]]` : '-';
    let aLink = item.resolved_account ? `[[${item.resolved_account}]]` : (item.account_name ? `[[${item.account_name}]]` : '-');
    let tSign = item.type === 'income' || item.type === 'repayment' ? '🟢' : (item.type === 'expense' ? '🔴' : '🔄');
    let amtStr = `**${Number(item.amount).toLocaleString()} đ**`;
    let noteStr = (item.note || raw) + (warn ? ` *(⚠️ ${warn})*` : '');
    
    let extraStr = '-';
    if (item.cashback_share_percent || item.cashback_share_fixed || item.service_fee) {
      const amt = Number(item.amount || 0);
      const fee = Number(item.service_fee || 0);
      const cb = item.cashback_share_percent ? Math.round(amt * item.cashback_share_percent) : Number(item.cashback_share_fixed || 0);
      const net = amt - cb + fee;
      extraStr = `Net: ${net.toLocaleString()}đ<br>CB: ${cb.toLocaleString()}đ${fee ? `<br>Fee: ${fee.toLocaleString()}đ` : ''}`;
    }
    
    const shortId = item.inserted_id ? item.inserted_id.substring(0, 5) : '-';
    syncedLines.push(`| \`${shortId}\` | ${timestamp} | ${pLink} | ${aLink} | ${tSign} | ${amtStr} | ${noteStr} | ${extraStr} |`);
  }

  const newContent = [...headerLines, ...syncedLines, ...footerLines].join('\n');
  fs.writeFileSync(monthlyFile, newContent, 'utf8');
  console.log(`✅ Updated ${monthlyFile} with synced status!`);
  notifyMac('Obsidian Money', 'Hoàn tất!', `Đã đồng bộ thành công ${unsyncedLines.length} giao dịch.`);
}

// Only auto-run if executed directly via CLI
if (process.argv[1]?.includes('index.ts')) {
  processDailyLog().catch(console.error);
}
