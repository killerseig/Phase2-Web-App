<script setup lang="ts">
import { computed, ref } from 'vue'

interface Column {
  key: string
  label: string
  sortable?: boolean
  class?: string
  format?: (value: any) => string
}

interface Props {
  items: any[]
  columns: Column[]
  searchable?: boolean
  searchFields?: string[]
  searchPlaceholder?: string
  showActions?: boolean
  loading?: boolean
  emptyMessage?: string
}

interface Emits {
  edit: [item: any]
  delete: [item: any]
}

const props = withDefaults(defineProps<Props>(), {
  searchable: true,
  searchFields: () => ['name', 'title'],
  searchPlaceholder: 'Search...',
  showActions: true,
  loading: false,
  emptyMessage: 'No items found',
})

const emit = defineEmits<Emits>()

const searchQuery = ref('')
const sortKey = ref<string | null>(null)
const sortOrder = ref<'asc' | 'desc'>('asc')

const filteredItems = computed(() => {
  let result = [...props.items]

  // Filter by search
  if (props.searchable && searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(item =>
      props.searchFields.some(field => {
        const value = item[field]
        return value && String(value).toLowerCase().includes(query)
      })
    )
  }

  // Sort
  if (sortKey.value) {
    result.sort((a, b) => {
      const aVal = a[sortKey.value!]
      const bVal = b[sortKey.value!]

      if (aVal < bVal) return sortOrder.value === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder.value === 'asc' ? 1 : -1
      return 0
    })
  }

  return result
})

function toggleSort(key: string) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'asc'
  }
}

function getCellValue(item: any, key: string) {
  const column = props.columns.find(c => c.key === key)
  const value = item[key]
  return column?.format ? column.format(value) : value
}
</script>

<template>
  <div>
    <!-- Search Bar -->
    <div v-if="searchable" class="mb-3">
      <input
        type="text"
        class="form-control"
        :placeholder="searchPlaceholder"
        v-model="searchQuery"
      />
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading…</span>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredItems.length === 0" class="alert alert-info text-center mb-0">
      {{ emptyMessage }}
    </div>

    <!-- Table -->
    <div v-else class="table-responsive">
      <table class="table table-sm table-striped table-hover mb-0">
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              @click="column.sortable && toggleSort(column.key)"
              :class="[column.class, column.sortable && 'cursor-pointer', 'small fw-semibold']"
            >
              <div class="d-flex align-items-center gap-1">
                {{ column.label }}
                <i
                  v-if="column.sortable && sortKey === column.key"
                  :class="`bi bi-arrow-${sortOrder === 'asc' ? 'up' : 'down'}`"
                ></i>
              </div>
            </th>
            <th v-if="showActions" style="width: 100px;" class="small fw-semibold text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filteredItems" :key="item.id">
            <td v-for="column in columns" :key="column.key" :class="[column.class, 'p-2']">
              {{ getCellValue(item, column.key) }}
            </td>
            <td v-if="showActions" class="p-2 text-center">
              <button
                type="button"
                class="btn btn-sm btn-outline-primary me-1"
                @click="emit('edit', item)"
                title="Edit"
              >
                <i class="bi bi-pencil"></i>
              </button>
              <button
                type="button"
                class="btn btn-sm btn-outline-danger"
                @click="emit('delete', item)"
                title="Delete"
              >
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.cursor-pointer {
  cursor: pointer;
  user-select: none;
}

.table-responsive {
  border: 1px solid $border-color;
  border-radius: 8px;
  background: $surface;
  box-shadow: $box-shadow-sm;
}
</style>
