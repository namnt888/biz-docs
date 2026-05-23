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

const txIds = [
  '2c03cebe-3611-4d31-9ced-7827ba6e56dd', // Techcombank Everyday
  '215f881a-fa5f-47bc-b2c6-ad51fe3ee4de', // Vpbank
  '492e4b4b-dd5e-46c2-891b-41779eb1a2dd'  // Jcb Ultimate
];

async function main() {
  for (const id of txIds) {
    const { data: txn, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !txn) {
      console.error(`Error fetching transaction ${id}:`, error?.message);
      continue;
    }

    console.log(`Processing cashback for: ${txn.note} (${txn.amount} VND)`);
    
    // Check if cashback entry already exists to avoid duplicates
    const { data: existingEntry } = await supabase
      .from('cashback_entries')
      .select('id')
      .eq('transaction_id', id)
      .maybeSingle();

    if (existingEntry) {
      console.log(`  Cashback entry already exists for transaction ${id}. Skipping.`);
      continue;
    }

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
      note: txn.note
    };

    await cashbackService.processTransactionCashback(payload);
  }
  console.log('Done!');
}

main().catch(console.error);
