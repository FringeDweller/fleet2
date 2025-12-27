import { relations } from 'drizzle-orm'
import { assetCategories } from './asset-categories'
import { assetCategoryParts } from './asset-category-parts'
import { assetLocationHistory } from './asset-location-history'
import { assetParts } from './asset-parts'
import { assets } from './assets'
import { auditLog } from './audit-log'
import { defects } from './defects'
import { maintenanceSchedules, maintenanceScheduleWorkOrders } from './maintenance-schedules'
import { notifications } from './notifications'
import { organisations } from './organisations'
import { partCategories } from './part-categories'
import { partUsageHistory } from './part-usage-history'
import { parts } from './parts'
import { roles } from './roles'
import { savedSearches } from './saved-searches'
import { sessions } from './sessions'
import { taskTemplateParts } from './task-template-parts'
import { taskTemplates } from './task-templates'
import { users } from './users'
import { workOrderChecklistItems } from './work-order-checklist-items'
import { workOrderParts } from './work-order-parts'
import { workOrderPhotos } from './work-order-photos'
import { workOrderStatusHistory } from './work-order-status-history'
import { workOrders } from './work-orders'

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
  parts: many(parts),
  defects: many(defects),
}))

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [users.organisationId],
    references: [organisations.id],
  }),
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
  sessions: many(sessions),
  auditLogs: many(auditLog),
  assignedWorkOrders: many(workOrders, { relationName: 'assignedWorkOrders' }),
  createdWorkOrders: many(workOrders, { relationName: 'createdWorkOrders' }),
  notifications: many(notifications),
  savedSearches: many(savedSearches),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  organisation: one(organisations, {
    fields: [auditLog.organisationId],
    references: [organisations.id],
  }),
  user: one(users, {
    fields: [auditLog.userId],
    references: [users.id],
  }),
}))

export const assetCategoriesRelations = relations(assetCategories, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [assetCategories.organisationId],
    references: [organisations.id],
  }),
  parent: one(assetCategories, {
    fields: [assetCategories.parentId],
    references: [assetCategories.id],
    relationName: 'parentChild',
  }),
  children: many(assetCategories, {
    relationName: 'parentChild',
  }),
  assets: many(assets),
  maintenanceSchedules: many(maintenanceSchedules),
  compatibleParts: many(assetCategoryParts),
}))

export const assetsRelations = relations(assets, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [assets.organisationId],
    references: [organisations.id],
  }),
  category: one(assetCategories, {
    fields: [assets.categoryId],
    references: [assetCategories.id],
  }),
  workOrders: many(workOrders),
  maintenanceSchedules: many(maintenanceSchedules),
  compatibleParts: many(assetParts),
  locationHistory: many(assetLocationHistory),
  defects: many(defects),
}))

// Asset Location History Relations
export const assetLocationHistoryRelations = relations(assetLocationHistory, ({ one }) => ({
  asset: one(assets, {
    fields: [assetLocationHistory.assetId],
    references: [assets.id],
  }),
  updatedBy: one(users, {
    fields: [assetLocationHistory.updatedById],
    references: [users.id],
  }),
}))

// Task Templates Relations
export const taskTemplatesRelations = relations(taskTemplates, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [taskTemplates.organisationId],
    references: [organisations.id],
  }),
  workOrders: many(workOrders),
  templateParts: many(taskTemplateParts),
}))

// Task Template Parts Relations
export const taskTemplatePartsRelations = relations(taskTemplateParts, ({ one }) => ({
  template: one(taskTemplates, {
    fields: [taskTemplateParts.templateId],
    references: [taskTemplates.id],
  }),
  part: one(parts, {
    fields: [taskTemplateParts.partId],
    references: [parts.id],
  }),
}))

// Work Orders Relations
export const workOrdersRelations = relations(workOrders, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [workOrders.organisationId],
    references: [organisations.id],
  }),
  asset: one(assets, {
    fields: [workOrders.assetId],
    references: [assets.id],
  }),
  template: one(taskTemplates, {
    fields: [workOrders.templateId],
    references: [taskTemplates.id],
  }),
  assignedTo: one(users, {
    fields: [workOrders.assignedToId],
    references: [users.id],
    relationName: 'assignedWorkOrders',
  }),
  createdBy: one(users, {
    fields: [workOrders.createdById],
    references: [users.id],
    relationName: 'createdWorkOrders',
  }),
  statusHistory: many(workOrderStatusHistory),
  checklistItems: many(workOrderChecklistItems),
  parts: many(workOrderParts),
  photos: many(workOrderPhotos),
  defects: many(defects),
}))

// Work Order Status History Relations
export const workOrderStatusHistoryRelations = relations(workOrderStatusHistory, ({ one }) => ({
  workOrder: one(workOrders, {
    fields: [workOrderStatusHistory.workOrderId],
    references: [workOrders.id],
  }),
  changedBy: one(users, {
    fields: [workOrderStatusHistory.changedById],
    references: [users.id],
  }),
}))

// Work Order Checklist Items Relations
export const workOrderChecklistItemsRelations = relations(workOrderChecklistItems, ({ one }) => ({
  workOrder: one(workOrders, {
    fields: [workOrderChecklistItems.workOrderId],
    references: [workOrders.id],
  }),
  completedBy: one(users, {
    fields: [workOrderChecklistItems.completedById],
    references: [users.id],
  }),
}))

