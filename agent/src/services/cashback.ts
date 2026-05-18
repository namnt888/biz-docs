import { SupabaseClient } from '@supabase/supabase-js';

export interface TransactionPayload {
  id: string;
  account_id: string;
  amount: number;
  type: string;
  occurred_at: string;
  cashback_mode?: string;
  cashback_share_percent?: number;
  cashback_share_fixed?: number;
  person_id?: string;
  note?: string;
}

export class CashbackService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Determine cycle tag (YYYY-MM) and date boundaries based on account config
   */
  public getCycleTagAndRange(dateStr: string, statementDay: number = 0) {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-12

    if (!statementDay || statementDay === 0) {
      // Calendar month
      const tag = `${year}-${String(month).padStart(2, '0')}`;
      return { tag, type: 'calendar_month' };
    }

    // Statement cycle
    // If statement_day is 25: 25/04 -> 24/05 is cycle 2026-05
    const day = d.getDate();
    let cycleYear = year;
    let cycleMonth = month;

    if (day >= statementDay) {
      // It belongs to the next month's statement cycle
      cycleMonth += 1;
      if (cycleMonth > 12) {
        cycleMonth = 1;
        cycleYear += 1;
      }
    }

    const tag = `${cycleYear}-${String(cycleMonth).padStart(2, '0')}`;
    return { tag, type: 'statement_cycle' };
  }

  /**
   * Process cashback for a newly inserted transaction
   */
  public async processTransactionCashback(txn: TransactionPayload) {
    if (!['expense', 'service', 'debt', 'cashback'].includes(txn.type)) {
      return; // Only these types affect cashback
    }

    // 1. Get Account Config
    const { data: account } = await this.supabase
      .from('accounts')
      .select('id, type')
      .eq('id', txn.account_id)
      .single();

    if (!account) return;

    // We fetch existing cycle or create one
    // First, let's see if we have cashback config in metadata or defaults
    const statementDay = 0; // Default calendar month
    const cbMinSpend = 3000000; // Default 3M VND min spend
    const cbMaxBudget = 500000; // Default 500k VND max budget
    const defaultRate = 0.01; // Default 1% cashback rate

    const { tag, type } = this.getCycleTagAndRange(txn.occurred_at, statementDay);

    // Ensure cycle exists
    let { data: cycle } = await this.supabase
      .from('cashback_cycles')
      .select('*')
      .eq('account_id', txn.account_id)
      .eq('cycle_tag', tag)
      .single();

    if (!cycle) {
      const { data: newCycle, error } = await this.supabase
        .from('cashback_cycles')
        .insert({
          account_id: txn.account_id,
          cycle_tag: tag,
          cycle_type: type,
          statement_day: statementDay,
          cb_min_spend: cbMinSpend,
          cb_max_budget: cbMaxBudget,
          spent_amount: 0,
          real_awarded: 0,
          virtual_profit: 0,
        })
        .select()
        .single();
      
      if (error || !newCycle) {
        console.error('Error creating cashback cycle:', error?.message);
        return;
      }
      cycle = newCycle;
    }

    // 2. Calculate cashback entry based on mode
    const mode = txn.cashback_mode || 'none_back';
    let virtualAmount = 0;
    let realAmount = 0;
    let countsToBudget = true;

    if (txn.type === 'cashback') {
      realAmount = txn.amount;
    } else if (mode === 'none_back') {
      virtualAmount = Math.round(txn.amount * defaultRate);
    } else if (mode === 'percent') {
      const sharePercent = txn.cashback_share_percent || 0.5;
      virtualAmount = Math.round(txn.amount * defaultRate * sharePercent);
    } else if (mode === 'fixed') {
      virtualAmount = txn.cashback_share_fixed || 0;
    } else if (mode === 'real_fixed') {
      realAmount = txn.cashback_share_fixed || 0;
    } else if (mode === 'real_percent') {
      const sharePercent = txn.cashback_share_percent || 0.01;
      realAmount = Math.round(txn.amount * sharePercent);
    } else if (mode === 'voluntary') {
      countsToBudget = false;
      virtualAmount = txn.cashback_share_fixed || Math.round(txn.amount * defaultRate);
    }

    const entryAmount = Math.max(virtualAmount, realAmount);
    const entryMode = realAmount > 0 ? 'real' : (mode === 'voluntary' ? 'voluntary' : 'virtual');

    if (entryAmount > 0) {
      await this.supabase.from('cashback_entries').insert({
        cycle_id: cycle.id,
        transaction_id: txn.id,
        mode: entryMode,
        amount: entryAmount,
        counts_to_budget: countsToBudget,
        metadata: { note: txn.note },
      });
    }

    // 3. Update Cycle Rollups
    const newSpent = txn.type === 'expense' || txn.type === 'service' ? Number(cycle.spent_amount) + txn.amount : Number(cycle.spent_amount);
    const newVirtual = Number(cycle.virtual_profit) + virtualAmount;
    const newReal = Number(cycle.real_awarded) + realAmount;

    await this.supabase
      .from('cashback_cycles')
      .update({
        spent_amount: newSpent,
        virtual_profit: newVirtual,
        real_awarded: newReal,
      })
      .eq('id', cycle.id);

    console.log(`✅ Cashback Cycle (${tag}) updated: Spent ${newSpent.toLocaleString()} VND, Virtual: ${newVirtual.toLocaleString()} VND, Real: ${newReal.toLocaleString()} VND`);
  }
}
