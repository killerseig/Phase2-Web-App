<script setup lang="ts">
const props = defineProps<{
  lines: any[]
  canEdit: boolean
  canDeleteLine: (line: any) => boolean
  isAdminLine: (line: any) => boolean
}>()

const emit = defineEmits<{
  (e: 'add-line'): void
  (e: 'remove-line', index: number): void
  (e: 'update-field', payload: { index: number; field: 'trade' | 'areas'; value: string }): void
  (e: 'update-count', payload: { index: number; value: number }): void
}>()

const handleFocus = (e: FocusEvent, line: any) => {
  const input = e.target as HTMLInputElement
  if (!line.count || line.count === 0) input.select()
}
</script>

<template>
  <div class="card mb-4">
    <div class="card-header bg-light"><h5 class="mb-0"><i class="bi bi-people me-2"></i>Manpower</h5></div>
    <div class="card-body">
      <div class="row g-3">
        <div class="col-12">
          <label class="form-label">Manpower</label>
          <div class="table-responsive">
            <table class="table table-sm table-dark table-striped table-hover mb-0 manpower-table">
              <thead>
                <tr>
                  <th class="small fw-semibold col-trade">Trade</th>
                  <th class="small fw-semibold text-center col-count">Count</th>
                  <th class="small fw-semibold col-areas">Areas</th>
                  <th class="text-center col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(ln, idx) in lines" :key="idx">
                  <td class="p-2">
                    <input
                      type="text"
                      class="form-control form-control-sm"
                      placeholder="Trade"
                      :value="(ln as any).trade"
                      :disabled="!canEdit"
                      @input="emit('update-field', { index: idx, field: 'trade', value: ($event.target as HTMLInputElement).value })"
                    />
                  </td>
                  <td class="p-2">
                    <input
                      type="number"
                      inputmode="numeric"
                      min="1"
                      step="1"
                      class="form-control form-control-sm text-center count-input"
                      placeholder="1"
                      :value="(ln as any).count"
                      :disabled="!canEdit"
                      @input="emit('update-count', { index: idx, value: Number(($event.target as HTMLInputElement).value) })"
                      @focus="(e) => handleFocus(e, ln)"
                    />
                  </td>
                  <td class="p-2">
                    <div class="d-flex gap-2 align-items-center">
                      <input
                        type="text"
                        class="form-control form-control-sm"
                        placeholder="Areas (optional)"
                        :value="(ln as any).areas"
                        :disabled="!canEdit"
                        @input="emit('update-field', { index: idx, field: 'areas', value: ($event.target as HTMLInputElement).value })"
                      />
                      <span v-if="isAdminLine(ln)" class="badge bg-info flex-shrink-0 badge-admin">admin</span>
                    </div>
                  </td>
                  <td class="p-2 text-center">
                    <button
                      v-if="idx > 0 && canDeleteLine(ln)"
                      type="button"
                      class="btn btn-outline-danger btn-sm"
                      :disabled="!canEdit"
                      @click="emit('remove-line', idx)"
                      title="Delete row"
                    >
                      <i class="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <button type="button" class="btn btn-outline-primary btn-sm mt-2" :disabled="!canEdit" @click="emit('add-line')">
            <i class="bi bi-plus-lg me-1"></i>Add Trade
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
