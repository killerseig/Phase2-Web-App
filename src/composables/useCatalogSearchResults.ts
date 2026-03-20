import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import type { ShopCatalogItem } from '@/services'
import type { ShopCategory } from '@/stores/shopCategories'

const ITEM_PREFIX = 'item-'
const DEFAULT_DEBOUNCE_MS = 40
const DEFAULT_MAX_RESULTS = 200
const MAX_PATH_DEPTH = 100

export type CatalogSearchMatchStrength = 'none' | 'primary' | 'secondary' | 'tertiary'

export type CatalogSearchResult = {
  id: string
  nodeId: string
  kind: 'category' | 'item'
  label: string
  pathLabel: string
  breadcrumbLabel: string
  sku?: string
  price?: number
  active: boolean
  hasChildren: boolean
  ancestorNodeIds: string[]
  matchStrength: Exclude<CatalogSearchMatchStrength, 'none'>
  item?: ShopCatalogItem
  category?: ShopCategory
}

type IncludeCategoryContext = {
  hasChildren: boolean
}

type IncludeItemContext = {
  hasChildren: boolean
}

type UseCatalogSearchResultsOptions = {
  searchQuery: Ref<string>
  categories: Ref<ShopCategory[]>
  allItems: Ref<ShopCatalogItem[]>
  includeCategory?: (category: ShopCategory, context: IncludeCategoryContext) => boolean
  includeItem?: (item: ShopCatalogItem, context: IncludeItemContext) => boolean
  debounceMs?: number
  maxResults?: number
}

