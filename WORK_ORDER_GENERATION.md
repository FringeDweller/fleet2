# Automatic Work Order Generation System

This document describes the automatic work order generation system for maintenance schedules.

## Overview

The system automatically generates work orders from maintenance schedules based on time-based and usage-based triggers. It supports:

- **Time-based schedules**: Generate WOs when `(nextDueDate - leadTimeDays) <= today`
- **Usage-based schedules**: Generate WOs when asset mileage/hours reach threshold
- **Combined schedules**: Generate WOs when either condition is met
- **Duplicate prevention**: Tracks generated work orders to avoid duplicates
- **Template application**: Auto-copies checklist items from task templates
- **Notifications**: Alerts assigned users when WOs are created
- **Audit logging**: Records all generation events

## Files Created

### 1. Core Logic: `/server/utils/work-order-generator.ts`

**Exports:**

```typescript
interface GenerationResult {
  scheduleId: string
  scheduleName: string
  workOrderId?: string
  workOrderNumber?: string
  assetId?: string
  assetNumber?: string
  status: 'created' | 'skipped' | 'error'
  reason?: string
}

// Generate WOs for all active schedules
async function generateScheduledWorkOrders(): Promise<GenerationResult[]>

// Generate WO for specific schedule + asset
async function generateWorkOrderFromSchedule(
  schedule: MaintenanceSchedule,
  asset: Asset
): Promise<GenerationResult>
```

**Key Features:**

- Checks time-based triggers using `nextDueDate` and `leadTimeDays`
- Checks usage-based triggers comparing asset mileage/hours to schedule intervals
- Validates no duplicate WOs exist for the same cycle
- Copies template checklist items to new work orders
- Updates schedule tracking fields (`lastGeneratedAt`, `nextDueDate`, `lastTriggeredMileage/Hours`)
- Creates status history entries
- Sends notifications to assignees
- Logs audit trail

### 2. Scheduled Task: `/server/tasks/generate-scheduled-work-orders.ts`

**Task Name:** `maintenance:generate-work-orders`

**Purpose:** Background job that runs periodically to check all schedules and generate work orders.

**Usage:**

```bash
# Manual run
bun run build
node .output/server/index.mjs --task=maintenance:generate-work-orders

# Cron (daily at 6 AM)
0 6 * * * cd /path/to/fleet2 && node .output/server/index.mjs --task=maintenance:generate-work-orders >> /var/log/fleet/maintenance.log 2>&1
```

**Output:**

```
[Task] Starting scheduled work order generation...
[Task] Work order generation complete:
  Total schedules checked: 10
  Work orders created: 3
  Skipped (not due): 6
  Errors: 1
```

### 3. API Endpoint (Bulk): `/server/api/maintenance-schedules/generate.post.ts`

**Route:** `POST /api/maintenance-schedules/generate`

**Authentication:** Required (organization-scoped)

**Request Body (optional):**

```json
{
  "scheduleId": "uuid" // Optional: generate for specific schedule
}
```

**Response:**

```json
{
  "results": [
    {
      "scheduleId": "uuid",
      "scheduleName": "Monthly Oil Change",
      "workOrderId": "uuid",
      "workOrderNumber": "WO-0042",
      "assetId": "uuid",
      "assetNumber": "VEH-001",
      "status": "created",
      "reason": "Time-based: due 2025-12-30"
    }
  ],
  "summary": {
    "total": 5,
    "created": 2,
    "skipped": 3,
    "errors": 0
  }
}
```

**Use Cases:**

- Manually trigger generation from admin UI
- Test schedule configurations
- Recover from missed automated runs

### 4. API Endpoint (Single): `/server/api/maintenance-schedules/[id]/generate.post.ts`

**Route:** `POST /api/maintenance-schedules/:id/generate`

**Authentication:** Required (organization-scoped)

**Response:** Same format as bulk endpoint

**Use Cases:**

- Generate WOs for a specific schedule
- Test individual schedule before activation
- Force generation outside normal schedule

### 5. Notification Function: `/server/utils/notifications.ts`

**Added Function:**

```typescript
async function createScheduledMaintenanceNotification(params: {
  organisationId: string
  userId: string
  scheduleName: string
  assetNumber: string
  workOrderNumber: string
  workOrderId: string
}): Promise<Notification>
```

**Notification Format:**

- **Type:** `work_order_assigned`
- **Title:** "Scheduled Maintenance Work Order"
- **Body:** "Auto-generated work order WO-XXXX for VEH-001 - Monthly Oil Change"
- **Link:** `/work-orders/{workOrderId}`

## How It Works

### Time-Based Generation

