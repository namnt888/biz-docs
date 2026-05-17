-- Seed 2 tài khoản quan trọng của người dùng (Tpbank & Msb Online)
-- Chạy đoạn SQL này trong mục SQL Editor trên Supabase Cloud

INSERT INTO public.accounts (id, name, type, status, currency, initial_balance, current_balance, icon, color, is_default)
VALUES 
('918bn7qgqsrray1', 'Tpbank', 'bank', 'active', 'VND', 54342967, 54342967, 'https://play-lh.googleusercontent.com/65K0CCfxy_8kga51gCci4NxMZXv6qmDvvb3GhwG-tRzd9dZ8a_EsuX54DIJeWk18hgO9qD1pm1IawyvDgWWruw', '#6200EE', true)
ON CONFLICT (id) DO UPDATE SET current_balance = EXCLUDED.current_balance;

INSERT INTO public.accounts (id, name, type, status, currency, initial_balance, current_balance, icon, color, is_default)
VALUES 
('qvhxj1tg36fl485', 'Msb Online', 'credit_card', 'active', 'VND', 11165750, 11165750, 'https://res.cloudinary.com/dpnrln3ug/image/upload/v1764834568/Th%E1%BA%BB_MSB_Visa_Online_epovcz.jpg', '#FF5722', false)
ON CONFLICT (id) DO UPDATE SET current_balance = EXCLUDED.current_balance;

-- Khởi tạo chu kỳ hoàn tiền (Cashback Cycle) cho Msb Online tháng 05/2026
INSERT INTO public.cashback_cycles (account_id, cycle_tag, cycle_type, statement_day, cb_min_spend, cb_max_budget, spent_amount, real_awarded, virtual_profit, status)
VALUES 
('qvhxj1tg36fl485', '2026-05', 'statement_cycle', 26, 3000000, 300000, 0, 0, 0, 'active')
ON CONFLICT (account_id, cycle_tag) DO UPDATE SET cb_min_spend = EXCLUDED.cb_min_spend, cb_max_budget = EXCLUDED.cb_max_budget;
