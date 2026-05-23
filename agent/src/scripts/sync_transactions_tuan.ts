import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

interface TxInput {
  date: string; // DD-MM
  occurred_at: string;
  cycle_tag: string;
  type: 'expense' | 'income';
  type_display: 'Out' | 'In';
  amount: number;
  notes: string;
  cashback_share_percent: number;
  cashback_share_fixed: number;
  back_source: string;
  shop_source: string;
}

const tuanTxs: TxInput[] = [
  {
    date: '01-05',
    occurred_at: '2026-05-01T12:00:00+07:00',
    cycle_tag: '2026-05',
    type: 'expense',
    type_display: 'Out',
    amount: 29243,
    notes: 'Youtube 2026-05 [1 slots] [29,243]/6',
    cashback_share_percent: 0,
    cashback_share_fixed: 0,
    back_source: 'Vietcombank',
    shop_source: 'Youtube'
  },
  {
    date: '06-05',
    occurred_at: '2026-05-06T12:00:00+07:00',
    cycle_tag: '2026-05',
    type: 'expense',
    type_display: 'Out',
    amount: 2303921,
    notes: 'Điện T4',
    cashback_share_percent: 0,
    cashback_share_fixed: 0,
    back_source: 'Uob',
    shop_source: 'Power'
  },
  {
    date: '13-05',
    occurred_at: '2026-05-13T12:00:00+07:00',
    cycle_tag: '2026-05',
    type: 'expense',
    type_display: 'Out',
    amount: 141087,
    notes: 'Nước T4',
    cashback_share_percent: 0,
    cashback_share_fixed: 0,
    back_source: 'Uob',
    shop_source: 'Water'
  },
  {
    date: '18-05',
    occurred_at: '2026-05-18T12:00:00+07:00',
    cycle_tag: '2026-05',
    type: 'expense',
    type_display: 'Out',
    amount: 22270000,
    notes: '17 256 tím',
    cashback_share_percent: 0,
    cashback_share_fixed: 0,
    back_source: 'Bidv Cashback',
    shop_source: 'Shopee'
  }
];

async function main() {
  console.log(`Step 1: Checking 'Tuấn' in people table...`);
  const { data: people, error: pErr } = await supabase
    .from('people')
    .select('id, name, sheet_id')
    .eq('name', 'Tuấn');

  if (pErr) {
    console.error('❌ Database error during people lookup:', pErr.message);
    process.exit(1);
  }

  if (!people || people.length === 0) {
    console.error("❌ ERROR: Person 'Tuấn' not found in database. STOPPING.");
    process.exit(1);
  }

  const person = people[0];
  if (!person.sheet_id) {
    console.error(`❌ ERROR: 'Tuấn' has no sheet_id in DB. STOPPING.`);
    process.exit(1);
  }

  console.log(`✅ Found 'Tuấn' with Sheet ID: ${person.sheet_id}\n`);

  console.log(`Step 2: Syncing transactions to database and n8n...\n`);
  const webhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/JIfwZP5txIaEsyvZ/webhook/supabase-multi-webhook';

  const { data: allAccounts } = await supabase.from('accounts').select('id, name');

  for (const item of tuanTxs) {
    console.log(`--------------------------------------------------`);
    console.log(`Processing: "${item.notes}" (${item.amount} VND)`);

    // Resolve or create account matching back_source (bank)
    let accountId = null;
    const backSourceName = item.back_source;
    const matchedAccount = (allAccounts || []).find(
      a => a.name.toLowerCase().replace(/[\s\-_]+/g, '') === backSourceName.toLowerCase().replace(/[\s\-_]+/g, '')
    );

    if (matchedAccount) {
      accountId = matchedAccount.id;
      console.log(`  Resolved account '${backSourceName}' to ID: ${accountId}`);
    } else {
      console.log(`  Account '${backSourceName}' not found. Auto-creating cash/credit account...`);
      // Use credit_card for accounts containing 'cashback' or 'card', bank otherwise
      const accType = (backSourceName.toLowerCase().includes('cashback') || backSourceName.toLowerCase().includes('card')) ? 'credit_card' : 'bank';
      const { data: newAcc, error: accErr } = await supabase
        .from('accounts')
        .insert({ name: backSourceName, type: accType, current_balance: 0 })
        .select()
        .single();
      if (accErr) {
        console.error(`  ❌ Failed to create account:`, accErr.message);
        continue;
      }
      accountId = newAcc.id;
      console.log(`  Created account '${backSourceName}' (type: ${accType}) with ID: ${accountId}`);
      allAccounts?.push({ id: accountId, name: backSourceName });
    }

    const cashbackMode = item.cashback_share_percent > 0 ? 'percent' : item.cashback_share_fixed > 0 ? 'fixed' : 'none_back';
    const cashbackPct = item.cashback_share_percent > 0 ? item.cashback_share_percent / 100 : null;
    const cashbackFixed = item.cashback_share_fixed > 0 ? item.cashback_share_fixed : null;

    // Insert transaction
    const { data: insertedTxn, error: insErr } = await supabase
      .from('transactions')
      .insert({
        occurred_at: item.occurred_at,
        type: item.type,
        status: 'posted',
        amount: item.amount,
        account_id: accountId,
        person_id: person.id,
        note: item.notes,
        cashback_mode: cashbackMode,
        cashback_share_percent: cashbackPct,
        cashback_share_fixed: cashbackFixed,
        metadata: {
          person_name: 'Tuấn',
          sheet_id: person.sheet_id,
          cycle_tag: item.cycle_tag,
          date: item.date,
          shop_source: item.shop_source,
          final_price: item.amount,
          back_source: item.back_source,
          is_installment: false,
          created_via: 'AIDaemon'
        }
      })
      .select()
      .single();

    if (insErr) {
      console.error(`  ❌ DB Insert Error:`, insErr.message);
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
        type_display: item.type_display,
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
        console.log(`  Webhook response OK: ${response.status}`);
        const { error: updErr } = await supabase
          .from('transactions')
          .update({ synced_at: new Date().toISOString() })
          .eq('id', insertedTxn.id);

        if (updErr) {
          console.error(`  ❌ Failed to update synced_at in DB:`, updErr.message);
        } else {
          console.log(`  ✅ synced`);
        }
      } else {
        console.error(`  ❌ Webhook response error status: ${response.status}`);
      }
    } catch (e: any) {
      console.error(`  ❌ Webhook request failed:`, e.message);
    }
  }
}

main().catch(console.error);
