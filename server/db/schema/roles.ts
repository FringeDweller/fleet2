import { pgTable, uuid, varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core'

// Predefined roles: Admin, Fleet Manager, Supervisor, Technician, Operator
export const ROLES = {
  ADMIN: 'admin',
  FLEET_MANAGER: 'fleet_manager',
  SUPERVISOR: 'supervisor',
  TECHNICIAN: 'technician',
  OPERATOR: 'operator'
} as const

export type RoleName = (typeof ROLES)[keyof typeof ROLES]

export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  description: text('description'),
  permissions: jsonb('permissions').$type<string[]>().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
})

export type Role = typeof roles.$inferSelect
export type NewRole = typeof roles.$inferInsert

// Default permissions for each role
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleName, string[]> = {
  [ROLES.ADMIN]: ['*'], // All permissions
  [ROLES.FLEET_MANAGER]: [
    'assets:read',
    'assets:write',
    'assets:delete',
    'work_orders:read',
    'work_orders:write',
    'work_orders:delete',
    'reports:read',
    'reports:write',
    'users:read',
    'settings:read',
    'settings:write'
  ],
  [ROLES.SUPERVISOR]: [
    'assets:read',
    'assets:write',
    'work_orders:read',
    'work_orders:write',
    'reports:read',
    'users:read'
  ],
  [ROLES.TECHNICIAN]: [
    'assets:read',
    'work_orders:read',
    'work_orders:write',
    'reports:read'
  ],
  [ROLES.OPERATOR]: [
    'assets:read',
    'work_orders:read'
  ]
}