1. Schedule has `nextDueDate` = 2025-12-30
2. Schedule has `leadTimeDays` = 7
3. When today >= 2025-12-23 (7 days before due date):
   - Check if WO already generated for this due date
   - If not, create work order with `dueDate` = 2025-12-30
   - Update `lastGeneratedAt` to today
   - Calculate new `nextDueDate` using `calculateNextDueDate()`
   - Record in `maintenanceScheduleWorkOrders` junction table

### Usage-Based Generation (Mileage)

1. Schedule has `intervalMileage` = 5000
2. Schedule has `lastTriggeredMileage` = 10000
3. Asset has current `mileage` = 15200
4. When asset mileage >= 15000 (10000 + 5000):
   - Create work order
   - Update `lastTriggeredMileage` to current asset mileage (15200)
   - Next trigger will be at 20200 km

### Usage-Based Generation (Hours)

1. Schedule has `intervalHours` = 250
2. Schedule has `lastTriggeredHours` = 500
3. Asset has current `operationalHours` = 780
4. When asset hours >= 750 (500 + 250):
   - Create work order
   - Update `lastTriggeredHours` to current asset hours (780)
   - Next trigger will be at 1030 hours

### Combined Schedules

For combined schedules, the work order is generated when **either** condition is met:

- Time-based trigger reached, OR
- Mileage threshold reached, OR
- Hours threshold reached

## Work Order Pre-Fill

When a work order is generated:

1. **Title**: Copied from schedule name
2. **Description**: Copied from schedule description
3. **Priority**: Set to `defaultPriority` from schedule
4. **Assigned To**: Set to `defaultAssigneeId` from schedule
5. **Due Date**: Set to schedule's `nextDueDate` (or today for usage-based)
6. **Template**: Linked to schedule's `templateId`
7. **Checklist Items**: Auto-copied from template's `checklistItems`
8. **Status**: Set to `open`
9. **Notes**: Includes trigger reason for audit trail

## Database Updates

### Work Order Created

```sql
INSERT INTO work_orders (
  organisation_id,
  work_order_number, -- Auto-generated: WO-####
  asset_id,
  template_id,
  assigned_to_id,
  created_by_id, -- Schedule creator
  title,
  description,
  priority,
  status, -- 'open'
  due_date,
  notes -- Includes trigger reason
);
```

### Checklist Items Copied

```sql
INSERT INTO work_order_checklist_items (
  work_order_id,
  template_item_id,
  title,
  description,
  is_required,
  order
)
SELECT ... FROM task_templates WHERE id = schedule.template_id;
```

### Junction Table Record

```sql
INSERT INTO maintenance_schedule_work_orders (
  schedule_id,
  work_order_id,
  scheduled_date -- For duplicate prevention
);
```

### Schedule Tracking Updated

```sql
UPDATE maintenance_schedules SET
  last_generated_at = NOW(),
  next_due_date = calculated_next_date, -- Time-based only
  last_triggered_mileage = current_mileage, -- Usage-based only
  last_triggered_hours = current_hours, -- Usage-based only
  updated_at = NOW()
WHERE id = schedule_id;
```

### Audit Log Entry

```sql
INSERT INTO audit_log (
  organisation_id,
  user_id, -- Schedule creator
  action, -- 'create'
  entity_type, -- 'work_order'
  entity_id, -- New work order ID
  new_values -- Work order data + metadata
);
```

### Notification Created

```sql
INSERT INTO notifications (
  organisation_id,
  user_id, -- Assignee
  type, -- 'work_order_assigned'
  title,
  body,
  link, -- /work-orders/{id}
  is_read -- false
);
```

## Duplicate Prevention

The system prevents duplicate work orders using the `maintenanceScheduleWorkOrders` junction table:

```typescript
// Check before generating
const existing = await db.query.maintenanceScheduleWorkOrders.findFirst({
  where: and(
    eq(scheduleId, schedule.id),
    eq(scheduledDate, schedule.nextDueDate)
  )
})

if (existing) {
  return { status: 'skipped', reason: 'Already generated for this cycle' }
}
```

For usage-based schedules, the `lastTriggeredMileage` and `lastTriggeredHours` fields ensure the next trigger point is always higher than the last.

## Error Handling

The system gracefully handles errors at multiple levels:

1. **Schedule Level**: If generation fails for one schedule, others continue
2. **Asset Level**: If generation fails for one asset, others in the same category continue
3. **Result Tracking**: Each generation returns a `GenerationResult` with status and reason
4. **Logging**: Errors are logged to console and included in task output
5. **API Errors**: Return proper HTTP status codes and error messages

## Testing

### Manual Test via API

```bash
# Generate for all schedules
curl -X POST http://localhost:3000/api/maintenance-schedules/generate \
  -H "Cookie: auth-token=..." \
  -H "Content-Type: application/json"

# Generate for specific schedule
curl -X POST http://localhost:3000/api/maintenance-schedules/{id}/generate \
  -H "Cookie: auth-token=..." \
  -H "Content-Type: application/json"
```

