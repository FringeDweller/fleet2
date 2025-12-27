import { relations } from 'drizzle-orm'
import { organisations } from './organisations'
import { roles } from './roles'
import { users } from './users'
import { sessions } from './sessions'
import { auditLog } from './audit-log'
import { assetCategories } from './asset-categories'
import { assets } from './assets'
import { taskTemplates } from './task-templates'
import { workOrders } from './work-orders'
import { workOrderStatusHistory } from './work-order-status-history'
import { workOrderChecklistItems } from './work-order-checklist-items'
import { workOrderParts } from './work-order-parts'
import { workOrderPhotos } from './work-order-photos'
import { maintenanceSchedules, maintenanceScheduleWorkOrders } from './maintenance-schedules'
import { notifications } from './notifications'
import { savedSearches } from './saved-searches'
import { partCategories } from './part-categories'
import { parts } from './parts'
import { partUsageHistory } from './part-usage-history'

export const organisationsRelations = relations(organisations, ({ many }) => ({
  users: many(users),
  assetCategories: many(assetCategories),
  assets: many(assets),
  auditLogs: many(auditLog),
  taskTemplates: many(taskTemplates),
  workOrders: many(workOrders),
  maintenanceSchedules: many(maintenanceSchedules),
  notifications: many(notifications),
  savedSearches: many(savedSearches),
  partCategories: many(partCategories),
  parts: many(parts)
}))

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users)
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [users.organisationId],
    references: [organisations.id]
  }),
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id]
  }),
  sessions: many(sessions),
  auditLogs: many(auditLog),
  assignedWorkOrders: many(workOrders, { relationName: 'assignedWorkOrders' }),
  createdWorkOrders: many(workOrders, { relationName: 'createdWorkOrders' }),
  notifications: many(notifications),
  savedSearches: many(savedSearches)
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id]
  })
}))

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  organisation: one(organisations, {
    fields: [auditLog.organisationId],
    references: [organisations.id]
  }),
  user: one(users, {
    fields: [auditLog.userId],
    references: [users.id]
  })
}))

export const assetCategoriesRelations = relations(assetCategories, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [assetCategories.organisationId],
    references: [organisations.id]
  }),
  parent: one(assetCategories, {
    fields: [assetCategories.parentId],
    references: [assetCategories.id],
    relationName: 'parentChild'
  }),
  children: many(assetCategories, {
    relationName: 'parentChild'
  }),
  assets: many(assets),
  maintenanceSchedules: many(maintenanceSchedules)
}))

export const assetsRelations = relations(assets, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [assets.organisationId],
    references: [organisations.id]
  }),
  category: one(assetCategories, {
    fields: [assets.categoryId],
    references: [assetCategories.id]
  }),
  workOrders: many(workOrders),
  maintenanceSchedules: many(maintenanceSchedules)
}))

// Task Templates Relations
export const taskTemplatesRelations = relations(taskTemplates, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [taskTemplates.organisationId],
    references: [organisations.id]
  }),
  workOrders: many(workOrders)
}))

// Work Orders Relations
export const workOrdersRelations = relations(workOrders, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [workOrders.organisationId],
    references: [organisations.id]
  }),
  asset: one(assets, {
    fields: [workOrders.assetId],
    references: [assets.id]
  }),
  template: one(taskTemplates, {
    fields: [workOrders.templateId],
    references: [taskTemplates.id]
  }),
  assignedTo: one(users, {
    fields: [workOrders.assignedToId],
    references: [users.id],
    relationName: 'assignedWorkOrders'
  }),
  createdBy: one(users, {
    fields: [workOrders.createdById],
    references: [users.id],
    relationName: 'createdWorkOrders'
  }),
  statusHistory: many(workOrderStatusHistory),
  checklistItems: many(workOrderChecklistItems),
  parts: many(workOrderParts),
  photos: many(workOrderPhotos)
}))

// Work Order Status History Relations
export const workOrderStatusHistoryRelations = relations(workOrderStatusHistory, ({ one }) => ({
  workOrder: one(workOrders, {
    fields: [workOrderStatusHistory.workOrderId],
    references: [workOrders.id]
  }),
  changedBy: one(users, {
    fields: [workOrderStatusHistory.changedById],
    references: [users.id]
  })
}))

