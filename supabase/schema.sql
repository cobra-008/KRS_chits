-- =============================================================
-- K R S SILVERS — Supabase PostgreSQL Schema
-- Run this in your Supabase SQL Editor
-- =============================================================

-- ─────────────────────────────────────────
-- CUSTOMERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  phone       TEXT,
  whatsapp    TEXT,
  address     TEXT,
  city        TEXT,
  pincode     TEXT,
  id_proof    TEXT,
  photo_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- GROUPS (Silver Chit Schemes)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,          -- e.g. "Date 5", "Date 10"
  draw_day            INTEGER,                -- day of month: 5, 10, 15, 20
  num_months          INTEGER NOT NULL,       -- total scheme duration
  unit_limit_g        NUMERIC(10,3) NOT NULL, -- per-month limit in grams (1000 or 1500)
  months_happened     INTEGER DEFAULT 0,      -- months elapsed so far
  company_profit_pct  NUMERIC(5,2) DEFAULT 4.00,
  start_date          DATE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- GROUP MEMBERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID REFERENCES groups(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE,
  ticket_no       INTEGER,                  -- seat number in scheme
  share_pct       NUMERIC(6,2) DEFAULT 100, -- 50%, 100%, 150%, 200%
  joining_month   INTEGER DEFAULT 1,        -- month they joined (for late joiners)
  joining_date    DATE DEFAULT CURRENT_DATE,
  fine_deposited  NUMERIC(12,3) DEFAULT 0,  -- total fine silver paid (g)
  fine_disbursed  NUMERIC(12,3) DEFAULT 0,  -- chit silver received (g)
  is_withdrawn    BOOLEAN DEFAULT FALSE,    -- has taken the chit
  withdrawal_month INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, customer_id),
  UNIQUE(group_id, ticket_no)
);

-- ─────────────────────────────────────────
-- VOUCHER SEQUENCE (auto-incrementing number)
-- ─────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS voucher_number_seq START 1;

-- ─────────────────────────────────────────
-- VOUCHERS (Receipt & Issue)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vouchers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_no      INTEGER UNIQUE DEFAULT nextval('voucher_number_seq'),
  type            TEXT CHECK(type IN ('receipt','issue')) NOT NULL,
  customer_id     UUID REFERENCES customers(id),
  voucher_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  total_weight_g  NUMERIC(12,3) DEFAULT 0,
  total_pure_g    NUMERIC(12,3) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- VOUCHER LOTS (line items)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voucher_lots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id  UUID REFERENCES vouchers(id) ON DELETE CASCADE,
  lot_no      INTEGER NOT NULL,
  silver_type TEXT DEFAULT 'K',         -- 'K' = Katcha, 'P' = Patla, 'B' = Bar
  patla_no    TEXT,                     -- physical bar/kacha identifier
  weight_g    NUMERIC(12,3) NOT NULL,
  tunch_pct   NUMERIC(6,3) NOT NULL,    -- purity %
  raw_fine_g  NUMERIC(12,3),            -- weight × tunch/100 (raw)
  pure_g      NUMERIC(12,3)             -- after custom rounding
);

-- ─────────────────────────────────────────
-- INVENTORY (Physical kachas in vault)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patla_no          TEXT NOT NULL,
  silver_type       TEXT DEFAULT 'K',   -- 'K', 'P', 'B'
  source_name       TEXT DEFAULT 'Direct',
  description       TEXT,
  weight_g          NUMERIC(12,3) NOT NULL,
  tunch_pct         NUMERIC(6,3) NOT NULL,
  pure_g            NUMERIC(12,3) NOT NULL,
  status            TEXT DEFAULT 'in_stock' CHECK(status IN ('in_stock','issued')),
  source_voucher_id UUID REFERENCES vouchers(id),
  issued_voucher_id UUID REFERENCES vouchers(id),
  added_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- CHIT DRAWS (Monthly settlements)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chit_draws (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id              UUID REFERENCES groups(id) ON DELETE CASCADE,
  month_no              INTEGER NOT NULL,
  draw_date             DATE NOT NULL,
  withdrawer_member_id  UUID REFERENCES group_members(id),
  
  -- Calculation fields (all in grams)
  total_capacity_g      NUMERIC(12,3),    -- e.g. 20000 (20 kg)
  discount_g            NUMERIC(12,3) DEFAULT 0,   -- discount accepted by withdrawer
  company_profit_g      NUMERIC(12,3) DEFAULT 0,   -- 4% of capacity
  net_dividend_pool_g   NUMERIC(12,3) DEFAULT 0,   -- discount - company_profit
  dividend_per_member_g NUMERIC(12,3) DEFAULT 0,   -- pool / num_members
  monthly_premium_g     NUMERIC(12,3) DEFAULT 0,   -- unit_limit - dividend
  old_dues_g            NUMERIC(12,3) DEFAULT 0,   -- previous balance deducted
  net_silver_to_issue_g NUMERIC(12,3) DEFAULT 0,   -- amount to give withdrawer
  delivery_status       TEXT DEFAULT 'hold_excess', -- 'hold_excess' or 'physical'
  withdrawer_share_pct  NUMERIC(6,2) DEFAULT 100,

  issue_voucher_id      UUID REFERENCES vouchers(id),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TRANSACTION LOG (Day Book)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transaction_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  type          TEXT NOT NULL,          -- 'receipt', 'issue', 'chit_settlement', 'chit_demand'
  ref_id        UUID,                   -- voucher_id or chit_draw_id
  ref_type      TEXT,                   -- 'voucher' or 'chit_draw'
  customer_id   UUID REFERENCES customers(id),
  customer_name TEXT,
  voucher_ref   TEXT,                   -- display ref e.g. "RV-001"
  description   TEXT,
  pure_in_g     NUMERIC(12,3) DEFAULT 0,
  pure_out_g    NUMERIC(12,3) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- ENABLE ROW LEVEL SECURITY (open for now — add auth later)
-- ─────────────────────────────────────────
ALTER TABLE customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_lots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chit_draws      ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_log ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anonymous (no-auth mode). 
-- Replace with proper auth policies before production.
CREATE POLICY "allow_all_customers"       ON customers       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_groups"          ON groups          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_group_members"   ON group_members   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_vouchers"        ON vouchers        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_voucher_lots"    ON voucher_lots    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_inventory"       ON inventory       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_chit_draws"      ON chit_draws      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_transaction_log" ON transaction_log FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────
-- INDEXES for performance
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_group_members_group    ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_customer ON group_members(customer_id);
CREATE INDEX IF NOT EXISTS idx_voucher_lots_voucher   ON voucher_lots(voucher_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status       ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_chit_draws_group       ON chit_draws(group_id);
CREATE INDEX IF NOT EXISTS idx_txn_log_date           ON transaction_log(log_date);
CREATE INDEX IF NOT EXISTS idx_txn_log_customer       ON transaction_log(customer_id);
