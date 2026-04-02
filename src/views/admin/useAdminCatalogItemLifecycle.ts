import type { ShopCatalogItem } from '@/services'
import { isCatalogParentItemId } from '@/utils/catalogNode'
import { runAdminCatalogMutation } from '@/views/admin/adminCatalogMutationRunner'
import type {
  AdminCatalogMutationState,
  UseAdminCatalogMutationsOptions,
} from '@/views/admin/adminCatalogMutationTypes'

export function useAdminCatalogItemLifecycle(
  options: UseAdminCatalogMutationsOptions,
  state: AdminCatalogMutationState,
) {
  async function archiveItem(item: ShopCatalogItem) {
    const childCategories = options.categories.value.filter((category) =>
      isCatalogParentItemId(category.parentId, item.id),
    )

    await runAdminCatalogMutation(
      async () => {
        await Promise.all([
          options.catalogStore.setItemActive(item.id, false),
          ...childCategories.map((category) => options.categoriesStore.archiveCategory(category.id)),
        ])
      },
      {
        pending: state.saving,
        toast: options.toast,
        successMessage: `Archived "${item.description}" and ${childCategories.length} subcategories`,
        errorMessage: 'Failed to archive item',
      },
    )
  }

  async function reactivateItem(item: ShopCatalogItem) {
    await runAdminCatalogMutation(
      () => options.catalogStore.setItemActive(item.id, true),
      {
        pending: state.saving,
        toast: options.toast,
        successMessage: `Reactivated "${item.description}"`,
        errorMessage: 'Failed to reactivate item',
      },
    )
  }

  return {
    archiveItem,
    reactivateItem,
  }
}
