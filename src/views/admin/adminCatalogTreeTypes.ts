import type { ShopCatalogItem } from '@/services'

export type AdminCatalogItemUpdates = {
  description?: string
  sku?: string | null
  price?: number | null
}

export type AdminCatalogCategoryUpdates = {
  name: string
}

export type AdminCatalogTreeListeners = {
  'toggle-expand': (nodeId: string) => void
  'add-child': (parentId: string) => void
  'add-item': (parentId: string) => void
  'edit-item': (item: ShopCatalogItem) => void
  'save-item': (itemId: string, updates: AdminCatalogItemUpdates) => void | Promise<void>
  'delete-item': (item: ShopCatalogItem) => void | Promise<void>
  'edit-category': (id: string) => void
  'save-category': (id: string, updates: AdminCatalogCategoryUpdates) => void | Promise<void>
  'cancel-category-edit': () => void
  'cancel-item-edit': () => void
  archive: (id: string) => void | Promise<void>
  reactivate: (id: string) => void | Promise<void>
  'archive-item': (item: ShopCatalogItem) => void | Promise<void>
  'reactivate-item': (item: ShopCatalogItem) => void | Promise<void>
  'delete-category': (id: string) => void | Promise<void>
  'update:editCategoryName': (name: string) => void
}
