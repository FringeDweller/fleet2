import { relations } from 'drizzle-orm'
import { organisations } from './organisations'
import { roles } from './roles'
import { users } from './users'
import { sessions } from './sessions'
import { auditLog } from './audit-log'
import { assetCategories } from './asset-categories'
import { assets } from './assets'

export const organisationsRelations = relations(organisations, ({ many }) => ({
  users: many(users),
  assetCategories: many(assetCategories),
  assets: many(assets),
  auditLogs: many(auditLog)
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
  auditLogs: many(auditLog)
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

export const assetsRelations = relations(assets, ({ one }) => ({
  organisation: one(organisations, {
    fields: [assets.organisationId],
    references: [organisations.id]
  }),
  category: one(assetCategories, {
    fields: [assets.categoryId],
    references: [assetCategories.id]
  })
}))
