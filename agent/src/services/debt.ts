import { SupabaseClient } from '@supabase/supabase-js';
import { TransactionPayload } from './cashback';

export class DebtService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Process debt creation or FIFO repayment allocation
   */
  public async processTransactionDebt(txn: TransactionPayload) {
    if (!txn.person_id) {
      if (txn.type === 'debt' || txn.type === 'repayment') {
        console.warn(`Transaction '${txn.note}' is of type '${txn.type}' but missing person_id!`);
      }
      return;
    }

    if (txn.type === 'debt') {
      // Create a new debt record
      const role = txn.note?.toLowerCase().includes('mượn') && txn.note?.toLowerCase().includes('của') ? 'borrowed' : 'lent';
      
      const { error } = await this.supabase.from('debts').insert({
        occurred_at: txn.occurred_at,
        person_id: txn.person_id,
        account_id: txn.account_id,
        original_transaction_id: txn.id,
        debt_role: role,
        original_amount: txn.amount,
        repaid_amount: 0,
        remaining_amount: txn.amount,
        status: 'pending',
        notes: txn.note,
      });

      if (error) {
        console.error('Error creating debt record:', error.message);
      } else {
        console.log(`✅ Created Debt Record for person (${txn.person_id}): ${txn.amount.toLocaleString()} VND (${role})`);
      }
      return;
    }

    if (txn.type === 'repayment') {
      // FIFO Repayment Allocation
      console.log(`Executing FIFO repayment allocation for person (${txn.person_id}), amount: ${txn.amount.toLocaleString()} VND`);

      // Find pending/partial debts for this person ordered by oldest first
      const { data: debts } = await this.supabase
        .from('debts')
        .select('*')
        .eq('person_id', txn.person_id)
        .in('status', ['pending', 'partial'])
        .order('occurred_at', { ascending: true });

      if (!debts || debts.length === 0) {
        console.log(`No outstanding debts found for person (${txn.person_id}). Marking as overpayment/unallocated.`);
        return;
      }

      let remainingRepayment = txn.amount;

      for (const debt of debts) {
        if (remainingRepayment <= 0) break;

        const currentRemaining = Number(debt.remaining_amount);
        const amountToAllocate = Math.min(remainingRepayment, currentRemaining);

        const newRepaid = Number(debt.repaid_amount) + amountToAllocate;
        const newRemaining = currentRemaining - amountToAllocate;
        const newStatus = newRemaining <= 0 ? 'settled' : 'partial';

        await this.supabase
          .from('debts')
          .update({
            repaid_amount: newRepaid,
            remaining_amount: newRemaining,
            status: newStatus,
          })
          .eq('id', debt.id);

        remainingRepayment -= amountToAllocate;
        console.log(`Allocated ${amountToAllocate.toLocaleString()} VND to debt (${debt.notes || debt.id}). Remaining on debt: ${newRemaining.toLocaleString()} VND [${newStatus}]`);
      }

      if (remainingRepayment > 0) {
        console.log(`Overpayment of ${remainingRepayment.toLocaleString()} VND detected after clearing all debts!`);
      }
    }
  }
}
