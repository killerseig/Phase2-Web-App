import {
  nextTick,
  reactive,
  ref,
} from 'vue'
import type { ShopCatalogTreeNode as TreeNode } from '@/features/shopCatalog/treeTypes'
import { useAdminRequestScope, type AdminRequestContext } from '@/features/admin/useAdminRequestContext'

type InlineCreateKind = 'category' | 'item'

export function useShopCatalogInlineEditing(context?: AdminRequestContext) {
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
  const scope = useAdminRequestScope(context, () => `${createState.key}\0${renameState.key}`)

  function setInlineInputRef(element: HTMLInputElement | null) {
    inlineInputRef.value = element
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
    const request = scope.capture()
    await nextTick()
    if (!request.current()) return
    const input = inlineInputRef.value
    requestAnimationFrame(() => {
      if (!request.current() || !input?.isConnected || inlineInputRef.value !== input) return
      input.focus()
      if (options.select) {
        input.select()
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
