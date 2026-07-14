import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'
import {
  formatShopCatalogFolderItemSummary,
  getShopCatalogCategoryPath,
  getShopCatalogItemDisplayName,
  getShopCategoryDisplayName,
  normalizeShopCatalogSearch,
} from './catalogDisplayHelpers'
import type { ShopCatalogTreeNode } from './treeTypes'

export {
  formatShopCatalogFolderItemSummary,
  getShopCatalogCategoryPath,
  getShopCatalogItemDisplayName,
  getShopCategoryDisplayName,
  normalizeShopCatalogSearch,
} from './catalogDisplayHelpers'

interface ShopCatalogInlineCreateState {
  key: ShopCatalogTreeNode['key'] | null
  kind: 'category' | 'item' | null
  parentId: string | null
  value: string
}

interface BuildShopCatalogTreeNodesOptions {
  treeSearch: string
  showArchived: boolean
  rootBucketExpanded: boolean
  expandedCategoryIds: readonly string[]
  createState: ShopCatalogInlineCreateState
  childCategoriesByParent: ReadonlyMap<string | null, readonly ShopCategoryRecord[]>
  childItemsByParent: ReadonlyMap<string | null, readonly ShopCatalogItemRecord[]>
  getCategoryPath: (categoryId: string | null) => string
}

export interface ShopCatalogCategoryFormState {
  name: string
  parentId: string | null
  active: boolean
}

export interface ShopCatalogItemFormState {
  description: string
  categoryId: string | null
  sku: string
  price: string
  active: boolean
}

export interface ShopCatalogCategoryOption {
  value: string
  label: string
}

export type ShopCatalogConfirmAction =
  | {
      kind: 'archive-category'
      categoryId: string
      label: string
      nextActive: boolean
      showInspector: boolean
    }
  | {
      kind: 'archive-item'
      itemId: string
      label: string
      nextActive: boolean
      showInspector: boolean
    }
  | {
      kind: 'delete-category'
      categoryId: string
      label: string
      parentId: string | null
    }
  | {
      kind: 'delete-item'
      itemId: string
      label: string
      categoryId: string | null
    }

export type ShopCatalogDragPayload =
  | { kind: 'category'; id: string }
  | { kind: 'item'; id: string }

export function formatShopCatalogPriceLabel(price: number | null) {
  if (price == null) return 'No Price'
  return price.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatShopCatalogPriceInputValue(price: number | null) {
  return price == null ? '' : formatShopCatalogPriceLabel(price)
}

export function sanitizeShopCatalogPriceInput(value: string) {
  const normalized = value.replace(/[^0-9.]/g, '')
  const [whole = '', ...fractionParts] = normalized.split('.')
  const fraction = fractionParts.join('').slice(0, 2)
  return fractionParts.length > 0 ? `${whole}.${fraction}` : whole
}

export function parseShopCatalogPrice(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/[$,\s]/g, '')
  if (!normalized || normalized === '.') return null

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return null

  return Math.round(parsed * 100) / 100
}

export function getShopCatalogNodeStatusLabel(active: boolean) {
  return active ? 'Active' : 'Archived'
}

export function createEmptyShopCatalogCategoryForm(parentId: string | null = null): ShopCatalogCategoryFormState {
  return {
    name: '',
    parentId,
    active: true,
  }
}

export function createEmptyShopCatalogItemForm(categoryId: string | null = null): ShopCatalogItemFormState {
  return {
    description: '',
    categoryId,
    sku: '',
    price: '',
    active: true,
  }
}

export function resetShopCatalogCategoryForm(form: ShopCatalogCategoryFormState, parentId: string | null) {
  form.name = ''
  form.parentId = parentId
  form.active = true
}

export function resetShopCatalogItemForm(form: ShopCatalogItemFormState, categoryId: string | null) {
  form.description = ''
  form.categoryId = categoryId
  form.sku = ''
  form.price = ''
  form.active = true
}

