import { computed, onMounted, onUnmounted, ref, watch, type ComputedRef } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import { useShopCatalogStore } from '@/stores/shopCatalog'
import { useShopCategoriesStore } from '@/stores/shopCategories'
import { subscribeEmailSettings, subscribeShopOrders, type ShopOrder, type ShopOrderStatus } from '@/services'
import { useJobAccess } from '@/composables/useJobAccess'
import { useSubscriptionRegistry } from '@/composables/useSubscriptionRegistry'
import { useToast } from '@/composables/useToast'
import { ROUTE_NAMES } from '@/constants/app'
import { normalizeError } from '@/services/serviceUtils'
import { formatDateTime, toMillis } from '@/utils/datetime'
import { logError, logWarn } from '@/utils/logger'

export function useShopOrdersData(jobId: ComputedRef<string>) {
  const router = useRouter()
  const auth = useAuthStore()
  const jobs = useJobsStore()
  const shopCatalogStore = useShopCatalogStore()
  const shopCategoriesStore = useShopCategoriesStore()
  const { items: catalog } = storeToRefs(shopCatalogStore)
  const { categories: shopCategories } = storeToRefs(shopCategoriesStore)
  const jobAccess = useJobAccess()
  const subscriptions = useSubscriptionRegistry()
  const toast = useToast()

  const loading = ref(true)
  const err = ref('')
  const orders = ref<ShopOrder[]>([])
  const selectedId = ref<string | null>(null)
  const search = ref('')
  const statusFilter = ref<'all' | ShopOrderStatus>('all')
  const shopOrderRecipients = ref<string[]>([])

  const job = computed(() => jobs.currentJob)
  const jobName = computed(() => job.value?.name ?? 'Shop Orders')
  const jobCode = computed(() => job.value?.code ?? '')
  const selected = computed(() => orders.value.find((order) => order.id === selectedId.value) ?? null)
  const filtered = computed(() => {
    const searchValue = search.value.trim().toLowerCase()
    return orders.value.filter((order) => {
      if (statusFilter.value !== 'all' && order.status !== statusFilter.value) return false
      if (!searchValue) return true

      const haystack = [
        order.id,
        order.status,
        ...(order.items ?? []).map((item) => item.description),
      ].join(' ').toLowerCase()
      return haystack.includes(searchValue)
    })
  })
  const fmtDate = (ts: unknown) => formatDateTime(ts)

  const pickFirstIfNeeded = () => {
    if (selectedId.value || orders.value.length === 0) return
    selectedId.value = orders.value[0]?.id ?? null
  }

  const replaceOrders = (snapshotOrders: ShopOrder[]) => {
    orders.value = snapshotOrders
      .map((order) => ({
        ...order,
        items: Array.isArray(order.items) ? [...order.items] : [],
      }))
      .sort((a, b) => toMillis(b.orderDate) - toMillis(a.orderDate))

    if (selectedId.value && !orders.value.some((order) => order.id === selectedId.value)) {
      selectedId.value = null
    }

    pickFirstIfNeeded()
  }

  const loadOrders = () => {
    subscriptions.clear('shop-orders')
    loading.value = true

    try {
      subscriptions.replace('shop-orders', subscribeShopOrders(jobId.value, {
        onUpdate(snapshotOrders) {
          replaceOrders(snapshotOrders)
          loading.value = false
        },
        onError(error) {
          err.value = error.message ?? 'Failed to load orders'
          toast.show(`Failed to load orders: ${error.message ?? 'Unknown error'}`, 'error')
          loading.value = false
        },
      }))
    } catch (error) {
      const message = normalizeError(error, 'Failed to load orders')
      err.value = message
      toast.show(`Failed to load orders: ${message}`, 'error')
      loading.value = false
    }
  }

  const init = async () => {
    if (!jobId.value) return

    loading.value = true
    err.value = ''

    try {
      if (!auth.ready) await auth.init()

      if (!jobAccess.canAccessJob(jobId.value)) {
        await router.push({ name: ROUTE_NAMES.UNAUTHORIZED })
        loading.value = false
        return
      }

      jobs.subscribeJob(jobId.value)
      subscriptions.replace('email-settings', subscribeEmailSettings(
        (settings) => {
          shopOrderRecipients.value = settings.shopOrderSubmitRecipients ?? []
        },
        (settingsError) => {
          logWarn('ShopOrders', 'Failed to subscribe to email settings, using defaults', settingsError)
          shopOrderRecipients.value = []
        }
      ))

      shopCatalogStore.subscribeCatalog()
      shopCategoriesStore.subscribeAllCategories()
      loadOrders()
    } catch (error) {
      logError('ShopOrders', 'Init error', error)
      err.value = normalizeError(error, 'Failed to initialize')
      loading.value = false
    }
  }

  const cleanup = () => {
    subscriptions.clearAll()
    jobs.stopCurrentJobSubscription()
    shopCatalogStore.stopCatalogSubscription()
    shopCategoriesStore.stopCategoriesSubscription()
  }

  onMounted(() => {
    void init()
  })

  watch(jobId, (nextJobId, previousJobId) => {
    if (!nextJobId || nextJobId === previousJobId) return
    void init()
  })

  onUnmounted(() => {
    cleanup()
  })

  return {
    catalog,
    shopCategories,
    jobName,
    jobCode,
    loading,
    err,
    orders,
    selectedId,
    selected,
    search,
    statusFilter,
    filtered,
    shopOrderRecipients,
    fmtDate,
    setSelectedId(orderId: string | null) {
      selectedId.value = orderId
    },
    clearError() {
      err.value = ''
    },
  }
}
