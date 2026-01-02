<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/table-core'
import { upperFirst } from 'scule'

definePageMeta({
  middleware: 'auth',
})

interface FolderNode {
  id: string
  name: string
  description: string | null
  path: string
  documentCount?: number
  children: FolderNode[]
}

interface Document {
  id: string
  organisationId: string
  folderId: string | null
  name: string
  originalFilename: string
  filePath: string
  mimeType: string
  fileSize: number
  description: string | null
  category: string
  tags: string[] | null
  expiryDate: string | null
  currentVersionId: string | null
  uploadedById: string
  createdAt: string
  updatedAt: string
  uploadedBy: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  } | null
  folder: {
    id: string
    name: string
  } | null
}

interface DocumentsResponse {
  data: Document[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasMore: boolean
  }
}

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UCheckbox = resolveComponent('UCheckbox')

const toast = useToast()
const table = useTemplateRef('table')
const router = useRouter()
const { $fetchWithCsrf } = useCsrfToken()

const columnVisibility = ref()
const rowSelection = ref({})
const sidebarOpen = ref(true)
const showCreateFolderModal = ref(false)
const showUploadModal = ref(false)
const showMoveDocumentModal = ref(false)
const documentToMove = ref<Document | null>(null)
const newFolderName = ref('')
const newFolderDescription = ref('')
const parentFolderIdForNew = ref<string | null>(null)

// Current folder navigation
const currentFolderId = ref<string | null>(null)

// Filters
const filters = ref({
  search: '',
  category: 'all',
  dateFrom: '',
  dateTo: '',
})

// Pagination
const pagination = ref({
  page: 1,
  limit: 25,
})

// Sorting
const sorting = ref({
  sortBy: 'createdAt' as 'name' | 'createdAt' | 'updatedAt' | 'category' | 'fileSize',
  sortOrder: 'desc' as 'asc' | 'desc',
})

// Fetch folder tree
const { data: folderTree, refresh: refreshFolders } = await useFetch<FolderNode[]>(
  '/api/documents/folders/tree',
  { lazy: true },
)

// Build query params
const queryParams = computed(() => {
  const params: Record<string, string | number> = {
    page: pagination.value.page,
    limit: pagination.value.limit,
    sortBy: sorting.value.sortBy,
    sortOrder: sorting.value.sortOrder,
  }

  if (currentFolderId.value) params.folderId = currentFolderId.value
  if (filters.value.search) params.q = filters.value.search
  if (filters.value.category && filters.value.category !== 'all')
    params.category = filters.value.category
  if (filters.value.dateFrom) params.dateFrom = filters.value.dateFrom
  if (filters.value.dateTo) params.dateTo = filters.value.dateTo

  return params
})

// Fetch documents
const {
  data: documentsResponse,
  status: fetchStatus,
  refresh: refreshDocuments,
} = await useFetch<DocumentsResponse>('/api/documents', {
  query: queryParams,
  lazy: true,
  watch: [queryParams],
})

const documents = computed(() => documentsResponse.value?.data || [])
const totalItems = computed(() => documentsResponse.value?.pagination.total || 0)
const totalPages = computed(() => documentsResponse.value?.pagination.totalPages || 0)

// Reset pagination when filters or folder change
watch(
  () => [filters.value, currentFolderId.value],
  () => {
    pagination.value.page = 1
  },
  { deep: true },
)

// Build breadcrumb from folder tree
const breadcrumbItems = computed(() => {
  const items = [
    {
      label: 'All Documents',
      icon: 'i-lucide-home',
      onClick: () => navigateToFolder(null),
    },
  ]

  if (!currentFolderId.value || !folderTree.value) return items

  // Find the path to current folder
  const findPath = (
    nodes: FolderNode[],
    targetId: string,
    path: FolderNode[] = [],
  ): FolderNode[] | null => {
    for (const node of nodes) {
      if (node.id === targetId) {
        return [...path, node]
      }
      if (node.children.length > 0) {
        const found = findPath(node.children, targetId, [...path, node])
        if (found) return found
      }
    }
    return null
  }

  const folderPath = findPath(folderTree.value, currentFolderId.value)
  if (folderPath) {
    for (const folder of folderPath) {
      items.push({
        label: folder.name,
        icon: 'i-lucide-folder',
        onClick: () => navigateToFolder(folder.id),
      })
    }
  }

  return items
})