export function hydrateShopCatalogCategoryForm(
  form: ShopCatalogCategoryFormState,
  category: ShopCategoryRecord | null,
) {
  if (!category) {
    resetShopCatalogCategoryForm(form, null)
    return
  }

  form.name = category.name
  form.parentId = category.parentId
  form.active = category.active
}

export function hydrateShopCatalogItemForm(
  form: ShopCatalogItemFormState,
  item: ShopCatalogItemRecord | null,
) {
  if (!item) {
    resetShopCatalogItemForm(form, null)
    return
  }

  form.description = item.description
  form.categoryId = item.categoryId
  form.sku = item.sku ?? ''
  form.price = formatShopCatalogPriceInputValue(item.price)
  form.active = item.active
}

export function validateShopCatalogCategoryForm(form: ShopCatalogCategoryFormState) {
  if (!form.name.trim()) return 'Enter a folder name.'
  return ''
}

export function validateShopCatalogItemForm(form: ShopCatalogItemFormState) {
  if (!form.description.trim()) return 'Enter an item name.'
  if (form.price.trim() && parseShopCatalogPrice(form.price) == null) return 'Enter a valid price.'
  return ''
}

export function buildShopCatalogCategoryWritePayload(form: ShopCatalogCategoryFormState) {
  return {
    name: form.name,
    parentId: form.parentId,
    active: form.active,
  }
}

export function buildShopCatalogItemWritePayload(
  form: ShopCatalogItemFormState,
  categoryId: string | null = form.categoryId,
) {
  return {
    description: form.description,
    categoryId,
    sku: form.sku.trim() || null,
    price: parseShopCatalogPrice(form.price),
    active: form.active,
  }
}

export function buildShopCatalogChildCategoriesByParent(categories: readonly ShopCategoryRecord[]) {
  const map = new Map<string | null, ShopCategoryRecord[]>()

  for (const category of categories) {
    const key = category.parentId ?? null
    const next = map.get(key) ?? []
    next.push(category)
    map.set(key, next)
  }

  for (const siblings of map.values()) {
    siblings.sort((left, right) => left.name.localeCompare(right.name))
  }

  return map
}

export function buildShopCatalogChildItemsByParent(items: readonly ShopCatalogItemRecord[]) {
  const map = new Map<string | null, ShopCatalogItemRecord[]>()

  for (const item of items) {
    const key = item.categoryId ?? null
    const next = map.get(key) ?? []
    next.push(item)
    map.set(key, next)
  }

  for (const siblings of map.values()) {
    siblings.sort((left, right) => left.description.localeCompare(right.description))
  }

  return map
}

export function isShopCatalogVisibleByArchive(active: boolean, showArchived: boolean) {
  return showArchived || active
}

export function getShopCatalogSelectedCategoryId(inspectorKey: string) {
  return inspectorKey.startsWith('category:') ? inspectorKey.slice('category:'.length) : null
}

export function getShopCatalogSelectedItemId(inspectorKey: string) {
  return inspectorKey.startsWith('item:') ? inspectorKey.slice('item:'.length) : null
}

export function countShopCatalogVisibleRecords(
  records: ReadonlyArray<{ active: boolean }>,
  showArchived: boolean,
) {
  return records.filter((record) => isShopCatalogVisibleByArchive(record.active, showArchived)).length
}

export function buildShopCatalogCategoryOptions(
  categories: readonly ShopCategoryRecord[],
  getCategoryPath: (categoryId: string | null) => string,
): ShopCatalogCategoryOption[] {
  return categories.map((category) => ({
    value: category.id,
    label: getCategoryPath(category.id),
  }))
}

export function buildShopCatalogCategoryParentOptions(
  selectedCategory: ShopCategoryRecord | null,
  categoryOptions: readonly ShopCatalogCategoryOption[],
  childCategoriesByParent: ReadonlyMap<string | null, readonly ShopCategoryRecord[]>,
) {
  if (!selectedCategory) return categoryOptions.slice()

  const blockedIds = getShopCatalogDescendantCategoryIds(selectedCategory.id, childCategoriesByParent)
  blockedIds.add(selectedCategory.id)
  return categoryOptions.filter((option) => !blockedIds.has(option.value))
}

