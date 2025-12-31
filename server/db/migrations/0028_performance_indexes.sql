-- US-18.1.3: Performance Optimization Indexes
-- These composite indexes optimize common query patterns for <100ms response

-- Work Orders - composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS work_orders_org_status_archived_idx
  ON work_orders (organisation_id, status, is_archived);

CREATE INDEX CONCURRENTLY IF NOT EXISTS work_orders_org_assignee_status_idx
  ON work_orders (organisation_id, assigned_to_id, status)
  WHERE is_archived = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS work_orders_org_asset_status_idx
  ON work_orders (organisation_id, asset_id, status)
  WHERE is_archived = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS work_orders_due_date_status_idx
  ON work_orders (due_date, status)
  WHERE is_archived = false AND due_date IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS work_orders_org_created_at_idx
  ON work_orders (organisation_id, created_at DESC)
  WHERE is_archived = false;

-- Assets - composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS assets_org_archived_status_idx
  ON assets (organisation_id, is_archived, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS assets_org_location_updated_idx
  ON assets (organisation_id, last_location_update DESC)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Inspections - composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS inspections_org_status_started_idx
  ON inspections (organisation_id, status, started_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS inspections_asset_started_idx
  ON inspections (asset_id, started_at DESC);

-- Fuel Transactions - composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS fuel_transactions_org_transaction_date_idx
  ON fuel_transactions (organisation_id, transaction_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS fuel_transactions_asset_transaction_date_idx
  ON fuel_transactions (asset_id, transaction_date DESC);

-- Parts - additional indexes for inventory queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS parts_org_active_category_idx
  ON parts (organisation_id, is_active, category_id)
  WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS parts_low_stock_idx
  ON parts (organisation_id, quantity_in_stock, reorder_threshold)
  WHERE is_active = true AND reorder_threshold IS NOT NULL;

-- Notifications - for fast unread count queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_user_unread_created_idx
  ON notifications (user_id, created_at DESC)
  WHERE is_read = false;

-- Defects - composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS defects_org_status_created_idx
  ON defects (organisation_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS defects_asset_created_idx
  ON defects (asset_id, created_at DESC);

-- Custom form submissions - for form analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS custom_form_submissions_form_submitted_idx
  ON custom_form_submissions (form_id, submitted_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS custom_form_submissions_org_submitted_idx
  ON custom_form_submissions (organisation_id, submitted_at DESC);
