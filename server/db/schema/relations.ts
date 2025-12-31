import { relations } from 'drizzle-orm'
import { assetCategories } from './asset-categories'
import { assetCategoryParts } from './asset-category-parts'
import { assetDocuments } from './asset-documents'
import { assetLocationHistory } from './asset-location-history'
import { assetParts } from './asset-parts'
import { assets } from './assets'
import { auditLog } from './audit-log'
import { customFormAssignments } from './custom-form-assignments'
import { customFormSubmissions } from './custom-form-submissions'
import { customFormVersions } from './custom-form-versions'
import { customForms } from './custom-forms'
import { dashboardLayouts } from './dashboard-layouts'
import { defects } from './defects'
import { diagnosticCodes } from './diagnostic-codes'
import { documentFolders } from './document-folders'
import { documentLinks } from './document-links'
import { documentVersions } from './document-versions'
import { documents } from './documents'
import { dtcWorkOrderHistory, dtcWorkOrderRules } from './dtc-work-order-rules'
import { fuelAlertSettings } from './fuel-alert-settings'
import { fuelAuthorizations } from './fuel-authorizations'
import { fuelTransactions } from './fuel-transactions'
import { geofenceAlertSettings, geofenceAlerts } from './geofence-alerts'
import { geofences } from './geofences'
import {
  inspectionCheckpointDefinitions,
  inspectionCheckpointScans,
} from './inspection-checkpoints'
import { inspectionItems } from './inspection-items'
import { inspectionTemplates } from './inspection-templates'
import { inspections } from './inspections'
import { integrationHealth, integrationSyncHistory } from './integration-health'
import { inventoryCountItems } from './inventory-count-items'
import { inventoryCountSessions } from './inventory-count-sessions'
import { inventoryTransfers } from './inventory-transfers'
import { jobSiteVisits } from './job-site-visits'
import { locationRecords } from './location-records'
import { maintenanceSchedules, maintenanceScheduleWorkOrders } from './maintenance-schedules'
import { notifications } from './notifications'
import { obdDevices } from './obd-devices'
import { operationBlocks } from './operation-blocks'
import { operatorCertifications } from './operator-certifications'
import { operatorSessions } from './operator-sessions'
import { organisations } from './organisations'
import { partCategories } from './part-categories'
import { partLocationQuantities } from './part-location-quantities'
import { partUsageHistory } from './part-usage-history'
import { parts } from './parts'
import { roles } from './roles'
import { savedSearches } from './saved-searches'
import { scheduledExports } from './scheduled-exports'
import { sessions } from './sessions'
import { storageLocations } from './storage-locations'
import { systemSettings } from './system-settings'
import { taskGroups } from './task-groups'
import { taskOverrides } from './task-overrides'
import { taskTemplateParts } from './task-template-parts'
import { taskTemplates } from './task-templates'
import { uploadChunks, uploadSessions } from './upload-chunks'
import { users } from './users'
import { workOrderApprovals } from './work-order-approvals'
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
  taskGroups: many(taskGroups),
  taskTemplates: many(taskTemplates),
  taskOverrides: many(taskOverrides),
  workOrders: many(workOrders),
  maintenanceSchedules: many(maintenanceSchedules),
  notifications: many(notifications),
  savedSearches: many(savedSearches),
  partCategories: many(partCategories),
  parts: many(parts),
  defects: many(defects),
  approvals: many(workOrderApprovals),
  operatorCertifications: many(operatorCertifications),
  geofences: many(geofences),
  geofenceAlerts: many(geofenceAlerts),
  geofenceAlertSettings: many(geofenceAlertSettings),
  inspectionTemplates: many(inspectionTemplates),
  inspections: many(inspections),
  customForms: many(customForms),
  customFormAssignments: many(customFormAssignments),
  jobSiteVisits: many(jobSiteVisits),
  obdDevices: many(obdDevices),
  operationBlocks: many(operationBlocks),
  diagnosticCodes: many(diagnosticCodes),
  systemSettings: many(systemSettings),
  scheduledExports: many(scheduledExports),
}))

