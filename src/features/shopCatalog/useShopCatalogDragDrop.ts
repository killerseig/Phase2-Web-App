import { reactive } from 'vue'
import {
  canDropShopCatalogPayload,
  getShopCatalogDragPayloadFromNode,
  getShopCatalogDragPayloadFromNodeKey,
  getShopCatalogDropTargetCategoryId,
  getShopCatalogDropTargetKey,
  type ShopCatalogDragPayload,
} from '@/features/shopCatalog/adminViewHelpers'
import type { ShopCatalogTreeNode as TreeNode } from '@/features/shopCatalog/treeTypes'
import { useShopCatalogTreeAutoScroll } from '@/features/shopCatalog/useShopCatalogTreeAutoScroll'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseShopCatalogDragDropOptions {
  categoriesById: ReadonlyRef<Map<string, ShopCategoryRecord>>
  childCategoriesByParent: ReadonlyRef<Map<string | null, ShopCategoryRecord[]>>
  clearPointerType: () => void
  closeContextMenu: () => void
  getScrollContainer: () => HTMLElement | null
  isCreatingNode: (nodeKey: TreeNode['key']) => boolean
  isRenamingNode: (nodeKey: TreeNode['key']) => boolean
  items: ReadonlyRef<ShopCatalogItemRecord[]>
  moveEntry: (payload: ShopCatalogDragPayload, targetCategoryId: string | null) => Promise<void>
  onMoveError: (error: unknown) => void
  shouldBlockDragStart: ReadonlyRef<boolean>
}

export function useShopCatalogDragDrop(options: UseShopCatalogDragDropOptions) {
  const dragState = reactive({
    sourceKey: null as TreeNode['key'] | null,
    overKey: null as TreeNode['key'] | 'root' | null,
    dropping: false,
  })
  const { stopTreeListAutoScroll, updateTreeListAutoScroll } = useShopCatalogTreeAutoScroll({
    getScrollContainer: options.getScrollContainer,
    getIsDragging: () => dragState.sourceKey !== null,
  })

  function clearDragState() {
    dragState.sourceKey = null
    dragState.overKey = null
    dragState.dropping = false
    stopTreeListAutoScroll()
  }

  function getDragPayloadFromNode(node: TreeNode): ShopCatalogDragPayload | null {
    return getShopCatalogDragPayloadFromNode(node, {
      isCreating: options.isCreatingNode(node.key),
      isRenaming: options.isRenamingNode(node.key),
    })
  }

  function getCurrentDragPayload(): ShopCatalogDragPayload | null {
    return getShopCatalogDragPayloadFromNodeKey(dragState.sourceKey)
  }

  function canDropPayload(payload: ShopCatalogDragPayload | null, targetCategoryId: string | null) {
    return canDropShopCatalogPayload(payload, targetCategoryId, {
      categoriesById: options.categoriesById.value,
      childCategoriesByParent: options.childCategoriesByParent.value,
      items: options.items.value,
    })
  }

  function handleTreeDragStart(event: DragEvent, node: TreeNode) {
    if (options.shouldBlockDragStart.value) {
      event.preventDefault()
      return
    }

    const payload = getDragPayloadFromNode(node)
    if (!payload) {
      event.preventDefault()
      return
    }

    options.closeContextMenu()
    dragState.sourceKey = node.key
    dragState.overKey = null

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', JSON.stringify(payload))
    }
  }

  function handleTreeDragEnd() {
    options.clearPointerType()
    clearDragState()
  }

  function handleTreeListDragOver(event: DragEvent) {
    updateTreeListAutoScroll(event.clientY)
  }

  function handleTreeListDragLeave(event: DragEvent) {
    const nextTarget = event.relatedTarget
    const scrollContainer = options.getScrollContainer()
    if (nextTarget instanceof Node && scrollContainer?.contains(nextTarget)) return
    stopTreeListAutoScroll()
  }

  function handleDragLeave(event: DragEvent, targetKey: TreeNode['key'] | 'root') {
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && event.currentTarget instanceof Element && event.currentTarget.contains(nextTarget)) {
      return
    }

    if (dragState.overKey === targetKey) {
      dragState.overKey = null
    }
  }

  function handleRootDragOver(event: DragEvent) {
    const payload = getCurrentDragPayload()
    if (!canDropPayload(payload, null)) return

    event.preventDefault()
    dragState.overKey = 'root'

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }
  }

  function handleNodeDragOver(event: DragEvent, node: TreeNode) {
    const targetCategoryId = getShopCatalogDropTargetCategoryId(node)
    const payload = getCurrentDragPayload()

    if (!canDropPayload(payload, targetCategoryId)) return

    event.preventDefault()
    dragState.overKey = getShopCatalogDropTargetKey(node)

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }
  }

  async function dropOnTarget(event: DragEvent, targetCategoryId: string | null) {
    const payload = getCurrentDragPayload()
    if (!canDropPayload(payload, targetCategoryId) || !payload || dragState.dropping) return

    event.preventDefault()
    stopTreeListAutoScroll()
    dragState.dropping = true

    try {
      await options.moveEntry(payload, targetCategoryId)
    } catch (error) {
      options.onMoveError(error)
    } finally {
      clearDragState()
    }
  }

  async function handleRootDrop(event: DragEvent) {
    await dropOnTarget(event, null)
  }

  async function handleNodeDrop(event: DragEvent, node: TreeNode) {
    await dropOnTarget(event, getShopCatalogDropTargetCategoryId(node))
  }

  return {
    canDropPayload,
    clearDragState,
    dragState,
    handleDragLeave,
    handleNodeDragOver,
    handleNodeDrop,
    handleRootDragOver,
    handleRootDrop,
    handleTreeDragEnd,
    handleTreeDragStart,
    handleTreeListDragLeave,
    handleTreeListDragOver,
    stopTreeListAutoScroll,
  }
}
