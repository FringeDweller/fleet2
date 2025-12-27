# Nitro Scheduled Tasks

This directory contains Nitro scheduled tasks that can be run manually or via cron/scheduler.

## Available Tasks

### maintenance:generate-work-orders

Automatically generates work orders from active maintenance schedules.

**Purpose:**
- Checks all active maintenance schedules
- Generates work orders when schedules are due (time-based or usage-based)
- Notifies assigned users
- Logs all actions in audit log

**Trigger Conditions:**
- **Time-based**: Triggers when `today >= (nextDueDate - leadTimeDays)`
- **Usage-based (mileage)**: Triggers when `currentMileage >= lastTriggeredMileage + intervalMileage`
- **Usage-based (hours)**: Triggers when `currentHours >= lastTriggeredHours + intervalHours`
- **Combined**: Triggers when any of the above conditions are met

**Duplicate Prevention:**
- Checks `maintenanceScheduleWorkOrders` junction table
- Skips generation if work order was already created for this cycle

**Running Manually:**

```bash
# Build the application first
bun run build

# Run the task
node .output/server/index.mjs --task=maintenance:generate-work-orders
```

**Running via API:**

See `/api/maintenance-schedules/generate` endpoint (requires authentication).

**Scheduling with Cron:**

Add to your cron tab to run daily at 6 AM:

```cron
0 6 * * * cd /path/to/fleet2 && node .output/server/index.mjs --task=maintenance:generate-work-orders >> /var/log/fleet/maintenance-tasks.log 2>&1
```

**Output:**

The task logs to console:
- Total schedules checked
- Work orders created
- Schedules skipped (not yet due)
- Errors encountered

Example output:
```
[Task] Starting scheduled work order generation...
[Task] Work order generation complete:
  Total schedules checked: 5
  Work orders created: 2
  Skipped (not due): 3
  Errors: 0

Created work orders:
  - WO-0042 for VEH-001 (Monthly Oil Change)
  - WO-0043 for VEH-002 (Quarterly Inspection)
```

## Adding New Tasks

Create a new file in this directory:

```typescript
// server/tasks/my-task.ts
export default defineTask({
  meta: {
    name: 'namespace:task-name',
    description: 'Task description'
  },
  async run() {
    console.log('Running task...')
    // Your task logic here
    return { result: { success: true } }
  }
})
```

Run it:

```bash
bun run build
node .output/server/index.mjs --task=namespace:task-name
```

## References

- [Nitro Tasks Documentation](https://nitro.unjs.io/guide/tasks)
- Work order generator: `/server/utils/work-order-generator.ts`
- API endpoints: `/server/api/maintenance-schedules/generate.post.ts`
