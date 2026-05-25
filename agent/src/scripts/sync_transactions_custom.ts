import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

interface ParsedTx {
  person_name: string;
  cycle_tag: string;
  date: string; // DD-MM
  occurred_at: string;
  amount: number;
  notes: string;
  cashback_share_percent: number; // e.g. 8
  cashback_share_fixed: number; // e.g. 100000
  back_source: string | null;
  shop_source: string;
  original_line: string;
}

const inputData = `Lâm, 2026-05:
- Ngày 1.5 Youtube
  + 58,485 Youtube 2026-05 [2 slots] [29,243]/6 Vpbank
- Ngày 1.5 iCloud
  + 86,300 iCloud 2026-05 [2 slots] [43,150]/6 Vpbank
- Ngày 5.5 Shopee
  + 941,420 Derma: 1 Rescuer, 1 HA B5, 1 VitC (giảm 100k Vpbank) Vpbank
  + 666,700 Derma: 1 B3 (Giảm 50k Vpbank) Vpbank
  + 589,120 Mediamix: 10 xà bông, Tẩy trang Chacott
  + 1,021,140 -8% Babé: 1 SRM, Zakka: 2 SRM Msb Online
- Ngày 6.5 Power
  + 1,971,346 -1% Điện T4 Vpbank`;

function parseCustomInput(text: string): ParsedTx[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let person_name = '';
  let cycle_tag = '';
  let current_date = '';
  let current_shop = '';
  
  const txs: ParsedTx[] = [];
  const KNOWN_SOURCES = ['vpbank', 'shopee', 'tpbank', 'tp bank', 'momo', 'techcombank', 'msb online'];

  for (const line of lines) {
    // 1. Header parsing: Lâm, 2026-05:
    const headerMatch = line.match(/^([^,]+),\s*(\d{4}-\d{2}):$/);
    if (headerMatch) {
      person_name = headerMatch[1].trim();
      cycle_tag = headerMatch[2].trim();
      continue;
    }
    
    // 2. Date/Shop parsing: - Ngày 5.5 Shopee
    const dateMatch = line.match(/^-?\s*(?:Ngày|ngày)\s+(\d+)\.(\d+)(?:\s+(.+))?$/);
    if (dateMatch) {
      const d = String(dateMatch[1]).padStart(2, '0');
      const m = String(dateMatch[2]).padStart(2, '0');
      current_date = `${d}-${m}`;
      current_shop = dateMatch[3] ? dateMatch[3].trim() : '';
      continue;
    }
    
    // 3. Transaction line parsing: + <amount>
    if (line.trim().startsWith('+')) {
      const original_line = line;
      const amountMatch = line.match(/^\+\s*([\d,.]+)/);
      if (!amountMatch) continue;
      const rawAmt = amountMatch[1];
      const amount = parseInt(rawAmt.replace(/[,.]/g, ''), 10);
      
      let rest = line.substring(amountMatch[0].length).trim();
      
      // Extract cashback percent: -X%
      let cashback_share_percent = 0;
      const pctMatch = rest.match(/^-(\d+)%/);
      if (pctMatch) {
        cashback_share_percent = parseInt(pctMatch[1], 10);
        rest = rest.substring(pctMatch[0].length).trim();
      }
      
      // Extract fixed cashback: (giảm Xk <source>) - Disabled per Rule 1: discount is not cashback
      let cashback_share_fixed = 0;
      let back_source: string | null = null;
      
      // Extract back_source (bank) from the end if it is a known source (supports multi-word sources like 'Msb Online')
      const sortedSources = [...KNOWN_SOURCES].sort((a, b) => b.length - a.length);
      for (const src of sortedSources) {
        if (rest.toLowerCase().endsWith(src.toLowerCase())) {
          const beforeIdx = rest.length - src.length - 1;
          if (beforeIdx < 0 || /\s/.test(rest[beforeIdx])) {
            back_source = rest.substring(rest.length - src.length);
            rest = rest.substring(0, rest.length - src.length).trim();
            break;
          }
        }
      }
      
      // Bank default rule: default to Vpbank if not specified
      if (!back_source) {
        back_source = 'Vpbank';
      }
      
      const shop_source = current_shop; // shop is always the day context (Shopee)
      
      const notes = rest;
      const [year, month] = cycle_tag.split('-');
      const [day, mth] = current_date.split('-');
      const occurred_at = `${year}-${month}-${day}T12:00:00+07:00`;
      
      txs.push({
        person_name,
        cycle_tag,
        date: current_date,
        occurred_at,
        amount,
        notes,
        cashback_share_percent,
        cashback_share_fixed,
        back_source,
        shop_source,
        original_line
      });
    }
  }
  
  return txs;
}

