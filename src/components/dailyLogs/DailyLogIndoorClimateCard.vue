<script setup lang="ts">
import type { IndoorClimateReading } from '@/types/documents'

const props = defineProps<{
  readings: IndoorClimateReading[] | undefined
  canEdit: boolean
}>()

const emit = defineEmits<{
  (e: 'add-reading'): void
  (e: 'remove-reading', index: number): void
  (e: 'update-field', payload: {
    index: number
    field: 'area' | 'high' | 'low' | 'humidity'
    value: string
  }): void
}>()

const indoorClimateKeys = new WeakMap<Record<string, unknown>, string>()
let indoorClimateKeyCounter = 0

function indoorClimateKey(reading: unknown, idx: number): string {
  if (!reading || typeof reading !== 'object') return `indoor-climate-${idx}`
  const record = reading as Record<string, unknown>
  const existing = indoorClimateKeys.get(record)
  if (existing) return existing
  indoorClimateKeyCounter += 1
  const generated = `indoor-climate-${indoorClimateKeyCounter}-${idx}`
  indoorClimateKeys.set(record, generated)
  return generated
}

function updateField(
  index: number,
  field: 'area' | 'high' | 'low' | 'humidity',
  event: Event
) {
  emit('update-field', {
    index,
    field,
    value: (event.target as HTMLInputElement).value,
  })
}
</script>

<template>
  <div class="card mb-4 app-section-card">
    <div class="card-header panel-header d-flex justify-content-between align-items-center">
      <h5 class="mb-0"><i class="bi bi-thermometer-half me-2"></i>Indoor Temperature Readings</h5>
      <button
        type="button"
        class="btn btn-sm btn-outline-primary"
        :disabled="!canEdit"
        @click="emit('add-reading')"
      >
        <i class="bi bi-plus-lg me-1"></i>Add Floor / Area
      </button>
    </div>
    <div class="card-body">
      <div
        v-for="(reading, idx) in props.readings"
        :key="indoorClimateKey(reading, idx)"
        class="row g-2 align-items-end mb-2"
      >
        <div class="col-md-4">
          <label class="form-label">Floor / Area</label>
          <input
            type="text"
            class="form-control"
            :value="reading.area"
            :disabled="!canEdit"
            placeholder="e.g., Level 2"
            @input="updateField(idx, 'area', $event)"
          />
        </div>
        <div class="col-md-2">
          <label class="form-label">High (degF)</label>
          <input
            type="text"
            class="form-control"
            :value="reading.high"
            :disabled="!canEdit"
            placeholder="High"
            @input="updateField(idx, 'high', $event)"
          />
        </div>
        <div class="col-md-2">
          <label class="form-label">Low (degF)</label>
          <input
            type="text"
            class="form-control"
            :value="reading.low"
            :disabled="!canEdit"
            placeholder="Low"
            @input="updateField(idx, 'low', $event)"
          />
        </div>
        <div class="col-md-2">
          <label class="form-label">Humidity (%)</label>
          <input
            type="text"
            class="form-control"
            :value="reading.humidity"
            :disabled="!canEdit"
            placeholder="Humidity"
            @input="updateField(idx, 'humidity', $event)"
          />
        </div>
        <div class="col-md-2 d-grid">
          <button
            type="button"
            class="btn btn-outline-danger"
            :disabled="!canEdit"
            @click="emit('remove-reading', idx)"
          >
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