### Manual Test via CLI

```bash
bun run build
node .output/server/index.mjs --task=maintenance:generate-work-orders
```

### Testing Triggers

**Time-Based:**
1. Create schedule with `nextDueDate` = tomorrow
2. Set `leadTimeDays` = 1
3. Run generator today - should create work order

**Usage-Based (Mileage):**
1. Create schedule with `intervalMileage` = 1000
2. Set asset `mileage` = 5500
3. Set schedule `lastTriggeredMileage` = 4000
4. Run generator - should create work order (5500 >= 5000)

**Usage-Based (Hours):**
1. Create schedule with `intervalHours` = 100
2. Set asset `operationalHours` = 650
3. Set schedule `lastTriggeredHours` = 500
4. Run generator - should create work order (650 >= 600)

## Deployment

### Production Setup

1. **Build the application:**

```bash
bun run build
```

2. **Set up cron job:**

```cron
# Run daily at 6 AM
0 6 * * * cd /path/to/fleet2 && /usr/bin/node .output/server/index.mjs --task=maintenance:generate-work-orders >> /var/log/fleet/maintenance-tasks.log 2>&1

# Or run every 6 hours
0 */6 * * * cd /path/to/fleet2 && /usr/bin/node .output/server/index.mjs --task=maintenance:generate-work-orders >> /var/log/fleet/maintenance-tasks.log 2>&1
```

3. **Monitor logs:**

```bash
tail -f /var/log/fleet/maintenance-tasks.log
```

### Docker Deployment

Add to `docker-compose.yml`:

```yaml
services:
  maintenance-scheduler:
    image: fleet-app:latest
    command: sh -c "while true; do node /app/.output/server/index.mjs --task=maintenance:generate-work-orders; sleep 21600; done"
    environment:
      - DATABASE_URL=postgresql://...
    depends_on:
      - db
```

Or use a separate cron container:

```yaml
services:
  cron:
    image: alpine:latest
    volumes:
      - ./scripts:/scripts
    command: crond -f -d 8
```

## Monitoring

### Key Metrics to Track

- Number of schedules checked per run
- Number of work orders created
- Number of schedules skipped (not yet due)
- Number of errors
- Execution time
- Last successful run timestamp

### Alerting

Set up alerts for:

- Task execution failures
- High error rates (> 10% of schedules)
- No work orders created for extended period (if schedules exist)
- Task not running for > 24 hours

## Future Enhancements

Potential improvements:

1. **Scheduling API**: `/api/tasks/schedule` to configure cron from UI
2. **Dashboard Widget**: Show upcoming scheduled generations
3. **Email Notifications**: Send digest of generated work orders
4. **Smart Scheduling**: Optimize generation timing based on asset usage patterns
5. **Batch Optimization**: Group similar work orders to reduce downtime
6. **Predictive Alerts**: Warn when schedules are about to trigger
7. **Multi-Tenant Isolation**: Run per organization in parallel
8. **Retry Logic**: Automatic retry for failed generations
9. **Dry Run Mode**: Preview what would be generated without creating WOs

## Troubleshooting

### Work Orders Not Generating

**Check:**

1. Schedule is active (`isActive = true`)
2. Schedule is not archived (`isArchived = false`)
3. Schedule has not ended (`endDate` is null or in future)
4. For specific asset: asset exists and is not archived
5. For category: at least one asset exists in category
6. Time-based: `today >= (nextDueDate - leadTimeDays)`
7. Usage-based: asset mileage/hours >= last triggered + interval
8. Not already generated for this cycle (check `maintenanceScheduleWorkOrders`)

**Debug:**

```bash
# Run task manually to see output
bun run build
node .output/server/index.mjs --task=maintenance:generate-work-orders

# Check via API with specific schedule
curl -X POST http://localhost:3000/api/maintenance-schedules/{id}/generate \
  -H "Cookie: ..." | jq
```

### Duplicate Work Orders

This should not happen due to junction table checks, but if it does:

1. Check `maintenanceScheduleWorkOrders` for existing records
2. Verify schedule's `lastGeneratedAt` is being updated
3. For time-based: verify `nextDueDate` is advancing
4. For usage-based: verify `lastTriggeredMileage/Hours` is updating

### Performance Issues

For large fleets with many schedules:

1. Add database indexes on `isActive`, `isArchived`, `nextDueDate`
2. Run task more frequently to process fewer schedules per run
3. Add pagination to process schedules in batches
4. Consider running per organization in parallel

## References

- Schema: `/server/db/schema/maintenance-schedules.ts`
- Work Orders Schema: `/server/db/schema/work-orders.ts`
- Schedule Calculator: `/server/utils/schedule-calculator.ts`
- Nitro Tasks Docs: https://nitro.unjs.io/guide/tasks
