import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import ShopCatalogContextMenu, {
  type ShopCatalogContextMenuAction,
} from '@/components/shopCatalog/ShopCatalogContextMenu.vue'
import ShopCatalogTreeNodeRow from '@/components/shopCatalog/ShopCatalogTreeNodeRow.vue'
import ShopCatalogTreeRootRow from '@/components/shopCatalog/ShopCatalogTreeRootRow.vue'
import type { ShopCatalogTreeNode } from '@/features/shopCatalog/treeTypes'

function makeNode(overrides: Partial<ShopCatalogTreeNode> = {}): ShopCatalogTreeNode {
  return {
    key: 'category:cat-tools',
    kind: 'category',
    id: 'cat-tools',
    parentId: null,
    depth: 1,
    label: 'Tools',
    secondary: '2 folders / 12 items',
    active: true,
    hasChildren: true,
    ...overrides,
  }
}

describe('ShopCatalogContextMenu', () => {
  it('renders positioned actions and runs enabled callbacks only', async () => {
    const archive = vi.fn()
    const remove = vi.fn()
    const actions: ShopCatalogContextMenuAction[] = [
      { key: 'archive', label: 'Archive Folder', run: archive },
      { key: 'delete', label: 'Delete Folder', danger: true, disabled: true, run: remove },
    ]
    const wrapper = mount(ShopCatalogContextMenu, {
      props: {
        visible: true,
        x: 45,
        y: 90,
        actions,
      },
    })
    const menu = wrapper.get('.shop-catalog-context-menu')
    const buttons = wrapper.findAll('button')

    expect(menu.attributes('style')).toContain('left: 45px')
    expect(menu.attributes('style')).toContain('top: 90px')
    expect(buttons[0]!.text()).toBe('Archive Folder')
    expect(buttons[1]!.text()).toBe('Delete Folder')
    expect(buttons[1]!.classes()).toContain('shop-catalog-context-menu__item--danger')
    expect(buttons[1]!.attributes('disabled')).toBeDefined()

    await buttons[0]!.trigger('click')
    await buttons[1]!.trigger('click')

    expect(archive).toHaveBeenCalledTimes(1)
    expect(remove).not.toHaveBeenCalled()
  })

  it('does not render while hidden', () => {
    const wrapper = mount(ShopCatalogContextMenu, {
      props: {
        visible: false,
        x: 0,
        y: 0,
        actions: [],
      },
    })

    expect(wrapper.find('.shop-catalog-context-menu').exists()).toBe(false)
  })
})

describe('ShopCatalogTreeRootRow', () => {
  it('renders root state and forwards root row events', async () => {
    const wrapper = mount(ShopCatalogTreeRootRow, {
      props: {
        active: true,
        dropTarget: true,
        expanded: true,
        hasChildren: true,
        summary: '3 folders / 7 items',
      },
    })
    const row = wrapper.get('[data-testid="shop-catalog-root-row"]')

    expect(row.text()).toContain('Top Level')
    expect(row.text()).toContain('3 folders / 7 items')
    expect(row.classes()).toContain('catalog-tree-node--active')
    expect(row.classes()).toContain('catalog-tree-node--drop-target')
    expect(wrapper.get('.catalog-tree-node__twist').classes()).toContain('catalog-tree-node__twist--open')

    await row.trigger('click')
    await row.trigger('contextmenu')
    await row.trigger('pointerdown')
    await row.trigger('dragover')
    await row.trigger('drop')

    expect(wrapper.emitted('click')).toHaveLength(1)
    expect(wrapper.emitted('contextmenu')).toHaveLength(1)
    expect(wrapper.emitted('pointerdown')).toHaveLength(1)
    expect(wrapper.emitted('dragover')).toHaveLength(1)
    expect(wrapper.emitted('drop')).toHaveLength(1)
  })

  it('emits expand toggles only when the root bucket has children', async () => {
    const expandable = mount(ShopCatalogTreeRootRow, {
      props: {
        active: false,
        dropTarget: false,
        expanded: false,
        hasChildren: true,
        summary: '',
      },
    })
    const empty = mount(ShopCatalogTreeRootRow, {
      props: {
        active: false,
        dropTarget: false,
        expanded: false,
        hasChildren: false,
        summary: '',
      },
    })

    await expandable.get('.catalog-tree-node__twist').trigger('click')

    expect(expandable.emitted('toggleExpanded')).toHaveLength(1)
    expect(empty.find('.catalog-tree-node__twist--placeholder').exists()).toBe(true)
    expect(empty.find('.catalog-chevron').exists()).toBe(false)
  })
})

