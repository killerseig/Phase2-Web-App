<script setup lang="ts">
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

const handleKeySelect = (event: KeyboardEvent, id: string) => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  handleSelect(id)
}
</script>

<template>
  <div class="card mb-4 panel-muted app-list-card">
    <div class="card-header panel-header d-flex align-items-center justify-content-between">
      <h5 class="mb-0"><i class="bi bi-journal-text me-2"></i>{{ title || 'Logs' }}</h5>
      <span class="badge app-badge-pill app-badge-pill--sm text-bg-secondary">{{ logs.length }}</span>
    </div>
    <div class="card-body p-0">
      <div v-if="logs.length" class="list-group list-group-flush">
        <div
          v-for="log in logs"
          :key="log.id"
          role="button"
          tabindex="0"
          :class="[
            'list-group-item list-group-item-action d-flex justify-content-between align-items-start log-list-item',
            log.id === selectedId ? 'log-list-item-active' : ''
          ]"
          @click="handleSelect(log.id)"
          @keydown="handleKeySelect($event, log.id)"
        >
          <div class="me-2">
            <div class="fw-semibold">{{ log.status === 'submitted' ? 'Submitted' : 'Draft' }}</div>
            <div class="log-list-meta small">{{ formatTimestamp(log.submittedAt || log.updatedAt || log.createdAt) || 'Time not available' }}</div>
          </div>
          <div class="d-flex flex-column align-items-end gap-2">
            <span :class="['badge', 'app-badge-pill', 'app-badge-pill--sm', log.status === 'submitted' ? 'text-bg-success' : 'text-bg-warning']">{{ log.status }}</span>
            <div class="d-flex align-items-center gap-2">
              <span v-if="log.uid === currentUserId" class="log-list-meta small">You</span>
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
        </div>
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

.log-list-meta {
  color: $text-muted;
}

.list-group-item.log-list-item-active {
  background: linear-gradient(135deg, mix($primary, $surface, 20%), mix($primary, $surface, 28%));
  border-color: mix($primary, $border-color, 55%);
  box-shadow: 0 0 0 1px rgba($primary, 0.35);
  color: $body-color;
}

.list-group-item.log-list-item-active .badge {
  background-color: rgba($primary, 0.2);
  color: $body-color;
  border: 1px solid rgba($primary, 0.35);
}

.list-group-item.log-list-item-active .log-list-meta {
  color: lighten($text-muted, 12%);
}

.log-list-item:active {
  background-color: mix($primary, $surface, 16%);
}

.log-delete-btn {
  line-height: 1;
  padding: 0.2rem 0.4rem;
}
</style>