async function markTransactionStatus(txId: string, status: string) {
  console.log(`Setting transaction ${txId} status='${status}'...`);
  const { data, error } = await supabase
    .from('transactions')
    .update({ status: status })
    .eq('id', txId)
    .select('id, status, occurred_at, metadata, people(id, name, sheet_id)')
    .single();

  if (error) {
    console.error('❌ Failed to update status:', error.message);
    process.exit(1);
  }

  console.log(`✅ Transaction ${txId} updated to status='${status}'`);

  if (status === 'void') {
    try {
      const webhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/supabase-multi-webhook';
      const { data: txn, error: txnErr } = await supabase
        .from('transactions')
        .select('id, occurred_at, type, amount, cashback_share_percent, cashback_share_fixed, note, metadata, people(id, name, sheet_id)')
        .eq('id', txId)
        .single();

      if (txnErr) {
        console.error('❌ Failed to fetch voided transaction for webhook sync:', txnErr.message);
        return;
      }

      const personRecord = Array.isArray(txn?.people) ? txn.people[0] : txn?.people;
      const payload = {
        table: 'transactions',
        record: {
          id: txn.id,
          occurred_at: txn.occurred_at,
          type: txn.type,
          type_display: txn.type === 'expense' ? 'Out' : 'In',
          amount: txn.amount,
          cashback_share_percent: txn.cashback_share_percent,
          cashback_share_fixed: txn.cashback_share_fixed,
          note: txn.note,
          metadata: {
            ...(txn.metadata || {}),
            person_name: personRecord?.name || txn.metadata?.person_name || '',
            sheet_id: personRecord?.sheet_id || txn.metadata?.sheet_id || '',
            status: 'void'
          }
        }
      };

      console.log(`Triggering n8n delete sync for ${personRecord?.name || 'unknown person'}: ${webhookUrl}`);
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (resp.ok) {
        console.log('✅ n8n void sync triggered');
      } else {
        console.error(`❌ n8n void sync failed: ${resp.status}`);
      }
    } catch (e: any) {
      console.error('❌ Error sending void webhook:', e.message || e);
    }
  }

  const personRecord = Array.isArray(data?.people) ? data.people[0] : data?.people;
  const personName = personRecord?.name || data?.metadata?.person_name || '';
  const deployKey = personName
    ? `PEOPLE_SHEET_DEPLOY_${personName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()}`
    : '';
  const deployId = deployKey ? process.env[deployKey] : '';
  const reconcileUrl = deployId
    ? `https://script.google.com/macros/s/${deployId}/exec`
    : process.env.APPS_SCRIPT_RECONCILE_URL;

  if (reconcileUrl) {
    try {
      console.log(`Triggering Apps Script reconcile for ${personName || 'unknown person'}: ${reconcileUrl}`);
      await fetch(reconcileUrl, { method: 'POST' });
      console.log('✅ Reconcile triggered');
    } catch (e: any) {
      console.error('⚠️ Failed to call Apps Script reconcile:', e.message || e);
    }
  } else {
    console.log('ℹ️ No APPS_SCRIPT_RECONCILE_URL configured; reconcile not triggered.');
  }
}