type FlatCatalogNode = {
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

type SearchableCatalogRecord = Omit<CatalogSearchResult, 'matchStrength'> & {
  primaryText: string
  secondaryText: string
  tertiaryText: string
}

function createItemNodeId(itemId: string): string {
  return `${ITEM_PREFIX}${itemId}`
}

function normalizeSearchValue(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizeSearchQuery(query: string): string[] {
  return normalizeSearchValue(query)
    .split(' ')
    .filter(Boolean)
}

function includesAllTokens(haystack: string, tokens: string[]): boolean {
  if (!haystack || tokens.length === 0) return false
  return tokens.every((token) => haystack.includes(token))
}

function resolveMatchStrength(record: SearchableCatalogRecord, tokens: string[]): CatalogSearchMatchStrength {
  if (tokens.length === 0) return 'none'
  if (includesAllTokens(record.primaryText, tokens)) return 'primary'
  if (includesAllTokens(record.secondaryText, tokens)) return 'secondary'
  if (includesAllTokens(record.tertiaryText, tokens)) return 'tertiary'

  const combined = [record.primaryText, record.secondaryText, record.tertiaryText]
    .filter(Boolean)
    .join(' ')

  return includesAllTokens(combined, tokens) ? 'tertiary' : 'none'
}

function matchStrengthRank(strength: CatalogSearchMatchStrength): number {
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

export function useCatalogSearchResults(options: UseCatalogSearchResultsOptions) {
  const includeCategory = options.includeCategory ?? (() => true)
  const includeItem = options.includeItem ?? (() => true)
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS

  const debouncedSearchQuery: Ref<string> = (() => {
    if (debounceMs <= 0) {
      return computed(() => {
        const value = options.searchQuery.value ?? ''
        return value.trim() ? value : ''
      })
    }

    const result = ref(options.searchQuery.value)
    let debounceHandle: ReturnType<typeof setTimeout> | null = null

    const stop = watch(
      () => options.searchQuery.value,
      (value) => {
        if (debounceHandle) {
          clearTimeout(debounceHandle)
          debounceHandle = null
        }

        if (!value?.trim()) {
          result.value = ''
          return
        }

        debounceHandle = setTimeout(() => {
          result.value = value
          debounceHandle = null
        }, debounceMs)
      },
      { immediate: true }
    )

    onScopeDispose(() => {
      if (debounceHandle) clearTimeout(debounceHandle)
      stop()
    })

    return result
  })()

  const normalizedQuery = computed(() => normalizeSearchValue(debouncedSearchQuery.value))
  const queryTokens = computed(() => tokenizeSearchQuery(normalizedQuery.value))
  const isSearching = computed(() => queryTokens.value.length > 0)

  const searchableRecords = computed<SearchableCatalogRecord[]>(() => {
    const categoryIds = new Set(options.categories.value.map((category) => category.id))
    const itemIds = new Set(options.allItems.value.map((item) => item.id))
    const nodeMap = new Map<string, FlatCatalogNode>()
    const childIds = new Map<string, string[]>()

    const ensureChildBucket = (nodeId: string) => {
      if (!childIds.has(nodeId)) {
        childIds.set(nodeId, [])
      }
    }

    const normalizeParentNodeId = (parentId: string | null | undefined): string | null => {
      if (!parentId) return null
      if (parentId.startsWith(ITEM_PREFIX)) return parentId
      if (itemIds.has(parentId)) return createItemNodeId(parentId)
      if (categoryIds.has(parentId)) return parentId
      return null
    }

    options.categories.value.forEach((category) => {
      const parentNodeId = normalizeParentNodeId(category.parentId)
      nodeMap.set(category.id, {
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

    options.allItems.value.forEach((item) => {
      const nodeId = createItemNodeId(item.id)
      nodeMap.set(nodeId, {
        id: item.id,
        nodeId,
        kind: 'item',
        label: item.description,
        parentNodeId: normalizeParentNodeId(item.categoryId ?? null),
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

    options.categories.value.forEach((category) => {
      pushChild(normalizeParentNodeId(category.parentId), category.id)
    })

    options.allItems.value.forEach((item) => {
      pushChild(normalizeParentNodeId(item.categoryId ?? null), createItemNodeId(item.id))
    })

    const pathLabelCache = new Map<string, string[]>()
    const ancestorIdCache = new Map<string, string[]>()

    const getPathSegments = (nodeId: string, seen = new Set<string>(), depth = 0): string[] => {
      if (pathLabelCache.has(nodeId)) return pathLabelCache.get(nodeId) ?? []

      const record = nodeMap.get(nodeId)
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
      if (ancestorIdCache.has(nodeId)) return ancestorIdCache.get(nodeId) ?? []

      const ancestorIds: string[] = []
      const seen = new Set<string>()
      let currentParentId = nodeMap.get(nodeId)?.parentNodeId ?? null
      let depth = 0

      while (currentParentId && depth <= MAX_PATH_DEPTH) {
        if (seen.has(currentParentId)) break
        seen.add(currentParentId)
        ancestorIds.unshift(currentParentId)
        currentParentId = nodeMap.get(currentParentId)?.parentNodeId ?? null
        depth += 1
      }

      ancestorIdCache.set(nodeId, ancestorIds)
      return ancestorIds
    }

    const records: SearchableCatalogRecord[] = []

    nodeMap.forEach((record, nodeId) => {
      const hasChildren = (childIds.get(nodeId)?.length ?? 0) > 0

      if (record.kind === 'category') {
        if (!record.category || !includeCategory(record.category, { hasChildren })) return
      } else if (!record.item || !includeItem(record.item, { hasChildren })) {
        return
      }

      const pathSegments = getPathSegments(nodeId)
      const breadcrumbSegments = pathSegments.slice(0, -1)
      const pathLabel = pathSegments.join(' > ')
      const breadcrumbLabel = breadcrumbSegments.join(' > ')

      records.push({
        id: record.id,
        nodeId,
        kind: record.kind,
        label: record.label,
        pathLabel,
        breadcrumbLabel,
        sku: record.sku,
        price: record.price,
        active: record.active,
        hasChildren,
        ancestorNodeIds: getAncestorNodeIds(nodeId),
        category: record.category,
        item: record.item,
        primaryText: normalizeSearchValue(record.label),
        secondaryText: normalizeSearchValue(
          record.kind === 'item'
            ? `${record.sku ?? ''} ${record.price ?? ''}`
            : ''
        ),
        tertiaryText: normalizeSearchValue(pathLabel),
      })
    })

    return records
  })

  const searchEvaluation = computed(() => {
    if (!isSearching.value) {
      return {
        results: [] as CatalogSearchResult[],
        totalResultCount: 0,
      }
    }

    const matches: CatalogSearchResult[] = []

    searchableRecords.value.forEach((record) => {
      const matchStrength = resolveMatchStrength(record, queryTokens.value)
      if (matchStrength === 'none') return

      matches.push({
        id: record.id,
        nodeId: record.nodeId,
        kind: record.kind,
        label: record.label,
        pathLabel: record.pathLabel,
        breadcrumbLabel: record.breadcrumbLabel,
        sku: record.sku,
        price: record.price,
        active: record.active,
        hasChildren: record.hasChildren,
        ancestorNodeIds: record.ancestorNodeIds,
        matchStrength,
        item: record.item,
        category: record.category,
      })
    })

    matches.sort((a, b) => {
        const strengthDiff = matchStrengthRank(a.matchStrength) - matchStrengthRank(b.matchStrength)
        if (strengthDiff !== 0) return strengthDiff

        const activeDiff = Number(b.active) - Number(a.active)
        if (activeDiff !== 0) return activeDiff

        const kindDiff = Number(a.kind === 'category') - Number(b.kind === 'category')
        if (kindDiff !== 0) return kindDiff

        const labelDiff = a.label.localeCompare(b.label)
        if (labelDiff !== 0) return labelDiff

        return a.pathLabel.localeCompare(b.pathLabel)
      })

    return {
      results: maxResults > 0 ? matches.slice(0, maxResults) : matches,
      totalResultCount: matches.length,
    }
  })

  return {
    normalizedQuery,
    isSearching,
    results: computed(() => searchEvaluation.value.results),
    totalResultCount: computed(() => searchEvaluation.value.totalResultCount),
    visibleResultCount: computed(() => searchEvaluation.value.results.length),
    hasMoreResults: computed(() => searchEvaluation.value.totalResultCount > searchEvaluation.value.results.length),
  }
}
