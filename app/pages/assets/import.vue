<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
  middleware: 'auth',
})

interface ValidationError {
  row: number
  field: string
  message: string
  value?: unknown
}

interface PreviewRow {
  rowNumber: number
  data: {
    assetNumber: string
    vin: string | null
    make: string | null
    model: string | null
    year: number | null
    licensePlate: string | null
    status: 'active' | 'inactive' | 'maintenance' | 'disposed'
    category: string | null
    mileage: number
    operationalHours: number
    description: string | null
  }
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
  summary: PreviewSummary
  rows: PreviewRow[]
}

const UBadge = resolveComponent('UBadge')

const toast = useToast()
const router = useRouter()

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const csvContent = ref<string>('')
const previewData = ref<PreviewResponse | null>(null)
const isValidating = ref(false)
const isImporting = ref(false)
const showPreview = ref(false)

// File upload handler
function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  if (!file.name.endsWith('.csv')) {
    toast.add({
      title: 'Invalid file type',
      description: 'Please select a CSV file',
      color: 'error',
    })
    return
  }

  selectedFile.value = file

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
    window.location.href = '/api/assets/import/template'
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
    const response = await $fetch<PreviewResponse>('/api/assets/import/preview', {
      method: 'POST',
      body: { csv: csvContent.value },
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

// Import assets
async function importAssets() {
  if (!csvContent.value || !previewData.value?.summary.canImport) return

  isImporting.value = true
  try {
    const response = await $fetch<{
      success: boolean
      imported: number
      skipped: number
      skippedAssetNumbers: string[]
    }>('/api/assets/import', {
      method: 'POST',
      body: { csv: csvContent.value },
    })

    if (response.success) {
      toast.add({
        title: 'Import successful',
        description: `Imported ${response.imported} asset(s)${response.skipped > 0 ? `, skipped ${response.skipped} duplicate(s)` : ''}`,
        color: 'success',
      })

      // Navigate back to assets list
      router.push('/assets')
    }
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }; statusMessage?: string }
    toast.add({
      title: 'Import failed',
      description: err.data?.message || err.statusMessage || 'Failed to import assets',
      color: 'error',
    })
  } finally {
    isImporting.value = false
  }
}

// Reset form
function reset() {
  selectedFile.value = null
  csvContent.value = ''
  previewData.value = null
  showPreview.value = false
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

// Preview table columns
const columns: TableColumn<PreviewRow>[] = [
  {
    accessorKey: 'rowNumber',
    header: 'Row',
    cell: ({ row }) => h('span', { class: 'text-muted text-sm' }, `${row.original.rowNumber}`),
  },
  {
    accessorKey: 'data.assetNumber',
    header: 'Asset #',
    cell: ({ row }) =>
      h('span', { class: 'font-medium text-highlighted' }, row.original.data.assetNumber),
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
        year ? h('p', { class: 'text-sm text-muted' }, year.toString()) : null,
      ])
    },
  },
  {
    accessorKey: 'data.licensePlate',
    header: 'License Plate',
    cell: ({ row }) => row.original.data.licensePlate || '-',
  },
  {
    accessorKey: 'data.status',
    header: 'Status',
    cell: ({ row }) => {
      const statusColors = {
        active: 'success',
        inactive: 'neutral',
        maintenance: 'warning',
        disposed: 'error',
      } as const
      const color = statusColors[row.original.data.status]
      return h(
        UBadge,
        { class: 'capitalize', variant: 'subtle', color },
        () => row.original.data.status,
      )
    },
  },
  {
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
  },
]
</script>

<template>
  <UDashboardPanel id="asset-import">
    <template #header>
      <UDashboardNavbar title="Import Assets">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="Back to Assets"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="outline"
            @click="router.push('/assets')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Instructions -->
      <div class="mb-6">
        <h2 class="text-lg font-semibold mb-2">
          Import Assets from CSV
        </h2>
        <p class="text-muted mb-4">
          Upload a CSV file to import multiple assets at once. The file must match the template
          format.
        </p>

        <div class="flex gap-2">
          <UButton
            label="Download CSV Template"
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            @click="downloadTemplate"
          />
        </div>
      </div>

      <!-- File Upload -->
      <div class="mb-6">
        <UCard>
          <template #header>
            <h3 class="text-base font-semibold">
              Upload CSV File
            </h3>
          </template>

          <div class="space-y-4">
            <div>
              <input
                ref="fileInput"
                type="file"
                accept=".csv"
                class="hidden"
                @change="handleFileSelect"
              >
              <UButton
                label="Select CSV File"
                icon="i-lucide-upload"
                color="primary"
                @click="fileInput?.click()"
              />
            </div>

            <div v-if="selectedFile" class="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-default">
              <i class="i-lucide-file-text text-xl text-primary" />
              <div class="flex-1">
                <p class="font-medium">
                  {{ selectedFile.name }}
                </p>
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
            <h3 class="text-base font-semibold">
              Validation Summary
            </h3>
          </template>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p class="text-sm text-muted mb-1">
                Total Rows
              </p>
              <p class="text-2xl font-semibold">
                {{ previewData.summary.totalRows }}
              </p>
            </div>
            <div>
              <p class="text-sm text-muted mb-1">
                Valid
              </p>
              <p class="text-2xl font-semibold text-green-600">
                {{ previewData.summary.validRows }}
              </p>
            </div>
            <div>
              <p class="text-sm text-muted mb-1">
                Errors
              </p>
              <p class="text-2xl font-semibold text-red-600">
                {{ previewData.summary.errorRows }}
              </p>
            </div>
            <div>
              <p class="text-sm text-muted mb-1">
                Warnings
              </p>
              <p class="text-2xl font-semibold text-yellow-600">
                {{ previewData.summary.warningRows }}
              </p>
            </div>
          </div>

          <template #footer>
            <div class="flex items-center justify-between">
              <div>
                <UBadge
                  v-if="previewData.summary.canImport"
                  variant="subtle"
                  color="success"
                >
                  Ready to import
                </UBadge>
                <UBadge
                  v-else
                  variant="subtle"
                  color="error"
                >
                  Fix errors before importing
                </UBadge>
              </div>
              <div class="flex gap-2">
                <UButton
                  label="Cancel"
                  color="neutral"
                  variant="outline"
                  @click="reset"
                />
                <UButton
                  label="Import Assets"
                  icon="i-lucide-upload"
                  color="primary"
                  :disabled="!previewData.summary.canImport || isImporting"
                  :loading="isImporting"
                  @click="importAssets"
                />
              </div>
            </div>
          </template>
        </UCard>
      </div>

      <!-- Preview Table -->
      <div v-if="showPreview && previewData && previewData.rows.length > 0">
        <UCard>
          <template #header>
            <h3 class="text-base font-semibold">
              Preview ({{ previewData.rows.length }} rows)
            </h3>
          </template>

          <UTable
            :data="previewData.rows"
            :columns="columns"
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
            <h4 class="font-semibold text-sm">
              Validation Details
            </h4>
            <div
              v-for="row in previewData.rows.filter(
                (r) => r.errors.length > 0 || r.warnings.length > 0,
              )"
              :key="row.rowNumber"
              class="p-3 rounded-lg border border-default"
            >
              <p class="font-medium mb-2">
                Row {{ row.rowNumber }}: {{ row.data.assetNumber }}
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
