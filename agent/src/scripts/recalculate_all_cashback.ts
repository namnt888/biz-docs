import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { CashbackService } from '../services/cashback';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

const cashbackService = new CashbackService(supabase);

async function main() {
  console.log('Fetching all transactions that affect cashback...');
  const { data: txns, error } = await supabase
    .from('transactions')
    .select('*')
    .in('type', ['expense', 'service', 'debt', 'cashback'])
    .order('occurred_at', { ascending: true });

  if (error || !txns) {
    console.error('Error fetching transactions:', error?.message);
    process.exit(1);
  }

  console.log(`Found ${txns.length} transactions. Processing...`);

  for (const txn of txns) {
    console.log(`Processing: "${txn.note}" | Mode: ${txn.cashback_mode} | Amt: ${txn.amount} | Date: ${txn.occurred_at}`);
    
    // Resolve cycle tag from metadata if available, otherwise let the service calculate it
    const cycleTag = txn.metadata?.cycle_tag || txn.metadata?.statement_cycle_tag || txn.metadata?.debt_cycle_tag;

    const payload = {
      id: txn.id,
      account_id: txn.account_id,
      amount: txn.amount,
      type: txn.type,
      occurred_at: txn.occurred_at,
      cashback_mode: txn.cashback_mode,
      cashback_share_percent: txn.cashback_share_percent ? Number(txn.cashback_share_percent) : undefined,
      cashback_share_fixed: txn.cashback_share_fixed ? Number(txn.cashback_share_fixed) : undefined,
      person_id: txn.person_id,
      note: txn.note,
      cycle_tag: cycleTag
    };

    await cashbackService.processTransactionCashback(payload);
  }

  console.log('Recalculation complete!');
}

main().catch(console.error);
