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
