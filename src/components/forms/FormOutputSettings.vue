<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { formOutputIssues } from '../../../functions/src/formOutputTemplate'
import { buildFormEmailHtml, buildFormEmailText } from '../../../functions/src/formEmailRender'
import type {
  FormAnswers,
  FormDefinition,
  FormOutputSettings,
  FormRecord,
  FormField,
} from '../../../functions/src/formModel'
import { formApi, isFormServerEnabled } from '@/services/forms'
import { validateFormAccess } from '../../../functions/src/formAccess'
import type { FormAccessPolicy } from '../../../functions/src/formAccess'
import type { FormRecipientGroup } from '../../../functions/src/formRecipients'
import { withCompanyReportDelivery } from '@/features/forms/companyReports'
import AppButton from '@/components/common/AppButton.vue'
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
    requireLogin: props.definition.access?.respondents !== 'public',
  })),
  issues = computed(() => formOutputIssues(props.definition))
function update(value: Partial<FormOutputSettings>) {
  emit('update:definition', { ...props.definition, output: { ...settings.value, ...value } })
}
const access = computed(() => validateFormAccess(props.definition.access))
const audienceRoles = ['admin', 'project-manager', 'foreman', 'shop-foreman']
const roleLabels: Record<string, string> = { admin: 'Admin', 'project-manager': 'Project manager', foreman: 'Foreman', 'shop-foreman': 'Shop foreman' }
function updateAccess(value: Partial<FormAccessPolicy>) {
  try {
    const next = { ...access.value, ...value }
    if (next.respondents === 'signed-in' && next.identity === 'anonymous')
      next.identity = 'identified'
    emit('update:definition', { ...props.definition, access: validateFormAccess(next) })
    error.value = ''
  } catch (caught) {
    error.value = (caught as Error).message
  }
}
function toggleRole(key: 'respondentRoles' | 'entryRoles', role: string, checked: boolean) {
  updateAccess({
    [key]: checked
      ? [...access.value[key], role]
      : access.value[key].filter((item) => item !== role),
  })
}
function updatePeople(key: 'respondentUserIds' | 'entryUserIds', value: string) {
  updateAccess({ [key]: value.split(/[\s,;]+/).filter(Boolean) })
}
const recipientGroupOptions: { value: FormRecipientGroup; label: string }[] = [
  { value: 'job-foremen', label: 'Foremen assigned to this job' },
  { value: 'job-project-managers', label: 'Project managers assigned to this job' },
  { value: 'job-everyone', label: 'Everyone assigned to this job' },
]
function toggleRecipientGroup(group: FormRecipientGroup, checked: boolean) {
  const groups = props.definition.recipientGroups || []
  emit('update:definition', {
    ...props.definition,
    recipientGroups: checked ? [...groups, group] : groups.filter((item) => item !== group),
  })
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
function sampleAnswers(fields: FormField[]): FormAnswers {
  return Object.fromEntries(
    fields.map((field) => [
      field.id,
      field.kind === 'matrix'
        ? (field.rows || []).map(() => field.options[0] || '')
        : field.kind === 'repeat'
          ? [{ instanceId: 'sample-site-1', answers: sampleAnswers(field.fields || []) }]
          : field.kind === 'recipients'
            ? ['sample@example.com']
            : field.kind === 'photo'
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
                            : 'Sample ' + field.label,
    ]),
  )
}
const samples = computed<FormAnswers>(() => sampleAnswers(props.definition.fields))
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
    <p v-if="error" role="alert">{{ error }}</p>
    <h3>Audience</h3>
    <label
      >Who can submit<select
        :value="access.respondents"
        @change="
          updateAccess({
            respondents: ($event.target as HTMLSelectElement)
              .value as FormAccessPolicy['respondents'],
          })
        "
      >
        <option value="signed-in">Selected employees (login required)</option>
        <option value="public">Everyone with the link (no login)</option>
      </select></label
    >
    <fieldset v-if="access.respondents !== 'public'">
      <legend>Employee respondent audience</legend>
      <label v-for="role in audienceRoles" :key="role"
        ><input
          type="checkbox"
          :checked="access.respondentRoles.includes(role)"
          @change="toggleRole('respondentRoles', role, ($event.target as HTMLInputElement).checked)"
        />{{ roleLabels[role] }}</label
      ><details><summary>Individual employees</summary><label
        >Individual employee IDs<input
          :value="access.respondentUserIds.join(', ')"
          @change="updatePeople('respondentUserIds', ($event.target as HTMLInputElement).value)"
      /></label></details>
    </fieldset>
    <label
      >Identity policy<select
        :value="access.identity"
        @change="
          updateAccess({
            identity: ($event.target as HTMLSelectElement).value as FormAccessPolicy['identity'],
          })
        "
      >
        <option value="identified">Identified response</option>
        <option value="form-fields">Identity through form fields</option>
        <option value="anonymous" :disabled="access.respondents !== 'public'">
          Anonymous response (public links)
        </option>
      </select></label
    >
    <p v-if="access.respondents === 'public'" class="output-notice">
      Anyone with the link can submit. No login does not mean anonymous; check the identity policy.
    </p>
    <fieldset>
      <legend>Notification recipients</legend>
      <label v-for="group in recipientGroupOptions" :key="group.value"
        ><input
          type="checkbox"
          :checked="definition.recipientGroups?.includes(group.value)"
          @change="toggleRecipientGroup(group.value, ($event.target as HTMLInputElement).checked)"
        />{{ group.label }}</label
      >
      <p>
        Job groups use the selected job. Fixed email addresses are in Form settings.
      </p>
      <p v-if="access.respondents === 'public'" class="output-notice">Public extra addresses receive no notification until verified. Fixed addresses and job groups still receive results.</p>
      <details><summary>Additional recipients</summary><p>An optional Recipient addresses field lets signed-in respondents add up to 10 addresses. Email delivery does not grant access to private entries or photos.</p></details>
    </fieldset>
    <fieldset>
      <legend>Private entries and photos</legend>
      <p>
        Admins and the signed-in owner retain access. Email recipients do not automatically get private access.
      </p>
      <p>Additional readers: {{ access.entryRoles.map(role => roleLabels[role] || role).join(', ') || 'No additional roles' }}{{ access.entryUserIds.length ? '; ' + access.entryUserIds.length + ' individual employees' : '' }}.</p>
      <details><summary>Manage additional readers</summary>
      <label v-for="role in audienceRoles" :key="role"
        ><input
          type="checkbox"
          :checked="access.entryRoles.includes(role)"
          @change="toggleRole('entryRoles', role, ($event.target as HTMLInputElement).checked)"
        />{{ roleLabels[role] }}</label
      ><label
        >Individual reader IDs<input
          :value="access.entryUserIds.join(', ')"
          @change="updatePeople('entryUserIds', ($event.target as HTMLInputElement).value)"
      /></label>
      </details>
    </fieldset>
    <h3>Email and PDF</h3>
    <label
      ><input
        type="checkbox"
        :checked="settings.pdf"
        @change="update({ pdf: ($event.target as HTMLInputElement).checked })"
      />Attach completed form PDF</label
    >
    <p>
      {{ settings.template ? 'Custom email layout is active.' : 'Standard email includes all answers and inline photo thumbnails.' }} Full photos require permitted private access.
    </p>
    <details class="output-options"><summary>Email layout options</summary>
    <AppButton @click="emit('update:definition', withCompanyReportDelivery(definition))">Apply standard email setup</AppButton>
    <p>Adds optional recipient selection and restores the all-answer email layout. Review before publishing. Sender configuration and private access stay unchanged.</p>
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
    ><AppButton :disabled="!picked" @click="insert">Insert selected field</AppButton>
    <p>
      Field keys stay stable when labels change. Text is escaped; templates cannot run HTML or code.
    </p>
    </details>
    <section aria-label="Output issues">
      <h3>Output checks</h3>
      <p v-if="!issues.length">No output issues. Default email includes all answers.</p>
      <p
        v-for="issue in issues"
        :key="issue.message"
        :role="issue.severity === 'error' ? 'alert' : 'status'"
      >
        {{ issue.severity === 'error' ? 'Error' : 'Warning' }}: {{ issue.message }}
      </p>
    </section>
    <AppButton @click="preview">Preview output</AppButton>
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
      <AppButton
        :disabled="pdfBusy || issues.some((issue) => issue.severity === 'error')"
        @click="previewPdf"
      >
        {{ pdfBusy ? 'Generating PDF…' : 'Generate PDF preview' }}</AppButton
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
  gap: 0.75rem;
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
.output-settings select,
.output-settings input:not([type='checkbox']) {
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font: inherit;
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
.output-settings p {
  margin: 0.2rem 0;
  font-size: 0.85rem;
}
.output-settings h3 { margin: .25rem 0 0; font-size: .95rem; }
.output-settings fieldset { display: grid; gap: .6rem; min-width: 0; margin: 0; padding: .75rem; border: 1px solid var(--border); border-radius: var(--radius-sm); }
.output-settings legend { padding: 0 .25rem; font-size: .9rem; font-weight: var(--font-weight-heading); }
.output-settings details > summary { cursor: pointer; padding: .4rem 0; font-size: .85rem; font-weight: 500; }
.output-settings details[open] > :not(summary) { margin-top: .6rem; }
.output-settings .output-notice { padding: .6rem; border-left: 2px solid var(--accent); background: var(--bg-accent); }
.output-settings :deep(.app-button) { max-width: 100%; white-space: normal; text-align: left; }
</style>