// Work Order Approvals Relations
export const workOrderApprovalsRelations = relations(workOrderApprovals, ({ one }) => ({
  organisation: one(organisations, {
    fields: [workOrderApprovals.organisationId],
    references: [organisations.id],
  }),
  workOrder: one(workOrders, {
    fields: [workOrderApprovals.workOrderId],
    references: [workOrders.id],
  }),
  requestedBy: one(users, {
    fields: [workOrderApprovals.requestedById],
    references: [users.id],
    relationName: 'approvalRequestedBy',
  }),
  reviewedBy: one(users, {
    fields: [workOrderApprovals.reviewedById],
    references: [users.id],
    relationName: 'approvalReviewedBy',
  }),
  emergencyOverrideBy: one(users, {
    fields: [workOrderApprovals.emergencyOverrideById],
    references: [users.id],
    relationName: 'approvalEmergencyOverrideBy',
  }),
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
  // Optional source location for multi-location inventory
  sourceLocation: one(storageLocations, {
    fields: [workOrderParts.sourceLocationId],
    references: [storageLocations.id],
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
  inspection: one(inspections, {
    fields: [defects.inspectionId],
    references: [inspections.id],
  }),
  inspectionItem: one(inspectionItems, {
    fields: [defects.inspectionItemId],
    references: [inspectionItems.id],
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
// Operation Blocks Relations (US-9.6)
export const operationBlocksRelations = relations(operationBlocks, ({ one }) => ({
  organisation: one(organisations, {
    fields: [operationBlocks.organisationId],
    references: [organisations.id],
  }),
  asset: one(assets, {
    fields: [operationBlocks.assetId],
    references: [assets.id],
  }),
  defect: one(defects, {
    fields: [operationBlocks.defectId],
    references: [defects.id],
  }),
  resolvedBy: one(users, {
    fields: [operationBlocks.resolvedById],
    references: [users.id],
    relationName: 'operationBlockResolvedBy',
  }),
  overriddenBy: one(users, {
    fields: [operationBlocks.overriddenById],
    references: [users.id],
    relationName: 'operationBlockOverriddenBy',
  }),
}))

// Task Overrides Relations
export const taskOverridesRelations = relations(taskOverrides, ({ one }) => ({
  organisation: one(organisations, {
    fields: [taskOverrides.organisationId],
    references: [organisations.id],
  }),
  taskTemplate: one(taskTemplates, {
    fields: [taskOverrides.taskTemplateId],
    references: [taskTemplates.id],
  }),
  asset: one(assets, {
    fields: [taskOverrides.assetId],
    references: [assets.id],
  }),
  category: one(assetCategories, {
    fields: [taskOverrides.categoryId],
    references: [assetCategories.id],
  }),
}))

export const inventoryCountSessionsRelations = relations(
  inventoryCountSessions,
  ({ one, many }) => ({
    organisation: one(organisations, {
      fields: [inventoryCountSessions.organisationId],
      references: [organisations.id],
    }),
    startedBy: one(users, {
      fields: [inventoryCountSessions.startedById],
      references: [users.id],
      relationName: 'inventoryCountSessionStartedBy',
    }),
    completedBy: one(users, {
      fields: [inventoryCountSessions.completedById],
      references: [users.id],
      relationName: 'inventoryCountSessionCompletedBy',
    }),
    cancelledBy: one(users, {
      fields: [inventoryCountSessions.cancelledById],
      references: [users.id],
      relationName: 'inventoryCountSessionCancelledBy',
    }),
    items: many(inventoryCountItems),
  }),
)

export const inventoryCountItemsRelations = relations(inventoryCountItems, ({ one }) => ({
  session: one(inventoryCountSessions, {
    fields: [inventoryCountItems.sessionId],
    references: [inventoryCountSessions.id],
  }),
  part: one(parts, {
    fields: [inventoryCountItems.partId],
    references: [parts.id],
  }),
  adjustedBy: one(users, {
    fields: [inventoryCountItems.adjustedById],
    references: [users.id],
  }),
}))

// Storage Locations Relations
export const storageLocationsRelations = relations(storageLocations, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [storageLocations.organisationId],
    references: [organisations.id],
  }),
  parent: one(storageLocations, {
    fields: [storageLocations.parentId],
    references: [storageLocations.id],
    relationName: 'locationParentChild',
  }),
  children: many(storageLocations, {
    relationName: 'locationParentChild',
  }),
  partQuantities: many(partLocationQuantities),
  transfersFrom: many(inventoryTransfers, { relationName: 'transfersFrom' }),
  transfersTo: many(inventoryTransfers, { relationName: 'transfersTo' }),
}))

// Part Location Quantities Relations
export const partLocationQuantitiesRelations = relations(partLocationQuantities, ({ one }) => ({
  organisation: one(organisations, {
    fields: [partLocationQuantities.organisationId],
    references: [organisations.id],
  }),
  part: one(parts, {
    fields: [partLocationQuantities.partId],
    references: [parts.id],
  }),
  location: one(storageLocations, {
    fields: [partLocationQuantities.locationId],
    references: [storageLocations.id],
  }),
}))

// Inventory Transfers Relations
export const inventoryTransfersRelations = relations(inventoryTransfers, ({ one }) => ({
  organisation: one(organisations, {
    fields: [inventoryTransfers.organisationId],
    references: [organisations.id],
  }),
  part: one(parts, {
    fields: [inventoryTransfers.partId],
    references: [parts.id],
  }),
  fromLocation: one(storageLocations, {
    fields: [inventoryTransfers.fromLocationId],
    references: [storageLocations.id],
    relationName: 'transfersFrom',
  }),
  toLocation: one(storageLocations, {
    fields: [inventoryTransfers.toLocationId],
    references: [storageLocations.id],
    relationName: 'transfersTo',
  }),
  transferredBy: one(users, {
    fields: [inventoryTransfers.transferredById],
    references: [users.id],
  }),
}))

// Operator Sessions Relations
export const operatorSessionsRelations = relations(operatorSessions, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [operatorSessions.organisationId],
    references: [organisations.id],
  }),
  asset: one(assets, {
    fields: [operatorSessions.assetId],
    references: [assets.id],
  }),
  operator: one(users, {
    fields: [operatorSessions.operatorId],
    references: [users.id],
  }),
  // Handover relations (US-8.5)
  handoverFromSession: one(operatorSessions, {
    fields: [operatorSessions.handoverFromSessionId],
    references: [operatorSessions.id],
    relationName: 'sessionHandover',
  }),
  handoverToSessions: many(operatorSessions, {
    relationName: 'sessionHandover',
  }),
  fuelTransactions: many(fuelTransactions),
  fuelAuthorizations: many(fuelAuthorizations),
  locationRecords: many(locationRecords),
}))

