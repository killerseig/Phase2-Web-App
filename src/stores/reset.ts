import { useAppStore } from '@/stores/app'
import { useConfirmStore } from '@/stores/confirm'
import { useEmployeesStore } from '@/stores/employees'
import { useJobRosterStore } from '@/stores/jobRoster'
import { useJobsStore } from '@/stores/jobs'
import { useShopCatalogStore } from '@/stores/shopCatalog'
import { useShopCategoriesStore } from '@/stores/shopCategories'
import { useUsersStore } from '@/stores/users'

/**
 * Clears non-auth store state and active subscriptions on sign-out.
 */
export function resetNonAuthStores(): void {
  useAppStore().$reset()
  useConfirmStore().$reset()
  useUsersStore().$reset()
  useJobsStore().$reset()
  useEmployeesStore().$reset()
  useJobRosterStore().$reset()
  useShopCatalogStore().$reset()
  useShopCategoriesStore().$reset()
}
