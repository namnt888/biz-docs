-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE account_type AS ENUM ('bank', 'wallet', 'cash', 'credit_card', 'investment');
CREATE TYPE account_status AS ENUM ('active', 'inactive', 'archived');
CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer_in', 'transfer_out', 'cashback', 'refund', 'debt', 'repayment', 'service');
CREATE TYPE transaction_status AS ENUM ('posted', 'pending', 'void');
CREATE TYPE debt_role AS ENUM ('lent', 'borrowed');
CREATE TYPE debt_status AS ENUM ('pending', 'partial', 'settled', 'cancelled');
CREATE TYPE cashback_cycle_type AS ENUM ('calendar_month', 'statement_cycle');
CREATE TYPE cycle_status AS ENUM ('active', 'closed', 'settled');
CREATE TYPE cashback_mode AS ENUM ('none_back', 'percent', 'fixed', 'real_fixed', 'real_percent', 'voluntary');

-- 1. Accounts Table
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type account_type NOT NULL,
    status account_status NOT NULL DEFAULT 'active',
    currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    initial_balance BIGINT NOT NULL DEFAULT 0,
    current_balance BIGINT NOT NULL DEFAULT 0,
    icon VARCHAR(255),
    color VARCHAR(50),
    is_default BOOLEAN NOT NULL DEFAULT false,
    owner VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Business Categories Table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) UNIQUE NOT NULL,
    name_vi VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES categories(id),
    level INTEGER NOT NULL DEFAULT 1,
    affects_cashback BOOLEAN NOT NULL DEFAULT true,
    kind VARCHAR(50) DEFAULT 'standard',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. People Table (Danh bạ tài chính)
CREATE TABLE people (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    nickname VARCHAR(100),
    phone VARCHAR(20),
    avatar VARCHAR(500),
    note TEXT,
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Transactions Table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    type transaction_type NOT NULL,
    status transaction_status NOT NULL DEFAULT 'posted',
    amount BIGINT NOT NULL CHECK (amount >= 0),
    account_id UUID NOT NULL REFERENCES accounts(id),
    destination_account_id UUID REFERENCES accounts(id), -- For transfer_out
    category_id UUID REFERENCES categories(id),
    person_id UUID REFERENCES people(id),
    note TEXT,
    
    -- Cashback properties
    persisted_cycle_tag VARCHAR(20),
    cashback_mode cashback_mode DEFAULT 'none_back',
    cashback_share_percent DECIMAL(5,4),
    cashback_share_fixed BIGINT,
    
    is_installment BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Debts Table
CREATE TABLE debts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    person_id UUID NOT NULL REFERENCES people(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    original_transaction_id UUID REFERENCES transactions(id),
    debt_role debt_role NOT NULL,
    original_amount BIGINT NOT NULL CHECK (original_amount > 0),
    repaid_amount BIGINT NOT NULL DEFAULT 0,
    remaining_amount BIGINT NOT NULL,
    status debt_status NOT NULL DEFAULT 'pending',
    due_date DATE,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Cashback Cycles Table
CREATE TABLE cashback_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    cycle_tag VARCHAR(20) NOT NULL,
    cycle_type cashback_cycle_type NOT NULL DEFAULT 'calendar_month',
    statement_day INTEGER DEFAULT 0,
    cb_min_spend BIGINT DEFAULT 0,
    cb_max_budget BIGINT,
    spent_amount BIGINT NOT NULL DEFAULT 0,
    real_awarded BIGINT NOT NULL DEFAULT 0,
    virtual_profit BIGINT NOT NULL DEFAULT 0,
    status cycle_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, cycle_tag)
);

-- 7. Cashback Entries Table
CREATE TABLE cashback_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_id UUID NOT NULL REFERENCES cashback_cycles(id),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    mode VARCHAR(50) NOT NULL, -- real, virtual, voluntary
    amount BIGINT NOT NULL,
    counts_to_budget BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Database Triggers for Auto-updating Updated_At
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_people_updated_at BEFORE UPDATE ON people FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_debts_updated_at BEFORE UPDATE ON debts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_cashback_cycles_updated_at BEFORE UPDATE ON cashback_cycles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Database Trigger for Balance Calculation
-- Calculates the current balance of an account based on posted transactions
CREATE OR REPLACE FUNCTION calculate_account_balance()
RETURNS TRIGGER AS $$
DECLARE
    new_balance BIGINT;
    v_account_id UUID;
BEGIN
    -- Determine which account to update
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        v_account_id := NEW.account_id;
    ELSIF TG_OP = 'DELETE' THEN
        v_account_id := OLD.account_id;
    END IF;

    -- Calculate balance
    SELECT 
        a.initial_balance + COALESCE(SUM(
            CASE 
                WHEN t.status != 'posted' THEN 0
                WHEN t.type IN ('income', 'transfer_in', 'cashback', 'refund', 'repayment') THEN t.amount
                WHEN t.type IN ('expense', 'transfer_out', 'debt', 'service') THEN -t.amount
                ELSE 0
            END
        ), 0) INTO new_balance
    FROM accounts a
    LEFT JOIN transactions t ON t.account_id = a.id
    WHERE a.id = v_account_id
    GROUP BY a.id, a.initial_balance;

    -- Update account
    UPDATE accounts SET current_balance = new_balance WHERE id = v_account_id;

    RETURN NULL; -- AFTER trigger, result is ignored
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_balance
AFTER INSERT OR UPDATE OF amount, status, type, account_id OR DELETE
ON transactions
FOR EACH ROW
EXECUTE PROCEDURE calculate_account_balance();

-- Trigger for remaining_amount in Debts
CREATE OR REPLACE FUNCTION calculate_debt_remaining_amount()
RETURNS TRIGGER AS $$
BEGIN
    NEW.remaining_amount = GREATEST(0, NEW.original_amount - NEW.repaid_amount);
    
    IF NEW.remaining_amount <= 0 THEN
        NEW.status = 'settled';
    ELSIF NEW.repaid_amount > 0 AND NEW.remaining_amount > 0 AND NEW.status = 'pending' THEN
        NEW.status = 'partial';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_debt_amounts
BEFORE INSERT OR UPDATE OF original_amount, repaid_amount
ON debts
FOR EACH ROW
EXECUTE PROCEDURE calculate_debt_remaining_amount();
