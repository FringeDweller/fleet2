import type { DashboardWidgetType } from '../../db/schema/dashboard-layouts'
import { requireAuth } from '../../utils/permissions'

/**
 * Widget metadata for the add widget modal
 */
export interface WidgetMetadata {
  type: DashboardWidgetType
  name: string
  description: string
  icon: string
  defaultSize: {
    w: number
    h: number
  }
  minSize: {
    w: number
    h: number
  }
  maxSize: {
    w: number
    h: number
  }
  supportsOptions: {
    dateRange: boolean
    period: boolean
    limit: boolean
    filters: boolean
  }
}

/**
 * GET /api/dashboard/widgets
 *
 * Returns metadata about available dashboard widgets.
 * Used by the AddWidgetModal to show widget options.
 */
export default defineEventHandler(async (event) => {
  // Require authentication to access widget list
  await requireAuth(event)

  const widgets: WidgetMetadata[] = [
    {
      type: 'stats',
      name: 'Statistics Overview',
      description: 'Shows key metrics including customers, conversions, revenue, and orders.',
      icon: 'i-lucide-bar-chart-3',
      defaultSize: { w: 12, h: 1 },
      minSize: { w: 6, h: 1 },
      maxSize: { w: 12, h: 2 },
      supportsOptions: {
        dateRange: true,
        period: true,
        limit: false,
        filters: false,
      },
    },
    {
      type: 'chart',
      name: 'Revenue Chart',
      description: 'Displays revenue trends over time with interactive visualization.',
      icon: 'i-lucide-line-chart',
      defaultSize: { w: 12, h: 4 },
      minSize: { w: 6, h: 3 },
      maxSize: { w: 12, h: 6 },
      supportsOptions: {
        dateRange: true,
        period: true,
        limit: false,
        filters: false,
      },
    },
    {
      type: 'lowStock',
      name: 'Low Stock Alerts',
      description: 'Displays parts inventory that are below reorder threshold.',
      icon: 'i-lucide-alert-triangle',
      defaultSize: { w: 6, h: 4 },
      minSize: { w: 4, h: 3 },
      maxSize: { w: 12, h: 6 },
      supportsOptions: {
        dateRange: false,
        period: false,
        limit: true,
        filters: false,
      },
    },
    {
      type: 'fuelAnomalies',
      name: 'Fuel Anomalies',
      description: 'Shows recent fuel consumption anomalies and alerts.',
      icon: 'i-lucide-fuel',
      defaultSize: { w: 6, h: 4 },
      minSize: { w: 4, h: 3 },
      maxSize: { w: 12, h: 6 },
      supportsOptions: {
        dateRange: true,
        period: false,
        limit: true,
        filters: false,
      },
    },
    {
      type: 'sales',
      name: 'Recent Sales',
      description: 'Displays recent sales transactions in a table format.',
      icon: 'i-lucide-shopping-cart',
      defaultSize: { w: 6, h: 4 },
      minSize: { w: 4, h: 3 },
      maxSize: { w: 12, h: 8 },
      supportsOptions: {
        dateRange: true,
        period: true,
        limit: true,
        filters: false,
      },
    },
    {
      type: 'recentWorkOrders',
      name: 'Recent Work Orders',
      description: 'Shows recent work orders with status and assignee information.',
      icon: 'i-lucide-clipboard-list',
      defaultSize: { w: 6, h: 4 },
      minSize: { w: 4, h: 3 },
      maxSize: { w: 12, h: 8 },
      supportsOptions: {
        dateRange: false,
        period: false,
        limit: true,
        filters: true,
      },
    },
  ]

  return {
    widgets,
  }
})
