export interface ShopCatalogTreeNode {
  key: `category:${string}` | `item:${string}` | `draft-category:${string}` | `draft-item:${string}`
  kind: 'category' | 'item'
  id: string
  parentId: string | null
  depth: number
  label: string
  secondary: string
  active: boolean
  hasChildren: boolean
  draft?: boolean
}