export function hasShopCatalogRootBucketChildren(options: {
  visibleRootCategoryCount: number
  visibleRootItemCount: number
  createParentId: string | null
  createKey: string | null
}) {
  return (
    options.visibleRootCategoryCount > 0
    || options.visibleRootItemCount > 0
    || (options.createParentId == null && !!options.createKey)
  )
}

export function getShopCatalogSelectedCategoryHasChildren(
  category: ShopCategoryRecord | null,
  childCategoriesByParent: ReadonlyMap<string | null, readonly ShopCategoryRecord[]>,
  childItemsByParent: ReadonlyMap<string | null, readonly ShopCatalogItemRecord[]>,
) {
  if (!category) return false
  return (
    getShopCatalogDirectChildCategoryCount(childCategoriesByParent, category.id) > 0
    || getShopCatalogDirectChildItemCount(childItemsByParent, category.id) > 0
  )
}

export function getShopCatalogSelectedCategorySummaryLabel(
  category: ShopCategoryRecord | null,
  childCategoriesByParent: ReadonlyMap<string | null, readonly ShopCategoryRecord[]>,
  childItemsByParent: ReadonlyMap<string | null, readonly ShopCatalogItemRecord[]>,
) {
  if (!category) return ''
  return formatShopCatalogFolderItemSummary(
    getShopCatalogDirectChildCategoryCount(childCategoriesByParent, category.id),
    getShopCatalogDirectChildItemCount(childItemsByParent, category.id),
  ) || 'No direct contents'
}

export function getShopCatalogSelectedItemPathLabel(
  item: ShopCatalogItemRecord | null,
  getCategoryPath: (categoryId: string | null) => string,
) {
  if (!item) return ''
  return item.categoryId ? getCategoryPath(item.categoryId) : 'Top Level'
}

export function getShopCatalogSelectedItemSkuLabel(item: ShopCatalogItemRecord | null) {
  return item?.sku ? `SKU ${item.sku}` : 'No SKU'
}

export function getShopCatalogDirectChildCategoryCount(
  childCategoriesByParent: ReadonlyMap<string | null, readonly ShopCategoryRecord[]>,
  categoryId: string | null,
) {
  return childCategoriesByParent.get(categoryId)?.length ?? 0
}

export function getShopCatalogDirectChildItemCount(
  childItemsByParent: ReadonlyMap<string | null, readonly ShopCatalogItemRecord[]>,
  categoryId: string | null,
) {
  return childItemsByParent.get(categoryId)?.length ?? 0
}

export function getShopCatalogVisibleChildCategoryCount(
  childCategoriesByParent: ReadonlyMap<string | null, readonly ShopCategoryRecord[]>,
  categoryId: string | null,
  showArchived: boolean,
) {
  return (childCategoriesByParent.get(categoryId) ?? [])
    .filter((category) => isShopCatalogVisibleByArchive(category.active, showArchived))
    .length
}

export function getShopCatalogVisibleChildItemCount(
  childItemsByParent: ReadonlyMap<string | null, readonly ShopCatalogItemRecord[]>,
  categoryId: string | null,
  showArchived: boolean,
) {
  return (childItemsByParent.get(categoryId) ?? [])
    .filter((item) => isShopCatalogVisibleByArchive(item.active, showArchived))
    .length
}

export function getShopCatalogDescendantCategoryIds(
  categoryId: string,
  childCategoriesByParent: ReadonlyMap<string | null, readonly ShopCategoryRecord[]>,
) {
  const descendantIds = new Set<string>()
  const queue = [categoryId]

  while (queue.length) {
    const currentId = queue.shift() ?? null
    if (!currentId) continue
    const childCategories = childCategoriesByParent.get(currentId) ?? []
    for (const childCategory of childCategories) {
      descendantIds.add(childCategory.id)
      queue.push(childCategory.id)
    }
  }

  return descendantIds
}

