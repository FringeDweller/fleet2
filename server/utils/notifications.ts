import type { NewNotification } from '../db/schema/notifications'
import { db, schema } from './db'

export async function createNotification(notification: Omit<NewNotification, 'id' | 'createdAt'>) {
  const [result] = await db.insert(schema.notifications).values(notification).returning()
  return result
}

export async function createWorkOrderAssignedNotification(params: {
  organisationId: string
  userId: string
  workOrderNumber: string
  workOrderTitle: string
  workOrderId: string
  assignedByName: string
}) {
  return createNotification({
    organisationId: params.organisationId,
    userId: params.userId,
    type: 'work_order_assigned',
    title: 'Work Order Assigned',
    body: `${params.assignedByName} assigned you to ${params.workOrderNumber}: ${params.workOrderTitle}`,
    link: `/work-orders/${params.workOrderId}`,
    isRead: false,
  })
}

export async function createWorkOrderUnassignedNotification(params: {
  organisationId: string
  userId: string
  workOrderNumber: string
  workOrderTitle: string
  unassignedByName: string
}) {
  return createNotification({
    organisationId: params.organisationId,
    userId: params.userId,
    type: 'work_order_unassigned',
    title: 'Work Order Unassigned',
    body: `${params.unassignedByName} removed you from ${params.workOrderNumber}: ${params.workOrderTitle}`,
    link: undefined,
    isRead: false,
  })
}

export async function createScheduledMaintenanceNotification(params: {
  organisationId: string
  userId: string
  scheduleName: string
  assetNumber: string
  workOrderNumber: string
  workOrderId: string
}) {
  return createNotification({
    organisationId: params.organisationId,
    userId: params.userId,
    type: 'work_order_assigned',
    title: 'Scheduled Maintenance Work Order',
    body: `Auto-generated work order ${params.workOrderNumber} for ${params.assetNumber} - ${params.scheduleName}`,
    link: `/work-orders/${params.workOrderId}`,
    isRead: false,
  })
}

// Approval workflow notifications

export async function createApprovalRequestedNotification(params: {
  organisationId: string
  userId: string
  workOrderNumber: string
  workOrderTitle: string
  workOrderId: string
  requestedByName: string
  estimatedCost: string
}) {
  return createNotification({
    organisationId: params.organisationId,
    userId: params.userId,
    type: 'work_order_approval_requested',
    title: 'Approval Required',
    body: `${params.requestedByName} requested approval for ${params.workOrderNumber}: ${params.workOrderTitle} (Est. cost: $${params.estimatedCost})`,
    link: `/work-orders/${params.workOrderId}`,
    isRead: false,
  })
}

export async function createWorkOrderApprovedNotification(params: {
  organisationId: string
  userId: string
  workOrderNumber: string
  workOrderTitle: string
  workOrderId: string
  approvedByName: string
}) {
  return createNotification({
    organisationId: params.organisationId,
    userId: params.userId,
    type: 'work_order_approved',
    title: 'Work Order Approved',
    body: `${params.approvedByName} approved ${params.workOrderNumber}: ${params.workOrderTitle}`,
    link: `/work-orders/${params.workOrderId}`,
    isRead: false,
  })
}

export async function createWorkOrderRejectedNotification(params: {
  organisationId: string
  userId: string
  workOrderNumber: string
  workOrderTitle: string
  workOrderId: string
  rejectedByName: string
  reason: string | null
}) {
  const reasonText = params.reason ? ` - Reason: ${params.reason}` : ''
  return createNotification({
    organisationId: params.organisationId,
    userId: params.userId,
    type: 'work_order_rejected',
    title: 'Work Order Rejected',
    body: `${params.rejectedByName} rejected ${params.workOrderNumber}: ${params.workOrderTitle}${reasonText}`,
    link: `/work-orders/${params.workOrderId}`,
    isRead: false,
  })
}

// Geofence alert notifications

export async function createGeofenceEntryNotification(params: {
  organisationId: string
  userId: string
  assetNumber: string
  geofenceName: string
  alertId: string
}) {
  return createNotification({
    organisationId: params.organisationId,
    userId: params.userId,
    type: 'geofence_entry',
    title: 'Geofence Entry Alert',
    body: `${params.assetNumber} entered ${params.geofenceName}`,
    link: `/geofence-alerts/${params.alertId}`,
    isRead: false,
  })
}

