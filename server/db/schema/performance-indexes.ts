/**
 * US-18.1.3: Additional Performance Indexes
 *
 * This file defines composite indexes for frequently queried columns
 * to optimize database query performance to <100ms.
 *
 * These indexes complement the existing indexes in individual schema files.
 * Run `bun run db:generate` and `bun run db:migrate` to apply.
 */

// Note: These are composite/covering indexes that span multiple columns
// for common query patterns. They are defined here to avoid circular imports.

/**
 * Work Orders - Composite indexes for common query patterns
 *
 * Common queries:
 * - List by org + status + archived (most common)
 * - List by org + assignee + status
 * - List by org + asset + status
 * - Overdue work orders (due date + status)
 */
export const workOrderPerformanceIndexes = {
  // Covers: GET /api/work-orders with status filter
  orgStatusArchived: 'work_orders_org_status_archived_idx',
  // Covers: GET /api/work-orders with assignee filter
  orgAssigneeStatus: 'work_orders_org_assignee_status_idx',
  // Covers: GET /api/work-orders with asset filter
  orgAssetStatus: 'work_orders_org_asset_status_idx',
  // Covers: Overdue work orders query
  dueDateStatus: 'work_orders_due_date_status_idx',
  // Covers: Recent work orders (for dashboard)
  orgCreatedAt: 'work_orders_org_created_at_idx',
}

/**
 * Assets - Composite indexes for common query patterns
 *
 * Common queries:
 * - List by org + archived + status
 * - Search by asset number/VIN/license plate
 * - Location-based queries
 */
export const assetPerformanceIndexes = {
  // Covers: GET /api/assets with status filter
  orgArchivedStatus: 'assets_org_archived_status_idx',
  // Covers: Asset search queries
  orgAssetNumberSearch: 'assets_org_asset_number_search_idx',
  // Covers: Fleet map location queries
  orgLocationUpdated: 'assets_org_location_updated_idx',
}

/**
 * Inspections - Composite indexes
 */
export const inspectionPerformanceIndexes = {
  // Covers: GET /api/inspections with status filter
  orgStatusStarted: 'inspections_org_status_started_idx',
  // Covers: Asset inspection history
  assetStarted: 'inspections_asset_started_idx',
}

/**
 * Fuel Transactions - Composite indexes
 */
export const fuelTransactionPerformanceIndexes = {
  // Covers: GET /api/fuel with date range
  orgTransactionDate: 'fuel_transactions_org_transaction_date_idx',
  // Covers: Asset fuel history
  assetTransactionDate: 'fuel_transactions_asset_transaction_date_idx',
}

/**
 * SQL statements to create the indexes.
 * These should be run via a migration.
 *
 * To apply manually (for development):
 * ```sql
 * -- Work Orders
 * CREATE INDEX CONCURRENTLY IF NOT EXISTS work_orders_org_status_archived_idx
 *   ON work_orders (organisation_id, status, is_archived);
 *
 * CREATE INDEX CONCURRENTLY IF NOT EXISTS work_orders_org_assignee_status_idx
 *   ON work_orders (organisation_id, assigned_to_id, status)
 *   WHERE is_archived = false;
 *
 * CREATE INDEX CONCURRENTLY IF NOT EXISTS work_orders_org_asset_status_idx
 *   ON work_orders (organisation_id, asset_id, status)
 *   WHERE is_archived = false;
 *
 * CREATE INDEX CONCURRENTLY IF NOT EXISTS work_orders_due_date_status_idx
 *   ON work_orders (due_date, status)
 *   WHERE is_archived = false AND due_date IS NOT NULL;
 *
 * CREATE INDEX CONCURRENTLY IF NOT EXISTS work_orders_org_created_at_idx
 *   ON work_orders (organisation_id, created_at DESC)
 *   WHERE is_archived = false;
 *
 * -- Assets
 * CREATE INDEX CONCURRENTLY IF NOT EXISTS assets_org_archived_status_idx
 *   ON assets (organisation_id, is_archived, status);
 *
 * CREATE INDEX CONCURRENTLY IF NOT EXISTS assets_org_location_updated_idx
 *   ON assets (organisation_id, last_location_update DESC)
 *   WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
 *
 * -- Inspections
 * CREATE INDEX CONCURRENTLY IF NOT EXISTS inspections_org_status_started_idx
 *   ON inspections (organisation_id, status, started_at DESC);
 *
 * CREATE INDEX CONCURRENTLY IF NOT EXISTS inspections_asset_started_idx
 *   ON inspections (asset_id, started_at DESC);
 *
 * -- Fuel Transactions
 * CREATE INDEX CONCURRENTLY IF NOT EXISTS fuel_transactions_org_transaction_date_idx
 *   ON fuel_transactions (organisation_id, transaction_date DESC);
 *
 * CREATE INDEX CONCURRENTLY IF NOT EXISTS fuel_transactions_asset_transaction_date_idx
 *   ON fuel_transactions (asset_id, transaction_date DESC);
 * ```
 */
export const PERFORMANCE_INDEX_SQL = `
-- US-18.1.3: Performance Indexes
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
`
