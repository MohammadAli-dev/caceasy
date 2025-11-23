-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- OTP table for authentication
CREATE TABLE IF NOT EXISTS otps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(20) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Batches table (for coupon generation batches)
CREATE TABLE IF NOT EXISTS batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(255) NOT NULL,
  points_per_coupon INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Coupons table
CREATE TABLE IF NOT EXISTS coupons (
  token VARCHAR(255) PRIMARY KEY,
  batch_id UUID REFERENCES batches(id),
  status VARCHAR(50) NOT NULL DEFAULT 'issued', -- issued, redeemed
  points INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  redeemed_at TIMESTAMP WITH TIME ZONE
);

-- Scans table (log of scan attempts)
CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token VARCHAR(255) REFERENCES coupons(token),
  user_id UUID REFERENCES users(id),
  device_id VARCHAR(255),
  gps JSONB,
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN DEFAULT false,
  error_message TEXT
);

-- Transactions table (ledger of points)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  amount INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL, -- redemption, payout, adjustment
  reference_id UUID, -- e.g., scan_id
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payouts table
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  amount INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  account_details JSONB,
  reference VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_token ON scans(token);
CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);

-- Flagged events table (Module 3: Admin Dashboard)
CREATE TABLE IF NOT EXISTS flagged_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_id UUID REFERENCES scans(id),
  user_id UUID REFERENCES users(id),
  device_id VARCHAR(255),
  batch_id UUID REFERENCES batches(id),
  risk_score INTEGER,
  reason TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_by VARCHAR(255),
  resolved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_flagged_events_status ON flagged_events(status);
CREATE INDEX IF NOT EXISTS idx_flagged_events_user_id ON flagged_events(user_id);
CREATE INDEX IF NOT EXISTS idx_flagged_events_created_at ON flagged_events(created_at DESC);

-- Admin audit log table (Module 3: Admin Dashboard)
CREATE TABLE IF NOT EXISTS admin_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_identifier VARCHAR(255) NOT NULL,
  action VARCHAR(255) NOT NULL,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON admin_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_identifier ON admin_audit(admin_identifier);

-- Module 4: Dealer / Proxy Scanning

-- Dealers table
CREATE TABLE IF NOT EXISTS dealers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  gst VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Dealer Transactions table
CREATE TABLE IF NOT EXISTS dealer_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID REFERENCES dealers(id),
  type VARCHAR(50) NOT NULL CHECK (type IN ('credit', 'debit', 'reimbursement_request', 'payout')),
  amount INTEGER NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add dealer_id to transactions and scans
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS dealer_id UUID REFERENCES dealers(id);
ALTER TABLE scans ADD COLUMN IF NOT EXISTS dealer_id UUID REFERENCES dealers(id);

-- Indexes for dealer tables
CREATE INDEX IF NOT EXISTS idx_dealer_transactions_dealer_id ON dealer_transactions(dealer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_dealer_id ON transactions(dealer_id);
CREATE INDEX IF NOT EXISTS idx_scans_dealer_id ON scans(dealer_id);

-- Seed sample dealer
INSERT INTO dealers (id, name, phone, gst) 
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Sample Dealer', '+15550001111', 'GST12345')
ON CONFLICT (phone) DO NOTHING;


-- Note: Payouts table currently references users(id). We might need to make user_id nullable or add dealer_id to payouts if we want to track dealer payouts explicitly in the same table.
-- The instructions say: "Create a payout record in `payouts` table with type='dealer' and status='pending'".
-- Let's check the payouts table definition again. It has `user_id UUID REFERENCES users(id)`.
-- If we want to store dealer payouts here, we need to make `user_id` nullable or add `dealer_id`.
-- The instructions say: "Add table `dealers`... Add table `dealer_transactions`... Add column `dealer_id` (nullable) to `transactions`".
-- It doesn't explicitly say to change `payouts` table structure, but it says "Create a payout record in `payouts` table with type='dealer'".
-- `payouts` table doesn't have a `type` column currently. It has `status`.
-- Let's add `type` and `dealer_id` to `payouts` table as well to support this requirement.

ALTER TABLE payouts ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'user'; -- 'user' or 'dealer'
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS dealer_id UUID REFERENCES dealers(id);
ALTER TABLE payouts ALTER COLUMN user_id DROP NOT NULL;

-- Now insert the sample dealer payout correctly
INSERT INTO payouts (id, dealer_id, amount, status, type, reference, created_at)
VALUES ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 5000, 'pending', 'dealer', 'Sample Dealer Payout', NOW())
ON CONFLICT (id) DO NOTHING;

-- Module 5: Analytics Engine + BI Layer

-- Analytics daily aggregation table
CREATE TABLE IF NOT EXISTS analytics_daily (
  date DATE PRIMARY KEY,
  scans INTEGER NOT NULL DEFAULT 0,
  active_masons INTEGER NOT NULL DEFAULT 0,
  redemptions INTEGER NOT NULL DEFAULT 0,
  redemption_rate FLOAT NOT NULL DEFAULT 0.0,
  top_regions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily(date DESC);

-- Seed sample analytics data for last 7 days
INSERT INTO analytics_daily (date, scans, active_masons, redemptions, redemption_rate, top_regions, created_at)
VALUES 
  (CURRENT_DATE - INTERVAL '6 days', 120, 45, 95, 0.792, '[{"region":"North","count":35},{"region":"South","count":28},{"region":"East","count":30},{"region":"West","count":27}]'::jsonb, NOW() - INTERVAL '6 days'),
  (CURRENT_DATE - INTERVAL '5 days', 135, 52, 108, 0.800, '[{"region":"North","count":40},{"region":"South","count":32},{"region":"East","count":35},{"region":"West","count":28}]'::jsonb, NOW() - INTERVAL '5 days'),
  (CURRENT_DATE - INTERVAL '4 days', 142, 58, 115, 0.810, '[{"region":"North","count":42},{"region":"South","count":35},{"region":"East","count":38},{"region":"West","count":27}]'::jsonb, NOW() - INTERVAL '4 days'),
  (CURRENT_DATE - INTERVAL '3 days', 128, 50, 102, 0.797, '[{"region":"North","count":38},{"region":"South","count":30},{"region":"East","count":32},{"region":"West","count":28}]'::jsonb, NOW() - INTERVAL '3 days'),
  (CURRENT_DATE - INTERVAL '2 days', 155, 62, 125, 0.806, '[{"region":"North","count":45},{"region":"South","count":38},{"region":"East","count":42},{"region":"West","count":30}]'::jsonb, NOW() - INTERVAL '2 days'),
  (CURRENT_DATE - INTERVAL '1 day', 148, 60, 120, 0.811, '[{"region":"North","count":43},{"region":"South","count":36},{"region":"East","count":40},{"region":"West","count":29}]'::jsonb, NOW() - INTERVAL '1 day'),
  (CURRENT_DATE, 165, 68, 135, 0.818, '[{"region":"North","count":48},{"region":"South","count":40},{"region":"East","count":45},{"region":"West","count":32}]'::jsonb, NOW())
ON CONFLICT (date) DO NOTHING;