export async function createGeofenceExitNotification(params: {
  organisationId: string
  userId: string
  assetNumber: string
  geofenceName: string
  alertId: string
}) {
  return createNotification({
    organisationId: params.organisationId,
    userId: params.userId,
    type: 'geofence_exit',
    title: 'Geofence Exit Alert',
    body: `${params.assetNumber} exited ${params.geofenceName}`,
    link: `/geofence-alerts/${params.alertId}`,
    isRead: false,
  })
}

export async function createAfterHoursMovementNotification(params: {
  organisationId: string
  userId: string
  assetNumber: string
  geofenceName: string
  alertId: string
}) {
  return createNotification({
    organisationId: params.organisationId,
    userId: params.userId,
    type: 'after_hours_movement',
    title: 'After-Hours Movement Alert',
    body: `${params.assetNumber} detected moving in ${params.geofenceName} during after-hours`,
    link: `/geofence-alerts/${params.alertId}`,
    isRead: false,
  })
}

// DTC Work Order notifications (US-10.7)

export async function createDtcWorkOrderNotification(params: {
  organisationId: string
  userId: string
  dtcCode: string
  assetNumber: string
  workOrderNumber: string
  workOrderId: string
}) {
  return createNotification({
    organisationId: params.organisationId,
    userId: params.userId,
    type: 'work_order_assigned',
    title: 'DTC Work Order Created',
    body: `Work order ${params.workOrderNumber} created for ${params.assetNumber} - DTC: ${params.dtcCode}`,
    link: `/work-orders/${params.workOrderId}`,
    isRead: false,
  })
}

// Fuel Anomaly notifications (US-11.5)

export async function createFuelAnomalyNotification(params: {
  organisationId: string
  userId: string
  assetNumber: string
  assetId: string
  anomalyType:
    | 'high_consumption'
    | 'low_consumption'
    | 'refuel_without_distance'
    | 'missing_odometer'
    | 'no_odometer'
  severity: 'warning' | 'critical'
  deviationPercent?: number
  litersPerHundredKm?: number
  expectedLitersPer100Km?: number
  distanceKm?: number
  quantity?: number
  transactionDate: Date
}) {
  let title: string
  let body: string
  const formattedDate = params.transactionDate.toLocaleDateString()

  switch (params.anomalyType) {
    case 'high_consumption':
      title =
        params.severity === 'critical'
          ? 'Critical Fuel Consumption Alert'
          : 'High Fuel Consumption Alert'
      body = `${params.assetNumber}: Consumption of ${params.litersPerHundredKm?.toFixed(1)} L/100km is ${Math.abs(params.deviationPercent ?? 0).toFixed(0)}% above average (${formattedDate})`
      break
    case 'low_consumption':
      title = 'Unusual Low Fuel Consumption'
      body = `${params.assetNumber}: Consumption of ${params.litersPerHundredKm?.toFixed(1)} L/100km is ${Math.abs(params.deviationPercent ?? 0).toFixed(0)}% below average - possible recording error (${formattedDate})`
      break
    case 'refuel_without_distance':
      title = 'Refuel Without Distance Alert'
      body = `${params.assetNumber}: Refuel of ${params.quantity?.toFixed(1)}L with only ${params.distanceKm?.toFixed(1)}km traveled since last fill (${formattedDate})`
      break
    case 'missing_odometer':
    case 'no_odometer':
      title = 'Missing Odometer Reading'
      body = `${params.assetNumber}: Fuel transaction recorded without odometer reading (${formattedDate})`
      break
    default:
      title = 'Fuel Anomaly Detected'
      body = `${params.assetNumber}: Unusual fuel activity detected (${formattedDate})`
  }

  return createNotification({
    organisationId: params.organisationId,
    userId: params.userId,
    type: 'fuel_anomaly',
    title,
    body,
    link: `/fuel/analytics?assetId=${params.assetId}`,
    isRead: false,
  })
}
