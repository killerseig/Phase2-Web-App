<script setup lang="ts">
import type { DailyLog } from '@/services'

const props = defineProps<{
  logs: DailyLog[]
  currentUserId?: string | null
  onSelect?: (id: string) => void
  formatTimestamp: (ts?: any) => string
  title?: string
}>()

const emit = defineEmits<{ (e: 'select', id: string): void }>()

const handleSelect = (id: string) => {
  emit('select', id)
  props.onSelect?.(id)
}
</script>

<template>
  <div class="card mb-4 panel-muted">
    <div class="card-header bg-light d-flex align-items-center justify-content-between">
      <h5 class="mb-0"><i class="bi bi-journal-text me-2"></i>{{ title || 'Logs' }}</h5>
      <span class="badge text-bg-secondary">{{ logs.length }}</span>
    </div>
    <div class="card-body p-0">
      <div v-if="logs.length" class="list-group list-group-flush">
        <button
          v-for="log in logs"
          :key="log.id"
          type="button"
          class="list-group-item list-group-item-action d-flex justify-content-between align-items-start"
          @click="handleSelect(log.id)"
        >
          <div class="me-2">
            <div class="fw-semibold">{{ log.status === 'submitted' ? 'Submitted' : 'Draft' }}</div>
            <div class="text-muted small">{{ formatTimestamp(log.submittedAt || log.updatedAt || log.createdAt) || 'Time not available' }}</div>
          </div>
          <div class="d-flex flex-column align-items-end">
            <span :class="['badge', log.status === 'submitted' ? 'text-bg-success' : 'text-bg-warning']">{{ log.status }}</span>
            <span v-if="log.uid === currentUserId" class="text-muted small mt-1">You</span>
          </div>
        </button>
      </div>
      <div v-else class="text-muted small text-center py-3">No logs for this date yet</div>
    </div>
  </div>
</template>
