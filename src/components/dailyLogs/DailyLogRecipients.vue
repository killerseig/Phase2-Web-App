<script setup lang="ts">
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import AppAlert from '@/components/common/AppAlert.vue'
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
  <AppSectionCard title="Email Recipients" icon="bi bi-envelope" class="mb-4 panel-muted">
      <AppAlert
        v-if="!props.recipients.length && (props.globalRecipients?.length ?? 0) > 0"
        variant="info"
        class="mb-3"
        icon="bi bi-info-circle"
        message="Only the global recipient list will receive this daily log right now. Add a job-specific recipient if someone on this job needs a copy."
      />

      <AppAlert
        v-else-if="!props.recipients.length"
        variant="warning"
        class="mb-3"
        icon="bi bi-exclamation-triangle"
        message="No daily log recipients are configured yet. Add a job-specific recipient here or ask an admin to set a global default list."
      />

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
  </AppSectionCard>
</template>