// Fuel Transactions Relations
export const fuelTransactionsRelations = relations(fuelTransactions, ({ one }) => ({
  organisation: one(organisations, {
    fields: [fuelTransactions.organisationId],
    references: [organisations.id],
  }),
  asset: one(assets, {
    fields: [fuelTransactions.assetId],
    references: [assets.id],
  }),
  operatorSession: one(operatorSessions, {
    fields: [fuelTransactions.operatorSessionId],
    references: [operatorSessions.id],
  }),
  user: one(users, {
    fields: [fuelTransactions.userId],
    references: [users.id],
  }),
}))

// Fuel Authorizations Relations
export const fuelAuthorizationsRelations = relations(fuelAuthorizations, ({ one }) => ({
  organisation: one(organisations, {
    fields: [fuelAuthorizations.organisationId],
    references: [organisations.id],
  }),
  asset: one(assets, {
    fields: [fuelAuthorizations.assetId],
    references: [assets.id],
  }),
  operatorSession: one(operatorSessions, {
    fields: [fuelAuthorizations.operatorSessionId],
    references: [operatorSessions.id],
  }),
  operator: one(users, {
    fields: [fuelAuthorizations.operatorId],
    references: [users.id],
  }),
  fuelTransaction: one(fuelTransactions, {
    fields: [fuelAuthorizations.fuelTransactionId],
    references: [fuelTransactions.id],
  }),
}))

// Location Records Relations
export const locationRecordsRelations = relations(locationRecords, ({ one }) => ({
  organisation: one(organisations, {
    fields: [locationRecords.organisationId],
    references: [organisations.id],
  }),
  asset: one(assets, {
    fields: [locationRecords.assetId],
    references: [assets.id],
  }),
  operatorSession: one(operatorSessions, {
    fields: [locationRecords.operatorSessionId],
    references: [operatorSessions.id],
  }),
}))

// Operator Certifications Relations
export const operatorCertificationsRelations = relations(operatorCertifications, ({ one }) => ({
  organisation: one(organisations, {
    fields: [operatorCertifications.organisationId],
    references: [organisations.id],
  }),
  operator: one(users, {
    fields: [operatorCertifications.operatorId],
    references: [users.id],
  }),
}))

