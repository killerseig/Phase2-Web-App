import { describe, expect, it } from 'vitest'
import { planShopCatalogMigration } from '../functions/scripts/shop-catalog-migration-lib.mjs'

describe('shop catalog migration planner', () => {
  it('converts container items into categories and leaf categories beneath them into items', () => {
    const plan = planShopCatalogMigration(
      [
        { id: 'cat-under-parent', name: 'Under Parent', parentId: 'parent-item', active: true },
      ],
      [
        {
          id: 'parent-item',
          description: 'Parent Item',
          categoryId: null,
          sku: 'DROP-ME',
          price: 42,
          active: true,
        },
      ]
    )

    expect(plan.summary.finalCategories).toBe(1)
    expect(plan.summary.finalItems).toBe(1)
    expect(plan.createCategoriesFromItems).toEqual([
      {
        sourceItemId: 'parent-item',
        id: 'parent-item',
        data: {
          name: 'Parent Item',
          parentId: null,
          active: true,
          createdAt: null,
          updatedAt: null,
        },
      },
    ])
    expect(plan.createItemsFromCategories).toEqual([
      {
        sourceCategoryId: 'cat-under-parent',
        id: 'cat-under-parent',
        data: {
          description: 'Under Parent',
          categoryId: 'parent-item',
          sku: null,
          price: null,
          active: true,
          createdAt: null,
          updatedAt: null,
        },
      },
    ])
    expect(plan.deleteItemIds).toEqual(['parent-item'])
    expect(plan.deleteCategoryIds).toEqual(['cat-under-parent'])
  })

  it('converts leaf categories into items even without purchasing fields', () => {
    const plan = planShopCatalogMigration(
      [
        { id: 'cat-root', name: 'Root', parentId: null, active: true },
        { id: 'cat-leaf', name: 'Leaf Category', parentId: 'cat-root', active: true },
      ],
      []
    )

    expect(plan.createItemsFromCategories).toEqual([
      {
        sourceCategoryId: 'cat-leaf',
        id: 'cat-leaf',
        data: {
          description: 'Leaf Category',
          categoryId: 'cat-root',
          sku: null,
          price: null,
          active: true,
          createdAt: null,
          updatedAt: null,
        },
      },
    ])
    expect(plan.deleteCategoryIds).toEqual(['cat-leaf'])
    expect(plan.summary.finalCategories).toBe(1)
    expect(plan.summary.finalItems).toBe(1)
  })

  it('keeps leaf items as items and normalizes legacy parent references to converted categories', () => {
    const plan = planShopCatalogMigration(
      [],
      [
        {
          id: 'container-item',
          description: 'Container',
          categoryId: null,
          active: true,
        },
        {
          id: 'leaf-item',
          description: 'Leaf',
          categoryId: 'item-container-item',
          sku: 'LF-1',
          price: 10,
          active: true,
        },
      ]
    )

    expect(plan.createCategoriesFromItems).toEqual([
      {
        sourceItemId: 'container-item',
        id: 'container-item',
        data: {
          name: 'Container',
          parentId: null,
          active: true,
          createdAt: null,
          updatedAt: null,
        },
      },
    ])
    expect(plan.updateItems).toEqual([
      {
        id: 'leaf-item',
        updates: {
          categoryId: 'container-item',
        },
      },
    ])
    expect(plan.summary.finalCategories).toBe(1)
    expect(plan.summary.finalItems).toBe(1)
  })
})
