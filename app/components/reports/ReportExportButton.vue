<script setup lang="ts">
/**
 * Report Export Button Component (US-14.8)
 *
 * Dropdown button with export options for reports:
 * - CSV: Simple text format
 * - Excel: XLSX spreadsheet
 * - PDF: Formatted document with tables
 */
import type { ExportColumn, ExportOptions } from '~/composables/useReportExport'

interface Props {
  data: object[]
  filename: string
  title?: string
  sheetName?: string
  columns?: ExportColumn[]
  dateRange?: { start: Date | null; end: Date | null }
  summary?: Record<string, string | number>
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  sheetName: 'Report',
  columns: undefined,
  dateRange: undefined,
  summary: undefined,
  disabled: false,
})

const { isExporting, exportProgress, exportToCSV, exportToExcel, exportToPDF } = useReportExport()

const exportOptions = computed<ExportOptions>(() => ({
  filename: props.filename,
  title: props.title,
  sheetName: props.sheetName,
  columns: props.columns,
  dateRange: props.dateRange,
  summary: props.summary,
}))

const isDisabled = computed(() => props.disabled || !props.data?.length || isExporting.value)

const menuItems = computed(() => [
  [
    {
      label: 'Export to CSV',
      icon: 'i-lucide-file-text',
      disabled: isDisabled.value,
      onSelect: () => exportToCSV(props.data, exportOptions.value),
    },
    {
      label: 'Export to Excel',
      icon: 'i-lucide-file-spreadsheet',
      disabled: isDisabled.value,
      onSelect: () => exportToExcel(props.data, exportOptions.value),
    },
    {
      label: 'Export to PDF',
      icon: 'i-lucide-file-type',
      disabled: isDisabled.value,
      onSelect: () => exportToPDF(props.data, exportOptions.value),
    },
  ],
])
</script>

<template>
  <UDropdownMenu :items="menuItems">
    <UButton
      :label="isExporting ? (exportProgress || 'Exporting...') : 'Export'"
      :icon="isExporting ? 'i-lucide-loader-2' : 'i-lucide-download'"
      :loading="isExporting"
      :disabled="isDisabled"
      color="neutral"
      variant="outline"
      trailing-icon="i-lucide-chevron-down"
    />
  </UDropdownMenu>
</template>
