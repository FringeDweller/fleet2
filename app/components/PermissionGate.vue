<script setup lang="ts">
import type { Permission } from '~/composables/usePermissions'

const props = defineProps<{
  /** Single permission to check */
  permission?: Permission
  /** Multiple permissions - user must have ALL of them */
  permissions?: Permission[]
  /** Multiple permissions - user must have ANY of them */
  anyPermission?: Permission[]
  /** Require admin role */
  admin?: boolean
  /** Require manager role or higher */
  manager?: boolean
  /** Require supervisor role or higher */
  supervisor?: boolean
  /** Invert the check - show content when permission is NOT granted */
  not?: boolean
}>()

const { hasPermission, hasAllPermissions, hasAnyPermission, isAdmin, isManager, isSupervisor } =
  usePermissions()

const hasAccess = computed(() => {
  let result = true

  // Check single permission
  if (props.permission) {
    result = result && hasPermission(props.permission)
  }

  // Check all permissions
  if (props.permissions && props.permissions.length > 0) {
    result = result && hasAllPermissions(props.permissions)
  }

  // Check any permission
  if (props.anyPermission && props.anyPermission.length > 0) {
    result = result && hasAnyPermission(props.anyPermission)
  }

  // Check role-based access
  if (props.admin) {
    result = result && isAdmin.value
  }

  if (props.manager) {
    result = result && isManager.value
  }

  if (props.supervisor) {
    result = result && isSupervisor.value
  }

  // Invert if requested
  return props.not ? !result : result
})
</script>

<template>
  <slot v-if="hasAccess" />
  <slot v-else name="fallback" />
</template>
