import type { ShopCatalogItemRecord } from '@/types/domain'
import type { ShopCatalogTreeNode } from './treeTypes'

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseShopCatalogTreeInteractionsOptions {
  clearDragState: () => void
  closeContextMenu: () => void
  consumeSuppressedClick: (event: MouseEvent) => boolean
  inspectItem: (item: ShopCatalogItemRecord, options?: { showInspector?: boolean }) => void
  items: ReadonlyRef<readonly ShopCatalogItemRecord[]>
  selectFolder: (
    categoryId: string,
    options?: { showInspector?: boolean; ensureExpanded?: boolean },
  ) => void
  selectRoot: () => void
  toggleCategoryExpanded: (categoryId: string) => void
  toggleRootBucketExpanded: () => void
}

export function useShopCatalogTreeInteractions({
  clearDragState,
  closeContextMenu,
  consumeSuppressedClick,
  inspectItem,
  items,
  selectFolder,
  selectRoot,
  toggleCategoryExpanded,
  toggleRootBucketExpanded,
}: UseShopCatalogTreeInteractionsOptions) {
  function openTreeNode(node: ShopCatalogTreeNode) {
    if (node.draft) return

    if (node.kind === 'category') {
      selectFolder(node.id, { showInspector: false, ensureExpanded: false })
      if (node.hasChildren) {
        toggleCategoryExpanded(node.id)
      }
      return
    }

    const item = items.value.find((candidate) => candidate.id === node.id)
    if (item) {
      inspectItem(item, { showInspector: false })
    }
  }

  function handleRootSurfaceClick(event: MouseEvent) {
    if (consumeSuppressedClick(event)) return
    selectRoot()
  }

  function handleRootBucketClick(event: MouseEvent) {
    if (consumeSuppressedClick(event)) return
    selectRoot()
    toggleRootBucketExpanded()
  }

  function handleTreeNodeClick(event: MouseEvent, node: ShopCatalogTreeNode) {
    if (consumeSuppressedClick(event)) return
    openTreeNode(node)
  }

  function handleGlobalPointerDown() {
    closeContextMenu()
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeContextMenu()
      clearDragState()
    }
  }

  return {
    handleGlobalKeydown,
    handleGlobalPointerDown,
    handleRootBucketClick,
    handleRootSurfaceClick,
    handleTreeNodeClick,
    openTreeNode,
  }
}
