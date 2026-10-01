<script setup lang="ts">
import BuilderConfirmDialog from '@/components/builder/BuilderConfirmDialog.vue'
import { ref, nextTick, onBeforeUnmount } from 'vue'
import { websiteFormAdmin, websiteError } from '@/services/website'
interface Submission {
  id: string
  formName: string
  createdAt: number
  answers: { label: string; value: string | boolean }[]
  emailStatus: string
  attempts: number
  attemptStartedAt: number | null
}
const confirmation = ref<InstanceType<typeof BuilderConfirmDialog>>()
const dialog = ref<HTMLDialogElement>(),
  entries = ref<Submission[]>([]),
  cursor = ref<string | null>(null),
  busy = ref(false),
  error = ref('')
let opener: HTMLElement | null = null
async function load(more = false) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const result = await websiteFormAdmin<{ submissions: Submission[]; nextCursor: string | null }>(
      'list',
      more && cursor.value ? { cursor: cursor.value } : {},
    )
    entries.value = more ? [...entries.value, ...result.submissions] : result.submissions
    cursor.value = result.nextCursor
  } catch (reason) {
    error.value = websiteError(reason)
  } finally {
    busy.value = false
  }
}
async function open(trigger?: MouseEvent) {
  opener = (trigger?.currentTarget as HTMLElement) || (document.activeElement as HTMLElement)
  await nextTick()
  dialog.value?.showModal()
  void load()
}
function close() {
  dialog.value?.close()
  opener?.focus({ preventScroll: true })
}
async function retry(entry: Submission, trigger?: MouseEvent) {
  if (
    busy.value ||
    !(await confirmation.value?.ask(
      {
        title: 'Retry notification email?',
        message:
          'This retries delivery to the original recipients. If the earlier attempt succeeded without confirmation, they may receive a duplicate.',
        confirmLabel: 'Retry email',
      },
      trigger,
    ))
  )
    return
  busy.value = true
  error.value = ''
  try {
    const result = await websiteFormAdmin<{ emailStatus: string }>('retry', { id: entry.id })
    entry.emailStatus = result.emailStatus
    entry.attempts++
  } catch (reason) {
    error.value = websiteError(reason)
  } finally {
    busy.value = false
  }
}
function canRetry(entry: Submission) {
  return (
    entry.emailStatus !== 'sent' &&
    (entry.emailStatus !== 'sending' || Date.now() - (entry.attemptStartedAt || 0) > 600000)
  )
}
onBeforeUnmount(() => dialog.value?.close())
</script>
<template>
  <BuilderConfirmDialog ref="confirmation" />
  <button type="button" @click="open">View form submissions</button>
  <Teleport to="body"
    ><dialog
      ref="dialog"
      class="builder-controls builder-dialog"
      aria-label="Website form submissions"
      @cancel.prevent="close"
      @keydown.esc.prevent.stop="close"
      @keydown.stop
    >
      <header>
        <h2>Website form submissions</h2>
        <button type="button" @click="close">Close submissions</button>
      </header>
      <p>Inquiries are saved before email delivery. This list is only available to admins.</p>
      <button :disabled="busy" @click="load()">Refresh submissions</button>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="busy" role="status">Loading...</p>
      <p v-else-if="!entries.length">No submissions yet.</p>
      <details v-for="entry in entries" :key="entry.id">
        <summary>
          {{ entry.formName }} - {{ new Date(entry.createdAt).toLocaleString() }} - Email
          {{ entry.emailStatus }}
        </summary>
        <dl>
          <template v-for="(answer, index) in entry.answers" :key="index"
            ><dt>{{ answer.label }}</dt>
            <dd>
              {{
                typeof answer.value === 'boolean'
                  ? answer.value
                    ? 'Yes'
                    : 'No'
                  : answer.value || '(not supplied)'
              }}
            </dd></template
          >
        </dl>
        <p v-if="entry.emailStatus === 'disabled'">
          Email sending is disabled for the application. The inquiry is saved here.
        </p>
        <p v-else-if="entry.emailStatus === 'failed'">
          The email attempt failed. The inquiry is saved here.
        </p>
        <button v-if="canRetry(entry)" :disabled="busy" @click="retry(entry, $event)">
          Retry notification email
        </button>
      </details>
      <button v-if="cursor" :disabled="busy" @click="load(true)">Load more submissions</button>
    </dialog></Teleport
  >
</template>
<style scoped>
dialog {
  box-sizing: border-box;
  width: min(900px, 94vw);
  max-height: 90dvh;
  overflow: auto;
  background: var(--bg-panel, #142d3c);
  color: var(--text, #fff);
  border: 1px solid var(--border);
  padding: 1rem;
  border-radius: 8px;
}
dialog::backdrop {
  background: #0009;
}
header {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
}
h2 {
  margin: 0;
}
details {
  padding: 0.8rem;
  border: 1px solid var(--border);
  margin: 0.7rem 0;
}
summary {
  cursor: pointer;
}
dt {
  font-weight: 600;
}
dd {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 0.2rem 0 1rem;
}
button {
  padding: 0.5rem;
  font: inherit;
  font-size: 0.8rem;
}
</style>
