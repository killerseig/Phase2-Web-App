<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import { sharedDashboardCommand } from '@/services/sharedDashboards'
import { dashboardError } from '@/services/dashboard'
import { useAuthStore } from '@/stores/auth'
import type { JobRecord } from '@/types/domain'
import type { PublishedAnnouncement, SharedDashboardScope } from '@/features/dashboard/sharedDashboards'
const props = defineProps<{ scope: SharedDashboardScope; jobId?: string; jobs?: JobRecord[]; layoutEditing: boolean }>()
const auth = useAuthStore()
const items = ref<PublishedAnnouncement[]>([])
const loading = ref(false), error = ref('')
let generation = 0
async function load() {
  const request = ++generation
  items.value = []
  error.value = ''
  loading.value = true
  try {
    const result = await sharedDashboardCommand('list-announcements', {
      scope: props.scope, ...(props.scope === 'job' ? { jobId: props.jobId } : {}),
    })
    if (request === generation) items.value = result.items
  } catch (reason) {
    if (request === generation) error.value = dashboardError(reason)
  } finally { if (request === generation) loading.value = false }
}
watch(() => [props.scope, props.jobId, props.layoutEditing, auth.currentUser?.uid, auth.rawRole, auth.hasWorkspaceAccess, JSON.stringify(auth.assignedJobIds)], () => {
  if (!auth.hasWorkspaceAccess) { generation++; items.value = []; loading.value = false; error.value = 'You do not have access to announcements.' }
  else if (!props.layoutEditing) void load()
  else { generation++; items.value = []; loading.value = false }
}, { immediate: true })
onBeforeUnmount(() => { generation++ })
</script>
<template>
  <div class="dashboard-announcements">
    <p v-if="layoutEditing">Published updates are filtered for the signed-in viewer.</p>
    <template v-else>
      <p v-if="loading" role="status">Loading announcements.</p>
      <p v-else-if="error" role="alert">{{ error }}</p>
      <p v-else-if="!items.length">No announcements for you.</p>
      <div v-else class="announcement-feed" tabindex="0" aria-label="Published announcements">
        <article v-for="item in items" :key="item.id">
          <h3>{{ item.title }}</h3>
          <small>{{ item.audience === 'everyone' ? 'Everyone' : item.audience === 'people' ? 'Specific people' : jobs?.find(job => job.id === item.jobId)?.name || 'Assigned job' }} · {{ new Date(item.publishedAt).toLocaleString() }}</small>
          <p>{{ item.body }}</p>
        </article>
      </div>
      <p v-if="items.length === 50">Showing the latest 50 announcements.</p>
      <AppButton type="button" :disabled="loading" @click="load">Refresh announcements</AppButton>
    </template>
  </div>
</template>
<style scoped>
.announcement-feed { max-height: 32rem; overflow-y: auto; overflow-wrap: anywhere; }
.announcement-feed article + article { border-top: 1px solid var(--border); margin-top: 1rem; padding-top: 1rem; }
.announcement-feed p { white-space: pre-wrap; }
.announcement-feed small { color: var(--text-muted); }
</style>
