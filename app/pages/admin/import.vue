<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
  middleware: 'auth',
})

type ImportEntity = 'assets' | 'parts' | 'users'

interface ValidationError {
  row: number
  field: string
  message: string
  value?: unknown
}

interface PreviewRow {
  rowNumber: number
  data: Record<string, unknown>
  errors: ValidationError[]
  warnings: string[]
}

interface PreviewSummary {
  totalRows: number
  validRows: number
  errorRows: number
  warningRows: number
  canImport: boolean
}

interface PreviewResponse {
  entity: ImportEntity
  summary: PreviewSummary
  rows: PreviewRow[]
}

interface ImportReport {
  timestamp: string
  entity: ImportEntity
  userId: string
  summary: {
    totalRows: number
    imported: number
    skipped: number
    errors: number
  }
  errors: Array<{ row: number; message: string }>
  skippedIdentifiers: string[]
}

interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  errors: Array<{ row: number; message: string }>
  skippedIdentifiers: string[]
  report: ImportReport
}

const UBadge = resolveComponent('UBadge')

const toast = useToast()
const router = useRouter()
const { isAdmin } = usePermissions()

// Redirect if not admin
watch(
  isAdmin,
  (val) => {
    if (val === false) {
      router.push('/')
    }
  },
  { immediate: true },
)

// Entity options
const entityOptions = [
  {
    label: 'Assets',
    value: 'assets' as ImportEntity,
    icon: 'i-lucide-truck',
    description: 'Import fleet assets with their details',
  },
  {
    label: 'Parts',
    value: 'parts' as ImportEntity,
    icon: 'i-lucide-package',
    description: 'Import inventory parts with stock levels',
  },
  {
    label: 'Users',
    value: 'users' as ImportEntity,
    icon: 'i-lucide-users',
    description: 'Import team members (password reset email will be sent)',
  },
]

// State
const selectedEntity = ref<ImportEntity>('assets')
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const csvContent = ref<string>('')
const previewData = ref<PreviewResponse | null>(null)
const importResult = ref<ImportResult | null>(null)
const isValidating = ref(false)
const isImporting = ref(false)
const showPreview = ref(false)
const showResults = ref(false)
const isDragOver = ref(false)

// Computed
const currentEntityOption = computed(() => {
  return entityOptions.find((e) => e.value === selectedEntity.value) || entityOptions[0]
})

// File upload handlers
function handleDragOver(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = true
}

function handleDragLeave() {
  isDragOver.value = false
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = false

  const file = event.dataTransfer?.files?.[0]
  if (file) {
    processFile(file)
  }
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    processFile(file)
  }
}

function processFile(file: File) {
  if (!file.name.endsWith('.csv')) {
    toast.add({
      title: 'Invalid file type',
      description: 'Please select a CSV file',
      color: 'error',
    })
    return
  }

  // Check file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    toast.add({
      title: 'File too large',
      description: 'Maximum file size is 5MB',
      color: 'error',
    })
    return
  }

  selectedFile.value = file
  showResults.value = false
  importResult.value = null

  // Read file content
  const reader = new FileReader()
  reader.onload = (e) => {
    csvContent.value = e.target?.result as string
    validateCSV()
  }
  reader.onerror = () => {
    toast.add({
      title: 'Error reading file',
      description: 'Failed to read the CSV file',
      color: 'error',
    })
  }
  reader.readAsText(file)
}

// Download template
async function downloadTemplate() {
  try {
    window.location.href = `/api/admin/import/templates/${selectedEntity.value}`
    toast.add({
      title: 'Template download started',
      description: 'Your CSV template download will begin shortly',
    })
  } catch {
    toast.add({
      title: 'Error',
      description: 'Failed to download template',
      color: 'error',
    })
  }
}

