<script setup lang="ts">
import type {
  ControllerSortKey,
  ControllerSortOption,
} from '@/components/controller/controllerTypes'

defineOptions({
  name: 'ControllerResultsToolbar',
})

interface Props {
  activeFilterSummary: string
  currentSortLabel: string
  refreshing: boolean
  sortOptions: ControllerSortOption[]
  sortKey: ControllerSortKey
  sortDir: 'asc' | 'desc'
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:sortKey': [value: ControllerSortKey]
  'toggle-direction': []
}>()

function handleSortKeyChange(event: Event) {
  emit('update:sortKey', String((event.target as HTMLSelectElement)?.value || 'weekEnding') as ControllerSortKey)
}
</script>

<template>
  <div class="controller-results-meta mb-3">
    <div>
      <div class="small text-muted">Active filters</div>
      <div class="fw-semibold">{{ activeFilterSummary }}</div>
      <div class="small text-muted">
        Sorted by {{ currentSortLabel }}
        <span v-if="refreshing"> | Updating...</span>
      </div>
    </div>

    <div class="controller-sort-controls">
      <div class="controller-sort-controls__field">
        <label class="form-label small text-muted mb-1">Sort by</label>
        <select class="form-select form-select-sm" :value="sortKey" @change="handleSortKeyChange">
          <option v-for="option in props.sortOptions" :key="option.key" :value="option.key">
            {{ option.label }}
          </option>
        </select>
      </div>

      <button
        type="button"
        class="btn btn-outline-secondary btn-sm controller-sort-controls__toggle"
        @click="emit('toggle-direction')"
      >
        <i :class="sortDir === 'asc' ? 'bi bi-sort-down me-2' : 'bi bi-sort-down-alt me-2'"></i>
        {{ sortDir === 'asc' ? 'Ascending' : 'Descending' }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.controller-results-meta {
  align-items: end;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
  justify-content: space-between;
}

.controller-sort-controls {
  align-items: end;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.controller-sort-controls__field {
  min-width: 190px;
}

.controller-sort-controls__toggle {
  min-width: 124px;
}

@media (max-width: 575px) {
  .controller-sort-controls {
    width: 100%;
  }

  .controller-sort-controls__field,
  .controller-sort-controls__toggle {
    width: 100%;
  }
}
</style>