// Current folder info
const currentFolder = computed(() => {
  if (!currentFolderId.value || !folderTree.value) return null

  const findFolder = (nodes: FolderNode[], id: string): FolderNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node
      if (node.children.length > 0) {
        const found = findFolder(node.children, id)
        if (found) return found
      }
    }
    return null
  }

  return findFolder(folderTree.value, currentFolderId.value)
})

function navigateToFolder(folderId: string | null) {
  currentFolderId.value = folderId
}

// Category options
const categoryOptions = [
  { label: 'All Categories', value: 'all' },
  { label: 'Registration', value: 'registration' },
  { label: 'Insurance', value: 'insurance' },
  { label: 'Inspection', value: 'inspection' },
  { label: 'Certification', value: 'certification' },
  { label: 'Manual', value: 'manual' },
  { label: 'Warranty', value: 'warranty' },
  { label: 'Invoice', value: 'invoice' },
  { label: 'Contract', value: 'contract' },
  { label: 'Report', value: 'report' },
  { label: 'Other', value: 'other' },
]

// Category colors
const categoryColors: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = {
  registration: 'info',
  insurance: 'success',
  inspection: 'warning',
  certification: 'success',
  manual: 'neutral',
  warranty: 'info',
  invoice: 'neutral',
  contract: 'warning',
  report: 'info',
  other: 'neutral',
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

// Get file icon based on MIME type
function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'i-lucide-image'
  if (mimeType.startsWith('video/')) return 'i-lucide-video'
  if (mimeType.startsWith('audio/')) return 'i-lucide-music'
  if (mimeType === 'application/pdf') return 'i-lucide-file-text'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'i-lucide-file-type'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet'))
    return 'i-lucide-file-spreadsheet'
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation'))
    return 'i-lucide-presentation'
  if (mimeType === 'text/plain' || mimeType === 'text/csv') return 'i-lucide-file-text'
  return 'i-lucide-file'
}

// Format date
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// Get uploader name
function getUploaderName(doc: Document): string {
  if (!doc.uploadedBy) return 'Unknown'
  const { firstName, lastName, email } = doc.uploadedBy
  if (firstName || lastName) {
    return `${firstName || ''} ${lastName || ''}`.trim()
  }
  return email
}

// Create folder
async function createFolder() {
  if (!newFolderName.value.trim()) {
    toast.add({ title: 'Error', description: 'Folder name is required', color: 'error' })
    return
  }

  try {
    await $fetchWithCsrf('/api/documents/folders', {
      method: 'POST',
      body: {
        name: newFolderName.value.trim(),
        description: newFolderDescription.value.trim() || null,
        parentId: parentFolderIdForNew.value,
      },
    })

    toast.add({ title: 'Folder created', description: `Created folder "${newFolderName.value}"` })
    newFolderName.value = ''
    newFolderDescription.value = ''
    parentFolderIdForNew.value = null
    showCreateFolderModal.value = false
    refreshFolders()
  } catch (error) {
    toast.add({ title: 'Error', description: 'Failed to create folder', color: 'error' })
  }
}

// Delete folder
async function deleteFolder(folderId: string, folderName: string) {
  try {
    await $fetchWithCsrf(`/api/documents/folders/${folderId}?mode=move`, {
      method: 'DELETE',
    })

    toast.add({ title: 'Folder deleted', description: `Deleted "${folderName}"` })

    // If current folder was deleted, navigate to root
    if (currentFolderId.value === folderId) {
      currentFolderId.value = null
    }

    refreshFolders()
    refreshDocuments()
  } catch (error) {
    toast.add({ title: 'Error', description: 'Failed to delete folder', color: 'error' })
  }
}

