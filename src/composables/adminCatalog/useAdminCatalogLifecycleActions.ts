import { useAdminCatalogCategoryLifecycle } from './useAdminCatalogCategoryLifecycle'
import { useAdminCatalogDeleteActions } from './useAdminCatalogDeleteActions'
import { useAdminCatalogItemLifecycle } from './useAdminCatalogItemLifecycle'
import type {
  AdminCatalogMutationState,
  UseAdminCatalogMutationsOptions,
} from './adminCatalogMutationTypes'

export function useAdminCatalogLifecycleActions(
  options: UseAdminCatalogMutationsOptions,
  state: AdminCatalogMutationState,
) {
  return {
    ...useAdminCatalogCategoryLifecycle(options, state),
    ...useAdminCatalogDeleteActions(options, state),
    ...useAdminCatalogItemLifecycle(options, state),
  }
}
