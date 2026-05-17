import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import OpenAI from 'openai';
import * as path from 'path';
import WebSocket from 'ws';
import { CashbackService } from './services/cashback';
import { DebtService } from './services/debt';

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
  "occurred_at": "ISO-8601 timestamp (use current time if not specified)",
  "type": "expense" | "income" | "transfer_in" | "transfer_out" | "cashback" | "debt" | "repayment",
  "amount": number (integer, positive absolute value in VND, e.g., 45k = 45000, 500k = 500000),
  "note": string (the description of what was bought or done),
  "account_name": string (guessed name of account, e.g., "Vpbank", "Techcombank", "MoMo", "Tiền mặt"),
  "category_name": string (guessed category, e.g., "Ăn uống", "Mua sắm", "Di chuyển", "Cho vay"),
  "person_name": string (optional, if the transaction involves borrowing, lending, or paying a specific person, e.g., "Nam", "Hương"),
  "cashback_mode": string (optional: "none_back" | "percent" | "fixed" | "real_fixed" | "real_percent" | "voluntary"),
  "cashback_share_percent": number (optional, e.g., 0.5 for 50%),
  "cashback_share_fixed": number (optional, integer amount),
  "service_fee": number (optional, integer in VND if the note mentions fees/surcharges, e.g., "phí 50k" -> 50000),
  "is_installment": boolean (optional, true if mentioned as installment/trả góp)
}
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
    
    const template = `# 📅 Ghi chép Chi tiêu Tháng ${d.getMonth() + 1}/${d.getFullYear()}\n\n> Ghi chép các khoản thu chi bằng văn bản tự nhiên dưới mục **Unsynced**.\n\n[👈 Xem Dashboard](../00_Dashboard/Dashboard.md)  |  [💸 Phân tích Thu Chi](../00_Dashboard/Cashflow_Analytics.md)\n\n---\n\n## Unsynced Transactions\n\n\n## Synced Transactions\n`;
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
    if (line.trim().startsWith('## Unsynced Transactions')) {
      isUnsyncedSection = true;
      isSyncedSection = false;
      headerLines.push(line);
      continue;
    }
    if (line.trim().startsWith('## Synced Transactions')) {
      isUnsyncedSection = false;
      isSyncedSection = true;
      syncedLines.push(line);
      continue;
    }

    if (isUnsyncedSection) {
      if (line.trim().startsWith('-') && line.trim().length > 1) {
        unsyncedLines.push(line.trim().replace(/^-/, '').trim());
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

  const parsedTxns = await parseTransactionsWithAI(unsyncedLines);
  if (!parsedTxns || !Array.isArray(parsedTxns)) {
    console.error('Failed to parse valid JSON from AI output.');
    return;
  }

  console.log('--- Successfully parsed JSON ---');
  console.log(JSON.stringify(parsedTxns, null, 2));

  console.log(`[Supabase sync ready] Attempting DB insertion & advanced services...`);
  
  for (const item of parsedTxns) {
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, name')
      .ilike('name', `%${item.account_name}%`)
      .limit(1);

    let accountId = null;
    if (accounts && accounts.length > 0) {
      accountId = accounts[0].id;
    } else {
      console.log(`Account '${item.account_name}' not found. Creating dummy account...`);
      const { data: newAcc } = await supabase
        .from('accounts')
        .insert({ name: item.account_name || 'Cash', type: 'cash', current_balance: 0 })
        .select()
        .single();
      if (newAcc) accountId = newAcc.id;
    }

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

      if (insErr || !insertedTxn) {
        console.error(`Error inserting transaction:`, insErr?.message);
      } else {
        console.log(`✅ Inserted '${item.note}' (${item.amount} VND) successfully!`);
        
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
  for (const raw of unsyncedLines) {
    syncedLines.push(`- [x] ${raw} (✅ synced at ${timestamp})`);
  }

  const newContent = [...headerLines, ...syncedLines, ...footerLines].join('\n');
  fs.writeFileSync(monthlyFile, newContent, 'utf8');
  console.log(`✅ Updated ${monthlyFile} with synced status!`);
}

// Only auto-run if executed directly via CLI
if (process.argv[1]?.includes('index.ts')) {
  processDailyLog().catch(console.error);
}
