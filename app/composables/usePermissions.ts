import { createSharedComposable } from '@vueuse/core'

export type Permission =
  | 'assets:read'
  | 'assets:write'
  | 'assets:delete'
  | 'work_orders:read'
  | 'work_orders:write'
  | 'work_orders:delete'
  | 'reports:read'
  | 'reports:write'
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  | 'settings:read'
  | 'settings:write'
  | 'parts:read'
  | 'parts:write'
  | 'parts:delete'
  | 'maintenance:read'
  | 'maintenance:write'
  | 'maintenance:delete'
  | '*'

export type RoleName = 'admin' | 'fleet_manager' | 'supervisor' | 'technician' | 'operator'

const _usePermissions = () => {
  const { user } = useUserSession()

  const permissions = computed<string[]>(() => {
    return user.value?.permissions || []
  })

  const roleName = computed<RoleName | null>(() => {
    return user.value?.roleName || null
  })

  /**
   * Check if user has a specific permission
   */
  const hasPermission = (required: Permission): boolean => {
    const perms = permissions.value
    if (perms.includes('*')) return true
    return perms.includes(required)
  }

  /**
   * Check if user has any of the specified permissions
   */
  const hasAnyPermission = (required: Permission[]): boolean => {
    const perms = permissions.value
    if (perms.includes('*')) return true
    return required.some((p) => perms.includes(p))
  }

  /**
   * Check if user has all of the specified permissions
   */
  const hasAllPermissions = (required: Permission[]): boolean => {
    const perms = permissions.value
    if (perms.includes('*')) return true
    return required.every((p) => perms.includes(p))
  }

  /**
   * Check if user has admin role
   */
  const isAdmin = computed(() => {
    return roleName.value === 'admin' || permissions.value.includes('*')
  })

  /**
   * Check if user has manager-level role or higher
   */
  const isManager = computed(() => {
    return isAdmin.value || roleName.value === 'fleet_manager'
  })

  /**
   * Check if user has supervisor-level role or higher
   */
  const isSupervisor = computed(() => {
    return isManager.value || roleName.value === 'supervisor'
  })

  /**
   * Reactive permission check (returns a computed ref)
   */
  const can = (permission: Permission) => {
    return computed(() => hasPermission(permission))
  }

  /**
   * Reactive check for any permissions (returns a computed ref)
   */
  const canAny = (required: Permission[]) => {
    return computed(() => hasAnyPermission(required))
  }

  /**
   * Reactive check for all permissions (returns a computed ref)
   */
  const canAll = (required: Permission[]) => {
    return computed(() => hasAllPermissions(required))
  }

  // Common permission shortcuts as computed refs
  const canReadAssets = computed(() => hasPermission('assets:read'))
  const canWriteAssets = computed(() => hasPermission('assets:write'))
  const canDeleteAssets = computed(() => hasPermission('assets:delete'))

  const canReadWorkOrders = computed(() => hasPermission('work_orders:read'))
  const canWriteWorkOrders = computed(() => hasPermission('work_orders:write'))
  const canDeleteWorkOrders = computed(() => hasPermission('work_orders:delete'))

  const canReadReports = computed(() => hasPermission('reports:read'))
  const canWriteReports = computed(() => hasPermission('reports:write'))

  const canReadUsers = computed(() => hasPermission('users:read'))
  const canWriteUsers = computed(() => hasPermission('users:write'))
  const canDeleteUsers = computed(() => hasPermission('users:delete'))

  const canReadSettings = computed(() => hasPermission('settings:read'))
  const canWriteSettings = computed(() => hasPermission('settings:write'))

  const canReadParts = computed(() => hasPermission('parts:read'))
  const canWriteParts = computed(() => hasPermission('parts:write'))
  const canDeleteParts = computed(() => hasPermission('parts:delete'))

  const canReadMaintenance = computed(() => hasPermission('maintenance:read'))
  const canWriteMaintenance = computed(() => hasPermission('maintenance:write'))
  const canDeleteMaintenance = computed(() => hasPermission('maintenance:delete'))

  return {
    // Raw values
    permissions,
    roleName,

    // Check functions (non-reactive)
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,

    // Reactive helpers
    can,
    canAny,
    canAll,

    // Role checks
    isAdmin,
    isManager,
    isSupervisor,

    // Permission shortcuts
    canReadAssets,
    canWriteAssets,
    canDeleteAssets,
    canReadWorkOrders,
    canWriteWorkOrders,
    canDeleteWorkOrders,
    canReadReports,
    canWriteReports,
    canReadUsers,
    canWriteUsers,
    canDeleteUsers,
    canReadSettings,
    canWriteSettings,
    canReadParts,
    canWriteParts,
    canDeleteParts,
    canReadMaintenance,
    canWriteMaintenance,
    canDeleteMaintenance,
  }
}

export const usePermissions = createSharedComposable(_usePermissions)
