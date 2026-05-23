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
  cashback_share_percent: number; // e.g. 6 for 6%
  cashback_share_fixed: number; // e.g. 400000
  back_source: string;
  shop_source: string;
  is_installment: boolean;
}

const ashleyTxs: TxInput[] = [
  {
    date: '28-04',
    occurred_at: '2026-04-28T12:00:00+07:00',
    cycle_tag: '2026-05',
    type: 'expense',
    type_display: 'Out',
    amount: 6699833,
    notes: '17 PM 512 40.199 [Góp 1/6-Start 05.2026] -400',
    cashback_share_percent: 0,
    cashback_share_fixed: 400000,
    back_source: 'Techcombank Everyday',
    shop_source: 'Shopee',
    is_installment: true
  },
  {
    date: '06-05',
    occurred_at: '2026-05-06T12:00:00+07:00',
    cycle_tag: '2026-05',
    type: 'expense',
    type_display: 'Out',
    amount: 710750,
    notes: 'Điện T4 (695.049 | Fee: 15.701)',
    cashback_share_percent: 4,
    cashback_share_fixed: 0,
    back_source: 'Vpbank',
    shop_source: 'Shopee',
    is_installment: false
  },
  {
    date: '06-05',
    occurred_at: '2026-05-06T12:00:00+07:00',
    cycle_tag: '2026-05',
    type: 'expense',
    type_display: 'Out',
    amount: 4293210,
    notes: 'Học Phí T4 (4.241.000 | Fee: 52.210)',
    cashback_share_percent: 6,
    cashback_share_fixed: 0,
    back_source: 'Jcb Ultimate',
    shop_source: 'School Fee',
    is_installment: false
  },
  {
    date: '22-05',
    occurred_at: '2026-05-22T12:00:00+07:00',
    cycle_tag: '2026-05',
    type: 'income',
    type_display: 'In',
    amount: 100000,
    notes: 'Bonus nhận iPhone',
    cashback_share_percent: 0,
    cashback_share_fixed: 0,
    back_source: 'Systems Card',
    shop_source: 'Systems card',
    is_installment: false
  }
];

async function main() {
  console.log(`Step 1: Checking 'Ashley' in people table...`);
  const { data: people, error: pErr } = await supabase
    .from('people')
    .select('id, name, sheet_id')
    .eq('name', 'Ashley');

  if (pErr) {
    console.error('❌ Database error during people lookup:', pErr.message);
    process.exit(1);
  }

  if (!people || people.length === 0) {
    console.error("❌ ERROR: Person 'Ashley' not found in database. STOPPING.");
    process.exit(1);
  }

  const person = people[0];
  if (!person.sheet_id) {
    console.error(`❌ ERROR: 'Ashley' has no sheet_id in DB. STOPPING.`);
    process.exit(1);
  }

  console.log(`✅ Found 'Ashley' with Sheet ID: ${person.sheet_id}\n`);

  console.log(`Step 2: Syncing transactions to database and n8n...\n`);
  const webhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/supabase-multi-webhook';

  const { data: allAccounts } = await supabase.from('accounts').select('id, name');

  for (const item of ashleyTxs) {
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
          person_name: 'Ashley',
          sheet_id: person.sheet_id,
          cycle_tag: item.cycle_tag,
          date: item.date,
          shop_source: item.shop_source,
          final_price: item.amount,
          back_source: item.back_source,
          is_installment: item.is_installment,
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
