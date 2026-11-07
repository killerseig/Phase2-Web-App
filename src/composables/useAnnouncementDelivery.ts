import { onBeforeUnmount, ref, watch } from 'vue'
import { sharedDashboardCommand, type DashboardContext } from '@/services/sharedDashboards'
import { dashboardError } from '@/services/dashboard'
import type { PublishedAnnouncement } from '@/features/dashboard/sharedDashboards'

/** Per-app lifetime only. Dismissal is not an acknowledgment or persisted read receipt. */
export function useAnnouncementDelivery(
  context: () => { identity: string; enabled: boolean; jobId: string },
) {
  const items = ref<PublishedAnnouncement[]>([]),
    error = ref(''),
    loading = ref(false)
  let generation = 0,
    entered = false,
    identity = '',
    target: DashboardContext = { scope: 'personal' }
  function dismiss() {
    generation++
    items.value = []
    error.value = ''
    loading.value = false
  }
  async function load() {
    if (!context().enabled) return
    const request = ++generation
    items.value = []
    error.value = ''
    loading.value = true
    try {
      const result = await sharedDashboardCommand('list-announcements', target)
      if (request === generation) items.value = result.items || []
    } catch (reason) {
      if (request === generation) error.value = dashboardError(reason)
    } finally {
      if (request === generation) loading.value = false
    }
  }
  watch(
    () => JSON.stringify(context()),
    () => {
      const next = context()
      dismiss()
      if (!next.enabled) {
        entered = false
        identity = ''
        return
      }
      const firstEntry = !entered || identity !== next.identity
      entered = true
      identity = next.identity
      // A direct login into a job coalesces into one personal feed, including all
      // of this viewer's assignments. Subsequent job entries use that job's feed.
      target =
        !firstEntry && next.jobId ? { scope: 'job', jobId: next.jobId } : { scope: 'personal' }
      if (firstEntry || next.jobId) void load()
    },
    { immediate: true },
  )
  onBeforeUnmount(dismiss)
  return { items, error, loading, retry: load, dismiss }
}
