<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { formOutputIssues } from '../../../functions/src/formOutputTemplate'
import { buildFormEmailHtml, buildFormEmailText } from '../../../functions/src/formEmailRender'
import type {
  FormAnswers,
  FormDefinition,
  FormOutputSettings,
  FormRecord,
} from '../../../functions/src/formModel'
import { formApi, isFormServerEnabled } from '@/services/forms'
const props = defineProps<{ definition: FormDefinition; templateId: string }>(),
  emit = defineEmits<{ 'update:definition': [value: FormDefinition] }>()
const editor = ref<HTMLTextAreaElement>(),
  picked = ref(''),
  showPreview = ref(false),
  records = ref<FormRecord[]>([]),
  selectedRecord = ref(''),
  error = ref('')
const settings = computed(() => ({
    pdf: false,
    template: '',
    ...props.definition.output,
    requireLogin: true,
  })),
  issues = computed(() => formOutputIssues(props.definition))
function update(value: Partial<FormOutputSettings>) {
  emit('update:definition', { ...props.definition, output: { ...settings.value, ...value } })
}
async function insert() {
  if (!picked.value) return
  const area = editor.value,
    token = '{{' + picked.value + '}}',
    text = settings.value.template,
    start = area?.selectionStart ?? text.length,
    end = area?.selectionEnd ?? start
  update({ template: text.slice(0, start) + token + text.slice(end) })
  await nextTick()
  area?.focus()
  area?.setSelectionRange(start + token.length, start + token.length)
}
const samples = computed<FormAnswers>(() =>
  Object.fromEntries(
    props.definition.fields.map((field) => [
      field.id,
      field.kind === 'photo'
        ? ['sample-photo']
        : field.kind === 'checkbox'
          ? true
          : field.kind === 'multiselect'
            ? [field.options[0] || 'Sample']
            : ['choice', 'radio'].includes(field.kind)
              ? field.options[0] || 'Sample'
              : field.kind === 'number'
                ? 4
                : field.kind === 'date'
                  ? '2026-10-02'
                  : field.kind === 'time'
                    ? '13:20'
                    : field.kind === 'email'
                      ? 'sample@example.com'
                      : field.kind === 'phone'
                        ? '+1 555 123 4567'
                        : field.kind === 'textarea'
                          ? 'Sample full answer.\nA second line is preserved.'
                          : 'Sample ' + field.label,
    ]),
  ),
)
const record = computed<FormRecord>(() => ({
  id: 'sample',
  ownerUid: 'sample',
  templateId: props.templateId,
  templateVersion: 1,
  definition: { ...props.definition, version: 1, createdAt: '' },
  answers: records.value.find((item) => item.id === selectedRecord.value)?.answers || samples.value,
  revision: 1,
  status: 'submitted',
  createdAt: 0,
  updatedAt: 0,
}))
const pdfUrl = ref(''),
  pdfBusy = ref(false)
function clearPdf() {
  if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value)
  pdfUrl.value = ''
}
const previewFingerprint = computed(() =>
  JSON.stringify({ definition: props.definition, answers: record.value.answers }),
)
watch(previewFingerprint, clearPdf)
onBeforeUnmount(clearPdf)
async function previewPdf() {
  pdfBusy.value = true
  error.value = ''
  const fingerprint = previewFingerprint.value
  try {
    const answers = Object.fromEntries(
      props.definition.fields.map((field) => [field.id, record.value.answers[field.id]]),
    )
    const result = await formApi<{ base64: string }>('formSubmissionViewer', {
      action: 'preview-pdf',
      definition: props.definition,
      answers,
    })
    if (fingerprint !== previewFingerprint.value) return
    clearPdf()
    pdfUrl.value = URL.createObjectURL(
      new Blob([Uint8Array.from(atob(result.base64), (char) => char.charCodeAt(0))], {
        type: 'application/pdf',
      }),
    )
  } catch (caught) {
    error.value = (caught as Error).message
  } finally {
    pdfBusy.value = false
  }
}
const html = computed(() => {
    try {
      return buildFormEmailHtml(record.value)
    } catch {
      return ''
    }
  }),
  text = computed(() => {
    try {
      return buildFormEmailText(record.value)
    } catch {
      return ''
    }
  })
