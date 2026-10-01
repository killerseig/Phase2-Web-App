<script setup lang="ts">
import { computed, ref } from 'vue'
import WebsiteFontPicker from './WebsiteFontPicker.vue'
import {
  textStyleNames,
  textStyleLimits,
  type WebsiteTextStyles,
  type TextStyleValues,
} from '../../../functions/src/websiteTypography'
const props = defineProps<{ value?: WebsiteTextStyles }>()
const emit = defineEmits<{ update: [value: WebsiteTextStyles] }>()
const selected = ref<keyof WebsiteTextStyles>('pageTitle')
const device = ref<'desktop' | 'tablet' | 'mobile'>('desktop')
const style = computed(() => props.value?.[selected.value] || {})
const current = computed(() =>
  device.value === 'desktop' ? style.value : style.value.devices?.[device.value] || {},
)
function set(key: keyof TextStyleValues, value: string | number | undefined) {
  const next = JSON.parse(JSON.stringify(props.value || {})) as WebsiteTextStyles
  const entry = (next[selected.value] ||= {})
  const target = device.value === 'desktop' ? entry : ((entry.devices ||= {})[device.value] ||= {})
  if (value === undefined || value === '') delete target[key]
  else Object.assign(target, { [key]: value })
  emit('update', next)
}
function number(key: keyof typeof textStyleLimits, event: Event) {
  const input = event.target as HTMLInputElement
  if (input.validity.valid) set(key, input.value === '' ? undefined : input.valueAsNumber)
}
function reset() {
  const next = JSON.parse(JSON.stringify(props.value || {})) as WebsiteTextStyles
  if (device.value === 'desktop') delete next[selected.value]
  else if (next[selected.value]?.devices) delete next[selected.value]!.devices![device.value]
  emit('update', next)
}
</script>
<template>
  <details class="text-styles">
    <summary>Reusable text styles</summary>
    <p>Shared across all pages. Widget and inline formatting can override these styles.</p>
    <label
      >Text style<select v-model="selected" aria-label="Reusable text style">
        <option v-for="(label, key) in textStyleNames" :key="key" :value="key">{{ label }}</option>
      </select></label
    >
    <label
      >Screen size<select v-model="device" aria-label="Typography screen size">
        <option value="desktop">Desktop</option>
        <option value="tablet">Tablet</option>
        <option value="mobile">Phone</option>
      </select></label
    >
    <WebsiteFontPicker
      label="Text style font"
      :value="current.font"
      :inherit-label="device === 'desktop' ? 'Site font' : 'Use desktop'"
      @update="set('font', $event)"
    />
    <label v-for="(limits, key) in textStyleLimits" :key="key"
      >{{ key === 'size' ? 'Font size (px)' : key === 'weight' ? 'Font weight' : 'Line height' }}
      <input
        :aria-label="`Text style ${key}`"
        type="number"
        :min="limits.min"
        :max="limits.max"
        :step="key === 'lineHeight' ? 0.05 : 1"
        :value="current[key] ?? ''"
        :placeholder="device === 'desktop' ? 'Auto' : String(style[key] ?? 'Use desktop')"
        @change="number(key, $event)"
      />
    </label>
    <button type="button" @click="reset">
      {{ device === 'desktop' ? 'Reset text style' : 'Reset device typography' }}
    </button>
  </details>
</template>
<style scoped>
.text-styles,
label {
  display: grid;
  gap: 6px;
  min-width: 0;
}
label {
  margin-top: 8px;
}
input,
select,
button {
  font: inherit;
  color: inherit;
  background: var(--field);
  border: 1px solid var(--border);
  padding: 5px;
  min-width: 0;
}
p {
  font-size: 0.8rem;
}
summary {
  cursor: pointer;
  font-weight: 600;
}
</style>
