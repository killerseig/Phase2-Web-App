<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import BuilderConfirmDialog from '@/components/builder/BuilderConfirmDialog.vue'
import FormDefinitionFields from '@/components/forms/FormDefinitionFields.vue'
import { useAuthStore } from '@/stores/auth'
import {
  formApi,
  isFormServerEnabled,
  uploadFormPhoto,
  type ServerFormTemplate,
} from '@/services/forms'
import type { FormAnswers, FormRecord } from '../../../functions/src/formModel'
const localPreview = import.meta.env.DEV
const props = withDefaults(
  defineProps<{
    templateId: string
    templateVersion?: number
    inline?: boolean
    dashboardScope?: 'personal' | 'role'
  }>(),
  { inline: false },
)
const auth = useAuthStore(),
  route = useRoute(),
  router = useRouter()
const root = ref<HTMLElement>()
const enabled = isFormServerEnabled(),
  templates = ref<ServerFormTemplate[]>([]),
  records = ref<FormRecord[]>([]),
  record = ref<FormRecord>(),
  answers = ref<FormAnswers>({}),
  busy = ref(false),
  dirty = ref(false),
  error = ref(''),
  message = ref(''),
  previews = ref<Record<string, string>>({}),
  pendingSubmission = ref(''),
  invalidField = ref('')
const confirm = ref<InstanceType<typeof BuilderConfirmDialog>>()
const uid = computed(() => auth.currentUser?.uid || ''),
  templateId = computed(() => props.templateId)
const selectedTemplate = computed(() =>
  templates.value.find((template) => template.id === templateId.value),
)
const pinnedVersion = computed(
  () =>
    props.templateVersion || Number(route.query.version) || selectedTemplate.value?.latestVersion,
)
const activeKey = () =>
  'form-active-record:v1:' + uid.value + ':' + templateId.value + ':' + pinnedVersion.value
