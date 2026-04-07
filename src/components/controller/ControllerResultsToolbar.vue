<script setup lang="ts">
import { computed } from 'vue'
import AppToolbarMeta from '@/components/common/AppToolbarMeta.vue'
import BaseSelectField from '@/components/common/BaseSelectField.vue'
import type {
  ControllerSortKey,
  ControllerSortOption,
} from '@/types/controller'

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

const sortFieldOptions = computed(() =>
  props.sortOptions.map((option) => ({
    value: option.key,
    label: option.label,
  })),
)
</script>

<template>
  <div class="app-toolbar-split mb-3">
    <AppToolbarMeta
      eyebrow="Active filters"
      :title="activeFilterSummary"
      :subtitle="`Sorted by ${currentSortLabel}${refreshing ? ' | Updating...' : ''}`"
      title-tag="div"
      title-class="fw-semibold"
    />

    <div class="app-toolbar-controls app-toolbar-controls--end">
      <div class="app-toolbar-controls__field">
        <BaseSelectField
          :model-value="sortKey"
          :options="sortFieldOptions"
          label="Sort by"
          label-class="form-label small text-muted mb-1"
          select-class="form-select form-select-sm"
          wrapper-class="mb-0"
          @update:model-value="emit('update:sortKey', $event as ControllerSortKey)"
        />
      </div>

      <button
        type="button"
        class="btn btn-outline-secondary btn-sm app-toolbar-controls__toggle"
        @click="emit('toggle-direction')"
      >
        <i :class="sortDir === 'asc' ? 'bi bi-sort-down me-2' : 'bi bi-sort-down-alt me-2'"></i>
        {{ sortDir === 'asc' ? 'Ascending' : 'Descending' }}
      </button>
    </div>
  </div>
</template>