// Users Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [users.organisationId],
    references: [organisations.id],
  }),
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
  workOrders: many(workOrders),
  notifications: many(notifications),
  sessions: many(sessions),
  certifications: many(operatorCertifications),
  dashboardLayout: one(dashboardLayouts, {
    fields: [users.id],
    references: [dashboardLayouts.userId],
  }),
}))

// Dashboard Layouts Relations (US-14.2)
export const dashboardLayoutsRelations = relations(dashboardLayouts, ({ one }) => ({
  user: one(users, {
    fields: [dashboardLayouts.userId],
    references: [users.id],
  }),
}))

// Roles Relations
export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
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

// Task Templates Relations
export const taskTemplatesRelations = relations(taskTemplates, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [taskTemplates.organisationId],
    references: [organisations.id],
  }),
  group: one(taskGroups, {
    fields: [taskTemplates.groupId],
    references: [taskGroups.id],
  }),
  templateParts: many(taskTemplateParts),
  overrides: many(taskOverrides),
  maintenanceSchedules: many(maintenanceSchedules),
}))

// Task Groups Relations
export const taskGroupsRelations = relations(taskGroups, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [taskGroups.organisationId],
    references: [organisations.id],
  }),
  parent: one(taskGroups, {
    fields: [taskGroups.parentId],
    references: [taskGroups.id],
    relationName: 'taskGroupParentChild',
  }),
  children: many(taskGroups, {
    relationName: 'taskGroupParentChild',
  }),
  templates: many(taskTemplates),
}))

// Assets Relations
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
  defects: many(defects),
  documents: many(assetDocuments),
  locationHistory: many(assetLocationHistory),
  maintenanceSchedules: many(maintenanceSchedules),
  operatorSessions: many(operatorSessions),
  fuelTransactions: many(fuelTransactions),
  locationRecords: many(locationRecords),
  compatibleParts: many(assetParts),
  obdDevices: many(obdDevices),
  operationBlocks: many(operationBlocks),
  diagnosticCodes: many(diagnosticCodes),
}))

// Asset Categories Relations
export const assetCategoriesRelations = relations(assetCategories, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [assetCategories.organisationId],
    references: [organisations.id],
  }),
  parent: one(assetCategories, {
    fields: [assetCategories.parentId],
    references: [assetCategories.id],
    relationName: 'assetCategoryParentChild',
  }),
  children: many(assetCategories, {
    relationName: 'assetCategoryParentChild',
  }),
  assets: many(assets),
  compatibleParts: many(assetCategoryParts),
  maintenanceSchedules: many(maintenanceSchedules),
  taskOverrides: many(taskOverrides),
  inspectionCheckpointDefinitions: many(inspectionCheckpointDefinitions),
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
  assignee: one(users, {
    fields: [workOrders.assignedToId],
    references: [users.id],
    relationName: 'workOrderAssignee',
  }),
  createdBy: one(users, {
    fields: [workOrders.createdById],
    references: [users.id],
    relationName: 'workOrderCreatedBy',
  }),
  checklistItems: many(workOrderChecklistItems),
  parts: many(workOrderParts),
  photos: many(workOrderPhotos),
  statusHistory: many(workOrderStatusHistory),
  approvals: many(workOrderApprovals),
  defects: many(defects),
}))

// Asset Documents Relations
export const assetDocumentsRelations = relations(assetDocuments, ({ one }) => ({
  asset: one(assets, {
    fields: [assetDocuments.assetId],
    references: [assets.id],
  }),
  uploadedBy: one(users, {
    fields: [assetDocuments.uploadedById],
    references: [users.id],
  }),
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

// Sessions Relations
export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

// Geofences Relations
export const geofencesRelations = relations(geofences, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [geofences.organisationId],
    references: [organisations.id],
  }),
  alertSettings: many(geofenceAlertSettings),
  alerts: many(geofenceAlerts),
  jobSiteVisits: many(jobSiteVisits),
}))

// Geofence Alert Settings Relations
export const geofenceAlertSettingsRelations = relations(geofenceAlertSettings, ({ one }) => ({
  organisation: one(organisations, {
    fields: [geofenceAlertSettings.organisationId],
    references: [organisations.id],
  }),
  geofence: one(geofences, {
    fields: [geofenceAlertSettings.geofenceId],
    references: [geofences.id],
  }),
}))

