<script setup lang="ts">
import type { TextBoxValues } from '../../../functions/src/websiteTextBox'
import type { WebsiteDevice } from '@/features/website/types'
defineProps<{
  value: TextBoxValues
  width?: number
  height?: number
  label: string
  image?: boolean
  device: WebsiteDevice
  disabled?: boolean
}>()
const emit = defineEmits<{
  change: [patch: TextBoxValues]
  reset: [keys: (keyof TextBoxValues)[]]
}>()
const fields = [
  { key: 'x', label: 'X', min: -4000, max: 4000 },
  { key: 'y', label: 'Y', min: -4000, max: 4000 },
  { key: 'width', label: 'Width', min: 24, max: 4000 },
  { key: 'height', label: 'Height', min: 24, max: 4000 },
  { key: 'rotation', label: 'Angle', min: -180, max: 180 },
  { key: 'padding', label: 'Padding', min: 0, max: 400 },
] as const
function change(event: Event, field: (typeof fields)[number]) {
  const input = event.target as HTMLInputElement
  if (!input.value.trim()) {
    emit('reset', [field.key])
    return
  }
  if (!input.validity.valid || !Number.isFinite(input.valueAsNumber)) return
  emit('change', { [field.key]: input.valueAsNumber })
}
</script>
<template>
  <fieldset data-element-inspector :disabled="disabled" class="element-fields">
    <legend>{{ label }} placement</legend>
    <p>
      {{
        device === 'desktop'
          ? 'Desktop base layout'
          : `${device === 'mobile' ? 'Phone' : 'Tablet'} overrides · Reset to follow desktop`
      }}
    </p>
    <div class="dimensions">
      <label v-for="field in fields" :key="field.key">
        {{ field.label }}{{ field.key === 'rotation' ? ' (°)' : ' (px)' }}
        <input
          type="number"
          :aria-label="`Element ${field.label}`"
          step="0.01"
          :min="field.min"
          :max="field.max"
          :value="
            value[field.key] ?? (field.key === 'width' || field.key === 'height' ? undefined : 0)
          "
          :placeholder="
            field.key === 'width'
              ? `Auto (${width || 0})`
              : field.key === 'height'
                ? `Auto (${height || 0})`
                : undefined
          "
          @change="change($event, field)"
        />
      </label>
      <label class="aspect"
        ><input
          type="checkbox"
          :checked="value.lockAspect ?? image"
          @change="emit('change', { lockAspect: ($event.target as HTMLInputElement).checked })"
        />
        Keep proportions</label
      >
    </div>
    <div class="resets" aria-label="Reset element placement">
      <button type="button" @click="emit('reset', ['x', 'y'])">Reset position</button>
      <button type="button" @click="emit('reset', ['width', 'height'])">Reset size</button>
      <button type="button" @click="emit('reset', ['rotation'])">Reset angle</button>
      <button type="button" @click="emit('reset', ['padding'])">Reset padding</button>
      <button
        type="button"
        @click="emit('reset', ['x', 'y', 'width', 'height', 'rotation', 'padding', 'lockAspect'])"
      >
        Reset all
      </button>
    </div>
  </fieldset>
</template>
<style scoped>
.element-fields {
  margin: 0.5rem 0;
  padding: 0.65rem;
  border: 1px solid var(--border);
  border-radius: 6px;
}
legend {
  font-weight: 600;
}
p {
  font-size: 0.75rem;
  color: var(--muted);
  margin: 0 0 0.5rem;
}
.dimensions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}
label {
  font-size: 0.75rem;
}
input[type='number'] {
  width: 100%;
  min-width: 0;
}
.aspect {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.resets {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}
.resets button {
  font-size: 0.7rem;
  padding: 0.3rem;
}
</style>
