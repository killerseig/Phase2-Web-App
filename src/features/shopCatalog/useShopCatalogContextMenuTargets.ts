import type { ShopCatalogTreeNode as TreeNode } from '@/features/shopCatalog/treeTypes'
import type { ShopCatalogContextMenuTarget } from '@/features/shopCatalog/useShopCatalogContextMenu'

interface UseShopCatalogContextMenuTargetsOptions {
  beginLongPress: (event: PointerEvent, target: ShopCatalogContextMenuTarget) => void
  openContextMenu: (event: MouseEvent, target: ShopCatalogContextMenuTarget) => void
}

function getNodeContextTarget(node: TreeNode): ShopCatalogContextMenuTarget | null {
  if (node.draft) return null

  if (node.kind === 'category') {
    return { kind: 'category', id: node.id }
  }

  return { kind: 'item', id: node.id }
}

export function useShopCatalogContextMenuTargets({
  beginLongPress,
  openContextMenu,
}: UseShopCatalogContextMenuTargetsOptions) {
  function openRootContextMenu(event: MouseEvent) {
    openContextMenu(event, { kind: 'root' })
  }

  function openNodeContextMenu(event: MouseEvent, node: TreeNode) {
    const target = getNodeContextTarget(node)

    if (!target) {
      event.preventDefault()
      return
    }

    openContextMenu(event, target)
  }

  function beginRootLongPress(event: PointerEvent) {
    beginLongPress(event, { kind: 'root' })
  }

  function beginNodeLongPress(event: PointerEvent, node: TreeNode) {
    const target = getNodeContextTarget(node)
    if (!target) return

    beginLongPress(event, target)
  }

  return {
    beginNodeLongPress,
    beginRootLongPress,
    openNodeContextMenu,
    openRootContextMenu,
  }
}