// Work Order Checklist Items Relations
export const workOrderChecklistItemsRelations = relations(workOrderChecklistItems, ({ one }) => ({
  workOrder: one(workOrders, {
    fields: [workOrderChecklistItems.workOrderId],
    references: [workOrders.id]
  }),
  completedBy: one(users, {
    fields: [workOrderChecklistItems.completedById],
    references: [users.id]
  })
}))

// Work Order Parts Relations
export const workOrderPartsRelations = relations(workOrderParts, ({ one }) => ({
  workOrder: one(workOrders, {
    fields: [workOrderParts.workOrderId],
    references: [workOrders.id]
  }),
  addedBy: one(users, {
    fields: [workOrderParts.addedById],
    references: [users.id]
  })
}))

// Work Order Photos Relations
export const workOrderPhotosRelations = relations(workOrderPhotos, ({ one }) => ({
  workOrder: one(workOrders, {
    fields: [workOrderPhotos.workOrderId],
    references: [workOrders.id]
  }),
  uploadedBy: one(users, {
    fields: [workOrderPhotos.uploadedById],
    references: [users.id]
  })
}))

// Notifications Relations
export const notificationsRelations = relations(notifications, ({ one }) => ({
  organisation: one(organisations, {
    fields: [notifications.organisationId],
    references: [organisations.id]
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id]
  })
}))

// Saved Searches Relations
export const savedSearchesRelations = relations(savedSearches, ({ one }) => ({
  organisation: one(organisations, {
    fields: [savedSearches.organisationId],
    references: [organisations.id]
  }),
  user: one(users, {
    fields: [savedSearches.userId],
    references: [users.id]
  })
}))

// Maintenance Schedules Relations
export const maintenanceSchedulesRelations = relations(maintenanceSchedules, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [maintenanceSchedules.organisationId],
    references: [organisations.id]
  }),
  asset: one(assets, {
    fields: [maintenanceSchedules.assetId],
    references: [assets.id]
  }),
  category: one(assetCategories, {
    fields: [maintenanceSchedules.categoryId],
    references: [assetCategories.id]
  }),
  template: one(taskTemplates, {
    fields: [maintenanceSchedules.templateId],
    references: [taskTemplates.id]
  }),
  defaultAssignee: one(users, {
    fields: [maintenanceSchedules.defaultAssigneeId],
    references: [users.id],
    relationName: 'scheduleDefaultAssignee'
  }),
  createdBy: one(users, {
    fields: [maintenanceSchedules.createdById],
    references: [users.id],
    relationName: 'scheduleCreatedBy'
  }),
  generatedWorkOrders: many(maintenanceScheduleWorkOrders)
}))

// Maintenance Schedule Work Orders Relations
export const maintenanceScheduleWorkOrdersRelations = relations(
  maintenanceScheduleWorkOrders,
  ({ one }) => ({
    schedule: one(maintenanceSchedules, {
      fields: [maintenanceScheduleWorkOrders.scheduleId],
      references: [maintenanceSchedules.id]
    }),
    workOrder: one(workOrders, {
      fields: [maintenanceScheduleWorkOrders.workOrderId],
      references: [workOrders.id]
    })
  })
)

// Part Categories Relations
export const partCategoriesRelations = relations(partCategories, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [partCategories.organisationId],
    references: [organisations.id]
  }),
  parent: one(partCategories, {
    fields: [partCategories.parentId],
    references: [partCategories.id],
    relationName: 'partCategoryParentChild'
  }),
  children: many(partCategories, {
    relationName: 'partCategoryParentChild'
  }),
  parts: many(parts)
}))

// Parts Relations
export const partsRelations = relations(parts, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [parts.organisationId],
    references: [organisations.id]
  }),
  category: one(partCategories, {
    fields: [parts.categoryId],
    references: [partCategories.id]
  }),
  usageHistory: many(partUsageHistory)
}))

// Part Usage History Relations
export const partUsageHistoryRelations = relations(partUsageHistory, ({ one }) => ({
  part: one(parts, {
    fields: [partUsageHistory.partId],
    references: [parts.id]
  }),
  workOrder: one(workOrders, {
    fields: [partUsageHistory.workOrderId],
    references: [workOrders.id]
  }),
  user: one(users, {
    fields: [partUsageHistory.userId],
    references: [users.id]
  })
}))