describe('ShopCatalogTreeNodeRow', () => {
  it('renders category node state and forwards selection, menu, drag, drop, and toggle events', async () => {
    const wrapper = mount(ShopCatalogTreeNodeRow, {
      props: {
        node: makeNode({ active: false }),
        active: true,
        dragging: true,
        dropTarget: true,
        draggable: true,
        expanded: true,
        creating: false,
        renaming: false,
        createValue: '',
        renameValue: '',
        setInputRef: vi.fn(),
      },
    })
    const row = wrapper.get('[data-testid="shop-catalog-category-cat-tools"]')

    expect(row.text()).toContain('Tools')
    expect(row.text()).toContain('2 folders / 12 items')
    expect(row.text()).toContain('Archived')
    expect(row.classes()).toContain('catalog-tree-node--active')
    expect(row.classes()).toContain('catalog-tree-node--dragging')
    expect(row.classes()).toContain('catalog-tree-node--drop-target')
    expect(row.attributes('draggable')).toBe('true')
    expect(wrapper.get('.catalog-node-icon').classes()).toContain('catalog-node-icon--folder')
    expect(wrapper.get('.catalog-tree-node__twist').classes()).toContain('catalog-tree-node__twist--open')
    expect(wrapper.get<HTMLElement>('.catalog-tree-node__indent').attributes('style')).toContain('width: 1rem')

    await row.trigger('click')
    await row.trigger('contextmenu')
    await row.trigger('dragstart')
    await row.trigger('dragover')
    await row.trigger('drop')
    await wrapper.get('.catalog-tree-node__twist').trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
    expect(wrapper.emitted('contextmenu')).toHaveLength(1)
    expect(wrapper.emitted('dragstart')).toHaveLength(1)
    expect(wrapper.emitted('dragover')).toHaveLength(1)
    expect(wrapper.emitted('drop')).toHaveLength(1)
    expect(wrapper.emitted('toggleExpanded')).toHaveLength(1)
  })

  it('renders item nodes without category-only summary/toggle controls', () => {
    const wrapper = mount(ShopCatalogTreeNodeRow, {
      props: {
        node: makeNode({
          key: 'item:item-aha',
          kind: 'item',
          id: 'item-aha',
          depth: 2,
          label: 'AHA Book',
          secondary: 'Hidden summary',
          active: true,
          hasChildren: false,
        }),
        active: false,
        dragging: false,
        dropTarget: false,
        draggable: false,
        expanded: false,
        creating: false,
        renaming: false,
        createValue: '',
        renameValue: '',
        setInputRef: vi.fn(),
      },
    })
    const row = wrapper.get('[data-testid="shop-catalog-item-item-aha"]')

    expect(row.text()).toContain('AHA Book')
    expect(row.text()).not.toContain('Hidden summary')
    expect(row.attributes('draggable')).toBe('false')
    expect(wrapper.get('.catalog-node-icon').classes()).toContain('catalog-node-icon--item')
    expect(wrapper.find('.catalog-chevron').exists()).toBe(false)
  })

  it('forwards inline create and rename input events', async () => {
    const creatingWrapper = mount(ShopCatalogTreeNodeRow, {
      props: {
        node: makeNode({ draft: true }),
        active: false,
        dragging: false,
        dropTarget: false,
        draggable: false,
        expanded: false,
        creating: true,
        renaming: false,
        createValue: 'New Folder',
        renameValue: '',
        setInputRef: vi.fn(),
      },
    })
    const renamingWrapper = mount(ShopCatalogTreeNodeRow, {
      props: {
        node: makeNode(),
        active: false,
        dragging: false,
        dropTarget: false,
        draggable: false,
        expanded: false,
        creating: false,
        renaming: true,
        createValue: '',
        renameValue: 'Renamed Folder',
        setInputRef: vi.fn(),
      },
    })

    await creatingWrapper.get('input.app-inline-input').setValue('Adhesive')
    await creatingWrapper.get('input.app-inline-input').trigger('keydown.enter')
    await creatingWrapper.get('input.app-inline-input').trigger('keydown.esc')
    await renamingWrapper.get('input.app-inline-input').setValue('Hardware')
    await renamingWrapper.get('input.app-inline-input').trigger('blur')
    await renamingWrapper.get('input.app-inline-input').trigger('keydown.esc')

    expect(creatingWrapper.emitted('updateCreateValue')).toEqual([['Adhesive']])
    expect(creatingWrapper.emitted('saveInlineCreate')).toHaveLength(1)
    expect(creatingWrapper.emitted('cancelInlineCreate')).toHaveLength(1)
    expect(renamingWrapper.emitted('updateRenameValue')).toEqual([['Hardware']])
    expect(renamingWrapper.emitted('saveInlineRename')).toHaveLength(1)
    expect(renamingWrapper.emitted('cancelRename')).toHaveLength(1)
  })
})
