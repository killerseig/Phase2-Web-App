<script setup lang="ts">
import DailyLogHistoryList from '@/components/dailyLogs/DailyLogHistoryList.vue'
import DailyLogRecipientsCard from '@/components/dailyLogs/DailyLogRecipientsCard.vue'
import DailyLogSelectedLogCard from '@/components/dailyLogs/DailyLogSelectedLogCard.vue'
import type { DailyLogRecord } from '@/types/domain'

const props = defineProps<{
  additionalRecipients: readonly string[]
  adminRecipients: readonly string[]
  canEditSelectedLog: boolean
  deletingDraft: boolean
  logs: DailyLogRecord[]
  logsLoading: boolean
  recipientInput: string
  recipientSaving: boolean
  selectedDate: string
  selectedDateIsToday: boolean
  selectedLog: DailyLogRecord | null
  selectedLogId: string | null
}>()

const emit = defineEmits<{
  addRecipient: []
  deleteSelectedLog: []
  removeRecipient: [email: string]
  selectLog: [logId: string]
  today: []
  'update:recipientInput': [value: string]
  'update:selectedDate': [value: string]
}>()
</script>

<template>
  <aside class="daily-logs-sidebar">
    <DailyLogSelectedLogCard
      :can-edit="props.canEditSelectedLog"
      :deleting="props.deletingDraft"
      :selected-log="props.selectedLog"
      @delete="emit('deleteSelectedLog')"
    />

    <DailyLogRecipientsCard
      v-if="props.selectedLog"
      :model-value="props.recipientInput"
      :admin-recipients="props.adminRecipients"
      :additional-recipients="props.additionalRecipients"
      :can-edit="props.canEditSelectedLog"
      :saving="props.recipientSaving"
      @update:model-value="emit('update:recipientInput', $event)"
      @add="emit('addRecipient')"
      @remove="emit('removeRecipient', $event)"
    />

    <DailyLogHistoryList
      :selected-date="props.selectedDate"
      :loading="props.logsLoading"
      :logs="props.logs"
      :selected-date-is-today="props.selectedDateIsToday"
      :selected-log-id="props.selectedLogId"
      @update:selected-date="emit('update:selectedDate', $event)"
      @select="emit('selectLog', $event)"
      @today="emit('today')"
    />
  </aside>
</template>

<style scoped>
.daily-logs-sidebar {
  display: grid;
  gap: 1rem;
  align-content: start;
  min-height: 0;
}
</style>
