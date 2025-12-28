import { requirePermission } from '../../../utils/permissions'

/**
 * Download CSV template for asset import
 */
export default defineEventHandler(async (event) => {
  // Require assets:write permission to download template
  await requirePermission(event, 'assets:write')

  // CSV headers - order matters for import
  const headers = [
    'Asset Number',
    'VIN',
    'Make',
    'Model',
    'Year',
    'License Plate',
    'Status',
    'Category',
    'Mileage',
    'Operational Hours',
    'Description',
  ]

  // Example rows to guide users
  const exampleRows = [
    [
      'FLT-0001',
      '1HGBH41JXMN109186',
      'Ford',
      'F-150',
      '2022',
      'ABC-123',
      'active',
      'Truck',
      '15000',
      '500',
      'Primary delivery truck',
    ],
    [
      'FLT-0002',
      '',
      'Toyota',
      'Camry',
      '2021',
      'XYZ-789',
      'active',
      'Sedan',
      '8500',
      '',
      'Sales vehicle',
    ],
  ]

  const escapeCSV = (value: string | number): string => {
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const rows = exampleRows.map((row) => row.map(escapeCSV).join(','))
  const csv = [headers.join(','), ...rows].join('\n')

  // Set response headers for CSV download
  setHeader(event, 'Content-Type', 'text/csv')
  setHeader(event, 'Content-Disposition', 'attachment; filename="asset-import-template.csv"')

  return csv
})
