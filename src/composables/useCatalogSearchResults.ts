import { computed, type Ref } from 'vue'
import { useDebouncedSearchQuery } from '@/composables/useDebouncedSearchQuery'
import type { ShopCatalogItem } from '@/services'
import type { ShopCategory } from '@/stores/shopCategories'
import {
  buildCatalogSearchNodeIndex,
  createCatalogPathResolver,
  normalizeCatalogSearchValue,
  rankCatalogSearchMatchStrength,
  resolveCatalogSearchMatchStrength,
  tokenizeCatalogSearchQuery,
  type CatalogSearchMatchStrength,
  type CatalogSearchNode,
  type CatalogSearchTextRecord,
} from '@/utils/catalogSearch'

const DEFAULT_DEBOUNCE_MS = 40
const DEFAULT_MAX_RESULTS = 200

export type { CatalogSearchMatchStrength } from '@/utils/catalogSearch'

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

type SearchableCatalogRecord = CatalogSearchTextRecord & Omit<CatalogSearchResult, 'matchStrength'>

export function useCatalogSearchResults(options: UseCatalogSearchResultsOptions) {
  const includeCategory = options.includeCategory ?? (() => true)
  const includeItem = options.includeItem ?? (() => true)
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS

  const debouncedSearchQuery = useDebouncedSearchQuery(options.searchQuery, debounceMs)
  const normalizedQuery = computed(() => normalizeCatalogSearchValue(debouncedSearchQuery.value))
  const queryTokens = computed(() => tokenizeCatalogSearchQuery(normalizedQuery.value))
  const isSearching = computed(() => queryTokens.value.length > 0)

  const nodeIndex = computed(() =>
    buildCatalogSearchNodeIndex({
      categories: options.categories.value,
      items: options.allItems.value,
    }),
  )

  const searchableRecords = computed<SearchableCatalogRecord[]>(() => {
    const { nodesById, childIds } = nodeIndex.value
    const { getPathSegments, getAncestorNodeIds } = createCatalogPathResolver(nodesById)
    const records: SearchableCatalogRecord[] = []

    nodesById.forEach((record: CatalogSearchNode, nodeId) => {
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
        sku: !hasChildren ? record.sku : undefined,
        price: !hasChildren ? record.price : undefined,
        active: record.active,
        hasChildren,
        ancestorNodeIds: getAncestorNodeIds(nodeId),
        category: record.category,
        item: record.item,
        primaryText: normalizeCatalogSearchValue(record.label),
        secondaryText: normalizeCatalogSearchValue(
          !hasChildren ? `${record.sku ?? ''} ${record.price ?? ''}` : '',
        ),
        tertiaryText: normalizeCatalogSearchValue(pathLabel),
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
      const matchStrength = resolveCatalogSearchMatchStrength(record, queryTokens.value)
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
      const strengthDiff = rankCatalogSearchMatchStrength(a.matchStrength)
        - rankCatalogSearchMatchStrength(b.matchStrength)
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