export function getShopCatalogDragPayloadFromNode(
  node: ShopCatalogTreeNode,
  options: { isCreating?: boolean; isRenaming?: boolean } = {},
): ShopCatalogDragPayload | null {
  if (node.draft || options.isCreating || options.isRenaming) return null

  return {
    kind: node.kind,
    id: node.id,
  }
}

export function getShopCatalogDragPayloadFromNodeKey(
  sourceKey: ShopCatalogTreeNode['key'] | null,
): ShopCatalogDragPayload | null {
  if (!sourceKey) return null

  if (sourceKey.startsWith('category:')) {
    return {
      kind: 'category',
      id: sourceKey.slice('category:'.length),
    }
  }

  if (sourceKey.startsWith('item:')) {
    return {
      kind: 'item',
      id: sourceKey.slice('item:'.length),
    }
  }

  return null
}

export function canDropShopCatalogPayload(
  payload: ShopCatalogDragPayload | null,
  targetCategoryId: string | null,
  options: {
    categoriesById: ReadonlyMap<string, ShopCategoryRecord>
    childCategoriesByParent: ReadonlyMap<string | null, readonly ShopCategoryRecord[]>
    items: readonly ShopCatalogItemRecord[]
  },
) {
  if (!payload) return false

  if (payload.kind === 'category') {
    const category = options.categoriesById.get(payload.id) ?? null
    if (!category) return false
    if (category.id === targetCategoryId) return false
    if ((category.parentId ?? null) === targetCategoryId) return false
    if (
      targetCategoryId
      && getShopCatalogDescendantCategoryIds(category.id, options.childCategoriesByParent).has(targetCategoryId)
    ) {
      return false
    }
    return true
  }

  const item = options.items.find((candidate) => candidate.id === payload.id) ?? null
  if (!item) return false
  return (item.categoryId ?? null) !== targetCategoryId
}

export function getShopCatalogDropTargetCategoryId(node: ShopCatalogTreeNode) {
  return node.kind === 'category' ? node.id : node.parentId
}

export function getShopCatalogDropTargetKey(node: ShopCatalogTreeNode): ShopCatalogTreeNode['key'] | 'root' {
  if (node.kind === 'category') return node.key

  return node.parentId ? (`category:${node.parentId}` as const) : 'root'
}

export function getShopCatalogConfirmTitle(action: ShopCatalogConfirmAction | null) {
  if (!action) return 'Confirm catalog action'

  if (action.kind === 'archive-category') return action.nextActive ? 'Restore folder?' : 'Archive folder?'
  if (action.kind === 'archive-item') return action.nextActive ? 'Restore item?' : 'Archive item?'
  if (action.kind === 'delete-category') return 'Delete folder?'
  return 'Delete item?'
}

export function getShopCatalogConfirmMessage(action: ShopCatalogConfirmAction | null) {
  if (!action) return ''

  if (action.kind === 'archive-category') {
    return `${action.nextActive ? 'Restore' : 'Archive'} folder "${action.label}" and its catalog contents?`
  }

  if (action.kind === 'archive-item') {
    return `${action.nextActive ? 'Restore' : 'Archive'} item "${action.label}"?`
  }

  if (action.kind === 'delete-category') {
    return `Delete folder "${action.label}"? This cannot be undone.`
  }

  return `Delete item "${action.label}"? This cannot be undone.`
}

export function getShopCatalogConfirmLabel(action: ShopCatalogConfirmAction | null) {
  if (!action) return 'Confirm'

  if (action.kind === 'archive-category') return action.nextActive ? 'Restore Folder' : 'Archive Folder'
  if (action.kind === 'archive-item') return action.nextActive ? 'Restore Item' : 'Archive Item'
  if (action.kind === 'delete-category') return 'Delete Folder'
  return 'Delete Item'
}

export function isShopCatalogConfirmDestructive(action: ShopCatalogConfirmAction | null) {
  if (!action) return false
  return action.kind.startsWith('delete') || ('nextActive' in action && !action.nextActive)
}