// Work Order Parts Relations
export const workOrderPartsRelations = relations(workOrderParts, ({ one }) => ({
  workOrder: one(workOrders, {
    fields: [workOrderParts.workOrderId],
    references: [workOrders.id],
  }),
  addedBy: one(users, {
    fields: [workOrderParts.addedById],
    references: [users.id],
  }),
  // Optional link to parts inventory for stock tracking
  part: one(parts, {
    fields: [workOrderParts.partId],
    references: [parts.id],
  }),
}))

// Work Order Photos Relations
export const workOrderPhotosRelations = relations(workOrderPhotos, ({ one }) => ({
  workOrder: one(workOrders, {
    fields: [workOrderPhotos.workOrderId],
    references: [workOrders.id],
  }),
  uploadedBy: one(users, {
    fields: [workOrderPhotos.uploadedById],
    references: [users.id],
  }),
}))

// Notifications Relations
export const notificationsRelations = relations(notifications, ({ one }) => ({
  organisation: one(organisations, {
    fields: [notifications.organisationId],
    references: [organisations.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}))

// Saved Searches Relations
export const savedSearchesRelations = relations(savedSearches, ({ one }) => ({
  organisation: one(organisations, {
    fields: [savedSearches.organisationId],
    references: [organisations.id],
  }),
  user: one(users, {
    fields: [savedSearches.userId],
    references: [users.id],
  }),
}))

// Maintenance Schedules Relations
export const maintenanceSchedulesRelations = relations(maintenanceSchedules, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [maintenanceSchedules.organisationId],
    references: [organisations.id],
  }),
  asset: one(assets, {
    fields: [maintenanceSchedules.assetId],
    references: [assets.id],
  }),
  category: one(assetCategories, {
    fields: [maintenanceSchedules.categoryId],
    references: [assetCategories.id],
  }),
  template: one(taskTemplates, {
    fields: [maintenanceSchedules.templateId],
    references: [taskTemplates.id],
  }),
  defaultAssignee: one(users, {
    fields: [maintenanceSchedules.defaultAssigneeId],
    references: [users.id],
    relationName: 'scheduleDefaultAssignee',
  }),
  createdBy: one(users, {
    fields: [maintenanceSchedules.createdById],
    references: [users.id],
    relationName: 'scheduleCreatedBy',
  }),
  generatedWorkOrders: many(maintenanceScheduleWorkOrders),
}))

// Maintenance Schedule Work Orders Relations
export const maintenanceScheduleWorkOrdersRelations = relations(
  maintenanceScheduleWorkOrders,
  ({ one }) => ({
    schedule: one(maintenanceSchedules, {
      fields: [maintenanceScheduleWorkOrders.scheduleId],
      references: [maintenanceSchedules.id],
    }),
    workOrder: one(workOrders, {
      fields: [maintenanceScheduleWorkOrders.workOrderId],
      references: [workOrders.id],
    }),
  }),
)

// Part Categories Relations
export const partCategoriesRelations = relations(partCategories, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [partCategories.organisationId],
    references: [organisations.id],
  }),
  parent: one(partCategories, {
    fields: [partCategories.parentId],
    references: [partCategories.id],
    relationName: 'partCategoryParentChild',
  }),
  children: many(partCategories, {
    relationName: 'partCategoryParentChild',
  }),
  parts: many(parts),
}))

// Parts Relations
export const partsRelations = relations(parts, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [parts.organisationId],
    references: [organisations.id],
  }),
  category: one(partCategories, {
    fields: [parts.categoryId],
    references: [partCategories.id],
  }),
  usageHistory: many(partUsageHistory),
  templateParts: many(taskTemplateParts),
  workOrderParts: many(workOrderParts),
  assetCategoryCompatibility: many(assetCategoryParts),
  assetCompatibility: many(assetParts),
}))

// Part Usage History Relations
export const partUsageHistoryRelations = relations(partUsageHistory, ({ one }) => ({
  part: one(parts, {
    fields: [partUsageHistory.partId],
    references: [parts.id],
  }),
  workOrder: one(workOrders, {
    fields: [partUsageHistory.workOrderId],
    references: [workOrders.id],
  }),
  user: one(users, {
    fields: [partUsageHistory.userId],
    references: [users.id],
  }),
}))

// Asset Category Parts Relations (part-category compatibility)
export const assetCategoryPartsRelations = relations(assetCategoryParts, ({ one }) => ({
  category: one(assetCategories, {
    fields: [assetCategoryParts.categoryId],
    references: [assetCategories.id],
  }),
  part: one(parts, {
    fields: [assetCategoryParts.partId],
    references: [parts.id],
  }),
}))

// Asset Parts Relations (part-asset compatibility)
export const assetPartsRelations = relations(assetParts, ({ one }) => ({
  asset: one(assets, {
    fields: [assetParts.assetId],
    references: [assets.id],
  }),
  part: one(parts, {
    fields: [assetParts.partId],
    references: [parts.id],
  }),
}))

// Defects Relations
export const defectsRelations = relations(defects, ({ one }) => ({
  organisation: one(organisations, {
    fields: [defects.organisationId],
    references: [organisations.id],
  }),
  asset: one(assets, {
    fields: [defects.assetId],
    references: [assets.id],
  }),
  workOrder: one(workOrders, {
    fields: [defects.workOrderId],
    references: [workOrders.id],
  }),
  reportedBy: one(users, {
    fields: [defects.reportedById],
    references: [users.id],
    relationName: 'defectReportedBy',
  }),
  resolvedBy: one(users, {
    fields: [defects.resolvedById],
    references: [users.id],
    relationName: 'defectResolvedBy',
  }),
}))
