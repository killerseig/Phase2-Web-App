<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import AppStatusMessage from '@/components/common/AppStatusMessage.vue'
import { personalTimecardRequest, type PersonalTimecardResult } from '@/services/personalTimecard'
const props = defineProps<{ uid: string; actorUid: string; disabled?: boolean }>()
const status = ref<PersonalTimecardResult | null>(null), error = ref('')
let epoch = 0
watch(() => [props.uid, props.disabled], async () => {
  const current = ++epoch
  status.value = null; error.value = ''
  if (!props.uid || props.disabled) return
  try {
    const next = await personalTimecardRequest({ personalAction: 'link-status', accountUid: props.uid })
    if (current === epoch) status.value = next
  } catch (cause) { if (current === epoch) error.value = (cause as Error).message }
}, { immediate: true })
onBeforeUnmount(() => { epoch++ })
</script>
<template>
  <section class="personal-link" aria-label="Personal timecard account matching">
    <h3>My Timecard</h3>
    <p>Payroll is matched automatically when this account is saved. There is no separate employee selection.</p>
    <p v-if="status?.status === 'linked'">Linked to {{ status.employeeName }} ({{ status.employeeNumber }}).</p>
    <p v-else-if="status?.status === 'matched'">Matches {{ status.employeeName }} ({{ status.employeeNumber }}). The match is applied automatically when the account is saved.</p>
    <AppStatusMessage v-else-if="status?.status === 'ambiguous' || status?.status === 'conflict'" tone="warning" message="The payroll match is ambiguous or already linked to another account. Correct the account or payroll identity before access can be enabled." />
    <p v-else-if="status?.status === 'unmatched'">No unique payroll match was found. Check the account's first and last names against the employee record.</p>
    <p v-else-if="status?.status === 'not-enabled'">Choose an active Employee account for personal timecard access.</p>
    <AppStatusMessage v-if="error" tone="error" :message="error" />
  </section>
</template>
<style scoped>
.personal-link { display: grid; gap: .75rem; border-top: 1px solid var(--border); padding-top: 1rem; }
.personal-link h3, .personal-link p { margin: 0; }
.personal-link p { color: var(--text-muted); }
</style>