async function main() {
  const argv = process.argv.slice(2);
  // support: --void <id>  or --restore <id>
  const voidIdx = argv.indexOf('--void');
  const restoreIdx = argv.indexOf('--restore');
  const mode = argv.includes('--commit') ? 'commit' : 'preview';

  if (voidIdx !== -1 && argv[voidIdx + 1]) {
    const txId = argv[voidIdx + 1];
    await markTransactionStatus(txId, 'void');
    return;
  }

  if (restoreIdx !== -1 && argv[restoreIdx + 1]) {
    const txId = argv[restoreIdx + 1];
    // restore to posted so it can be synced again
    await markTransactionStatus(txId, 'posted');
    // After restoring, trigger webhook to write row back to sheet
    const webhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/supabase-multi-webhook';
    try {
      // fetch the restored txn to build payload
      const { data: txn, error: tErr } = await supabase.from('transactions').select('*,people(sheet_id,name)').eq('id', txId).single();
      if (tErr) {
        console.error('❌ Failed to fetch restored transaction:', tErr.message);
        return;
      }
      const payload = {
        table: 'transactions',
        record: {
          id: txn.id,
          occurred_at: txn.occurred_at,
          type: txn.type,
          type_display: txn.type === 'expense' ? 'Out' : 'In',
          amount: txn.amount,
          cashback_share_percent: txn.cashback_share_percent,
          cashback_share_fixed: txn.cashback_share_fixed,
          note: txn.note,
          metadata: {
            ...(txn.metadata || {}),
            person_name: (Array.isArray(txn.people) ? txn.people[0]?.name : txn.people?.name) || txn.metadata?.person_name || 'Lâm',
            sheet_id: (Array.isArray(txn.people) ? txn.people[0]?.sheet_id : txn.people?.sheet_id) || txn.metadata?.sheet_id || '',
            status: 'posted'
          }
        }
      };

      console.log(`Sending webhook to restore txn row: ${webhookUrl}`);
      const resp = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (resp.ok) console.log('✅ Webhook sent for restored txn'); else console.error('❌ Webhook error', resp.status);
    } catch (e: any) {
      console.error('❌ Error sending restore webhook:', e.message || e);
    }

    return;
  }

  console.log(`Running in ${mode.toUpperCase()} mode...`);

  // Step 1: Query sheet_id for 'Lâm'
  console.log(`Step 1: Checking 'Lâm' in people table...`);
  const { data: people, error: pErr } = await supabase
    .from('people')
    .select('id, name, sheet_id')
    .eq('name', 'Lâm');

  if (pErr) {
    console.error('❌ Database error during people lookup:', pErr.message);
    process.exit(1);
  }

  if (!people || people.length === 0) {
    console.error("❌ ERROR: Person 'Lâm' not found in database. STOPPING.");
    process.exit(1);
  }

  const person = people[0];
  if (!person.sheet_id) {
    console.error(`❌ ERROR: 'Lâm' has no sheet_id in DB (sheet_id is null/empty). STOPPING.`);
    process.exit(1);
  }

  console.log(`✅ Found 'Lâm' with Sheet ID: ${person.sheet_id}\n`);

  // Step 2: Parse transactions
  console.log(`Step 2: Parsing input data...`);
  const txs = parseCustomInput(inputData);
  console.log(`Parsed ${txs.length} transactions:\n`);

  // Step 3: Print preview table
  console.table(
    txs.map((tx, idx) => ({
      '#': idx + 1,
      'Date': tx.date,
      'Amount': tx.amount.toLocaleString() + ' đ',
      'Notes': tx.notes,
      '% CB': tx.cashback_share_percent > 0 ? `${tx.cashback_share_percent}%` : '-',
      'Fixed CB': tx.cashback_share_fixed > 0 ? tx.cashback_share_fixed.toLocaleString() + ' đ' : '-',
      'Back Source': tx.back_source || '-',
      'Shop Source': tx.shop_source
    }))
  );

  if (mode === 'preview') {
    console.log('\n👉 To insert these transactions and sync, run with the --commit flag:');
    console.log('   npx tsx src/scripts/sync_transactions_custom.ts --commit');
    return;
  }

  // Step 4: Commit to DB and trigger webhook
  console.log(`\nStep 4 & 5: Committing to database and triggering webhooks...\n`);
  const webhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/supabase-multi-webhook';

  const { data: allAccounts } = await supabase.from('accounts').select('id, name');

  for (const item of txs) {
    console.log(`--------------------------------------------------`);
    console.log(`Processing: "${item.original_line}"`);

    // Resolve or create account matching back_source (bank)
    let accountId = null;
    const backSourceName = item.back_source || 'Vpbank';
    const matchedAccount = (allAccounts || []).find(
      a => a.name.toLowerCase().replace(/[\s\-_]+/g, '') === backSourceName.toLowerCase().replace(/[\s\-_]+/g, '')
    );

    if (matchedAccount) {
      accountId = matchedAccount.id;
      console.log(`  Resolved account '${backSourceName}' to ID: ${accountId}`);
    } else {
      console.log(`  Account '${backSourceName}' not found. Auto-creating cash account...`);
      const { data: newAcc, error: accErr } = await supabase
        .from('accounts')
        .insert({ name: backSourceName, type: 'cash', current_balance: 0 })
        .select()
        .single();
      if (accErr) {
        console.error(`  ❌ Failed to create account:`, accErr.message);
        continue;
      }
      accountId = newAcc.id;
      console.log(`  Created account '${backSourceName}' with ID: ${accountId}`);
      // Add to list to avoid duplicate creation
      allAccounts?.push({ id: accountId, name: backSourceName });
    }

    const cashbackMode = item.cashback_share_percent > 0 ? 'percent' : item.cashback_share_fixed > 0 ? 'fixed' : 'none_back';
    const cashbackPct = item.cashback_share_percent > 0 ? item.cashback_share_percent / 100 : null;
    const cashbackFixed = item.cashback_share_fixed > 0 ? item.cashback_share_fixed : null;

    // Insert row
    const { data: insertedTxn, error: insErr } = await supabase
      .from('transactions')
      .insert({
        occurred_at: item.occurred_at,
        type: 'expense',
        status: 'posted',
        amount: item.amount,
        account_id: accountId,
        person_id: person.id,
        note: item.notes,
        cashback_mode: cashbackMode,
        cashback_share_percent: cashbackPct,
        cashback_share_fixed: cashbackFixed,
        metadata: {
          person_name: item.person_name,
          sheet_id: person.sheet_id,
          cycle_tag: item.cycle_tag,
          date: item.date,
          shop_source: item.shop_source,
          final_price: item.amount,
          back_source: item.back_source || undefined,
          created_via: 'AIDaemon'
        }
      })
      .select()
      .single();

    if (insErr) {
      console.error(`  ❌ DB Insert Error:`, insErr.message);
      console.log(`  ⚠️ pending sync`);
      continue;
    }

    console.log(`  ✅ DB Insert success. ID: ${insertedTxn.id}`);

    // Trigger n8n webhook
    const payload = {
      table: 'transactions',
      record: {
        id: insertedTxn.id,
        occurred_at: insertedTxn.occurred_at,
        type: insertedTxn.type,
        type_display: 'Out',
        amount: insertedTxn.amount,
        cashback_share_percent: cashbackPct,
        cashback_share_fixed: cashbackFixed,
        note: insertedTxn.note,
        metadata: insertedTxn.metadata
      }
    };

    console.log(`  Sending webhook to: ${webhookUrl}`);
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        // n8n returned success
        console.log(`  Webhook response OK: ${response.status}`);
        const { error: updErr } = await supabase
          .from('transactions')
          .update({ synced_at: new Date().toISOString() })
          .eq('id', insertedTxn.id);

        if (updErr) {
          console.error(`  ❌ Failed to update synced_at in DB:`, updErr.message);
          console.log(`  ⚠️ pending sync`);
        } else {
          console.log(`  ✅ synced`);
        }
      } else {
        console.error(`  ❌ Webhook response error status: ${response.status}`);
        console.log(`  ⚠️ pending sync`);
      }
    } catch (e: any) {
      console.error(`  ❌ Webhook request failed:`, e.message);
      console.log(`  ⚠️ pending sync`);
    }
  }
}

main().catch(console.error);