export function buildShopCatalogTreeNodes(options: BuildShopCatalogTreeNodesOptions): ShopCatalogTreeNode[] {
  const {
    treeSearch,
    showArchived,
    rootBucketExpanded,
    expandedCategoryIds,
    createState,
    childCategoriesByParent,
    childItemsByParent,
    getCategoryPath,
  } = options
  const query = normalizeShopCatalogSearch(treeSearch)
  const expandedCategorySet = new Set(expandedCategoryIds)
  const nodes: ShopCatalogTreeNode[] = []
  const isVisibleByArchive = (active: boolean) => showArchived || active
  const getVisibleChildCategoryCount = (categoryId: string | null) =>
    (childCategoriesByParent.get(categoryId) ?? []).filter((category) => isVisibleByArchive(category.active)).length
  const getVisibleChildItemCount = (categoryId: string | null) =>
    (childItemsByParent.get(categoryId) ?? []).filter((item) => isVisibleByArchive(item.active)).length

  const appendDraftNode = (kind: 'category' | 'item', parentId: string | null, depth: number) => {
    if (!createState.key || createState.kind !== kind || createState.parentId !== parentId) return

    nodes.push({
      key: createState.key,
      kind,
      id: createState.key,
      parentId,
      depth,
      label: createState.value || (kind === 'category' ? 'New Folder' : 'New Item'),
      secondary: kind === 'category' ? 'New folder' : 'New item',
      active: true,
      hasChildren: false,
      draft: true,
    })
  }

  const appendItem = (item: ShopCatalogItemRecord, depth: number) => {
    if (!isVisibleByArchive(item.active)) return

    const label = getShopCatalogItemDisplayName(item)
    const sku = (item.sku ?? '').toLowerCase()
    const path = getCategoryPath(item.categoryId).toLowerCase()
    const matchesSearch = !query || label.toLowerCase().includes(query) || sku.includes(query) || path.includes(query)

    if (!matchesSearch) return

    nodes.push({
      key: `item:${item.id}`,
      kind: 'item',
      id: item.id,
      parentId: item.categoryId,
      depth,
      label,
      secondary: item.sku ? `SKU ${item.sku}` : 'Item',
      active: item.active,
      hasChildren: false,
    })
  }

  const appendCategory = (category: ShopCategoryRecord, depth: number) => {
    if (!isVisibleByArchive(category.active)) return

    const label = getShopCategoryDisplayName(category)
    const path = getCategoryPath(category.parentId)
    const matchesSearch = !query || label.toLowerCase().includes(query) || path.toLowerCase().includes(query)

    if (matchesSearch) {
      const visibleChildCategoryCount = getVisibleChildCategoryCount(category.id)
      const visibleChildItemCount = getVisibleChildItemCount(category.id)

      nodes.push({
        key: `category:${category.id}`,
        kind: 'category',
        id: category.id,
        parentId: category.parentId,
        depth,
        label,
        secondary: formatShopCatalogFolderItemSummary(visibleChildCategoryCount, visibleChildItemCount),
        active: category.active,
        hasChildren: visibleChildCategoryCount > 0 || visibleChildItemCount > 0,
      })
    }

    if (!expandedCategorySet.has(category.id) && !query) return

    const childCategories = childCategoriesByParent.get(category.id) ?? []
    for (const childCategory of childCategories) {
      appendCategory(childCategory, depth + 1)
    }

    appendDraftNode('category', category.id, depth + 1)

    const childItems = childItemsByParent.get(category.id) ?? []
    for (const childItem of childItems) {
      appendItem(childItem, depth + 1)
    }

    appendDraftNode('item', category.id, depth + 1)
  }

  const rootCategories = childCategoriesByParent.get(null) ?? []
  if (rootBucketExpanded || query) {
    for (const rootCategory of rootCategories) {
      appendCategory(rootCategory, 1)
    }

    appendDraftNode('category', null, 1)

    const rootItems = childItemsByParent.get(null) ?? []
    for (const rootItem of rootItems) {
      appendItem(rootItem, 1)
    }

    appendDraftNode('item', null, 1)
  }

  return nodes
}
