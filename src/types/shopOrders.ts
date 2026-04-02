export type CatalogOrderSelection = {
  id: string
  description: string
  sku?: string
  price?: string | number
  quantity: number
}

export type CatalogItemQuantityUpdate = {
  id: string
  qty: number
}
