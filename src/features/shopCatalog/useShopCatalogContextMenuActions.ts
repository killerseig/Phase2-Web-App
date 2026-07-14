import { computed, type Ref } from 'vue'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'
import type { ShopCatalogContextMenuTarget } from './useShopCatalogContextMenu'

type InlineCreateKind = 'category' | 'item'

interface ReadonlyRef<T> {
  readonly value: T
}

export interface ShopCatalogContextAction {
  key: string
  label: string
  danger?: boolean
  disabled?: boolean
  run: () => void
}

interface UseShopCatalogContextMenuActionsOptions {
  beginInlineCreate: (kind: InlineCreateKind, parentId: string | null) => void | Promise<void>
  beginRenameNode: (target: ShopCatalogContextMenuTarget) => void | Promise<void>
  closeContextMenu: () => void
  collapseAllCategories: () => void
  deleteCategoryFromContext: (categoryId: string) => void
  deleteItemFromContext: (itemId: string) => void
  expandedCategoryIds: ReadonlyRef<readonly string[]>
  expandAllCategories: () => void
  getCategoryById: (categoryId: string) => ShopCategoryRecord | null
  getDirectChildCategoryCount: (categoryId: string | null) => number
  getDirectChildItemCount: (categoryId: string | null) => number
  getItemById: (itemId: string) => ShopCatalogItemRecord | null
  getVisibleCategoryIds: () => string[]
  handleArchiveCategory: (
    nextActive: boolean,
    categoryId: string,
    options?: { showInspector?: boolean },
  ) => void | Promise<void>
  handleArchiveItem: (
    nextActive: boolean,
    itemId: string,
    options?: { showInspector?: boolean },
  ) => void | Promise<void>
  inspectItem: (item: ShopCatalogItemRecord, options?: { showInspector?: boolean }) => void
  isSinglePaneLayout: ReadonlyRef<boolean>
  openCreateItemMode: (parentId: string | null) => void
  rootBucketExpanded: Ref<boolean>
  selectFolder: (categoryId: string, options?: { showInspector?: boolean }) => void
  selectRoot: () => void
  showMobileInspector: () => void
  target: ReadonlyRef<ShopCatalogContextMenuTarget>
}

export function useShopCatalogContextMenuActions(options: UseShopCatalogContextMenuActionsOptions) {
  const contextMenuActions = computed<ShopCatalogContextAction[]>(() => {
    const target = options.target.value
    const visibleCategoryIds = options.getVisibleCategoryIds()
    const hasVisibleCategories = visibleCategoryIds.length > 0
    const allVisibleCategoriesExpanded =
      options.rootBucketExpanded.value
      && (!hasVisibleCategories || visibleCategoryIds.every((categoryId) => (
        options.expandedCategoryIds.value.includes(categoryId)
      )))
    const anyFoldersExpanded = options.rootBucketExpanded.value || options.expandedCategoryIds.value.length > 0

    function makeExpandCollapseActions(suffix: 'root' | 'category' | 'item'): ShopCatalogContextAction[] {
      return [
        {
          key: `expand-all-folders-${suffix}`,
          label: 'Expand All Folders',
          disabled: allVisibleCategoriesExpanded,
          run: options.expandAllCategories,
        },
        {
          key: `collapse-all-folders-${suffix}`,
          label: 'Collapse All Folders',
          disabled: !anyFoldersExpanded,
          run: options.collapseAllCategories,
        },
      ]
    }

    if (target.kind === 'root') {
      return [
        ...(options.isSinglePaneLayout.value
          ? [{
              key: 'inspect-root',
              label: 'Inspect',
              run: () => {
                options.selectRoot()
                options.showMobileInspector()
                options.closeContextMenu()
              },
            }]
          : []),
        {
          key: 'new-folder-root',
          label: 'New Folder',
          run: () => {
            void options.beginInlineCreate('category', null)
          },
        },
        {
          key: 'new-item-root',
          label: 'New Item',
          run: () => {
            options.openCreateItemMode(null)
            options.closeContextMenu()
          },
        },
        ...makeExpandCollapseActions('root'),
      ]
    }

    if (target.kind === 'category') {
      const category = options.getCategoryById(target.id)
      const hasChildren = category
        ? options.getDirectChildCategoryCount(category.id) > 0 || options.getDirectChildItemCount(category.id) > 0
        : false
      const isArchived = category ? !category.active : false

      return [
        ...(options.isSinglePaneLayout.value
          ? [{
              key: 'inspect-folder',
              label: 'Inspect',
              run: () => {
                options.selectFolder(target.id, { showInspector: true })
                options.closeContextMenu()
              },
            }]
          : []),
        {
          key: 'new-folder-inside',
          label: 'New Folder',
          run: () => {
            void options.beginInlineCreate('category', target.id)
          },
        },
        {
          key: 'new-item-inside',
          label: 'New Item',
          run: () => {
            options.openCreateItemMode(target.id)
            options.closeContextMenu()
          },
        },
        {
          key: 'rename-folder',
          label: 'Rename',
          run: () => {
            void options.beginRenameNode(target)
          },
        },
        ...makeExpandCollapseActions('category'),
        {
          key: 'archive-folder',
          label: isArchived ? 'Restore Folder' : 'Archive Folder',
          run: () => {
            void options.handleArchiveCategory(isArchived, target.id, { showInspector: false })
            options.closeContextMenu()
          },
        },
        {
          key: 'delete-folder',
          label: 'Delete Folder',
          danger: true,
          disabled: hasChildren,
          run: () => options.deleteCategoryFromContext(target.id),
        },
      ]
    }

    const item = options.getItemById(target.id)
    const isArchived = item ? !item.active : false

    return [
      ...(options.isSinglePaneLayout.value
        ? [{
            key: 'inspect-item',
            label: 'Inspect',
            run: () => {
              if (item) {
                options.inspectItem(item, { showInspector: true })
              }
              options.closeContextMenu()
            },
          }]
        : []),
      {
        key: 'rename-item',
        label: 'Rename',
        run: () => {
          void options.beginRenameNode(target)
        },
      },
      ...makeExpandCollapseActions('item'),
      {
        key: 'archive-item',
        label: isArchived ? 'Restore Item' : 'Archive Item',
        run: () => {
          void options.handleArchiveItem(isArchived, target.id, { showInspector: false })
          options.closeContextMenu()
        },
      },
      {
        key: 'delete-item',
        label: 'Delete Item',
        danger: true,
        run: () => options.deleteItemFromContext(target.id),
      },
    ]
  })

  return {
    contextMenuActions,
  }
}
