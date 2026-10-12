-- =============================================================
-- K R S SILVERS — Schema Migration v2
-- Run this in your Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- =============================================================

-- 1. Add share_pct to group_members (for 50%, 100%, 150%, 200% portions)
ALTER TABLE group_members 
ADD COLUMN IF NOT EXISTS share_pct NUMERIC(6,2) DEFAULT 100;

-- 2. Add silver_type to voucher_lots ('K' = Katcha, 'P' = Patla, 'B' = Bar)
ALTER TABLE voucher_lots 
ADD COLUMN IF NOT EXISTS silver_type TEXT DEFAULT 'K';

-- 3. Add silver_type and source_name to inventory
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS silver_type TEXT DEFAULT 'K';

ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS source_name TEXT DEFAULT 'Direct';

-- 4. Add delivery_status and withdrawer_share_pct to chit_draws
ALTER TABLE chit_draws 
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'hold_excess';

ALTER TABLE chit_draws 
ADD COLUMN IF NOT EXISTS withdrawer_share_pct NUMERIC(6,2) DEFAULT 100;

-- 5. Drop check constraints on transaction_log if present to allow flexible ledger types
ALTER TABLE transaction_log 
DROP CONSTRAINT IF EXISTS transaction_log_type_check;