async function preview() {
  showPreview.value = true
  error.value = ''
  if (isFormServerEnabled())
    try {
      records.value = (
        await formApi<{ records: FormRecord[] }>('formWorkspace', { action: 'list' })
      ).records.filter(
        (item) => item.templateId === props.templateId && item.status === 'submitted',
      )
    } catch (caught) {
      error.value = (caught as Error).message
    }
}
</script>
<template>
  <section aria-label="Form output settings" class="output-settings">
    <label><input type="checkbox" checked disabled />Require login</label>
    <p>
      Employee forms and their photos require the existing owner or Admin login. Public sharing is
      unavailable.
    </p>
    <label
      ><input
        type="checkbox"
        :checked="settings.pdf"
        @change="update({ pdf: ($event.target as HTMLInputElement).checked })"
      />Attach completed form PDF</label
    >
    <p>
      Default email includes every question and answer. Photos use small inline previews and a
      viewer link, as Daily Logs does.
    </p>
    <label
      >Custom email template<textarea
        ref="editor"
        :value="settings.template"
        maxlength="20000"
        placeholder="Leave blank for the complete form email"
        @input="update({ template: ($event.target as HTMLTextAreaElement).value })"
      />
    </label>
    <label
      >Insert field<select v-model="picked" aria-label="Insert field">
        <option value="">Choose a field</option>
        <option v-for="field in definition.fields" :key="field.id" :value="field.id">
          {{ field.label }}
        </option>
      </select></label
    ><button :disabled="!picked" @click="insert">Insert selected field</button>
    <p>
      Field keys stay stable when labels change. Text is escaped; templates cannot run HTML or code.
    </p>
    <section aria-label="Output issues">
      <h3>Issues / review</h3>
      <p v-if="!issues.length">No output issues. Default email includes all answers.</p>
      <p
        v-for="issue in issues"
        :key="issue.message"
        :role="issue.severity === 'error' ? 'alert' : 'status'"
      >
        {{ issue.severity === 'error' ? 'Error' : 'Warning' }}: {{ issue.message }}
      </p>
    </section>
    <button @click="preview">Preview output</button>
    <section v-if="showPreview" aria-label="Output preview">
      <label
        >Preview answers<select v-model="selectedRecord" aria-label="Preview answers">
          <option value="">Sample answers</option>
          <option v-for="item in records" :key="item.id" :value="item.id">
            Saved submission {{ item.id.slice(0, 8) }} · version {{ item.templateVersion }}
          </option>
        </select></label
      >
      <p v-if="error" role="alert">{{ error }}</p>
      <p>
        No email is sent. Saved answers are shown against the current draft; issued submissions
        retain their original definition.
      </p>
      <iframe v-if="html" title="Completed form email preview" :srcdoc="html" sandbox="" />
      <button
        :disabled="pdfBusy || issues.some((issue) => issue.severity === 'error')"
        @click="previewPdf"
      >
        Generate PDF preview</button
      ><a v-if="pdfUrl" :href="pdfUrl" target="_blank" rel="noopener">Open completed form PDF</a>
      <p>
        PDF preview uses the chosen answers; sample photos are placeholders. Emailed PDFs include
        bounded photo previews and point to the email viewer for full photos.
      </p>
      <details>
        <summary>Plain text preview</summary>
        <pre>{{ text }}</pre>
      </details>
    </section>
  </section>
</template>
<style scoped>
.output-settings {
  display: grid;
  gap: 0.6rem;
  min-width: 0;
}
.output-settings label {
  display: grid;
  gap: 0.35rem;
}
.output-settings label:has(input[type='checkbox']) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.output-settings input[type='checkbox'] {
  width: auto;
}
.output-settings textarea {
  min-height: 9rem;
}
.output-settings textarea,
.output-settings select {
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}
.output-settings iframe {
  width: 100%;
  height: 28rem;
  background: white;
  border: 1px solid var(--border);
}
.output-settings pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.output-settings button,
.output-settings a {
  display: inline-block;
  padding: 0.45rem 0.65rem;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 0.35rem;
  font: inherit;
  text-decoration: none;
}
.output-settings button:disabled {
  opacity: 0.55;
}
.output-settings p {
  margin: 0.2rem 0;
  font-size: 0.85rem;
}
</style>
