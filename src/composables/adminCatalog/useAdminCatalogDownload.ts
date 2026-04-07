import { ref, type Ref } from 'vue'
import type { ToastNotifier } from '@/composables/useToast'
import type { ShopCatalogItem } from '@/services'
import { type ShopCategory, useShopCategoriesStore } from '@/stores/shopCategories'
import { isCatalogParentItemId } from '@/utils/catalogNode'
import { logError } from '@/utils'

type UseAdminCatalogDownloadOptions = {
  categoriesStore: ReturnType<typeof useShopCategoriesStore>
  categories: Ref<ShopCategory[]>
  allItems: Ref<ShopCatalogItem[]>
  toast: ToastNotifier
}

export function useAdminCatalogDownload(options: UseAdminCatalogDownloadOptions) {
  const downloading = ref(false)

  const normalizeCategoryId = (value?: string | null) => {
    if (!value) return null
    const trimmed = value.trim()
    if (!trimmed) return null
    return trimmed
  }

  const escapeCsv = (value: unknown) => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  async function downloadCatalog() {
    if (!options.allItems.value.length && !options.categories.value.length) return

    downloading.value = true
    try {
      const header = ['Name', 'Type', 'SKU', 'Price', 'Active', 'Path', 'Hierarchy Level', 'Is Sub Item', 'ID']

      const getChildrenNormalized = (parentId: string | null) =>
        options.categories.value
          .filter((category) => normalizeCategoryId(category.parentId) === normalizeCategoryId(parentId))
          .sort((a, b) => a.name.localeCompare(b.name))

      const getChildCategoriesForItem = (itemId: string) =>
        options.categories.value
          .filter((category) => isCatalogParentItemId(normalizeCategoryId(category.parentId), itemId))
          .sort((a, b) => a.name.localeCompare(b.name))

      const itemsByCategory = new Map<string | null, ShopCatalogItem[]>()
      options.allItems.value.forEach((item) => {
        const key = normalizeCategoryId(item.categoryId)
        const arr = itemsByCategory.get(key) ?? []
        arr.push(item)
        itemsByCategory.set(key, arr)
      })

      const sortItems = (arr: ShopCatalogItem[] = []) =>
        arr.slice().sort((a, b) => a.description.localeCompare(b.description))

      const rows: (string | number)[][] = []
      const MAX_DEPTH = 200
      const visitedCategories = new Set<string>()
      const visitedItems = new Set<string>()

      const addItemRow = (item: ShopCatalogItem, path: string, level: number, depth: number) => {
        if (depth > MAX_DEPTH) return
        if (visitedItems.has(item.id)) return
        visitedItems.add(item.id)

        const isSubItem = level > 0 ? 'Yes' : 'No'
        rows.push([
          item.description || '',
          'Item',
          item.sku || '',
          typeof item.price === 'number' ? item.price.toFixed(2) : '',
          item.active === false ? 'Inactive' : 'Active',
          path,
          level,
          isSubItem,
          item.id,
        ])

        const childCategories = getChildCategoriesForItem(item.id)
        const nextPathBase = path ? `${path} > ${item.description}` : item.description
        childCategories.forEach((childCategory) =>
          traverseCategory(childCategory.id, nextPathBase, level + 1, depth + 1)
        )
      }

      const traverseCategory = (categoryId: string, parentPath: string, level: number, depth: number) => {
        if (depth > MAX_DEPTH) return
        if (visitedCategories.has(categoryId)) return
        visitedCategories.add(categoryId)

        const category = options.categoriesStore.getCategoryById(categoryId)
        if (!category) return
        const path = parentPath ? `${parentPath} > ${category.name}` : category.name

        rows.push([
          category.name,
          'Category',
          '',
          '',
          category.active === false ? 'Inactive' : 'Active',
          path,
          level,
          level > 0 ? 'Yes' : 'No',
          category.id,
        ])

        const itemsInCategory = sortItems(itemsByCategory.get(normalizeCategoryId(categoryId)) ?? [])
        itemsInCategory.forEach((item) => addItemRow(item, path, level + 1, depth + 1))

        const childCategories = getChildrenNormalized(categoryId)
        childCategories.forEach((childCategory) =>
          traverseCategory(childCategory.id, path, level + 1, depth + 1)
        )
      }

      sortItems(itemsByCategory.get(null) ?? []).forEach((item) => addItemRow(item, '', 0, 0))

      const rootCategories = getChildrenNormalized(null)
      const seenRootIds = new Set<string>()
      rootCategories
        .filter((category) => {
          if (seenRootIds.has(category.id)) return false
          seenRootIds.add(category.id)
          return true
        })
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((category) => traverseCategory(category.id, '', 0, 0))

      const csv = [header, ...rows]
        .map((row) => row.map(escapeCsv).join(','))
        .join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'shop-catalog.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      logError('AdminShopCatalog', 'Failed to download catalog', error)
      options.toast.show('Failed to download catalog', 'error')
    } finally {
      downloading.value = false
    }
  }

  return {
    downloading,
    downloadCatalog,
  }
}
