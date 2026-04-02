import { useAdminCatalogCategoryLifecycle } from '@/views/admin/useAdminCatalogCategoryLifecycle'
import { useAdminCatalogDeleteActions } from '@/views/admin/useAdminCatalogDeleteActions'
import { useAdminCatalogItemLifecycle } from '@/views/admin/useAdminCatalogItemLifecycle'
import type {
  AdminCatalogMutationState,
  UseAdminCatalogMutationsOptions,
} from '@/views/admin/adminCatalogMutationTypes'

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