// Geofence Alerts Relations
export const geofenceAlertsRelations = relations(geofenceAlerts, ({ one }) => ({
  organisation: one(organisations, {
    fields: [geofenceAlerts.organisationId],
    references: [organisations.id],
  }),
  geofence: one(geofences, {
    fields: [geofenceAlerts.geofenceId],
    references: [geofences.id],
  }),
  asset: one(assets, {
    fields: [geofenceAlerts.assetId],
    references: [assets.id],
  }),
  operatorSession: one(operatorSessions, {
    fields: [geofenceAlerts.operatorSessionId],
    references: [operatorSessions.id],
  }),
  acknowledgedBy: one(users, {
    fields: [geofenceAlerts.acknowledgedById],
    references: [users.id],
  }),
}))

// Integration Health Relations
export const integrationHealthRelations = relations(integrationHealth, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [integrationHealth.organisationId],
    references: [organisations.id],
  }),
  syncHistory: many(integrationSyncHistory),
}))

// Integration Sync History Relations
export const integrationSyncHistoryRelations = relations(integrationSyncHistory, ({ one }) => ({
  integrationHealth: one(integrationHealth, {
    fields: [integrationSyncHistory.integrationHealthId],
    references: [integrationHealth.id],
  }),
  organisation: one(organisations, {
    fields: [integrationSyncHistory.organisationId],
    references: [organisations.id],
  }),
}))

// Inspection Templates Relations
export const inspectionTemplatesRelations = relations(inspectionTemplates, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [inspectionTemplates.organisationId],
    references: [organisations.id],
  }),
  category: one(assetCategories, {
    fields: [inspectionTemplates.categoryId],
    references: [assetCategories.id],
  }),
  inspections: many(inspections),
}))

// Inspections Relations
export const inspectionsRelations = relations(inspections, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [inspections.organisationId],
    references: [organisations.id],
  }),
  asset: one(assets, {
    fields: [inspections.assetId],
    references: [assets.id],
  }),
  template: one(inspectionTemplates, {
    fields: [inspections.templateId],
    references: [inspectionTemplates.id],
  }),
  operator: one(users, {
    fields: [inspections.operatorId],
    references: [users.id],
    relationName: 'inspectionOperator',
  }),
  operatorSession: one(operatorSessions, {
    fields: [inspections.operatorSessionId],
    references: [operatorSessions.id],
  }),
  signedBy: one(users, {
    fields: [inspections.signedById],
    references: [users.id],
    relationName: 'inspectionSignedBy',
  }),
  items: many(inspectionItems),
  defects: many(defects),
  checkpointScans: many(inspectionCheckpointScans),
}))

// Inspection Items Relations
export const inspectionItemsRelations = relations(inspectionItems, ({ one, many }) => ({
  inspection: one(inspections, {
    fields: [inspectionItems.inspectionId],
    references: [inspections.id],
  }),
  defects: many(defects),
}))

// Job Site Visits Relations
export const jobSiteVisitsRelations = relations(jobSiteVisits, ({ one }) => ({
  organisation: one(organisations, {
    fields: [jobSiteVisits.organisationId],
    references: [organisations.id],
  }),
  geofence: one(geofences, {
    fields: [jobSiteVisits.geofenceId],
    references: [geofences.id],
  }),
  asset: one(assets, {
    fields: [jobSiteVisits.assetId],
    references: [assets.id],
  }),
  operatorSession: one(operatorSessions, {
    fields: [jobSiteVisits.operatorSessionId],
    references: [operatorSessions.id],
  }),
}))

// Custom Forms Relations
export const customFormsRelations = relations(customForms, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [customForms.organisationId],
    references: [organisations.id],
  }),
  createdBy: one(users, {
    fields: [customForms.createdById],
    references: [users.id],
    relationName: 'customFormCreatedBy',
  }),
  updatedBy: one(users, {
    fields: [customForms.updatedById],
    references: [users.id],
    relationName: 'customFormUpdatedBy',
  }),
  assignments: many(customFormAssignments),
  versions: many(customFormVersions),
  submissions: many(customFormSubmissions),
}))

// Custom Form Versions Relations
export const customFormVersionsRelations = relations(customFormVersions, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [customFormVersions.organisationId],
    references: [organisations.id],
  }),
  form: one(customForms, {
    fields: [customFormVersions.formId],
    references: [customForms.id],
  }),
  publishedBy: one(users, {
    fields: [customFormVersions.publishedById],
    references: [users.id],
  }),
  submissions: many(customFormSubmissions),
}))

