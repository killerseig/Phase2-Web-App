import { getCatalogItemIdFromNodeId } from '@/utils/catalogNode'
import { runAdminCatalogMutation } from '@/views/admin/adminCatalogMutationRunner'
import type {
  AdminCatalogMutationState,
  UseAdminCatalogMutationsOptions,
} from '@/views/admin/adminCatalogMutationTypes'

function createCategoryReactivationRunner(options: UseAdminCatalogMutationsOptions) {
  const MAX_DEPTH = 100

  return async function reactivateCategoryTree(categoryId: string) {
    const visited = new Set<string>()

    const reactivateRecursive = async (currentId: string, depth = 0): Promise<void> => {
      if (depth > MAX_DEPTH || visited.has(currentId)) return
      visited.add(currentId)

      const current = options.categoriesStore.getCategoryById(currentId)
      if (!current) return

      await options.categoriesStore.reactivateCategory(currentId)

      if (!current.parentId) return

      const itemId = getCatalogItemIdFromNodeId(current.parentId)
      if (itemId) {
        const item = options.allItems.value.find((entry) => entry.id === itemId)
        if (item && !item.active) {
          await options.catalogStore.setItemActive(itemId, true)
        }
        return
      }

      const parentCategory = options.categoriesStore.getCategoryById(current.parentId)
      if (parentCategory && !parentCategory.active) {
        await reactivateRecursive(current.parentId, depth + 1)
      }
    }

    await reactivateRecursive(categoryId)
  }
}

export function useAdminCatalogCategoryLifecycle(
  options: UseAdminCatalogMutationsOptions,
  state: AdminCatalogMutationState,
) {
  const reactivateCategoryTree = createCategoryReactivationRunner(options)

  async function archiveCategory(categoryId: string) {
    const category = options.categoriesStore.getCategoryById(categoryId)
    if (!category) return

    await runAdminCatalogMutation(
      () => options.categoriesStore.archiveCategory(categoryId),
      {
        pending: state.saving,
        toast: options.toast,
        successMessage: `Archived "${category.name}"`,
        errorMessage: 'Failed to archive category',
      },
    )
  }

  async function reactivateCategory(categoryId: string) {
    const category = options.categoriesStore.getCategoryById(categoryId)
    if (!category) return

    await runAdminCatalogMutation(
      () => reactivateCategoryTree(categoryId),
      {
        pending: state.saving,
        toast: options.toast,
        successMessage: `Reactivated "${category.name}"`,
        errorMessage: 'Failed to reactivate category',
        logContext: {
          scope: 'AdminShopCatalog',
          message: 'Error reactivating category',
        },
      },
    )
  }

  return {
    archiveCategory,
    reactivateCategory,
  }
}
