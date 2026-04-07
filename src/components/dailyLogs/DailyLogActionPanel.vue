<script setup lang="ts">
import AppAlert from '@/components/common/AppAlert.vue'
import type { DailyLogStatus } from '@/services'

defineProps<{
  currentStatus: DailyLogStatus
  saving: boolean
  hasEmailRecipients: boolean
  hasSubmittedToday: boolean
  error?: string
}>()

const emit = defineEmits<{
  submit: []
  'send-email': []
}>()
</script>

<template>
  <div class="daily-log-action-panel">
    <AppAlert v-if="error" variant="danger" title="Error:" :message="error" />

    <div class="d-grid gap-2">
      <button
        v-if="currentStatus === 'draft'"
        type="button"
        class="btn btn-success"
        :disabled="saving"
        @click="emit('submit')"
      >
        <i class="bi bi-send me-2"></i>Submit
      </button>

      <AppAlert
        v-if="currentStatus !== 'draft' && hasSubmittedToday"
        variant="info"
        class="mb-0"
        icon="bi bi-info-circle"
        message="Daily log already submitted for today"
        body-class="small"
      />

      <button
        v-if="currentStatus === 'submitted' && hasEmailRecipients"
        type="button"
        class="btn btn-info"
        :disabled="saving"
        @click="emit('send-email')"
      >
        <i class="bi bi-envelope me-2"></i>Send Email
      </button>
    </div>
  </div>
</template>