// Custom Form Submissions Relations
export const customFormSubmissionsRelations = relations(customFormSubmissions, ({ one }) => ({
  organisation: one(organisations, {
    fields: [customFormSubmissions.organisationId],
    references: [organisations.id],
  }),
  form: one(customForms, {
    fields: [customFormSubmissions.formId],
    references: [customForms.id],
  }),
  version: one(customFormVersions, {
    fields: [customFormSubmissions.versionId],
    references: [customFormVersions.id],
  }),
  submittedBy: one(users, {
    fields: [customFormSubmissions.submittedById],
    references: [users.id],
    relationName: 'formSubmittedBy',
  }),
  reviewedBy: one(users, {
    fields: [customFormSubmissions.reviewedById],
    references: [users.id],
    relationName: 'formReviewedBy',
  }),
}))

// Custom Form Assignments Relations
export const customFormAssignmentsRelations = relations(customFormAssignments, ({ one }) => ({
  organisation: one(organisations, {
    fields: [customFormAssignments.organisationId],
    references: [organisations.id],
  }),
  form: one(customForms, {
    fields: [customFormAssignments.formId],
    references: [customForms.id],
  }),
  categoryFilter: one(assetCategories, {
    fields: [customFormAssignments.categoryFilterId],
    references: [assetCategories.id],
  }),
  createdBy: one(users, {
    fields: [customFormAssignments.createdById],
    references: [users.id],
  }),
}))

// Inspection Checkpoint Definitions Relations
export const inspectionCheckpointDefinitionsRelations = relations(
  inspectionCheckpointDefinitions,
  ({ one, many }) => ({
    organisation: one(organisations, {
      fields: [inspectionCheckpointDefinitions.organisationId],
      references: [organisations.id],
    }),
    assetCategory: one(assetCategories, {
      fields: [inspectionCheckpointDefinitions.assetCategoryId],
      references: [assetCategories.id],
    }),
    scans: many(inspectionCheckpointScans),
  }),
)

// Inspection Checkpoint Scans Relations
export const inspectionCheckpointScansRelations = relations(
  inspectionCheckpointScans,
  ({ one }) => ({
    inspection: one(inspections, {
      fields: [inspectionCheckpointScans.inspectionId],
      references: [inspections.id],
    }),
    checkpointDefinition: one(inspectionCheckpointDefinitions, {
      fields: [inspectionCheckpointScans.checkpointDefinitionId],
      references: [inspectionCheckpointDefinitions.id],
    }),
    scannedBy: one(users, {
      fields: [inspectionCheckpointScans.scannedById],
      references: [users.id],
    }),
  }),
)

// OBD Devices Relations (US-10.1, US-10.2)
export const obdDevicesRelations = relations(obdDevices, ({ one }) => ({
  organisation: one(organisations, {
    fields: [obdDevices.organisationId],
    references: [organisations.id],
  }),
  asset: one(assets, {
    fields: [obdDevices.assetId],
    references: [assets.id],
  }),
  pairedBy: one(users, {
    fields: [obdDevices.pairedById],
    references: [users.id],
  }),
}))

// DTC Work Order Rules Relations (US-10.7)
export const dtcWorkOrderRulesRelations = relations(dtcWorkOrderRules, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [dtcWorkOrderRules.organisationId],
    references: [organisations.id],
  }),
  createdBy: one(users, {
    fields: [dtcWorkOrderRules.createdById],
    references: [users.id],
    relationName: 'dtcRuleCreatedBy',
  }),
  autoAssignTo: one(users, {
    fields: [dtcWorkOrderRules.autoAssignToId],
    references: [users.id],
    relationName: 'dtcRuleAutoAssignTo',
  }),
  template: one(taskTemplates, {
    fields: [dtcWorkOrderRules.templateId],
    references: [taskTemplates.id],
  }),
  history: many(dtcWorkOrderHistory),
}))

// DTC Work Order History Relations (US-10.7)
export const dtcWorkOrderHistoryRelations = relations(dtcWorkOrderHistory, ({ one }) => ({
  organisation: one(organisations, {
    fields: [dtcWorkOrderHistory.organisationId],
    references: [organisations.id],
  }),
  asset: one(assets, {
    fields: [dtcWorkOrderHistory.assetId],
    references: [assets.id],
  }),
  rule: one(dtcWorkOrderRules, {
    fields: [dtcWorkOrderHistory.ruleId],
    references: [dtcWorkOrderRules.id],
  }),
  workOrder: one(workOrders, {
    fields: [dtcWorkOrderHistory.workOrderId],
    references: [workOrders.id],
  }),
}))

