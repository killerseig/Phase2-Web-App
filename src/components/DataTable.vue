<script setup lang="ts">
/**
 * Standardized Data Table Component
 * Provides consistent behavior for all editable/display tables in the app
 */
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.data-table-wrapper {
  width: 100%;
}

.table-responsive {
  border: 1px solid $border-color;
  border-radius: 8px;
  overflow-x: auto;
  background: $surface;
  box-shadow: $box-shadow-sm;
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
  compact?: boolean
}

withDefaults(defineProps<Props>(), {
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
  update: [rowIndex: number, row: any]
}>()

const props = defineProps<Props>()

const visibleColumns = computed(() => props.columns.filter(col => !col.hidden))

const tableClasses = computed(() => [
  'table',
  'table-sm',
  props.striped && 'table-striped',
  props.hover && 'table-hover',
  'mb-0'
].filter(Boolean).join(' '))

const handleDelete = (rowIndex: number) => {
  if (confirm(props.deleteConfirmMessage)) {
    props.onDeleteRow?.(rowIndex)
  }
}

const handleCellUpdate = (rowIndex: number, colKey: string, value: any) => {
  const updated = { ...props.rows[rowIndex], [colKey]: value }
  props.onUpdateRow?.(rowIndex, updated)
}

const getInputType = (col: Column): string => col.type || 'text'

const getInputClasses = (): string => [
  'form-control',
  props.compact ? 'form-control-sm' : ''
].filter(Boolean).join(' ')

</script>

<template>
  <div class="data-table-wrapper">
    <!-- Loading State -->
    <div v-if="loading" class="text-center py-3">
      <div class="spinner-border spinner-border-sm text-muted"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!rows || rows.length === 0" class="text-center text-muted py-4 small">
      {{ emptyMessage }}
    </div>

    <!-- Table -->
    <div v-else class="table-responsive">
      <table :class="tableClasses">
        <thead>
          <tr>
            <th v-for="col in visibleColumns" :key="String(col.key)" :style="{ width: col.width }" class="small fw-semibold">
              {{ col.label }}
            </th>
            <th v-if="editable" style="width: 50px;" class="text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIdx) in rows" :key="rowIdx">
            <td v-for="col in visibleColumns" :key="String(col.key)" :style="{ width: col.width }">
              <!-- Editable Cell -->
              <template v-if="editable && col.editable !== false">
                <!-- Text/Email/Date Input -->
                <input
                  v-if="['text', 'email', 'date'].includes(getInputType(col))"
                  :type="getInputType(col)"
                  :value="row[col.key]"
                  :placeholder="col.placeholder"
                  :class="`${getInputClasses()} text-center`"
                  @input="(e) => handleCellUpdate(rowIdx, col.key, (e.target as HTMLInputElement).value)"
                  @focus="(e) => (e.target as HTMLInputElement).select()"
                />
                
                <!-- Number Input -->
                <input
                  v-else-if="getInputType(col) === 'number'"
                  type="number"
                  :value="row[col.key]"
                  :placeholder="col.placeholder"
                  :step="col.step"
                  :min="col.min"
                  :max="col.max"
                  :class="`${getInputClasses()} text-center`"
                  @input="(e) => handleCellUpdate(rowIdx, col.key, Number((e.target as HTMLInputElement).value))"
                  @focus="(e) => (e.target as HTMLInputElement).select()"
                />
                
                <!-- Select -->
                <select
                  v-else-if="getInputType(col) === 'select'"
                  :value="row[col.key]"
                  :class="`${getInputClasses()} text-center`"
                  @input="(e) => handleCellUpdate(rowIdx, col.key, (e.target as HTMLSelectElement).value)"
                >
                  <option value="">Select...</option>
                  <option v-for="opt in col.options" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
                
                <!-- Textarea -->
                <textarea
                  v-else-if="getInputType(col) === 'textarea'"
                  :value="row[col.key]"
                  :placeholder="col.placeholder"
                  rows="2"
                  :class="getInputClasses()"
                  @input="(e) => handleCellUpdate(rowIdx, col.key, (e.target as HTMLTextAreaElement).value)"
                ></textarea>
              </template>

              <!-- Display Cell -->
              <template v-else>
                <span v-if="col.format">{{ col.format(row[col.key]) }}</span>
                <span v-else>{{ row[col.key] }}</span>
              </template>
            </td>

            <!-- Actions Column -->
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

    <!-- Add Button -->
    <div v-if="editable && showAddButton && rows && rows.length > 0" class="mt-2">
      <button
        type="button"
        class="btn btn-outline-primary btn-sm"
        @click="onAddRow"
      >
        <i class="bi bi-plus-lg me-1"></i>{{ addButtonLabel }}
      </button>
    </div>
  </div>
.table-responsive {
  border: 1px solid $border-color;
  border-radius: 8px;
  overflow-x: auto;
  background: $surface;
  box-shadow: $box-shadow-sm;
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

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;
.data-table-wrapper {
  width: 100%;
}
</style>
