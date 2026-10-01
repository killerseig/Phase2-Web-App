<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'
import BuilderConfirmDialog from '@/components/builder/BuilderConfirmDialog.vue'
import FormDefinitionFields from '@/components/forms/FormDefinitionFields.vue'
import { useAuthStore } from '@/stores/auth'
import {
  formApi,
  isFormServerEnabled,
  uploadFormPhoto,
  type ServerFormTemplate,
} from '@/services/forms'
import type { FormAnswers, FormRecord } from '../../functions/src/formModel'
const auth = useAuthStore(),
  route = useRoute()
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
  pendingSubmission = ref('')
const confirm = ref<InstanceType<typeof BuilderConfirmDialog>>()
const uid = computed(() => auth.currentUser?.uid || ''),
  templateId = computed(() => String(route.params.templateId || ''))
const selectedTemplate = computed(() =>
  templates.value.find((template) => template.id === templateId.value),
)
let sequence = 0
let saveRequest = { signature: '', id: '' }
const pendingKey = () => 'form-submit-request:v1:' + uid.value + ':' + record.value?.id
function received(next: FormRecord) {
  record.value = next
  answers.value = structuredClone(next.answers)
  dirty.value = false
  records.value = [next, ...records.value.filter((item) => item.id !== next.id)]
  previews.value = {}
  pendingSubmission.value = next.status === 'draft' ? localStorage.getItem(pendingKey()) || '' : ''
  if (next.status === 'submitted') localStorage.removeItem(pendingKey())
}
function updateAnswers(value: FormAnswers) {
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
  if (!enabled || !owner) return
  busy.value = true
  try {
    const [forms, saved] = await Promise.all([
      formApi<{ templates: ServerFormTemplate[] }>('formTemplates', { action: 'list' }),
      formApi<{ records: FormRecord[] }>('formWorkspace', { action: 'list' }),
    ])
    if (current !== sequence || uid.value !== owner) return
    templates.value = forms.templates
    records.value = saved.records.filter((item) => item.templateId === templateId.value)
  } catch (caught) {
    if (current === sequence) error.value = (caught as Error).message
  } finally {
    if (current === sequence) busy.value = false
  }
}
watch([uid, templateId], load, { immediate: true })
async function discard() {
  return (
    !dirty.value ||
    (await confirm.value?.ask({
      title: 'Discard unsaved answers?',
      message: 'Your last saved progress remains on the local server.',
      confirmLabel: 'Discard answers',
    }))
  )
}
async function start() {
  const generation = sequence,
    owner = uid.value,
    target = selectedTemplate.value
  if (!target || busy.value || !(await discard()) || uid.value !== owner || generation !== sequence)
    return
  busy.value = true
  try {
    const createKey = 'form-create-request:v1:' + owner + ':' + target.id
    const existing = localStorage.getItem(createKey)
    const pendingCreate = existing
      ? (JSON.parse(existing) as { version: number; requestId: string })
      : { version: target.latestVersion, requestId: crypto.randomUUID() }
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
    if (generation === sequence) busy.value = false
  }
}
async function resume(id: string) {
  const generation = sequence,
    owner = uid.value
  if (busy.value || !(await discard()) || uid.value !== owner || generation !== sequence) return
  busy.value = true
  try {
    const next = await formApi<FormRecord>('formWorkspace', { action: 'get', id })
    if (uid.value === owner && generation === sequence) received(next)
  } catch (caught) {
    if (generation === sequence) error.value = (caught as Error).message
  } finally {
    if (generation === sequence) busy.value = false
  }
}
async function save(): Promise<boolean> {
  if (!record.value || pendingSubmission.value) return false
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
    if (uid.value === owner && generation === sequence) error.value = (caught as Error).message
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
    if (generation === sequence) busy.value = false
  }
}
async function submit() {
  if (!record.value || busy.value) return
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
    if (
      problem.code?.includes('invalid-argument') ||
      problem.code?.includes('permission-denied') ||
      problem.code?.includes('aborted')
    ) {
      localStorage.removeItem(pendingKey())
      pendingSubmission.value = ''
    }
  } finally {
    if (generation === sequence) busy.value = false
  }
}
async function upload(fieldId: string, files: File[]) {
  if (!record.value || busy.value || pendingSubmission.value) return
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
    if (generation === sequence) busy.value = false
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
    if (generation === sequence) busy.value = false
  }
}
</script>
<template>
  <AppShell
    ><section class="response">
      <h1>
        {{
          selectedTemplate?.draft?.title || selectedTemplate?.definition?.title || 'Complete a form'
        }}
      </h1>
      <p>Local emulator workflow. Production records and email are not used.</p>
      <p v-if="!enabled" role="alert">
        Start the local Form Builder emulator profile to use durable drafts and submissions.
      </p>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="message" role="status">{{ message }}</p>
      <button
        :disabled="busy || !selectedTemplate?.latestVersion || selectedTemplate.archived"
        @click="start"
      >
        Start draft</button
      ><button :disabled="busy" @click="load">Reload saved records</button>
      <section aria-label="Saved form records">
        <h2>Saved records</h2>
        <button v-for="item in records" :key="item.id" :disabled="busy" @click="resume(item.id)">
          {{ item.status === 'draft' ? 'Resume draft' : 'View submitted form' }} · version
          {{ item.templateVersion }} · {{ item.id.slice(0, 8) }}
        </button>
        <p v-if="!records.length">Opening this page creates no draft.</p>
      </section>
      <section v-if="record" aria-label="Current form record">
        <h2>{{ record.definition.title }} · version {{ record.templateVersion }}</h2>
        <p>
          Record status: {{ record.status }} · {{ dirty ? 'Unsaved answers' : 'Saved answers' }}
        </p>
        <FormDefinitionFields
          :definition="record.definition"
          :model-value="answers"
          :readonly="record.status === 'submitted' || !!pendingSubmission"
          :disabled="busy"
          photos-enabled
          :photo-previews="previews"
          @update:model-value="updateAnswers"
          @upload="upload"
          @view-photo="viewPhoto"
        />
        <div class="actions">
          <button
            :disabled="busy || record.status === 'submitted' || !!pendingSubmission"
            @click="saveClick"
          >
            Save progress</button
          ><button :disabled="busy || record.status === 'submitted'" @click="submit">
            {{ pendingSubmission ? 'Retry submission confirmation' : 'Submit form' }}
          </button>
        </div>
        <p v-if="record.status === 'submitted'">
          Email delivery: {{ record.emailStatus }}. The submission is retained independently.
        </p>
        <button
          v-if="
            record.status === 'submitted' &&
            ['failed', 'disabled'].includes(record.emailStatus || '')
          "
          :disabled="busy"
          @click="retryEmail"
        >
          Retry email delivery
        </button>
      </section>
      <BuilderConfirmDialog ref="confirm" /></section
  ></AppShell>
</template>
<style scoped>
.response {
  max-width: 52rem;
  margin: auto;
  padding: 1rem;
}
button {
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
