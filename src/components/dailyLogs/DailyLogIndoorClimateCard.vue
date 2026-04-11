<script setup lang="ts">
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import BaseInputField from '@/components/common/BaseInputField.vue'
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

function updateField(index: number, field: 'area' | 'high' | 'low' | 'humidity', value: string) {
  emit('update-field', {
    index,
    field,
    value,
  })
}
</script>

<template>
  <AppSectionCard class="mb-4">
    <template #header>
      <div class="d-flex justify-content-between align-items-center">
      <h5 class="mb-0"><i class="bi bi-thermometer-half me-2"></i>Indoor Temperature Readings</h5>
      <button
        type="button"
        class="btn btn-sm btn-outline-primary"
        :disabled="!canEdit"
        @click="emit('add-reading')"
      >
        <i class="bi bi-plus-lg me-1"></i>Add Reading
      </button>
      </div>
    </template>
      <div
        v-for="(reading, idx) in props.readings"
        :key="indoorClimateKey(reading, idx)"
        class="row g-2 align-items-end mb-2"
      >
        <div class="col-md-4">
          <BaseInputField
            :model-value="reading.area"
            label="Floor / Area"
            wrapper-class="mb-0"
            :disabled="!canEdit"
            placeholder="e.g., Level 2"
            @update:model-value="updateField(idx, 'area', $event)"
          />
        </div>
        <div class="col-md-2">
          <BaseInputField
            :model-value="reading.high"
            label="High (degF)"
            wrapper-class="mb-0"
            :disabled="!canEdit"
            placeholder="High"
            @update:model-value="updateField(idx, 'high', $event)"
          />
        </div>
        <div class="col-md-2">
          <BaseInputField
            :model-value="reading.low"
            label="Low (degF)"
            wrapper-class="mb-0"
            :disabled="!canEdit"
            placeholder="Low"
            @update:model-value="updateField(idx, 'low', $event)"
          />
        </div>
        <div class="col-md-2">
          <BaseInputField
            :model-value="reading.humidity"
            label="Humidity (%)"
            wrapper-class="mb-0"
            :disabled="!canEdit"
            placeholder="Humidity"
            @update:model-value="updateField(idx, 'humidity', $event)"
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
      <div class="mt-3 d-flex justify-content-end">
        <button
          type="button"
          class="btn btn-outline-primary btn-sm"
          :disabled="!canEdit"
          @click="emit('add-reading')"
        >
          <i class="bi bi-plus-lg me-1"></i>Add Reading
        </button>
      </div>
  </AppSectionCard>
</template>