let sequence = 0
let saveRequest = { signature: '', id: '' }
const readOnlyRecord = computed(
  () =>
    !!record.value && (record.value.status === 'submitted' || record.value.ownerUid !== uid.value),
)
const tooLargeInline = computed(
  () => props.inline && (record.value?.definition.fields.length || 0) > 8,
)
const pendingKey = () => 'form-submit-request:v1:' + uid.value + ':' + record.value?.id
function received(next: FormRecord) {
  invalidField.value = ''
  error.value = ''
  message.value = ''
  record.value = next
  if (next.templateVersion === pinnedVersion.value) localStorage.setItem(activeKey(), next.id)
  answers.value = structuredClone(next.answers)
  dirty.value = false
  records.value = [next, ...records.value.filter((item) => item.id !== next.id)]
  previews.value = {}
  pendingSubmission.value = next.status === 'draft' ? localStorage.getItem(pendingKey()) || '' : ''
  if (next.status === 'submitted') localStorage.removeItem(pendingKey())
}
function updateAnswers(value: FormAnswers) {
  invalidField.value = ''
  answers.value = value
  dirty.value = true
}
async function load() {
  const current = ++sequence,
    owner = uid.value
  record.value = undefined
  answers.value = {}
  records.value = []
  templates.value = []
  dirty.value = false
  previews.value = {}
  error.value = ''
  pendingSubmission.value = ''
  message.value = ''
  invalidField.value = ''
  if (!enabled || !owner) return
  if (!['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(auth.rawRole)) {
    error.value = 'Your account cannot use this form workflow.'
    return
  }
  busy.value = true
  try {
    const [forms, saved] = await Promise.all([
      formApi<{ templates: ServerFormTemplate[] }>('formTemplates', { action: 'list' }),
      formApi<{ records: FormRecord[] }>('formWorkspace', { action: 'list' }),
    ])
    if (current !== sequence || uid.value !== owner) return
    templates.value = forms.templates
    records.value = saved.records.filter((item) => item.templateId === templateId.value)
    const requested =
      !props.inline && typeof route.query.record === 'string'
        ? route.query.record
        : props.inline || route.query.dashboard
          ? localStorage.getItem(activeKey())
          : String(route.query.record || '')
    const candidate =
      requested ||
      (props.inline || route.query.dashboard
        ? records.value
            .filter(
              (item) => item.status === 'draft' && item.templateVersion === pinnedVersion.value,
            )
            .sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id
        : undefined)
    if (candidate) {
      const next = await formApi<FormRecord>('formWorkspace', { action: 'get', id: candidate })
      if (current !== sequence || uid.value !== owner) return
      if (
        next.templateId !== templateId.value ||
        ((props.templateVersion || route.query.version) &&
          next.templateVersion !== pinnedVersion.value)
      )
        throw new Error('This record does not match the selected form version.')
      received(next)
    }
  } catch (caught) {
    if (current === sequence) error.value = (caught as Error).message
  } finally {
    if (current === sequence) busy.value = false
  }
}
watch([uid, templateId, () => props.templateVersion, () => auth.rawRole], load, { immediate: true })
async function discard() {
  return (
    !dirty.value ||
    (await confirm.value?.ask({
      title: 'Discard unsaved answers?',
      message: 'Your last saved progress remains on the server.',
      confirmLabel: 'Discard answers',
    }))
  )
}
async function start() {
  if ((props.inline || route.query.dashboard) && record.value?.status === 'draft') return
  const generation = sequence,
    owner = uid.value,
    target = selectedTemplate.value
  if (
    !target ||
    busy.value ||
    !(await discard()) ||
    uid.value !== owner ||
    generation !== sequence ||
    busy.value
  )
    return
  busy.value = true
  try {
    if (props.inline || route.query.dashboard) {
      if (record.value?.status === 'draft') return
      const draft = records.value
        .filter((item) => item.status === 'draft' && item.templateVersion === pinnedVersion.value)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0]
      if (draft) {
        received(await formApi<FormRecord>('formWorkspace', { action: 'get', id: draft.id }))
        return
      }
    }
    const createKey =
      'form-create-request:v1:' + owner + ':' + target.id + ':' + pinnedVersion.value
    const existing = localStorage.getItem(createKey)
    const pendingCreate = existing
      ? (JSON.parse(existing) as { version: number; requestId: string })
      : { version: pinnedVersion.value, requestId: crypto.randomUUID() }
    localStorage.setItem(createKey, JSON.stringify(pendingCreate))
    const next = await formApi<FormRecord>('formWorkspace', {
      action: 'create',
      templateId: target.id,
      ...pendingCreate,
    })
    if (uid.value === owner && generation === sequence) {
      localStorage.removeItem(createKey)
      received(next)
    }
  } catch (caught) {
    if (generation === sequence) error.value = (caught as Error).message
  } finally {
    if (generation === sequence) {
      busy.value = false
      await nextTick()
      if (generation === sequence && invalidField.value)
        root.value?.querySelector<HTMLElement>('[id="answer-' + invalidField.value + '"]')?.focus()
    }
  }
}
async function resume(id: string) {
  const generation = sequence,
    owner = uid.value
  if (
    busy.value ||
    !(await discard()) ||
    uid.value !== owner ||
    generation !== sequence ||
    busy.value
  )
    return
  busy.value = true
  try {
    const next = await formApi<FormRecord>('formWorkspace', { action: 'get', id })
    if (uid.value === owner && generation === sequence) received(next)
  } catch (caught) {
    if (generation === sequence) error.value = (caught as Error).message
  } finally {
    if (generation === sequence) {
      busy.value = false
      await nextTick()
      if (generation === sequence && invalidField.value)
        document.getElementById('answer-' + invalidField.value)?.focus()
    }
  }
}
async function save(): Promise<boolean> {
  if (!record.value || readOnlyRecord.value || pendingSubmission.value) return false
  const generation = sequence,
    owner = uid.value,
    current = record.value
  try {
    const next = await formApi<FormRecord>('formWorkspace', {
      action: 'save',
      id: current.id,
      revision: current.revision,
      requestId:
        saveRequest.signature ===
        JSON.stringify([owner, current.id, current.revision, answers.value])
          ? saveRequest.id
          : (saveRequest = {
              signature: JSON.stringify([owner, current.id, current.revision, answers.value]),
              id: crypto.randomUUID(),
            }).id,
      answers: answers.value,
    })
    if (uid.value !== owner || generation !== sequence) return false
    received(next)
    message.value = 'Progress saved. This form has not been submitted.'
    error.value = ''
    return true
  } catch (caught) {
    if (uid.value === owner && generation === sequence) {
      error.value = (caught as Error).message
      invalidField.value =
        current.definition.fields.find(
          (field) =>
            error.value.startsWith(field.label + ':') || error.value.startsWith(field.label + ' '),
        )?.id || ''
      await nextTick()
      if (generation === sequence) document.getElementById('answer-' + invalidField.value)?.focus()
    }
    return false
  }
}
async function saveClick() {
  const generation = sequence
  if (busy.value) return
  busy.value = true
  try {
    await save()
  } finally {
    if (generation === sequence) {
      busy.value = false
      await nextTick()
      if (generation === sequence && invalidField.value)
        document.getElementById('answer-' + invalidField.value)?.focus()
    }
  }
}
async function submit() {
  if (!record.value || busy.value || readOnlyRecord.value) return
  const generation = sequence,
    owner = uid.value
  busy.value = true
  try {
    if (!pendingSubmission.value && !(await save())) return
    if (uid.value !== owner || generation !== sequence) return
    pendingSubmission.value ||= crypto.randomUUID()
    localStorage.setItem(pendingKey(), pendingSubmission.value)
    const next = await formApi<FormRecord>('formWorkspace', {
      action: 'submit',
      id: record.value!.id,
      revision: record.value!.revision,
      requestId: pendingSubmission.value,
    })
    if (uid.value !== owner || generation !== sequence) return
    received(next)
    error.value = ''
    message.value = 'Submission retained. Email delivery is tracked separately.'
  } catch (caught) {
    if (uid.value !== owner || generation !== sequence) return
    const problem = caught as Error & { code?: string }
    error.value = problem.message
    invalidField.value =
      record.value?.definition.fields.find(
        (field) =>
          problem.message.startsWith(field.label + ' ') ||
          problem.message.startsWith(field.label + ':'),
      )?.id || ''
    await nextTick()
    if (generation === sequence && invalidField.value)
      document.getElementById('answer-' + invalidField.value)?.focus()
    if (
      problem.code?.includes('invalid-argument') ||
      problem.code?.includes('permission-denied') ||
      problem.code?.includes('aborted')
    ) {
      localStorage.removeItem(pendingKey())
      pendingSubmission.value = ''
    }
  } finally {
    if (generation === sequence) {
      busy.value = false
      await nextTick()
      if (generation === sequence && invalidField.value)
        document.getElementById('answer-' + invalidField.value)?.focus()
    }
  }
}
async function upload(fieldId: string, files: File[]) {
  if (!record.value || busy.value || readOnlyRecord.value || pendingSubmission.value) return
  const generation = sequence,
    owner = uid.value
  busy.value = true
  try {
    if (dirty.value && !(await save())) return
    for (const file of files) {
      const next = await uploadFormPhoto(record.value!, fieldId, file)
      if (uid.value !== owner || generation !== sequence) return
      received(next)
    }
    message.value = 'Photos saved to this draft.'
    error.value = ''
  } catch (caught) {
    if (generation === sequence) error.value = (caught as Error).message
  } finally {
    if (generation === sequence) {
      busy.value = false
      await nextTick()
      if (generation === sequence && invalidField.value)
        document.getElementById('answer-' + invalidField.value)?.focus()
    }
  }
}
async function viewPhoto(id: string) {
  if (!record.value) return
  const generation = sequence,
    owner = uid.value,
    recordId = record.value.id
  try {
    const result = await formApi<{ base64: string; contentType: string }>('formWorkspace', {
      action: 'photo',
      id: recordId,
      assetId: id,
    })
    if (uid.value === owner && generation === sequence && record.value?.id === recordId)
      previews.value[id] = 'data:' + result.contentType + ';base64,' + result.base64
  } catch (caught) {
    if (generation === sequence) error.value = (caught as Error).message
  }
}
async function retryEmail() {
  const generation = sequence,
    current = record.value
  if (!record.value || busy.value) return
  busy.value = true
  try {
    const result = await formApi<{ emailStatus: string }>('formEmail', {
      action: 'retry',
      id: record.value.id,
    })
    if (generation !== sequence || record.value?.id !== current?.id) return
    record.value!.emailStatus = result.emailStatus
    message.value = 'Delivery status refreshed. The submission is unchanged.'
  } catch (caught) {
    if (generation === sequence) error.value = (caught as Error).message
  } finally {
    if (generation === sequence) {
      busy.value = false
      await nextTick()
      if (generation === sequence && invalidField.value)
        document.getElementById('answer-' + invalidField.value)?.focus()
    }
  }
}
async function prepareNavigation(): Promise<boolean> {
  if (busy.value) return false
  if (record.value && record.value.ownerUid !== uid.value) return !dirty.value
  if (!dirty.value || pendingSubmission.value || record.value?.status !== 'draft') return true
  const generation = sequence
  busy.value = true
  try {
    return await save()
  } finally {
    if (generation === sequence) busy.value = false
  }
}
async function openFullPage() {
  if (!(await prepareNavigation())) return
  await router.push({
    name: 'form-response',
    params: { templateId: templateId.value },
    query: {
      version: String(pinnedVersion.value || ''),
      ...(record.value ? { record: record.value.id } : {}),
      ...(props.dashboardScope ? { dashboard: props.dashboardScope } : {}),
    },
  })
}
async function reloadRecords() {
  if (await prepareNavigation()) await load()
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || busy.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
window.addEventListener('beforeunload', beforeUnload)
onBeforeUnmount(() => {
  sequence++
  window.removeEventListener('beforeunload', beforeUnload)
})
onBeforeRouteLeave(prepareNavigation)
onBeforeRouteUpdate(async () => await prepareNavigation())
defineExpose({ prepareNavigation })
</script>
<template>
  <section ref="root" class="response" :class="{ 'response-inline': inline }">
    <component :is="inline ? 'h2' : 'h1'">
      {{
        record?.definition.title ||
        selectedTemplate?.definition?.title ||
        selectedTemplate?.draft?.title ||
        'Complete a form'
      }}
    </component>
    <button v-if="inline" :disabled="busy" @click="openFullPage">Open full-page form</button>
    <button
      v-else-if="route.query.dashboard === 'personal' || route.query.dashboard === 'role'"
      :disabled="busy"
      @click="router.push('/dashboards/' + route.query.dashboard)"
    >
      Return to dashboard
    </button>
    <p v-if="localPreview">Local emulator workflow. Production records and email are not used.</p>
    <p v-if="!enabled" role="alert">
      Start the local Form Builder emulator profile to use durable drafts and submissions.
    </p>
    <p v-if="error" id="form-validation-message" role="alert">{{ error }}</p>
    <p v-if="message" role="status">{{ message }}</p>
    <button
      :disabled="busy || !selectedTemplate?.latestVersion || selectedTemplate.archived"
      @click="start"
    >
      Start draft</button
    ><button :disabled="busy" @click="reloadRecords">Reload saved records</button>
    <section v-if="!inline" aria-label="Saved form records">
      <h2>Saved records</h2>
      <button v-for="item in records" :key="item.id" :disabled="busy" @click="resume(item.id)">
        {{ item.status === 'draft' ? 'Resume draft' : 'View submitted form' }} · version
        {{ item.templateVersion }} · {{ item.id.slice(0, 8) }}
      </button>
      <p v-if="!records.length">Opening this page creates no draft.</p>
    </section>
    <section v-if="record" aria-label="Current form record">
      <h2>{{ record.definition.title }} · version {{ record.templateVersion }}</h2>
      <p>Record status: {{ record.status }} · {{ dirty ? 'Unsaved answers' : 'Saved answers' }}</p>
      <p v-if="tooLargeInline">
        This form has more than eight fields. Open the full-page form to continue.
      </p>
      <FormDefinitionFields
        v-else
        :definition="record.definition"
        :model-value="answers"
        :invalid-field="invalidField"
        :readonly="readOnlyRecord || !!pendingSubmission"
        :disabled="busy"
        photos-enabled
        :photo-previews="previews"
        @update:model-value="updateAnswers"
        @upload="upload"
        @view-photo="viewPhoto"
      />
      <div class="actions">
        <button
          :disabled="busy || tooLargeInline || readOnlyRecord || !!pendingSubmission"
          @click="saveClick"
        >
          Save progress</button
        ><button :disabled="busy || tooLargeInline || readOnlyRecord" @click="submit">
          {{ pendingSubmission ? 'Retry submission confirmation' : 'Submit form' }}
        </button>
      </div>
      <p v-if="record.status === 'submitted'">
        Email delivery: {{ record.emailStatus }}. The submission is retained independently.
      </p>
      <button
        v-if="
          record.ownerUid === uid &&
          record.status === 'submitted' &&
          ['failed', 'disabled'].includes(record.emailStatus || '')
        "
        :disabled="busy"
        @click="retryEmail"
      >
        Retry email delivery
      </button>
    </section>
    <BuilderConfirmDialog ref="confirm" />
  </section>
</template>
<style scoped>
.response {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow-wrap: anywhere;
  max-width: 52rem;
  margin: auto;
  padding: 1rem;
}
.response-inline {
  padding: 0.75rem;
  margin: 0;
}
button {
  max-width: 100%;
  white-space: normal;
  padding: 0.65rem;
  margin: 0.4rem 0.4rem 0.4rem 0;
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  background: var(--surface);
  color: var(--text);
}
section[aria-label] {
  border-top: 1px solid var(--border);
  margin-top: 1rem;
  padding-top: 1rem;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
p[role='alert'] {
  color: var(--danger, #e99);
}
</style>
