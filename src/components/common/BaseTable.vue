<script setup lang="ts">
import { computed } from 'vue'

type Align = 'start' | 'center' | 'end'

type Column = {
  key: string
  label: string
  sortable?: boolean
  width?: string
  align?: Align
  slot?: string
}

type SortDir = 'asc' | 'desc'

const props = defineProps<{
  rows: any[]
  columns: Column[]
  rowKey?: string
  striped?: boolean
  hover?: boolean
  small?: boolean
  sortKey?: string
  sortDir?: SortDir
  tableClass?: string | string[]
}>()

const emit = defineEmits<{
  'update:sortKey': [key: string]
  'update:sortDir': [dir: SortDir]
  'sort-change': [payload: { sortKey: string; sortDir: SortDir }]
}>()

const normalizeClasses = (cls?: string | string[]) => {
  if (!cls) return []
  if (Array.isArray(cls)) return cls.filter(Boolean)
  return cls
    .split(' ')
    .map(part => part.trim())
    .filter(Boolean)
}

const tableClasses = computed(() => [
  'table',
  props.striped !== false ? 'table-striped' : '',
  props.hover !== false ? 'table-hover' : '',
  props.small !== false ? 'table-sm' : '',
  'table-striped',
  'table-hover',
  'table-sm',
  'table-dark',
  ...normalizeClasses(props.tableClass),
].filter(Boolean).join(' '))

const alignClass = (align?: Align) => {
  if (align === 'center') return 'text-center'
  if (align === 'end') return 'text-end'
  return 'text-start'
}

const currentSortKey = computed(() => props.sortKey || '')
const currentSortDir = computed<SortDir>(() => props.sortDir || 'asc')

function toggleSort(col: Column) {
  if (!col.sortable) return
  const nextKey = col.key
  const nextDir: SortDir = currentSortKey.value === col.key && currentSortDir.value === 'asc' ? 'desc' : 'asc'
  emit('update:sortKey', nextKey)
  emit('update:sortDir', nextDir)
  emit('sort-change', { sortKey: nextKey, sortDir: nextDir })
}

function isSorted(col: Column) {
  return currentSortKey.value === col.key
}

function sortIcon(col: Column) {
  if (!isSorted(col)) return 'bi bi-arrow-down-up text-muted'
  return currentSortDir.value === 'asc' ? 'bi bi-sort-down-alt' : 'bi bi-sort-up'
}

function rowId(row: any, index: number) {
  if (props.rowKey && row && row[props.rowKey] !== undefined) return row[props.rowKey]
  if (row && row.id !== undefined) return row.id
  return index
}

function cellValue(row: any, key: string) {
  return row ? row[key] : undefined
}
</script>

<template>
  <div class="table-responsive">
    <table :class="tableClasses">
      <colgroup v-if="columns.some(c => c.width)">
        <col v-for="col in columns" :key="col.key" :style="col.width ? { width: col.width } : undefined" />
      </colgroup>
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.key" :class="alignClass(col.align)">
            <button
              v-if="col.sortable"
              type="button"
              class="table-sort-trigger d-inline-flex align-items-center gap-1"
              @click="toggleSort(col)"
            >
              <span>
                <slot :name="`header-${col.key}`" :column="col">{{ col.label }}</slot>
              </span>
              <i :class="sortIcon(col)"></i>
            </button>
            <template v-else>
              <slot :name="`header-${col.key}`" :column="col">{{ col.label }}</slot>
            </template>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIndex) in rows" :key="rowId(row, rowIndex)">
          <td v-for="col in columns" :key="col.key" :class="alignClass(col.align)">
            <slot
              v-if="col.slot"
              :name="col.slot"
              :row="row"
              :value="cellValue(row, col.key)"
              :column="col"
              :row-index="rowIndex"
            />
            <slot
              v-else-if="$slots[`cell-${col.key}`]"
              :name="`cell-${col.key}`"
              :row="row"
              :value="cellValue(row, col.key)"
              :column="col"
              :row-index="rowIndex"
            />
            <template v-else>
              {{ cellValue(row, col.key) ?? '—' }}
            </template>
          </td>
        </tr>
        <tr v-if="rows.length === 0">
          <td :colspan="columns.length" class="text-center text-muted small py-3">
            <slot name="empty">No records found.</slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
