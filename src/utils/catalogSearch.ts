import type { ShopCatalogItem } from '@/services'
import type { ShopCategory } from '@/stores/shopCategories'
import {
  createCatalogItemNodeId,
  normalizeCatalogParentNodeId,
} from '@/utils/catalogNode'

const MAX_PATH_DEPTH = 100

export type CatalogSearchMatchStrength = 'none' | 'primary' | 'secondary' | 'tertiary'

export type CatalogSearchTextRecord = {
  primaryText: string
  secondaryText: string
  tertiaryText: string
}

export type CatalogSearchNode = {
  id: string
  nodeId: string
  kind: 'category' | 'item'
  label: string
  parentNodeId: string | null
  active: boolean
  sku?: string
  price?: number
  category?: ShopCategory
  item?: ShopCatalogItem
}

export type CatalogSearchNodeIndex = {
  childIds: Map<string, string[]>
  nodesById: Map<string, CatalogSearchNode>
  rootCategoryNodeIds: string[]
  rootItemNodeIds: string[]
  uncategorizedItemNodeIds: string[]
}

export function normalizeCatalogSearchValue(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenizeCatalogSearchQuery(query: string): string[] {
  return normalizeCatalogSearchValue(query)
    .split(' ')
    .filter(Boolean)
}

function includesAllTokens(haystack: string, tokens: string[]): boolean {
  if (!haystack || tokens.length === 0) return false
  return tokens.every((token) => haystack.includes(token))
}

export function resolveCatalogSearchMatchStrength(
  record: CatalogSearchTextRecord,
  tokens: string[],
): CatalogSearchMatchStrength {
  if (tokens.length === 0) return 'none'
  if (includesAllTokens(record.primaryText, tokens)) return 'primary'
  if (includesAllTokens(record.secondaryText, tokens)) return 'secondary'
  if (includesAllTokens(record.tertiaryText, tokens)) return 'tertiary'

  const combined = [record.primaryText, record.secondaryText, record.tertiaryText]
    .filter(Boolean)
    .join(' ')

  return includesAllTokens(combined, tokens) ? 'tertiary' : 'none'
}

export function rankCatalogSearchMatchStrength(strength: CatalogSearchMatchStrength): number {
  switch (strength) {
    case 'primary':
      return 0
    case 'secondary':
      return 1
    case 'tertiary':
      return 2
    default:
      return 3
  }
}

export function buildCatalogSearchNodeIndex(options: {
  categories: ShopCategory[]
  items: ShopCatalogItem[]
}): CatalogSearchNodeIndex {
  const categoryIds = new Set(options.categories.map((category) => category.id))
  const itemIds = new Set(options.items.map((item) => item.id))
  const nodesById = new Map<string, CatalogSearchNode>()
  const childIds = new Map<string, string[]>()

  const ensureChildBucket = (nodeId: string) => {
    if (!childIds.has(nodeId)) {
      childIds.set(nodeId, [])
    }
  }

  const resolveParentNodeId = (parentId: string | null | undefined) =>
    normalizeCatalogParentNodeId(parentId, categoryIds, itemIds)

  options.categories.forEach((category) => {
    const parentNodeId = resolveParentNodeId(category.parentId)
    nodesById.set(category.id, {
      id: category.id,
      nodeId: category.id,
      kind: 'category',
      label: category.name,
      parentNodeId,
      active: category.active !== false,
      category,
    })
    ensureChildBucket(category.id)
  })

  options.items.forEach((item) => {
    const nodeId = createCatalogItemNodeId(item.id)
    nodesById.set(nodeId, {
      id: item.id,
      nodeId,
      kind: 'item',
      label: item.description,
      parentNodeId: resolveParentNodeId(item.categoryId ?? null),
      active: item.active !== false,
      sku: item.sku ?? undefined,
      price: item.price ?? undefined,
      item,
    })
    ensureChildBucket(nodeId)
  })

  const pushChild = (parentNodeId: string | null, childNodeId: string) => {
    if (!parentNodeId) return
    ensureChildBucket(parentNodeId)
    childIds.get(parentNodeId)?.push(childNodeId)
  }

  options.categories.forEach((category) => {
    pushChild(resolveParentNodeId(category.parentId), category.id)
  })

  options.items.forEach((item) => {
    pushChild(resolveParentNodeId(item.categoryId ?? null), createCatalogItemNodeId(item.id))
  })

  return {
    childIds,
    nodesById,
    rootCategoryNodeIds: options.categories
      .filter((category) => !resolveParentNodeId(category.parentId))
      .map((category) => category.id),
    rootItemNodeIds: options.items
      .filter((item) => !resolveParentNodeId(item.categoryId ?? null))
      .map((item) => createCatalogItemNodeId(item.id)),
    uncategorizedItemNodeIds: options.items
      .filter((item) => !item.categoryId)
      .map((item) => createCatalogItemNodeId(item.id)),
  }
}

export function createCatalogPathResolver(nodesById: ReadonlyMap<string, CatalogSearchNode>) {
  const pathLabelCache = new Map<string, string[]>()
  const ancestorIdCache = new Map<string, string[]>()

  const getPathSegments = (nodeId: string, seen = new Set<string>(), depth = 0): string[] => {
    if (pathLabelCache.has(nodeId)) {
      return pathLabelCache.get(nodeId) ?? []
    }

    const record = nodesById.get(nodeId)
    if (!record) return []

    if (seen.has(nodeId) || depth > MAX_PATH_DEPTH) {
      const fallback = [record.label].filter(Boolean)
      pathLabelCache.set(nodeId, fallback)
      return fallback
    }

    const nextSeen = new Set(seen)
    nextSeen.add(nodeId)
    const parentSegments = record.parentNodeId
      ? getPathSegments(record.parentNodeId, nextSeen, depth + 1)
      : []
    const segments = [...parentSegments, record.label].filter(Boolean)
    pathLabelCache.set(nodeId, segments)
    return segments
  }

  const getAncestorNodeIds = (nodeId: string): string[] => {
    if (ancestorIdCache.has(nodeId)) {
      return ancestorIdCache.get(nodeId) ?? []
    }

    const ancestorIds: string[] = []
    const seen = new Set<string>()
    let currentParentId = nodesById.get(nodeId)?.parentNodeId ?? null
    let depth = 0

    while (currentParentId && depth <= MAX_PATH_DEPTH) {
      if (seen.has(currentParentId)) break
      seen.add(currentParentId)
      ancestorIds.unshift(currentParentId)
      currentParentId = nodesById.get(currentParentId)?.parentNodeId ?? null
      depth += 1
    }

    ancestorIdCache.set(nodeId, ancestorIds)
    return ancestorIds
  }

  return {
    getPathSegments,
    getAncestorNodeIds,
  }
}
