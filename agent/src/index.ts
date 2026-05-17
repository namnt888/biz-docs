import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import OpenAI from 'openai';
import * as path from 'path';
import WebSocket from 'ws';

dotenv.config();

// Initialize Universal AI Client (supports OpenRouter, 9router, Groq, Ollama, OpenAI)
const openai = new OpenAI({
  baseURL: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
  apiKey: process.env.AI_API_KEY || 'dummy_key',
});

const modelName = process.env.AI_MODEL || 'google/gemini-2.5-flash';

// Initialize Supabase Client with WebSocket transport workaround for Node.js
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'placeholder',
  {
    auth: {
      persistSession: false,
    },
    realtime: {
      transport: WebSocket as any,
    },
  }
);

const SYSTEM_PROMPT = `
You are a financial transaction parsing AI agent for 'Obsidian Money'.
Your job is to parse natural language spending/income inputs into a structured JSON array.
Each transaction should conform strictly to the following JSON schema:
{
  "occurred_at": "ISO-8601 timestamp (use current time if not specified)",
  "type": "expense" | "income" | "transfer_in" | "transfer_out" | "cashback" | "debt" | "repayment",
  "amount": number (integer, positive absolute value in VND, e.g., 45k = 45000),
  "note": string (the description of what was bought or done),
  "account_name": string (the guessed name of account, e.g., "Vpbank", "Techcombank", "MoMo", "Tiền mặt"),
  "category_name": string (the guessed category, e.g., "Ăn uống", "Mua sắm", "Di chuyển")
}
Return ONLY valid JSON array [ { ... } ]. Do not include markdown formatting like \`\`\`json or any explanations.
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

    // 1. Strip <thinking> ... </thinking> blocks
    content = content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();

    // 2. Find first '[' and last ']'
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

async function processDailyLog() {
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH || '../vault';
  const todayFile = path.join(vaultPath, '01_Daily_Logs', 'Today.md');
  
  if (!fs.existsSync(todayFile)) {
    console.log(`No daily log found at ${todayFile}`);
    return;
  }

  const content = fs.readFileSync(todayFile, 'utf8');
  console.log(`--- Processing content in Today.md ---`);

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
    console.log('No unsynced transactions found to process.');
    return;
  }

  console.log(`Found ${unsyncedLines.length} unsynced transactions:`, unsyncedLines);
  console.log(`Connecting to AI Gateway (${process.env.AI_BASE_URL}) using model ${modelName}...`);

  if (process.env.AI_API_KEY === 'your_key_here' || !process.env.AI_API_KEY) {
    console.log('⚠️ AI_API_KEY is not configured in .env! Skipping actual AI request.');
    console.log('Simulating parsed JSON for testing:');
    const dummyParsed = unsyncedLines.map(t => ({
      occurred_at: new Date().toISOString(),
      type: 'expense',
      amount: 45000,
      note: t,
      account_name: 'Vpbank',
      category_name: 'Ăn uống',
    }));
    console.log(JSON.stringify(dummyParsed, null, 2));
    return;
  }

  const parsedTxns = await parseTransactionsWithAI(unsyncedLines);
  if (!parsedTxns || !Array.isArray(parsedTxns)) {
    console.error('Failed to parse valid JSON from AI output.');
    return;
  }

  console.log('--- Successfully parsed JSON ---');
  console.log(JSON.stringify(parsedTxns, null, 2));

  // In a full implementation, here we would lookup account_id by account_name from DB
  // and insert into Supabase 'transactions' table.
  console.log(`[Supabase sync ready] Attempting to find accounts and insert...`);
  
  // For each parsed transaction, we simulate or execute DB insert
  for (const item of parsedTxns) {
    // Check if account exists
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, name')
      .ilike('name', `%${item.account_name}%`)
      .limit(1);

    let accountId = null;
    if (accounts && accounts.length > 0) {
      accountId = accounts[0].id;
    } else {
      console.log(`Account '${item.account_name}' not found in DB. Creating dummy account...`);
      const { data: newAcc, error: err } = await supabase
        .from('accounts')
        .insert({ name: item.account_name || 'Cash', type: 'cash', current_balance: 0 })
        .select()
        .single();
      if (!err && newAcc) accountId = newAcc.id;
    }

    if (accountId) {
      const { error: insErr } = await supabase.from('transactions').insert({
        occurred_at: item.occurred_at || new Date().toISOString(),
        type: item.type || 'expense',
        amount: item.amount || 0,
        note: item.note || '',
        account_id: accountId,
        metadata: { category_name: item.category_name },
      });
      if (insErr) console.error(`Error inserting transaction:`, insErr.message);
      else console.log(`✅ Inserted '${item.note}' (${item.amount} VND) successfully!`);
    }
  }

  // Update Today.md file
  const timestamp = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  for (const raw of unsyncedLines) {
    syncedLines.push(`- [x] ${raw} (✅ synced at ${timestamp})`);
  }

  const newContent = [...headerLines, ...syncedLines, ...footerLines].join('\n');
  fs.writeFileSync(todayFile, newContent, 'utf8');
  console.log(`✅ Updated ${todayFile} with synced status!`);
}

processDailyLog().catch(console.error);
