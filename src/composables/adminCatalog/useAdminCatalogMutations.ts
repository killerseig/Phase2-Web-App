import { ref } from 'vue'
import { useAdminCatalogEditing } from './useAdminCatalogEditing'
import { useAdminCatalogLifecycleActions } from './useAdminCatalogLifecycleActions'
import type { AdminCatalogMutationState, UseAdminCatalogMutationsOptions } from './adminCatalogMutationTypes'

export type { ConfirmFn, UseAdminCatalogMutationsOptions } from './adminCatalogMutationTypes'

export function useAdminCatalogMutations(options: UseAdminCatalogMutationsOptions) {
  const state: AdminCatalogMutationState = {
    saving: ref(false),
    editingItemId: ref<string | null>(null),
    editingCategoryId: ref<string | null>(null),
    editCategoryName: ref(''),
    editCategoryNameOriginal: ref(''),
    savingCategoryEdit: ref(false),
    inlineDraftItem: ref(null),
  }

  const editingActions = useAdminCatalogEditing(options, state)
  const lifecycleActions = useAdminCatalogLifecycleActions(options, state)

  return {
    saving: state.saving,
    editingItemId: state.editingItemId,
    editingCategoryId: state.editingCategoryId,
    editCategoryName: state.editCategoryName,
    savingCategoryEdit: state.savingCategoryEdit,
    inlineDraftItem: state.inlineDraftItem,
    ...editingActions,
    ...lifecycleActions,
  }
}
