<script setup lang="ts">
import AppSectionCard from '@/components/common/AppSectionCard.vue'
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
