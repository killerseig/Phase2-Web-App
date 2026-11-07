<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import { isWorkspaceServerEnabled } from '@/services/workspaceServer'
import { useAnnouncementDelivery } from '@/composables/useAnnouncementDelivery'
import AnnouncementList from './AnnouncementList.vue'
import AppButton from '@/components/common/AppButton.vue'

const auth = useAuthStore(),
  route = useRoute(),
  jobs = useJobsStore()
const id = useId(),
  dialog = ref<HTMLDialogElement>(),
  title = ref<HTMLElement>()
const context = computed(() => ({
  identity: JSON.stringify([auth.currentUser?.uid, auth.rawRole, auth.assignedJobIds]),
  enabled:
    !!route.name &&
    route.meta.requiresAuth !== false &&
    auth.hasWorkspaceAccess &&
    isWorkspaceServerEnabled(),
  jobId:
    auth.rawRole !== 'employee' && typeof route.params.jobId === 'string' ? route.params.jobId : '',
}))
const { items, error, loading, retry, dismiss } = useAnnouncementDelivery(() => context.value)
let opener: HTMLElement | null = null,
  generation = 0
function close() {
  dialog.value?.close()
  if (opener?.isConnected) opener.focus({ preventScroll: true })
  opener = null
}
function keepFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  const controls = dialog.value?.querySelectorAll<HTMLElement>(
    'button:not(:disabled), [tabindex="0"]',
  )
  const first = controls?.[0],
    last = controls?.[controls.length - 1]
  if (
    event.shiftKey &&
    (document.activeElement === first || document.activeElement === title.value)
  ) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}
watch(items, async (next) => {
  const request = ++generation
  if (!next.length) {
    close()
    return
  }
  await nextTick()
  if (request !== generation || !dialog.value?.isConnected) return
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  dialog.value.showModal()
  title.value?.focus({ preventScroll: true })
})
onBeforeUnmount(() => {
  generation++
  close()
})
</script>
<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="announcement-delivery"
      :aria-labelledby="`${id}-title`"
      @cancel.prevent="dismiss"
      @close="!dialog?.open && items.length && dismiss()"
      @keydown.stop="keepFocus"
    >
      <template v-if="items.length">
        <header>
          <h2 :id="`${id}-title`" ref="title" tabindex="-1">Announcements for you</h2>
          <AppButton aria-label="Close announcements" @click="dismiss"
            ><span aria-hidden="true">×</span></AppButton
          >
        </header>
        <div class="announcement-delivery__body" tabindex="0" aria-label="Announcement messages">
          <AnnouncementList :items="items" :jobs="auth.rawRole === 'employee' ? [] : jobs.jobs" />
          <p v-if="items.length === 50">Showing the latest 50 announcements.</p>
        </div>
        <footer><AppButton variant="primary" @click="dismiss">Continue</AppButton></footer>
      </template>
    </dialog>
    <aside
      v-if="error"
      class="announcement-delivery-error"
      aria-label="Announcement delivery"
      role="status"
    >
      <p>Announcements could not be loaded. {{ error }}</p>
      <AppButton :disabled="loading" @click="retry">Retry announcements</AppButton>
      <AppButton @click="dismiss">Dismiss</AppButton>
    </aside>
  </Teleport>
</template>
<style scoped>
.announcement-delivery {
  box-sizing: border-box;
  width: min(42rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--panel-background);
  color: var(--text);
  overflow: hidden;
}
.announcement-delivery[open] {
  display: flex;
  flex-direction: column;
}
.announcement-delivery::backdrop {
  background: var(--overlay-backdrop, #00121db3);
}
header,
footer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
}
header {
  border-bottom: 1px solid var(--border);
}
h2 {
  margin: 0;
  font-size: 1.35rem;
}
footer {
  justify-content: flex-end;
  border-top: 1px solid var(--border);
}
.announcement-delivery__body {
  min-height: 0;
  overflow: auto;
  padding: 1.25rem;
  overscroll-behavior: contain;
}
.announcement-delivery-error {
  position: fixed;
  inset: auto 1rem 1rem auto;
  z-index: 1000;
  width: min(28rem, calc(100vw - 2rem));
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--panel-background);
  color: var(--text);
}
.announcement-delivery-error p {
  margin-top: 0;
}
</style>
