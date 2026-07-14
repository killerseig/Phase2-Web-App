import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

export function normalizeShopCatalogSearch(value: string) {
  return value.trim().toLowerCase()
}

export function getShopCategoryDisplayName(category: Pick<ShopCategoryRecord, 'name'>) {
  return category.name.trim() || 'Untitled Folder'
}

export function getShopCatalogItemDisplayName(item: Pick<ShopCatalogItemRecord, 'description'>) {
  return item.description.trim() || 'Untitled Item'
}

export function getShopCatalogCategoryPath(
  categoryId: string | null,
  categoriesById: ReadonlyMap<string, ShopCategoryRecord>,
) {
  if (!categoryId) return 'Top Level'

  const segments: string[] = []
  let currentId: string | null = categoryId

  while (currentId) {
    const category = categoriesById.get(currentId)
    if (!category) break
    segments.unshift(getShopCategoryDisplayName(category))
    currentId = category.parentId
  }

  return segments.join(' / ') || 'Top Level'
}

export function formatShopCatalogFolderItemSummary(folderCount: number, itemCount: number) {
  const parts: string[] = []

  if (folderCount > 0) {
    parts.push(`${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}`)
  }

  if (itemCount > 0) {
    parts.push(`${itemCount} ${itemCount === 1 ? 'item' : 'items'}`)
  }

  return parts.join(' | ')
}
