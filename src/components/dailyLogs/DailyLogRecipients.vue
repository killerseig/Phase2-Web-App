<script setup lang="ts">
import EmailRecipientInput from '@/components/common/EmailRecipientInput.vue'

const props = defineProps<{
  recipients: string[]
  globalRecipients?: string[]
  saving: boolean
}>()

const emit = defineEmits<{
  (e: 'add', email: string): void
  (e: 'remove', email: string): void
}>()
</script>

<template>
  <div class="card mb-4 panel-muted app-section-card">
    <div class="card-header panel-header"><h5 class="mb-0"><i class="bi bi-envelope me-2"></i>Email Recipients</h5></div>
    <div class="card-body">
      <EmailRecipientInput
        :emails="props.recipients"
        label="Job-specific recipients"
        placeholder="Enter email"
        input-name="daily-log-recipient"
        autocomplete-section="daily-log-recipient"
        :disabled="props.saving"
        empty-text="No job-specific recipients yet"
        :read-only-emails="props.globalRecipients ?? []"
        read-only-label="Global defaults (read-only)"
        read-only-badge-label="Global"
        @add="(email) => emit('add', email)"
        @remove="(email) => emit('remove', email)"
      />
    </div>
  </div>
</template>