// Diagnostic Codes Relations (US-10.3, US-10.4)
export const diagnosticCodesRelations = relations(diagnosticCodes, ({ one }) => ({
  organisation: one(organisations, {
    fields: [diagnosticCodes.organisationId],
    references: [organisations.id],
  }),
  asset: one(assets, {
    fields: [diagnosticCodes.assetId],
    references: [assets.id],
  }),
  readByUser: one(users, {
    fields: [diagnosticCodes.readByUserId],
    references: [users.id],
    relationName: 'dtcReadByUser',
  }),
  clearedByUser: one(users, {
    fields: [diagnosticCodes.clearedByUserId],
    references: [users.id],
    relationName: 'dtcClearedByUser',
  }),
  workOrder: one(workOrders, {
    fields: [diagnosticCodes.workOrderId],
    references: [workOrders.id],
  }),
}))

// Fuel Alert Settings Relations (US-11.5)
export const fuelAlertSettingsRelations = relations(fuelAlertSettings, ({ one }) => ({
  organisation: one(organisations, {
    fields: [fuelAlertSettings.organisationId],
    references: [organisations.id],
  }),
  updatedBy: one(users, {
    fields: [fuelAlertSettings.updatedById],
    references: [users.id],
  }),
}))

// Document Folders Relations (US-15.2)
export const documentFoldersRelations = relations(documentFolders, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [documentFolders.organisationId],
    references: [organisations.id],
  }),
  parent: one(documentFolders, {
    fields: [documentFolders.parentId],
    references: [documentFolders.id],
    relationName: 'folderParentChild',
  }),
  children: many(documentFolders, {
    relationName: 'folderParentChild',
  }),
  documents: many(documents),
  createdBy: one(users, {
    fields: [documentFolders.createdById],
    references: [users.id],
  }),
}))

// Documents Relations (US-15.1)
export const documentsRelations = relations(documents, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [documents.organisationId],
    references: [organisations.id],
  }),
  folder: one(documentFolders, {
    fields: [documents.folderId],
    references: [documentFolders.id],
  }),
  versions: many(documentVersions),
  links: many(documentLinks),
  currentVersion: one(documentVersions, {
    fields: [documents.currentVersionId],
    references: [documentVersions.id],
  }),
  uploadedBy: one(users, {
    fields: [documents.uploadedById],
    references: [users.id],
  }),
}))

// Document Versions Relations (US-15.5)
export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
  document: one(documents, {
    fields: [documentVersions.documentId],
    references: [documents.id],
  }),
  uploadedBy: one(users, {
    fields: [documentVersions.uploadedById],
    references: [users.id],
  }),
}))

// Document Links Relations (US-15.3)
export const documentLinksRelations = relations(documentLinks, ({ one }) => ({
  document: one(documents, {
    fields: [documentLinks.documentId],
    references: [documents.id],
  }),
  linkedBy: one(users, {
    fields: [documentLinks.linkedById],
    references: [users.id],
  }),
}))

// Upload Sessions Relations (US-15.1 - Chunked Uploads)
export const uploadSessionsRelations = relations(uploadSessions, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [uploadSessions.organisationId],
    references: [organisations.id],
  }),
  user: one(users, {
    fields: [uploadSessions.userId],
    references: [users.id],
  }),
  chunks: many(uploadChunks),
}))

// Upload Chunks Relations (US-15.1)
export const uploadChunksRelations = relations(uploadChunks, ({ one }) => ({
  session: one(uploadSessions, {
    fields: [uploadChunks.sessionId],
    references: [uploadSessions.id],
  }),
}))

// System Settings Relations (US-17.4)
export const systemSettingsRelations = relations(systemSettings, ({ one }) => ({
  organisation: one(organisations, {
    fields: [systemSettings.organisationId],
    references: [organisations.id],
  }),
  updatedBy: one(users, {
    fields: [systemSettings.updatedById],
    references: [users.id],
  }),
}))

// Scheduled Exports Relations (US-17.7)
export const scheduledExportsRelations = relations(scheduledExports, ({ one }) => ({
  organisation: one(organisations, {
    fields: [scheduledExports.organisationId],
    references: [organisations.id],
  }),
  createdBy: one(users, {
    fields: [scheduledExports.createdById],
    references: [users.id],
  }),
}))
