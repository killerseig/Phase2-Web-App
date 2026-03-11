<script setup lang="ts">
import { computed } from 'vue'
import { useConfirmDialog } from '@/composables/useConfirmDialog'

type InputType = 'text' | 'email' | 'date' | 'number' | 'select' | 'textarea'

interface ColumnOption {
  label: string
  value: string | number
}

interface Column {
  key: string
  label: string
  width?: string
  hidden?: boolean
  editable?: boolean
  type?: InputType
  options?: ColumnOption[]
  placeholder?: string
  step?: number
  min?: number
  max?: number
  format?: (value: unknown) => string
}

interface Props {
  columns: Column[]
  rows: Record<string, unknown>[]
  editable?: boolean
  showAddButton?: boolean
  addButtonLabel?: string
  deleteConfirmMessage?: string
  emptyMessage?: string
  loading?: boolean
  striped?: boolean
  hover?: boolean
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  editable: true,
  showAddButton: true,
  addButtonLabel: 'Add Row',
  deleteConfirmMessage: 'Are you sure you want to delete this row?',
  emptyMessage: 'No data available',
  loading: false,
  striped: true,
  hover: true,
  compact: true,
})

const emit = defineEmits<{
  (e: 'add-row'): void
  (e: 'delete-row', rowIndex: number): void
  (e: 'update-row', rowIndex: number, row: Record<string, unknown>): void
}>()
const { confirm } = useConfirmDialog()

const visibleColumns = computed(() => props.columns.filter((col) => !col.hidden))

const tableClasses = computed(() =>
  [
    'table',
    'table-sm',
    props.striped && 'table-striped',
    props.hover && 'table-hover',
    'mb-0',
  ]
    .filter(Boolean)
    .join(' ')
)

const handleDelete = async (rowIndex: number) => {
  const confirmed = await confirm(props.deleteConfirmMessage, {
    title: 'Delete Row',
    confirmText: 'Delete',
    variant: 'danger',
  })
  if (!confirmed) return
  emit('delete-row', rowIndex)
}

const handleCellUpdate = (rowIndex: number, colKey: string, value: unknown) => {
  const updated = { ...props.rows[rowIndex], [colKey]: value }
  emit('update-row', rowIndex, updated)
}

const getInputType = (col: Column): InputType => col.type || 'text'

const getInputClasses = (): string =>
  ['form-control', props.compact ? 'form-control-sm' : ''].filter(Boolean).join(' ')

const onAddRow = () => emit('add-row')
</script>

<template>
  <div class="data-table-wrapper">
    <div v-if="loading" class="text-center py-3">
      <div class="spinner-border spinner-border-sm text-muted" />
    </div>

    <div v-else-if="!rows || rows.length === 0" class="text-center text-muted py-4 small">
      {{ emptyMessage }}
    </div>

    <div v-else class="table-responsive">
      <table :class="tableClasses">
        <thead>
          <tr>
            <th
              v-for="col in visibleColumns"
              :key="String(col.key)"
              :style="{ width: col.width }"
              class="small fw-semibold"
            >
              {{ col.label }}
            </th>
            <th v-if="editable" style="width: 50px;" class="text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIdx) in rows" :key="rowIdx">
            <td v-for="col in visibleColumns" :key="String(col.key)" :style="{ width: col.width }">
              <template v-if="editable && col.editable !== false">
                <input
                  v-if="['text', 'email', 'date'].includes(getInputType(col))"
                  :type="getInputType(col)"
                  :value="(row as any)[col.key]"
                  :placeholder="col.placeholder"
                  :class="`${getInputClasses()} text-center`"
                  @input="(e) => handleCellUpdate(rowIdx, col.key, (e.target as HTMLInputElement).value)"
                  @focus="(e) => (e.target as HTMLInputElement).select()"
                />

                <input
                  v-else-if="getInputType(col) === 'number'"
                  type="number"
                  :value="(row as any)[col.key]"
                  :placeholder="col.placeholder"
                  :step="col.step"
                  :min="col.min"
                  :max="col.max"
                  :class="`${getInputClasses()} text-center`"
                  @input="(e) => handleCellUpdate(rowIdx, col.key, Number((e.target as HTMLInputElement).value))"
                  @focus="(e) => (e.target as HTMLInputElement).select()"
                />

                <select
                  v-else-if="getInputType(col) === 'select'"
                  :value="(row as any)[col.key]"
                  :class="`${getInputClasses()} text-center`"
                  @input="(e) => handleCellUpdate(rowIdx, col.key, (e.target as HTMLSelectElement).value)"
                >
                  <option value="">Select...</option>
                  <option v-for="opt in col.options" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>

                <textarea
                  v-else-if="getInputType(col) === 'textarea'"
                  :value="(row as any)[col.key]"
                  :placeholder="col.placeholder"
                  rows="2"
                  :class="getInputClasses()"
                  @input="(e) => handleCellUpdate(rowIdx, col.key, (e.target as HTMLTextAreaElement).value)"
                ></textarea>
              </template>

              <template v-else>
                <span v-if="col.format">{{ col.format((row as any)[col.key]) }}</span>
                <span v-else>{{ (row as any)[col.key] }}</span>
              </template>
            </td>

            <td v-if="editable" class="text-center">
              <button
                type="button"
                class="btn btn-outline-danger btn-sm"
                title="Delete row"
                @click="handleDelete(rowIdx)"
              >
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="editable && showAddButton && rows && rows.length > 0" class="mt-2">
      <button type="button" class="btn btn-outline-primary btn-sm" @click="onAddRow">
        <i class="bi bi-plus-lg me-1"></i>{{ addButtonLabel }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.data-table-wrapper {
  width: 100%;
}

.table-responsive {
  border: 1px solid var(--border, $border-color);
  border-radius: 8px;
  overflow-x: auto;
  background: var(--surface, $surface);
  box-shadow: var(--shadow-sm, $box-shadow-sm);
}

.table {
  border-collapse: collapse;
}

.form-control,
.form-control-sm,
select {
  border-radius: 4px;
}

.form-control:focus,
.form-control-sm:focus,
select:focus {
  border-color: lighten($primary, 6%);
  box-shadow: 0 0 0 0.2rem rgba($primary, 0.25);
}
</style>