// Delete document
async function deleteDocument(id: string, name: string) {
  try {
    await $fetchWithCsrf(`/api/documents/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Document deleted', description: `Deleted "${name}"` })
    refreshDocuments()
    refreshFolders() // Update document counts
  } catch (error) {
    toast.add({ title: 'Error', description: 'Failed to delete document', color: 'error' })
  }
}

// Download document
function downloadDocument(doc: Document) {
  const baseUrl = '/uploads'
  const url = `${baseUrl}/documents/${doc.filePath}`
  const link = document.createElement('a')
  link.href = url
  link.download = doc.originalFilename
  link.click()
}

// Move document
async function moveDocument(targetFolderId: string | null) {
  if (!documentToMove.value) return

  try {
    await $fetchWithCsrf(`/api/documents/${documentToMove.value.id}/move`, {
      method: 'POST',
      body: { folderId: targetFolderId },
    })

    toast.add({
      title: 'Document moved',
      description: `Moved "${documentToMove.value.name}" to ${targetFolderId ? 'folder' : 'root'}`,
    })

    documentToMove.value = null
    showMoveDocumentModal.value = false
    refreshDocuments()
    refreshFolders()
  } catch (error) {
    toast.add({ title: 'Error', description: 'Failed to move document', color: 'error' })
  }
}

// Upload handler for UploadDropzone
async function handleUpload(file: File): Promise<{ url: string; id?: string }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('category', 'other')
  if (currentFolderId.value) {
    formData.append('folderId', currentFolderId.value)
  }

  const response = await $fetchWithCsrf<{ document: { id: string; filePath: string } }>(
    '/api/documents/upload',
    {
      method: 'POST',
      body: formData,
    },
  )

  refreshDocuments()
  refreshFolders()

  return {
    url: `/uploads/documents/${response.document.filePath}`,
    id: response.document.id,
  }
}

// Clear filters
function clearFilters() {
  filters.value = {
    search: '',
    category: 'all',
    dateFrom: '',
    dateTo: '',
  }
}

// Table row actions
function getRowItems(row: Row<Document>) {
  return [
    {
      type: 'label',
      label: 'Actions',
    },
    {
      label: 'Download',
      icon: 'i-lucide-download',
      onSelect() {
        downloadDocument(row.original)
      },
    },
    {
      label: 'View details',
      icon: 'i-lucide-eye',
      onSelect() {
        router.push(`/documents/${row.original.id}`)
      },
    },
    {
      label: 'Move to folder',
      icon: 'i-lucide-folder-input',
      onSelect() {
        documentToMove.value = row.original
        showMoveDocumentModal.value = true
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Delete',
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect() {
        deleteDocument(row.original.id, row.original.name)
      },
    },
  ]
}

// Table columns
const columns: TableColumn<Document>[] = [
  {
    id: 'select',
    header: ({ table }) =>
      h(UCheckbox, {
        modelValue: table.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
          table.toggleAllPageRowsSelected(!!value),
        ariaLabel: 'Select all',
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        ariaLabel: 'Select row',
      }),
  },
  {
    accessorKey: 'name',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Name',
        icon: isSorted
          ? isSorted === 'asc'
            ? 'i-lucide-arrow-up-narrow-wide'
            : 'i-lucide-arrow-down-wide-narrow'
          : 'i-lucide-arrow-up-down',
        class: '-mx-2.5',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
      })
    },
    cell: ({ row }) => {
      return h('div', { class: 'flex items-center gap-3' }, [
        h(
          'div',
          {
            class:
              'flex-shrink-0 w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center',
          },
          [h('span', { class: `${getFileIcon(row.original.mimeType)} w-5 h-5 text-muted` })],
        ),
        h('div', { class: 'min-w-0' }, [
          h(
            'p',
            { class: 'font-medium text-highlighted truncate max-w-[200px]' },
            row.original.name,
          ),
          h(
            'p',
            { class: 'text-xs text-muted truncate max-w-[200px]' },
            row.original.originalFilename,
          ),
        ]),
      ])
    },
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => {
      const color = categoryColors[row.original.category] || 'neutral'
      return h(
        UBadge,
        { variant: 'subtle', color, class: 'capitalize' },
        () => row.original.category,
      )
    },
  },
  {
    accessorKey: 'fileSize',
    header: 'Size',
    cell: ({ row }) => h('span', { class: 'text-sm' }, formatFileSize(row.original.fileSize)),
  },
  {
    accessorKey: 'uploadedBy',
    header: 'Uploaded By',
    cell: ({ row }) =>
      h('span', { class: 'text-sm truncate max-w-[120px]' }, getUploaderName(row.original)),
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Date',
        icon: isSorted
          ? isSorted === 'asc'
            ? 'i-lucide-arrow-up-narrow-wide'
            : 'i-lucide-arrow-down-wide-narrow'
          : 'i-lucide-arrow-up-down',
        class: '-mx-2.5',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
      })
    },
    cell: ({ row }) => h('span', { class: 'text-sm' }, formatDate(row.original.createdAt)),
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      return h(
        'div',
        { class: 'text-right' },
        h(
          UDropdownMenu,
          {
            content: { align: 'end' },
            items: getRowItems(row),
          },
          () =>
            h(UButton, {
              icon: 'i-lucide-ellipsis-vertical',
              color: 'neutral',
              variant: 'ghost',
              class: 'ml-auto',
            }),
        ),
      )
    },
  },
]

// Uploaded files state for dropzone
const uploadedFiles = ref<
  Array<{
    id: string
    name: string
    size: number
    type: string
    url: string
    progress?: number
    status: 'pending' | 'uploading' | 'complete' | 'error'
    errorMessage?: string
  }>
>([])
</script>

<template>
  <UDashboardPanel id="documents">
    <template #header>
      <UDashboardNavbar title="Documents">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              label="New Folder"
              icon="i-lucide-folder-plus"
              color="neutral"
              variant="outline"
              @click="
                () => {
                  parentFolderIdForNew = currentFolderId
                  showCreateFolderModal = true
                }
              "
            />
            <UButton
              label="Upload"
              icon="i-lucide-upload"
              color="primary"
              @click="showUploadModal = true"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex h-full">
        <!-- Folder Sidebar -->
        <div
          v-if="sidebarOpen"
          class="w-64 flex-shrink-0 border-r border-default overflow-y-auto"
        >
          <div class="p-4">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">
                Folders
              </h3>
              <UButton
                icon="i-lucide-panel-left-close"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="sidebarOpen = false"
              />
            </div>

            <!-- Root folder -->
            <button
              type="button"
              :class="[
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors mb-2',
                currentFolderId === null
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted/50 text-default',
              ]"
              @click="navigateToFolder(null)"
            >
              <UIcon name="i-lucide-home" class="w-4 h-4 flex-shrink-0" />
              <span class="flex-1 truncate text-sm font-medium">All Documents</span>
            </button>

            <!-- Folder Tree -->
            <div v-if="folderTree && folderTree.length > 0" class="space-y-1">
              <template v-for="folder in folderTree" :key="folder.id">
                <DocumentsFolderTreeItem
                  :folder="folder"
                  :current-folder-id="currentFolderId"
                  :depth="0"
                  @navigate="navigateToFolder"
                  @delete="deleteFolder"
                  @create-subfolder="
                    (parentId) => {
                      parentFolderIdForNew = parentId
                      showCreateFolderModal = true
                    }
                  "
                />
              </template>
            </div>

            <div v-else class="text-sm text-muted py-4 text-center">
              No folders yet
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div class="flex-1 flex flex-col min-w-0 p-4">
          <!-- Sidebar Toggle (when hidden) -->
          <div v-if="!sidebarOpen" class="mb-4">
            <UButton
              icon="i-lucide-panel-left-open"
              label="Show Folders"
              color="neutral"
              variant="outline"
              size="sm"
              @click="sidebarOpen = true"
            />
          </div>

          <!-- Breadcrumb -->
          <div class="mb-4">
            <UBreadcrumb :items="breadcrumbItems" />
          </div>

          <!-- Current folder info -->
          <div v-if="currentFolder" class="mb-4 p-4 bg-muted/30 rounded-lg border border-default">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <UIcon name="i-lucide-folder" class="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 class="font-semibold text-highlighted">{{ currentFolder.name }}</h2>
                  <p v-if="currentFolder.description" class="text-sm text-muted">
                    {{ currentFolder.description }}
                  </p>
                </div>
              </div>
              <UBadge variant="subtle" color="neutral">
                {{ currentFolder.documentCount || 0 }} documents
              </UBadge>
            </div>
          </div>

          <!-- Filters -->
          <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div class="flex flex-wrap items-center gap-2">
              <UInput
                v-model="filters.search"
                icon="i-lucide-search"
                placeholder="Search documents..."
                class="w-64"
              />

              <USelect
                v-model="filters.category"
                :items="categoryOptions"
                placeholder="Category"
                class="min-w-36"
              />

              <UButton
                v-if="filters.search || (filters.category && filters.category !== 'all') || filters.dateFrom || filters.dateTo"
                label="Clear"
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                @click="clearFilters"
              />
            </div>

            <div class="flex items-center gap-2">
              <UDropdownMenu
                :items="
                  table?.tableApi
                    ?.getAllColumns()
                    .filter((column: any) => column.getCanHide())
                    .map((column: any) => ({
                      label: upperFirst(column.id),
                      type: 'checkbox' as const,
                      checked: column.getIsVisible(),
                      onUpdateChecked(checked: boolean) {
                        table?.tableApi?.getColumn(column.id)?.toggleVisibility(!!checked)
                      },
                      onSelect(e?: Event) {
                        e?.preventDefault()
                      }
                    }))
                "
                :content="{ align: 'end' }"
              >
                <UButton
                  label="Columns"
                  color="neutral"
                  variant="outline"
                  trailing-icon="i-lucide-settings-2"
                />
              </UDropdownMenu>
            </div>
          </div>

          <!-- Results count -->
          <div class="text-sm text-muted mb-2">
            {{ totalItems }} document{{ totalItems === 1 ? '' : 's' }} found
          </div>

          <!-- Documents Table -->
          <UTable
            ref="table"
            v-model:column-visibility="columnVisibility"
            v-model:row-selection="rowSelection"
            class="shrink-0"
            :data="documents"
            :columns="columns"
            :loading="fetchStatus === 'pending'"
            :ui="{
              base: 'table-fixed border-separate border-spacing-0',
              thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
              tbody: '[&>tr]:last:[&>td]:border-b-0',
              th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
              td: 'border-b border-default',
              separator: 'h-0'
            }"
          />

          <!-- Pagination -->
          <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
            <div class="text-sm text-muted">
              Showing
              {{ (pagination.page - 1) * pagination.limit + 1 }}-{{
                Math.min(pagination.page * pagination.limit, totalItems)
              }}
              of {{ totalItems }}
            </div>

            <div class="flex items-center gap-1.5">
              <USelect
                :model-value="pagination.limit.toString()"
                :items="[
                  { label: '10 per page', value: '10' },
                  { label: '25 per page', value: '25' },
                  { label: '50 per page', value: '50' },
                  { label: '100 per page', value: '100' }
                ]"
                class="min-w-32"
                @update:model-value="
                  (v: string) => {
                    pagination.limit = parseInt(v)
                    pagination.page = 1
                  }
                "
              />
              <UPagination
                :default-page="pagination.page"
                :items-per-page="pagination.limit"
                :total="totalItems"
                @update:page="(p: number) => (pagination.page = p)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Create Folder Modal -->
  <UModal v-model:open="showCreateFolderModal">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Create Folder</h3>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="showCreateFolderModal = false"
            />
          </div>
        </template>

        <div class="space-y-4">
          <UFormField label="Folder Name" required>
            <UInput
              v-model="newFolderName"
              placeholder="Enter folder name"
              @keyup.enter="createFolder"
            />
          </UFormField>

          <UFormField label="Description">
            <UTextarea
              v-model="newFolderDescription"
              placeholder="Optional description"
              :rows="3"
            />
          </UFormField>

          <div v-if="parentFolderIdForNew" class="text-sm text-muted">
            <UIcon name="i-lucide-info" class="w-4 h-4 inline mr-1" />
            This folder will be created inside the current folder.
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="outline"
              @click="showCreateFolderModal = false"
            />
            <UButton label="Create" color="primary" @click="createFolder" />
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <!-- Upload Modal -->
  <UModal v-model:open="showUploadModal">
    <template #content>
      <UCard class="min-w-[500px]">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Upload Documents</h3>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="showUploadModal = false"
            />
          </div>
        </template>

        <div class="space-y-4">
          <div v-if="currentFolder" class="text-sm text-muted flex items-center gap-2">
            <UIcon name="i-lucide-folder" class="w-4 h-4" />
            Uploading to: <strong>{{ currentFolder.name }}</strong>
          </div>

          <DocumentsUploadDropzone
            v-model="uploadedFiles"
            :upload-handler="handleUpload"
            :max-files="20"
            :max-file-size="50 * 1024 * 1024"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp"
            label="Drop files here"
            help-text="Drag and drop files or click to browse"
          />
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              label="Done"
              color="primary"
              @click="
                () => {
                  showUploadModal = false
                  uploadedFiles = []
                }
              "
            />
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <!-- Move Document Modal -->
  <UModal v-model:open="showMoveDocumentModal">
    <template #content>
      <UCard class="min-w-[400px]">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Move Document</h3>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="showMoveDocumentModal = false"
            />
          </div>
        </template>

        <div v-if="documentToMove" class="space-y-4">
          <div class="text-sm text-muted">
            Moving: <strong>{{ documentToMove.name }}</strong>
          </div>

          <div class="border border-default rounded-lg overflow-hidden max-h-64 overflow-y-auto">
            <!-- Root option -->
            <button
              type="button"
              class="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left border-b border-default"
              @click="moveDocument(null)"
            >
              <UIcon name="i-lucide-home" class="w-4 h-4" />
              <span class="text-sm">Root (No Folder)</span>
            </button>

            <!-- Folder options -->
            <template v-if="folderTree">
              <template v-for="folder in folderTree" :key="folder.id">
                <button
                  type="button"
                  :class="[
                    'w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left border-b border-default last:border-b-0',
                    documentToMove.folderId === folder.id ? 'bg-muted/30' : '',
                  ]"
                  :disabled="documentToMove.folderId === folder.id"
                  @click="moveDocument(folder.id)"
                >
                  <UIcon name="i-lucide-folder" class="w-4 h-4" />
                  <span class="text-sm">{{ folder.name }}</span>
                  <UBadge
                    v-if="documentToMove.folderId === folder.id"
                    variant="subtle"
                    color="neutral"
                    size="xs"
                  >
                    Current
                  </UBadge>
                </button>

                <!-- Nested folders (one level) -->
                <template v-for="child in folder.children" :key="child.id">
                  <button
                    type="button"
                    :class="[
                      'w-full flex items-center gap-2 px-3 py-2 pl-8 hover:bg-muted/50 text-left border-b border-default last:border-b-0',
                      documentToMove.folderId === child.id ? 'bg-muted/30' : '',
                    ]"
                    :disabled="documentToMove.folderId === child.id"
                    @click="moveDocument(child.id)"
                  >
                    <UIcon name="i-lucide-folder" class="w-4 h-4" />
                    <span class="text-sm">{{ child.name }}</span>
                    <UBadge
                      v-if="documentToMove.folderId === child.id"
                      variant="subtle"
                      color="neutral"
                      size="xs"
                    >
                      Current
                    </UBadge>
                  </button>
                </template>
              </template>
            </template>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <UButton
              label="Cancel"
              color="neutral"
              variant="outline"
              @click="showMoveDocumentModal = false"
            />
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
