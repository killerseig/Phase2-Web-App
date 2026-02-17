<script setup lang="ts">
import type { DailyLog } from '@/services'

const props = defineProps<{
  logs: DailyLog[]
  currentUserId?: string | null
  onSelect?: (id: string) => void
  formatTimestamp: (ts?: any) => string
  title?: string
  selectedId?: string | null
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
          :class="[
            'list-group-item list-group-item-action d-flex justify-content-between align-items-start log-list-item',
            log.id === props.selectedId ? 'log-list-item-active' : ''
          ]"
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

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.log-list-item {
  background-color: $surface;
  color: $body-color;
  border-color: rgba($border-color, 0.6);
  transition: background-color 0.15s ease, border-color 0.15s ease;

  &:hover {
    background-color: mix($primary, $surface, 12%);
  }

  &:focus-visible {
    outline: 2px solid $primary;
    outline-offset: -4px;
  }
}

.log-list-item-active {
  background: linear-gradient(135deg, mix($primary, $surface, 20%), mix($primary, $surface, 28%));
  border-color: mix($primary, $border-color, 55%);
  box-shadow: 0 0 0 1px rgba($primary, 0.35);
  color: $body-color !important;
}

.log-list-item-active .badge {
  background-color: rgba($primary, 0.2);
  color: $body-color;
  border: 1px solid rgba($primary, 0.35);
}

.log-list-item-active .text-muted {
  color: lighten($text-muted-2, 12%) !important;
}

.log-list-item:active {
  background-color: mix($primary, $surface, 16%);
}
</style>
