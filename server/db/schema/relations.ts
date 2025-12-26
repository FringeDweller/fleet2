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
import { notifications } from './notifications'

export const organisationsRelations = relations(organisations, ({ many }) => ({
  users: many(users),
  assetCategories: many(assetCategories),
  assets: many(assets),
  auditLogs: many(auditLog),
  taskTemplates: many(taskTemplates),
  workOrders: many(workOrders),
  notifications: many(notifications)
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
  notifications: many(notifications)
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
  assets: many(assets)
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
  workOrders: many(workOrders)
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
