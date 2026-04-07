<script setup lang="ts">
import AppBadge from '@/components/common/AppBadge.vue'
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import BaseTableCellInput from '@/components/common/BaseTableCellInput.vue'

type ManpowerLine = {
  trade?: string
  areas?: string
  count?: number
  addedByUserId?: string
}

defineProps<{
  lines: ManpowerLine[]
  canEdit: boolean
  canDeleteLine: (line: ManpowerLine) => boolean
  isAdminLine: (line: ManpowerLine) => boolean
}>()

const emit = defineEmits<{
  (e: 'add-line'): void
  (e: 'remove-line', index: number): void
  (e: 'update-field', payload: { index: number; field: 'trade' | 'areas'; value: string }): void
  (e: 'update-count', payload: { index: number; value: number }): void
}>()

const handleFocus = (e: FocusEvent, line: ManpowerLine) => {
  const input = e.target as HTMLInputElement
  if (!line.count || line.count === 0) input.select()
}

const lineKeys = new WeakMap<ManpowerLine, string>()
let lineKeyCounter = 0

const getLineKey = (line: ManpowerLine, idx: number): string => {
  const existing = lineKeys.get(line)
  if (existing) return existing
  lineKeyCounter += 1
  const generated = `manpower-line-${lineKeyCounter}-${idx}`
  lineKeys.set(line, generated)
  return generated
}
</script>

<template>
  <AppSectionCard class="mb-4" title="Manpower" icon="bi bi-people">
      <div class="row g-3">
        <div class="col-12">
          <label class="form-label">Manpower</label>
          <div class="table-responsive">
            <table class="table table-sm table-striped table-hover mb-0 manpower-table">
              <thead>
                <tr>
                  <th class="small fw-semibold col-trade">Trade</th>
                  <th class="small fw-semibold text-center col-count">Count</th>
                  <th class="small fw-semibold col-areas">Areas</th>
                  <th class="text-center col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(ln, idx) in lines" :key="getLineKey(ln, idx)">
                  <td class="p-2">
                    <BaseTableCellInput
                      type="text"
                      input-class="manpower-input"
                      placeholder="Trade"
                      :model-value="ln.trade"
                      :disabled="!canEdit"
                      @update:model-value="emit('update-field', { index: idx, field: 'trade', value: $event })"
                    />
                  </td>
                  <td class="p-2">
                    <BaseTableCellInput
                      type="number"
                      inputmode="numeric"
                      min="1"
                      step="1"
                      input-class="text-center count-input"
                      placeholder="1"
                      :model-value="ln.count"
                      :disabled="!canEdit"
                      @update:model-value="emit('update-count', { index: idx, value: Number($event) })"
                      @focus="(e) => handleFocus(e, ln)"
                    />
                  </td>
                  <td class="p-2">
                    <div class="d-flex gap-2 align-items-center">
                      <BaseTableCellInput
                        type="text"
                        input-class="manpower-input"
                        placeholder="Areas (optional)"
                        :model-value="ln.areas"
                        :disabled="!canEdit"
                        @update:model-value="emit('update-field', { index: idx, field: 'areas', value: $event })"
                      />
                      <AppBadge v-if="isAdminLine(ln)" label="admin" variant-class="bg-info" class="flex-shrink-0" />
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
  </AppSectionCard>
</template>

<style scoped lang="scss">
.col-trade { width: 40%; }
.col-count { width: 20%; }
.col-areas { width: 35%; }
.col-actions { width: 5%; }

.manpower-table td {
  vertical-align: middle;
}

:deep(.count-input) {
  min-width: 90px;
}

@media (max-width: 768px) {
  :deep(.count-input) {
    min-width: 80px;
    font-size: 0.95rem;
  }

  .manpower-table td {
    padding: 0.35rem;
  }
}
</style>
