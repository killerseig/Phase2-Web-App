import {
  nextTick,
  reactive,
  ref,
  type ComponentPublicInstance,
} from 'vue'
import type { ShopCatalogTreeNode as TreeNode } from '@/features/shopCatalog/treeTypes'

type InlineCreateKind = 'category' | 'item'

export function useShopCatalogInlineEditing() {
  const inlineInputRef = ref<HTMLInputElement | null>(null)
  const renameState = reactive({
    key: null as TreeNode['key'] | null,
    value: '',
    saving: false,
  })
  const createState = reactive({
    key: null as TreeNode['key'] | null,
    kind: null as InlineCreateKind | null,
    parentId: null as string | null,
    value: '',
    saving: false,
  })

  function setInlineInputRef(element: Element | ComponentPublicInstance | null) {
    inlineInputRef.value = element instanceof HTMLInputElement ? element : null
  }

  function isRenamingNode(nodeKey: TreeNode['key']) {
    return renameState.key === nodeKey
  }

  function isCreatingNode(nodeKey: TreeNode['key']) {
    return createState.key === nodeKey
  }

  function cancelRename() {
    renameState.key = null
    renameState.value = ''
    renameState.saving = false
  }

  function cancelInlineCreate() {
    createState.key = null
    createState.kind = null
    createState.parentId = null
    createState.value = ''
    createState.saving = false
  }

  function startInlineCreate(kind: InlineCreateKind, parentId: string | null) {
    cancelRename()
    cancelInlineCreate()
    createState.kind = kind
    createState.parentId = parentId
    createState.key = `draft-${kind}:${Date.now()}`
    createState.value = ''
  }

  function startInlineRename(key: TreeNode['key'], value: string) {
    cancelInlineCreate()
    renameState.key = key
    renameState.value = value
  }

  async function focusInlineInput(options: { select?: boolean } = {}) {
    await nextTick()
    requestAnimationFrame(() => {
      inlineInputRef.value?.focus()
      if (options.select) {
        inlineInputRef.value?.select()
      }
    })
  }

  return {
    cancelInlineCreate,
    cancelRename,
    createState,
    focusInlineInput,
    isCreatingNode,
    isRenamingNode,
    renameState,
    setInlineInputRef,
    startInlineCreate,
    startInlineRename,
  }
}
