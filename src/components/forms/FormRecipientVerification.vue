<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import { formApi } from '@/services/forms'
import { respondentRecipients } from '../../../functions/src/formRecipients'
import type { FormAnswers, FormField, FormRecord } from '../../../functions/src/formModel'
const props = defineProps<{ record: FormRecord; answers: FormAnswers; capability: string; prepare: () => Promise<boolean>; disabled?: boolean }>()
const emit = defineEmits<{ busy: [value: boolean] }>()
type State = { status: 'idle' | 'sent' | 'pending' | 'verified' | 'not-configured'; code: string; error: string; requestId: string }
const states = ref<Record<string, State>>({}), working = ref(false), id = useId()
const activeEmail = ref(''), activeAction = ref<'request' | 'verify'>('request')
function recipientFields(fields: FormField[]): boolean { return fields.some(field => field.kind === 'recipients' || (field.kind === 'repeat' && recipientFields(field.fields || []))) }
const hasRecipientFields = computed(() => recipientFields(props.record.definition.fields))
const scope = computed(() => [props.record.id, props.record.templateId, props.record.templateVersion, props.capability].join(':'))
const recipients = computed(() => {
  try { return { emails: respondentRecipients(props.record.definition.fields, props.answers), error: '' } }
  catch (caught) { return { emails: [], error: (caught as Error).message } }
})
let alive = true
function syncAddresses(emails: string[]) {
  states.value = Object.fromEntries(emails.map(email => [email, states.value[email] || { status: 'idle', code: '', error: '', requestId: '' }]))
}
watch(scope, () => { states.value = {}; working.value = false; syncAddresses(recipients.value.emails) })
watch(() => recipients.value.emails, syncAddresses, { immediate: true })
onBeforeUnmount(() => { alive = false; states.value = {} })
async function approval(email: string, action: 'request' | 'verify') {
  const state = states.value[email]
  if (!state || props.disabled || working.value || state.status === 'verified' || props.record.status !== 'draft') return
  state.error = ''
  if (action === 'verify' && !/^\d{8}$/.test(state.code)) { state.error = 'Enter the eight-digit approval code.'; return }
  const selectedScope = scope.value, recordId = props.record.id, capability = props.capability
  const current = () => alive && scope.value === selectedScope && states.value[email] === state
  working.value = true; activeEmail.value = email; activeAction.value = action; emit('busy', true)
  try {
    if (!(await props.prepare())) {
      if (current()) state.error = 'Save the recipient addresses successfully before requesting or verifying a code.'
      return
    }
    if (!current()) return
    if (!respondentRecipients(props.record.definition.fields, props.record.answers).includes(email)) {
      state.error = 'Save this address in the recipient field first.'
      return
    }
    if (action === 'request') state.requestId ||= crypto.randomUUID()
    const result = await formApi<{ status: string; message?: string }>('publicFormRecipientVerification', {
      action, id: recordId, publicCapability: capability, email,
      ...(action === 'request' ? { requestId: state.requestId } : { code: state.code }),
    })
    if (!current()) return
    if (result.status === 'verified') { state.status = 'verified'; state.code = '' }
    else if (action === 'request' && result.status === 'sent') state.status = 'sent'
    else if (action === 'request' && ['sending', 'pending'].includes(result.status)) state.status = 'pending'
    else if (action === 'request' && result.status === 'not-configured') { state.status = 'not-configured'; state.code = '' }
    else if (action === 'request' && result.status === 'failed') { state.status = 'idle'; state.requestId = ''; state.error = 'The approval email could not be sent. Try again.' }
    else state.error = 'Approval was not confirmed. Try again.'
  } catch (caught) {
    if (!current()) return
    state.error = caught instanceof Error ? caught.message : 'Approval could not be confirmed. Try again.'
    // Keep the request ID on uncertain failures so retrying cannot send duplicate challenges.
    if (action === 'request' && /Verification email failed/.test(state.error)) state.requestId = ''
    if (action === 'verify' && /expired or unavailable/i.test(state.error)) { state.status = 'idle'; state.code = ''; state.requestId = '' }
  } finally {
    if (alive && scope.value === selectedScope) {
      working.value = false; activeEmail.value = ''; emit('busy', false)
      void nextTick(() => {
        if (!current()) return
        const index = recipients.value.emails.indexOf(email)
        const target = ['verified', 'not-configured'].includes(state.status) ? 'status' : state.status === 'sent' ? 'code' : ''
        if (target) document.getElementById(`${id}-${target}-${index}`)?.focus({ preventScroll: true })
      })
    }
  }
}
</script>
<template>
  <section v-if="hasRecipientFields" class="recipient-verification" aria-label="Additional recipient approval" :aria-busy="working">
    <h3>Approve additional recipients</h3>
    <p>Each additional address needs its recipient’s approval for this response. Unverified addresses receive no report email. Approval does not grant access to private entries or photos.</p>
    <p v-if="recipients.error" role="alert">{{ recipients.error }}</p>
    <p v-else-if="!recipients.emails.length">Enter additional recipient addresses in the form above.</p>
    <fieldset v-for="(email, index) in recipients.emails" :key="email" :disabled="disabled || working" :aria-describedby="`${id}-status-${index}`">
      <legend>{{ email }}</legend>
      <p :id="`${id}-status-${index}`" role="status" tabindex="-1">
        <template v-if="states[email]?.status === 'verified'">Approved for this response. Final delivery is checked again when submitted.</template>
        <template v-else-if="states[email]?.status === 'sent'">Ask the recipient for their current eight-digit approval code. Codes expire after 15 minutes.</template>
        <template v-else-if="states[email]?.status === 'pending'">The approval request is still pending. Check its status before entering a code.</template>
        <template v-else-if="states[email]?.status === 'not-configured'">Approval email is not enabled. You can submit your answers, but this unverified address will not receive the report.</template>
        <template v-else>Not approved.</template>
      </p>
      <AppButton v-if="states[email]?.status !== 'verified'" :disabled="states[email]?.status === 'not-configured'" :aria-label="'Request approval code for ' + email" @click="approval(email, 'request')">{{ working && activeEmail === email && activeAction === 'request' ? 'Requesting…' : states[email]?.status === 'pending' ? 'Check request' : states[email]?.status === 'sent' ? 'Check code request' : 'Request code' }}</AppButton>
      <template v-if="states[email]?.status === 'sent'">
        <label :for="`${id}-code-${index}`">Approval code<input :id="`${id}-code-${index}`" v-model.trim="states[email]!.code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{8}" maxlength="8" :aria-label="'Approval code for ' + email" :aria-invalid="!!states[email]?.error || undefined" :aria-describedby="`${id}-status-${index} ${id}-error-${index}`" @keydown.enter.prevent="approval(email, 'verify')" /></label>
        <AppButton :aria-label="'Verify approval code for ' + email" @click="approval(email, 'verify')">{{ working && activeEmail === email && activeAction === 'verify' ? 'Verifying…' : 'Verify code' }}</AppButton>
      </template>
      <p :id="`${id}-error-${index}`" :role="states[email]?.error ? 'alert' : undefined">{{ states[email]?.error }}</p>
    </fieldset>
  </section>
</template>
<style scoped>
.recipient-verification { display: grid; gap: .75rem; width: 100%; min-width: 0; }
h3, p { margin: 0; }
p { font-size: .9rem; overflow-wrap: anywhere; }
fieldset { display: grid; gap: .6rem; min-width: 0; margin: 0; padding: .75rem; border: 1px solid var(--border); border-radius: var(--radius-sm); }
legend { max-width: 100%; padding: 0 .25rem; box-sizing: border-box; overflow-wrap: anywhere; font-weight: 600; }
label { display: grid; gap: .35rem; }
input { box-sizing: border-box; width: 100%; max-width: 14rem; padding: .65rem; font: inherit; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); }
.app-button { width: fit-content; max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
</style>
