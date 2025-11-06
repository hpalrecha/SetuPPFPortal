-- Performance Optimization Indexes
-- Created: 2025-11-06
-- Purpose: Add indexes to improve query performance for dashboard and list pages

-- Work Orders Indexes
CREATE INDEX IF NOT EXISTS idx_work_orders_oem_id ON work_orders(oem_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_dealership_id ON work_orders(dealership_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_showroom_id ON work_orders(showroom_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_created_at ON work_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_partner_id ON work_orders(assigned_partner_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_sales_person_id ON work_orders(sales_person_id);

-- Composite index for common query patterns (OEM + dealership + showroom filtering)
CREATE INDEX IF NOT EXISTS idx_work_orders_composite ON work_orders(oem_id, dealership_id, showroom_id, created_at DESC);

-- Job Cards Indexes
CREATE INDEX IF NOT EXISTS idx_job_cards_work_order_id ON job_cards(work_order_id);
CREATE INDEX IF NOT EXISTS idx_job_cards_partner_id ON job_cards(partner_id);
CREATE INDEX IF NOT EXISTS idx_job_cards_status ON job_cards(status);
CREATE INDEX IF NOT EXISTS idx_job_cards_completed_at ON job_cards(completed_at);
CREATE INDEX IF NOT EXISTS idx_job_cards_started_at ON job_cards(started_at);
CREATE INDEX IF NOT EXISTS idx_job_cards_created_at ON job_cards(created_at);

-- Composite index for common query patterns (JOIN + status filtering)
CREATE INDEX IF NOT EXISTS idx_job_cards_composite ON job_cards(work_order_id, status, completed_at DESC);

-- Payouts Indexes
CREATE INDEX IF NOT EXISTS idx_payouts_job_card_id ON payouts(job_card_id);
CREATE INDEX IF NOT EXISTS idx_payouts_partner_id ON payouts(partner_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON payouts(created_at);

-- Commissions Indexes (for sales commission settlement)
CREATE INDEX IF NOT EXISTS idx_commissions_work_order_id ON commissions(work_order_id);
CREATE INDEX IF NOT EXISTS idx_commissions_sales_person_id ON commissions(sales_person_id);
CREATE INDEX IF NOT EXISTS idx_commissions_showroom_id ON commissions(showroom_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);

-- OEM Royalty Calculations Indexes
CREATE INDEX IF NOT EXISTS idx_oem_royalty_calcs_oem_id ON oem_royalty_calculations(oem_id);
CREATE INDEX IF NOT EXISTS idx_oem_royalty_calcs_work_order_id ON oem_royalty_calculations(work_order_id);
CREATE INDEX IF NOT EXISTS idx_oem_royalty_calcs_calculated_at ON oem_royalty_calculations(calculated_at);

-- Additional indexes for better JOIN performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_oem_id ON users(oem_id);
CREATE INDEX IF NOT EXISTS idx_users_dealership_id ON users(dealership_id);
CREATE INDEX IF NOT EXISTS idx_users_showroom_id ON users(showroom_id);
CREATE INDEX IF NOT EXISTS idx_users_partner_id ON users(partner_id);