// Validate CSV and show preview
async function validateCSV() {
  if (!csvContent.value) return

  isValidating.value = true
  try {
    const response = await $fetch<PreviewResponse>('/api/admin/import/preview', {
      method: 'POST',
      body: {
        entity: selectedEntity.value,
        csv: csvContent.value,
      },
    })

    previewData.value = response
    showPreview.value = true

    if (response.summary.errorRows > 0) {
      toast.add({
        title: 'Validation errors found',
        description: `${response.summary.errorRows} row(s) have errors that must be fixed`,
        color: 'error',
      })
    } else if (response.summary.warningRows > 0) {
      toast.add({
        title: 'Validation complete with warnings',
        description: `${response.summary.warningRows} row(s) have warnings`,
        color: 'warning',
      })
    } else {
      toast.add({
        title: 'Validation successful',
        description: `All ${response.summary.validRows} row(s) are ready to import`,
        color: 'success',
      })
    }
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }; statusMessage?: string }
    toast.add({
      title: 'Validation failed',
      description: err.data?.message || err.statusMessage || 'Failed to validate CSV',
      color: 'error',
    })
    showPreview.value = false
  } finally {
    isValidating.value = false
  }
}

// Execute import
async function executeImport() {
  if (!csvContent.value || !previewData.value?.summary.canImport) return

  isImporting.value = true
  try {
    const response = await $fetch<ImportResult>('/api/admin/import/execute', {
      method: 'POST',
      body: {
        entity: selectedEntity.value,
        csv: csvContent.value,
      },
    })

    importResult.value = response
    showResults.value = true

    if (response.success) {
      toast.add({
        title: 'Import successful',
        description: `Imported ${response.imported} ${selectedEntity.value}${response.skipped > 0 ? `, skipped ${response.skipped} duplicate(s)` : ''}`,
        color: 'success',
      })
    } else {
      toast.add({
        title: 'Import completed with errors',
        description: `${response.errors.length} error(s) occurred during import`,
        color: 'warning',
      })
    }
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }; statusMessage?: string }
    toast.add({
      title: 'Import failed',
      description: err.data?.message || err.statusMessage || 'Failed to import data',
      color: 'error',
    })
  } finally {
    isImporting.value = false
  }
}

