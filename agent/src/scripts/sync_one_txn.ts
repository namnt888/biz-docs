import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

const txnId = '212e9d3e-bc8f-4559-be14-5a8020c35390';
const webhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/JIfwZP5txIaEsyvZ/webhook/supabase-multi-webhook';

async function main() {
  console.log(`Fetching transaction ${txnId} from DB...`);
  const { data: txn, error } = await supabase
    .from('transactions')
    .select('*, people(sheet_id, name)')
    .eq('id', txnId)
    .single();

  if (error || !txn) {
    console.error('❌ Failed to fetch transaction:', error?.message);
    process.exit(1);
  }

  const payload = {
    table: 'transactions',
    record: {
      id: txn.id,
      occurred_at: txn.occurred_at,
      type: txn.type,
      type_display: txn.type === 'expense' ? 'Out' : 'In',
      amount: txn.amount,
      cashback_share_percent: txn.cashback_share_percent ? Number(txn.cashback_share_percent) : null,
      cashback_share_fixed: txn.cashback_share_fixed ? Number(txn.cashback_share_fixed) : null,
      note: txn.note,
      metadata: {
        ...txn.metadata,
        person_name: txn.people?.name || 'Tuấn',
        sheet_id: txn.people?.sheet_id
      }
    }
  };

  console.log('Sending payload:', JSON.stringify(payload, null, 2));
  console.log(`Sending webhook to: ${webhookUrl}`);

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (response.ok) {
    console.log(`✅ Webhook response OK: ${response.status}`);
    const { error: updErr } = await supabase
      .from('transactions')
      .update({ synced_at: new Date().toISOString() })
      .eq('id', txn.id);

    if (updErr) {
      console.error(`❌ Failed to update synced_at in DB:`, updErr.message);
    } else {
      console.log(`✅ synced`);
    }
  } else {
    console.error(`❌ Webhook response error status: ${response.status}`);
  }
}

main().catch(console.error);
