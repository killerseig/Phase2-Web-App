<script setup lang="ts">
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppListCard from '@/components/common/AppListCard.vue'
import AppSelectableListItem from '@/components/common/AppSelectableListItem.vue'
import DailyLogStatusBadge from '@/components/dailyLogs/DailyLogStatusBadge.vue'
import type { DailyLog } from '@/services'

defineProps<{
  logs: DailyLog[]
  currentUserId?: string | null
  formatTimestamp: (ts?: unknown) => string
  title?: string
  selectedId?: string | null
  deleting?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'delete', id: string): void
}>()

const handleSelect = (id: string) => {
  emit('select', id)
}

const handleDelete = (event: MouseEvent, id: string) => {
  event.stopPropagation()
  emit('delete', id)
}
</script>

<template>
  <AppListCard
    class="mb-4"
    :title="title || 'Logs'"
    icon="bi bi-journal-text"
    :badge-label="logs.length"
    muted
  >
    <div v-if="logs.length" class="list-group list-group-flush">
      <AppSelectableListItem
        v-for="log in logs"
        :key="log.id"
        class="log-list-item d-flex justify-content-between align-items-start gap-3"
        :selected="log.id === selectedId"
        @activate="handleSelect(log.id)"
      >
        <div class="me-2">
          <div class="fw-semibold">{{ log.status === 'submitted' ? 'Submitted' : 'Draft' }}</div>
          <div class="app-selectable-list-meta small">{{ formatTimestamp(log.submittedAt || log.updatedAt || log.createdAt) || 'Time not available' }}</div>
        </div>
        <div class="d-flex flex-column align-items-end gap-2">
          <DailyLogStatusBadge :status="log.status" />
          <div class="d-flex align-items-center gap-2">
            <span v-if="log.uid === currentUserId" class="app-selectable-list-meta small">You</span>
            <button
              v-if="log.status === 'draft'"
              type="button"
              class="btn btn-sm btn-outline-danger log-delete-btn"
              :disabled="deleting"
              @click="handleDelete($event, log.id)"
            >
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </AppSelectableListItem>
    </div>
    <AppEmptyState
      v-else
      compact
      message="No logs for this date yet"
      message-class="small mb-0"
    />
  </AppListCard>
</template>
