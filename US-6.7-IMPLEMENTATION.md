# US-6.7: Multi-Location Inventory - Implementation Summary

## Overview
Implemented multi-location inventory tracking for Fleet2, enabling parts to be stored and tracked across multiple storage locations with full transfer history.

## Database Schema Changes

### New Tables

1. **storage_locations**
   - `id` (UUID, PK)
   - `organisation_id` (FK to organisations)
   - `name` (varchar 200)
   - `description` (text, optional)
   - `type` (enum: warehouse, bin, shelf, truck, building, room, other)
   - `parent_id` (FK to storage_locations, for hierarchical locations)
   - `code` (varchar 50, optional)
   - `is_active` (boolean, default true)
   - `created_at`, `updated_at` (timestamps)
   - Indexes: organisation_id, parent_id, code

2. **part_location_quantities**
   - `id` (UUID, PK)
   - `organisation_id` (FK to organisations)
   - `part_id` (FK to parts)
   - `location_id` (FK to storage_locations)
   - `quantity` (decimal 12,2)
   - `created_at`, `updated_at` (timestamps)
   - Indexes: organisation_id, part_id, location_id
   - Unique constraint: (part_id, location_id)

3. **inventory_transfers**
   - `id` (UUID, PK)
   - `organisation_id` (FK to organisations)
   - `part_id` (FK to parts)
   - `from_location_id` (FK to storage_locations)
   - `to_location_id` (FK to storage_locations)
   - `quantity` (decimal 12,2)
   - `transferred_by_id` (FK to users)
   - `notes` (text, optional)
   - `reference_number` (varchar 100, optional)
   - `created_at` (timestamp)
   - Indexes: organisation_id, part_id, from_location_id, to_location_id, transferred_by_id, created_at

### Modified Tables

1. **work_order_parts**
   - Added `source_location_id` (FK to storage_locations, optional)
   - Added index on source_location_id
   - Enables tracking which location parts were drawn from for work orders

## API Endpoints

### Storage Locations

#### GET /api/storage-locations
- Lists all storage locations for an organisation
- Query params:
  - `search` - Search by name, code, or description
  - `type` - Filter by location type
  - `parentId` - Filter by parent (use "null" for root-level)
  - `includeInactive` - Include inactive locations (default false)
  - `limit`, `offset` - Pagination
  - `sortBy`, `sortOrder` - Sorting
- Returns: Paginated list with parent relations

#### POST /api/storage-locations
- Creates a new storage location
- Body:
  - `name` (required)
  - `description` (optional)
  - `type` (default: warehouse)
  - `parentId` (optional, for hierarchical locations)
  - `code` (optional, must be unique)
- Validations:
  - Parent location must exist
  - Code must be unique if provided
- Returns: Created location

#### GET /api/storage-locations/[id]
- Gets a specific storage location
- Returns: Location with parent and children relations

#### PUT /api/storage-locations/[id]
- Updates a storage location
- Body: Same as POST (all fields optional)
- Validations:
  - Cannot set self as parent
  - Parent must exist
  - Code must be unique if changed
- Returns: Updated location

#### DELETE /api/storage-locations/[id]
- Deletes a storage location
- Validations:
  - Cannot delete if has child locations
  - Cannot delete if has inventory
- Returns: Success confirmation

### Part Locations

#### GET /api/parts/[id]/locations
- Gets all quantities by location for a specific part
- Returns:
  - `partId` - The part ID
  - `totalQuantity` - Sum across all locations
  - `locations[]` - Array of:
    - `locationId`, `locationName`, `locationType`, `locationCode`
    - `quantity` - Quantity at this location

### Inventory Transfers

#### POST /api/inventory/transfer
- Transfers parts between locations
- Body:
  - `partId` (required)
  - `fromLocationId` (required)
  - `toLocationId` (required)
  - `quantity` (required, positive number)
  - `notes` (optional)
  - `referenceNumber` (optional)
- Validations:
  - From and to locations must be different
  - Part must exist
  - Both locations must exist and be active
  - Sufficient quantity must be available at source
- Transaction:
  1. Deducts quantity from source location
  2. Adds quantity to destination location
  3. Records transfer in inventory_transfers table
  4. Creates audit log entry
- Returns: Transfer record

#### GET /api/inventory/transfers
- Gets transfer history
- Query params:
  - `partId` - Filter by part
  - `locationId` - Filter by location (from or to)
  - `limit`, `offset` - Pagination
- Returns: Paginated list with part, locations, and user relations

## Database Relations

### New Relations
- `organisations` → `storageLocations`, `partLocationQuantities`, `inventoryTransfers`
- `storageLocations` → `partQuantities`, `transfersFrom`, `transfersTo`, `parent`, `children`
- `partLocationQuantities` → `organisation`, `part`, `location`
- `inventoryTransfers` → `organisation`, `part`, `fromLocation`, `toLocation`, `transferredBy`
- `workOrderParts` → `sourceLocation`

## Features Implemented

1. **Hierarchical Storage Locations**
   - Locations can have parent-child relationships (e.g., Warehouse → Bin → Shelf)
   - Prevents deletion of locations with children

2. **Multi-Location Part Tracking**
   - Each part can have quantities at multiple locations
   - Unique constraint ensures one quantity record per part-location
   - Automatic quantity consolidation (removes records when quantity becomes zero)

3. **Inventory Transfers**
   - Atomic transfers between locations using database transactions
   - Full audit trail with timestamps, user, and notes
   - Prevents negative stock by validating available quantity before transfer

4. **Work Order Integration**
   - Work order parts can optionally reference source location
   - Enables tracking which location parts were drawn from

5. **Safety & Validation**
   - Cannot delete locations with inventory
   - Cannot delete locations with children
   - Prevents circular parent-child relationships
   - Validates all foreign keys before operations

## Files Changed/Created

### Database Schema
- `server/db/schema/storage-locations.ts` (new)
- `server/db/schema/part-location-quantities.ts` (new)
- `server/db/schema/inventory-transfers.ts` (new)
- `server/db/schema/work-order-parts.ts` (modified - added sourceLocationId)
- `server/db/schema/index.ts` (modified - exported new tables)
- `server/db/schema/relations.ts` (modified - added new relations)

### API Endpoints
- `server/api/storage-locations/index.get.ts` (new)
- `server/api/storage-locations/index.post.ts` (new)
- `server/api/storage-locations/[id].get.ts` (new)
- `server/api/storage-locations/[id].put.ts` (new)
- `server/api/storage-locations/[id].delete.ts` (new)
- `server/api/parts/[id]/locations.get.ts` (new)
- `server/api/inventory/transfer.post.ts` (new)
- `server/api/inventory/transfers.get.ts` (new)

## Next Steps (Frontend)

The backend implementation is complete. Frontend components needed:

1. **Settings: Storage Locations Management**
   - CRUD interface for storage locations
   - Tree view for hierarchical locations
   - Location type selector

2. **Parts: Location Quantities**
   - Show quantities by location on part detail page
   - Visual indicator for low stock at any location

3. **Inventory: Transfer Interface**
   - Transfer form with part, from/to location selectors
   - Transfer history table
   - Notes and reference number input

4. **Work Orders: Location Selection**
   - Add location selector when consuming parts
   - Show available quantity at selected location
   - Default to location with highest quantity

## Testing

All endpoints include:
- Authentication checks
- Organisation isolation
- Input validation with Zod schemas
- Foreign key validation
- Business rule enforcement
- Audit logging

## Migration

Migration file already exists in project. Run:
```bash
bun run db:migrate
```

To apply the schema changes to the database.
