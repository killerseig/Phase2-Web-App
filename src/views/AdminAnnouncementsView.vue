<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, RouterLink } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'
import AppButton from '@/components/common/AppButton.vue'
import BuilderConfirmDialog from '@/components/builder/BuilderConfirmDialog.vue'
import DashboardAnnouncementDrafts from '@/components/dashboard/DashboardAnnouncementDrafts.vue'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import { sharedDashboardCommand } from '@/services/sharedDashboards'
import { dashboardError } from '@/services/dashboard'
import type { AnnouncementDraft } from '@/features/dashboard/sharedDashboards'
import '@/styles/builder-ui.css'

const auth = useAuthStore(),
  jobs = useJobsStore()
const allowed = computed(() => auth.hasWorkspaceAccess && auth.rawRole === 'admin')
const editor = ref<InstanceType<typeof DashboardAnnouncementDrafts>>()
const confirm = ref<InstanceType<typeof BuilderConfirmDialog>>()
const drafts = ref<AnnouncementDraft[]>([]),
  published = ref<string[]>([])
const version = ref(0),
  ready = ref(false),
  busy = ref(false),
  error = ref(''),
  message = ref('')
let generation = 0
async function load() {
  if (!allowed.value) return
  const request = ++generation
  busy.value = true
  error.value = ''
  message.value = ''
  try {
    const result = await sharedDashboardCommand('load-announcement-drafts', { scope: 'personal' })
    if (request !== generation) return
    drafts.value = result.announcementDrafts
    published.value = result.publishedDraftIds
    version.value = result.version
    ready.value = true
  } catch (reason) {
    if (request === generation) error.value = dashboardError(reason)
  } finally {
    if (request === generation) busy.value = false
  }
}
async function prepare() {
  if (busy.value) return false
  if (!editor.value?.dirty) return true
  if (
    !(await confirm.value?.ask({
      title: 'Discard unsaved announcement edits?',
      message: 'Your saved drafts will remain available.',
      confirmLabel: 'Discard edits',
      destructive: true,
    }))
  )
    return false
  editor.value?.discard()
  return true
}
async function reload() {
  if (await prepare()) await load()
}
async function save(items: AnnouncementDraft[]) {
  if (!allowed.value || !ready.value || busy.value) return
  const request = generation
  busy.value = true
  error.value = ''
  message.value = ''
  try {
    const result = await sharedDashboardCommand('save-announcement-drafts', {
      scope: 'personal',
      version: version.value,
      announcementDrafts: items,
    })
    if (request !== generation) return
    drafts.value = result.announcementDrafts || []
    version.value = result.version
    editor.value?.discard()
    message.value = 'Your announcement drafts are saved.'
  } catch (reason) {
    if (request === generation) error.value = dashboardError(reason)
  } finally {
    if (request === generation) busy.value = false
  }
}
async function publish(draftId: string) {
  if (!allowed.value || busy.value) return
  const request = generation,
    draft = drafts.value.find((item) => item.id === draftId)
  if (!draft?.audience) return
  const audience =
    draft.audience === 'everyone'
      ? 'everyone with announcement access'
      : draft.audience === 'people'
        ? `${draft.recipientIds?.length || 0} selected people`
        : 'people currently assigned to ' +
          (jobs.jobs.find((job) => job.id === draft.jobId)?.name || 'the selected job')
  if (
    !(await confirm.value?.ask({
      title: 'Publish announcement?',
      message: `Publish “${draft.title}” to ${audience}? Recipients will see this snapshot when they enter the app or a job.`,
      confirmLabel: 'Publish',
    })) ||
    request !== generation ||
    !allowed.value ||
    busy.value
  )
    return
  busy.value = true
  error.value = ''
  message.value = ''
  try {
    await sharedDashboardCommand('publish-announcement', {
      scope: 'personal',
      version: version.value,
      draftId,
    })
    if (request !== generation) return
    published.value = [...new Set([...published.value, draftId])]
    message.value = 'Announcement published.'
  } catch (reason) {
    if (request === generation) error.value = dashboardError(reason)
  } finally {
    if (request === generation) busy.value = false
  }
}
watch(
  () => [auth.currentUser?.uid, allowed.value],
  () => {
    generation++
    drafts.value = []
    published.value = []
    ready.value = false
    busy.value = false
    error.value = ''
    message.value = ''
    editor.value?.discard()
    if (allowed.value) void load()
  },
  { immediate: true },
)
function beforeUnload(event: BeforeUnloadEvent) {
  if (editor.value?.dirty || busy.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onBeforeRouteLeave(prepare)
onMounted(() => {
  if (allowed.value) void jobs.subscribeVisibleJobs()
  window.addEventListener('beforeunload', beforeUnload)
})
onBeforeUnmount(() => {
  generation++
  jobs.stopJobsSubscription()
  window.removeEventListener('beforeunload', beforeUnload)
})
</script>

<template>
  <AppShell :before-sign-out="prepare">
    <section class="admin-announcements" aria-labelledby="announcements-heading">
      <header>
        <div>
          <h1 id="announcements-heading">Announcements</h1>
          <p>Create an update for everyone, a job or specific people.</p>
        </div>
        <AppButton :disabled="busy" @click="reload">Reload drafts</AppButton>
      </header>
      <p v-if="!allowed" role="alert">Only Admin can manage announcements.</p>
      <template v-else>
        <p v-if="busy" role="status">Working…</p>
        <p v-if="error" role="alert">{{ error }}</p>
        <p v-if="message" role="status">{{ message }}</p>
        <p v-if="jobs.loading" role="status">Loading jobs…</p>
        <p v-if="jobs.error" role="alert">
          {{ jobs.error }} <AppButton @click="jobs.subscribeVisibleJobs()">Retry jobs</AppButton>
        </p>
        <section
          v-if="ready"
          class="admin-announcements__drafts"
          aria-label="Your announcement drafts"
        >
          <h2>Your drafts</h2>
          <DashboardAnnouncementDrafts
            ref="editor"
            :items="drafts"
            :busy="busy"
            :layout-editing="false"
            :jobs="jobs.jobs"
            :published-draft-ids="published"
            @save="save"
            @publish="publish"
          />
        </section>
        <RouterLink to="/dashboards/announcements">View updates available to you</RouterLink>
      </template>
    </section>
    <BuilderConfirmDialog ref="confirm" />
  </AppShell>
</template>

<style scoped>
.admin-announcements {
  width: min(100%, 64rem);
  margin-inline: auto;
  padding: clamp(1rem, 3vw, 2rem);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}
h1,
h2 {
  margin: 0 0 0.5rem;
}
header p {
  margin: 0;
  color: var(--text-muted);
}
.admin-announcements__drafts {
  padding: clamp(1rem, 3vw, 1.5rem);
  background: var(--panel-background);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  margin-bottom: 1.5rem;
}
</style>
