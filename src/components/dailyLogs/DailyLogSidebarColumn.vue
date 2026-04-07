<script setup lang="ts">
import DailyLogList from '@/components/dailyLogs/DailyLogList.vue'
import DailyLogRecipients from '@/components/dailyLogs/DailyLogRecipients.vue'
import type { DailyLog } from '@/services'

defineProps<{
  logDate: string
  logs: DailyLog[]
  currentUserId?: string | null
  formatTimestamp: (value?: unknown) => string
  selectedId?: string | null
  saving: boolean
  recipients: string[]
  globalRecipients: string[]
  savingRecipients: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  delete: [id: string]
  'add-recipient': [email: string]
  'remove-recipient': [email: string]
}>()
</script>

<template>
  <div class="daily-log-sidebar-column">
    <DailyLogList
      :title="`Logs for ${logDate}`"
      :logs="logs"
      :current-user-id="currentUserId || null"
      :format-timestamp="formatTimestamp"
      :selected-id="selectedId"
      :deleting="saving"
      @select="(id) => emit('select', id)"
      @delete="(id) => emit('delete', id)"
    />

    <DailyLogRecipients
      :recipients="recipients"
      :global-recipients="globalRecipients"
      :saving="savingRecipients"
      @add="(email) => emit('add-recipient', email)"
      @remove="(email) => emit('remove-recipient', email)"
    />
  </div>
</template>
