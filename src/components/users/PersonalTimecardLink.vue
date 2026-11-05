<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import AppField from '@/components/common/AppField.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import AppStatusMessage from '@/components/common/AppStatusMessage.vue'
import { subscribeEmployees } from '@/services/employees'
import {
  confirmPersonalTimecardLink,
  subscribePersonalTimecardLink,
} from '@/services/personalTimecard'
import type { EmployeeRecord } from '@/types/domain'
const props = defineProps<{ uid: string; actorUid: string; disabled?: boolean }>()
const employees = ref<EmployeeRecord[]>([]),
  selected = ref(''),
  baseline = ref(''),
  error = ref(''),
  success = ref(''),
  busy = ref(false),
  loading = ref(true)
let epoch = 0,
  stopLink: (() => void) | undefined
const stopEmployees = subscribeEmployees(
  (rows) => {
    employees.value = rows.filter((e) => e.active)
  },
  (cause) => {
    error.value = String(cause)
  },
)
watch(
  () => props.uid,
  (uid) => {
    const current = ++epoch
    stopLink?.()
    selected.value = ''
    baseline.value = ''
    error.value = ''
    success.value = ''
    loading.value = true
    stopLink = subscribePersonalTimecardLink(
      uid,
      (id) => {
        if (current !== epoch) return
        selected.value = id
        baseline.value = id
        loading.value = false
      },
      (cause) => {
        if (current === epoch) {
          error.value = String(cause)
          loading.value = false
        }
      },
    )
  },
  { immediate: true },
)
async function save() {
  if (props.disabled || busy.value || loading.value) return
  busy.value = true
  error.value = ''
  success.value = ''
  const current = epoch
  try {
    await confirmPersonalTimecardLink(props.actorUid, props.uid, selected.value)
    if (current === epoch) {
      baseline.value = selected.value
      success.value = 'Payroll employee link confirmed. Role activation is separate.'
    }
  } catch (cause) {
    if (current === epoch) error.value = (cause as Error).message
  } finally {
    busy.value = false
  }
}
onBeforeUnmount(() => {
  epoch++
  stopLink?.()
  stopEmployees()
})
</script>
<template>
  <section class="personal-link" aria-label="Personal timecard employee link">
    <h3>My Timecard employee link</h3>
    <p>
      Confirm the payroll employee for this account. Names are never matched automatically. This
      does not enable a role or submit payroll.
    </p>
    <p v-if="disabled">
      Wait for account changes to finish saving before confirming the employee link.
    </p>
    <AppField label="Payroll employee"
      ><AppSelect v-model="selected" :disabled="disabled || busy || loading"
        ><option value="">Not linked</option>
        <option v-for="employee in employees" :key="employee.id" :value="employee.id">
          {{ employee.lastName }}, {{ employee.firstName }} · {{ employee.employeeNumber }}
        </option></AppSelect
      ></AppField
    >
    <AppButton :disabled="disabled || busy || loading || selected === baseline" @click="save">{{
      busy ? 'Saving…' : 'Confirm employee link'
    }}</AppButton>
    <AppStatusMessage v-if="error" tone="error" :message="error" /><AppStatusMessage
      v-if="success"
      tone="success"
      :message="success"
    />
  </section>
</template>
<style scoped>
.personal-link {
  display: grid;
  gap: 0.75rem;
  border-top: 1px solid var(--border);
  padding-top: 1rem;
}
.personal-link h3,
.personal-link p {
  margin: 0;
}
.personal-link p {
  color: var(--text-muted);
}
.personal-link .app-button {
  justify-self: start;
}
</style>