// Download error report
function downloadErrorReport() {
  if (!importResult.value?.report) return

  const report = importResult.value.report
  const lines: string[] = []

  lines.push('Import Report')
  lines.push(`Entity,${report.entity}`)
  lines.push(`Timestamp,${report.timestamp}`)
  lines.push('')
  lines.push('Summary')
  lines.push(`Total Rows,${report.summary.totalRows}`)
  lines.push(`Imported,${report.summary.imported}`)
  lines.push(`Skipped,${report.summary.skipped}`)
  lines.push(`Errors,${report.summary.errors}`)

  if (report.errors.length > 0) {
    lines.push('')
    lines.push('Errors')
    lines.push('Row,Message')
    for (const error of report.errors) {
      const escapedMessage = error.message.includes(',')
        ? `"${error.message.replace(/"/g, '""')}"`
        : error.message
      lines.push(`${error.row},${escapedMessage}`)
    }
  }

  if (report.skippedIdentifiers.length > 0) {
    lines.push('')
    lines.push('Skipped (Already Exists)')
    for (const id of report.skippedIdentifiers) {
      lines.push(id)
    }
  }

  const csv = lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `import-report-${report.entity}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Reset form
function reset() {
  selectedFile.value = null
  csvContent.value = ''
  previewData.value = null
  importResult.value = null
  showPreview.value = false
  showResults.value = false
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

// Get preview table columns based on entity
const previewColumns = computed<TableColumn<PreviewRow>[]>(() => {
  const baseColumns: TableColumn<PreviewRow>[] = [
    {
      accessorKey: 'rowNumber',
      header: 'Row',
      cell: ({ row }) => h('span', { class: 'text-muted text-sm' }, `${row.original.rowNumber}`),
    },
  ]

  // Add entity-specific columns
  switch (selectedEntity.value) {
    case 'assets':
      baseColumns.push(
        {
          accessorKey: 'data.assetNumber',
          header: 'Asset #',
          cell: ({ row }) =>
            h(
              'span',
              { class: 'font-medium text-highlighted' },
              String(row.original.data.assetNumber || '-'),
            ),
        },
        {
          accessorKey: 'data.make',
          header: 'Make/Model',
          cell: ({ row }) => {
            const make = row.original.data.make || ''
            const model = row.original.data.model || ''
            const year = row.original.data.year || ''
            return h('div', undefined, [
              h('p', { class: 'font-medium text-highlighted' }, `${make} ${model}`.trim() || '-'),
              year ? h('p', { class: 'text-sm text-muted' }, String(year)) : null,
            ])
          },
        },
        {
          accessorKey: 'data.status',
          header: 'Status',
          cell: ({ row }) => {
            const status = (row.original.data.status as string) || 'active'
            const statusColors = {
              active: 'success',
              inactive: 'neutral',
              maintenance: 'warning',
              disposed: 'error',
            } as const
            const color = statusColors[status as keyof typeof statusColors] || 'neutral'
            return h(UBadge, { class: 'capitalize', variant: 'subtle', color }, () => status)
          },
        },
      )
      break
    case 'parts':
      baseColumns.push(
        {
          accessorKey: 'data.partNumber',
          header: 'Part #',
          cell: ({ row }) =>
            h(
              'span',
              { class: 'font-medium text-highlighted' },
              String(row.original.data.partNumber || '-'),
            ),
        },
        {
          accessorKey: 'data.name',
          header: 'Name',
          cell: ({ row }) => String(row.original.data.name || '-'),
        },
        {
          accessorKey: 'data.currentQuantity',
          header: 'Qty',
          cell: ({ row }) =>
            h('span', { class: 'font-mono' }, String(row.original.data.currentQuantity || 0)),
        },
        {
          accessorKey: 'data.category',
          header: 'Category',
          cell: ({ row }) => String(row.original.data.category || '-'),
        },
      )
      break
    case 'users':
      baseColumns.push(
        {
          accessorKey: 'data.email',
          header: 'Email',
          cell: ({ row }) =>
            h(
              'span',
              { class: 'font-medium text-highlighted' },
              String(row.original.data.email || '-'),
            ),
        },
        {
          accessorKey: 'data.name',
          header: 'Name',
          cell: ({ row }) => {
            const firstName = row.original.data.firstName || ''
            const lastName = row.original.data.lastName || ''
            return `${firstName} ${lastName}`.trim() || '-'
          },
        },
        {
          accessorKey: 'data.role',
          header: 'Role',
          cell: ({ row }) => {
            const role = (row.original.data.role as string) || 'operator'
            return h(UBadge, { class: 'capitalize', variant: 'subtle', color: 'primary' }, () =>
              role.replace('_', ' '),
            )
          },
        },
      )
      break
  }

  // Add validation column
  baseColumns.push({
    accessorKey: 'errors',
    header: 'Validation',
    cell: ({ row }) => {
      const { errors, warnings } = row.original
      if (errors.length > 0) {
        return h(UBadge, { variant: 'subtle', color: 'error' }, () => `${errors.length} Error(s)`)
      }
      if (warnings.length > 0) {
        return h(
          UBadge,
          { variant: 'subtle', color: 'warning' },
          () => `${warnings.length} Warning(s)`,
        )
      }
      return h(UBadge, { variant: 'subtle', color: 'success' }, () => 'Valid')
    },
  })

  return baseColumns
})
</script>

<template>
  <UDashboardPanel id="admin-import">
    <template #header>
      <UDashboardNavbar title="Data Import">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="Back to Settings"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="outline"
            @click="router.push('/settings')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Instructions -->
      <div class="mb-6">
        <h2 class="text-lg font-semibold mb-2">Bulk Data Import</h2>
        <p class="text-muted mb-4">
          Import multiple records at once using a CSV file. Download a template, fill in your data,
          and upload to import.
        </p>
      </div>

      <!-- Entity Selection -->
      <div class="mb-6">
        <UCard>
          <template #header>
            <h3 class="text-base font-semibold">Step 1: Select Data Type</h3>
          </template>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              v-for="option in entityOptions"
              :key="option.value"
              class="p-4 rounded-lg border-2 cursor-pointer transition-all"
              :class="[
                selectedEntity === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-default hover:border-muted',
              ]"
              @click="selectedEntity = option.value; reset()"
            >
              <div class="flex items-center gap-3 mb-2">
                <i :class="option.icon" class="text-xl text-primary" />
                <span class="font-medium">{{ option.label }}</span>
              </div>
              <p class="text-sm text-muted">{{ option.description }}</p>
            </div>
          </div>

          <template #footer>
            <UButton
              :label="`Download ${currentEntityOption?.label} Template`"
              icon="i-lucide-download"
              color="neutral"
              variant="outline"
              @click="downloadTemplate"
            />
          </template>
        </UCard>
      </div>

      <!-- File Upload -->
      <div class="mb-6">
        <UCard>
          <template #header>
            <h3 class="text-base font-semibold">Step 2: Upload CSV File</h3>
          </template>

          <div class="space-y-4">
            <!-- Drop zone -->
            <div
              class="border-2 border-dashed rounded-lg p-8 text-center transition-colors"
              :class="[
                isDragOver ? 'border-primary bg-primary/5' : 'border-default hover:border-muted',
              ]"
              @dragover="handleDragOver"
              @dragleave="handleDragLeave"
              @drop="handleDrop"
            >
              <input
                ref="fileInput"
                type="file"
                accept=".csv"
                class="hidden"
                @change="handleFileSelect"
              >
              <i class="i-lucide-upload text-4xl text-muted mb-4" />
              <p class="text-muted mb-2">
                Drag and drop your CSV file here, or
              </p>
              <UButton
                label="Browse Files"
                icon="i-lucide-folder-open"
                color="primary"
                @click="fileInput?.click()"
              />
              <p class="text-xs text-muted mt-2">Maximum file size: 5MB</p>
            </div>

            <!-- Selected file info -->
            <div
              v-if="selectedFile"
              class="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-default"
            >
              <i class="i-lucide-file-text text-xl text-primary" />
              <div class="flex-1">
                <p class="font-medium">{{ selectedFile.name }}</p>
                <p class="text-sm text-muted">
                  {{ (selectedFile.size / 1024).toFixed(2) }} KB
                </p>
              </div>
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="reset"
              />
            </div>

            <!-- Loading state -->
            <div v-if="isValidating" class="flex items-center gap-2 text-muted">
              <i class="i-lucide-loader-2 animate-spin" />
              <span>Validating CSV...</span>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Preview Summary -->
      <div v-if="showPreview && previewData" class="mb-6">
        <UCard>
          <template #header>
            <h3 class="text-base font-semibold">Step 3: Review & Import</h3>
          </template>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p class="text-sm text-muted mb-1">Total Rows</p>
              <p class="text-2xl font-semibold">{{ previewData.summary.totalRows }}</p>
            </div>
            <div>
              <p class="text-sm text-muted mb-1">Valid</p>
              <p class="text-2xl font-semibold text-green-600">
                {{ previewData.summary.validRows }}
              </p>
            </div>
            <div>
              <p class="text-sm text-muted mb-1">Errors</p>
              <p class="text-2xl font-semibold text-red-600">
                {{ previewData.summary.errorRows }}
              </p>
            </div>
            <div>
              <p class="text-sm text-muted mb-1">Warnings</p>
              <p class="text-2xl font-semibold text-yellow-600">
                {{ previewData.summary.warningRows }}
              </p>
            </div>
          </div>

          <template #footer>
            <div class="flex items-center justify-between">
              <div>
                <UBadge v-if="previewData.summary.canImport" variant="subtle" color="success">
                  Ready to import
                </UBadge>
                <UBadge v-else variant="subtle" color="error">
                  Fix errors before importing
                </UBadge>
              </div>
              <div class="flex gap-2">
                <UButton label="Cancel" color="neutral" variant="outline" @click="reset" />
                <UButton
                  :label="`Import ${previewData.summary.validRows} ${selectedEntity}`"
                  icon="i-lucide-upload"
                  color="primary"
                  :disabled="!previewData.summary.canImport || isImporting"
                  :loading="isImporting"
                  @click="executeImport"
                />
              </div>
            </div>
          </template>
        </UCard>
      </div>

      <!-- Import Results -->
      <div v-if="showResults && importResult" class="mb-6">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-base font-semibold">Import Results</h3>
              <UBadge
                :color="importResult.success ? 'success' : 'warning'"
                variant="subtle"
              >
                {{ importResult.success ? 'Success' : 'Completed with issues' }}
              </UBadge>
            </div>
          </template>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p class="text-sm text-muted mb-1">Imported</p>
              <p class="text-2xl font-semibold text-green-600">{{ importResult.imported }}</p>
            </div>
            <div>
              <p class="text-sm text-muted mb-1">Skipped</p>
              <p class="text-2xl font-semibold text-yellow-600">{{ importResult.skipped }}</p>
            </div>
            <div>
              <p class="text-sm text-muted mb-1">Errors</p>
              <p class="text-2xl font-semibold text-red-600">{{ importResult.errors.length }}</p>
            </div>
          </div>

          <!-- Skipped items -->
          <div v-if="importResult.skippedIdentifiers.length > 0" class="mt-4">
            <p class="font-medium text-sm mb-2">Skipped (already exist):</p>
            <div class="flex flex-wrap gap-2">
              <UBadge
                v-for="id in importResult.skippedIdentifiers.slice(0, 10)"
                :key="id"
                variant="subtle"
                color="warning"
              >
                {{ id }}
              </UBadge>
              <UBadge
                v-if="importResult.skippedIdentifiers.length > 10"
                variant="subtle"
                color="neutral"
              >
                +{{ importResult.skippedIdentifiers.length - 10 }} more
              </UBadge>
            </div>
          </div>

          <template #footer>
            <div class="flex gap-2">
              <UButton
                label="Download Report"
                icon="i-lucide-download"
                color="neutral"
                variant="outline"
                @click="downloadErrorReport"
              />
              <UButton label="Import More" icon="i-lucide-plus" color="primary" @click="reset" />
            </div>
          </template>
        </UCard>
      </div>

      <!-- Preview Table -->
      <div v-if="showPreview && previewData && previewData.rows.length > 0 && !showResults">
        <UCard>
          <template #header>
            <h3 class="text-base font-semibold">
              Preview ({{ previewData.rows.length }} rows)
            </h3>
          </template>

          <UTable
            :data="previewData.rows"
            :columns="previewColumns"
            :ui="{
              base: 'table-fixed border-separate border-spacing-0',
              thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
              tbody: '[&>tr]:last:[&>td]:border-b-0',
              th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
              td: 'border-b border-default',
            }"
          />

          <!-- Error/Warning Details -->
          <div
            v-if="previewData.rows.some((r) => r.errors.length > 0 || r.warnings.length > 0)"
            class="mt-4 space-y-3"
          >
            <h4 class="font-semibold text-sm">Validation Details</h4>
            <div
              v-for="row in previewData.rows.filter((r) => r.errors.length > 0 || r.warnings.length > 0)"
              :key="row.rowNumber"
              class="p-3 rounded-lg border border-default"
            >
              <p class="font-medium mb-2">
                Row {{ row.rowNumber }}
              </p>
              <div v-if="row.errors.length > 0" class="space-y-1 mb-2">
                <div
                  v-for="(error, idx) in row.errors"
                  :key="idx"
                  class="flex items-start gap-2 text-sm text-red-600"
                >
                  <i class="i-lucide-circle-x mt-0.5 shrink-0" />
                  <span><strong>{{ error.field }}:</strong> {{ error.message }}</span>
                </div>
              </div>
              <div v-if="row.warnings.length > 0" class="space-y-1">
                <div
                  v-for="(warning, idx) in row.warnings"
                  :key="idx"
                  class="flex items-start gap-2 text-sm text-yellow-600"
                >
                  <i class="i-lucide-alert-triangle mt-0.5 shrink-0" />
                  <span>{{ warning }}</span>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
