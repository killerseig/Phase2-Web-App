<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import { motionEffects, type WebsiteMotion } from '../../../functions/src/websiteMotion'
import { playWebsiteMotion } from '@/features/website/motion'
const props = defineProps<{ value?: WebsiteMotion }>()
const emit = defineEmits<{ update: [value: WebsiteMotion | undefined] }>()
const sample = ref<HTMLElement>()
let animation: Animation | undefined
function set(key: keyof WebsiteMotion, value: string | number) {
  emit('update', { effect: 'fade', ...props.value, [key]: value })
}
function number(key: 'duration' | 'delay', event: Event) {
  const input = event.target as HTMLInputElement
  if (input.validity.valid && input.value !== '') set(key, input.valueAsNumber)
}
function preview() {
  animation?.cancel()
  if (sample.value) animation = playWebsiteMotion(sample.value, props.value)
}
onBeforeUnmount(() => animation?.cancel())
</script>
<template>
  <details class="motion-controls">
    <summary>Animation and fading</summary>
    <label
      >Entrance animation<select
        aria-label="Entrance animation"
        :value="value?.effect || 'none'"
        @change="set('effect', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="(label, key) in motionEffects" :key="key" :value="key">{{ label }}</option>
      </select></label
    >
    <template v-if="value && value.effect !== 'none'">
      <label
        >Animation duration (ms)<input
          type="number"
          min="100"
          max="3000"
          step="50"
          :value="value.duration ?? 600"
          @change="number('duration', $event)"
      /></label>
      <label
        >Animation delay (ms)<input
          type="number"
          min="0"
          max="3000"
          step="50"
          :value="value.delay ?? 0"
          @change="number('delay', $event)"
      /></label>
      <label
        >Animation easing<select
          aria-label="Animation easing"
          :value="value.easing || 'ease-out'"
          @change="set('easing', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="ease in ['linear', 'ease-in', 'ease-out', 'ease-in-out']" :key="ease">
            {{ ease }}
          </option>
        </select></label
      >
      <div class="sample-stage">
        <div ref="sample" class="motion-sample">Animation preview</div>
      </div>
      <button type="button" @click="preview">Preview animation</button>
      <p>
        Plays once when the widget enters view on the published page. Reduced-motion preferences are
        respected, including this preview.
      </p>
    </template>
    <button v-if="value" type="button" @click="emit('update', undefined)">Reset animation</button>
  </details>
</template>
<style scoped>
label {
  display: grid;
  gap: 4px;
  margin: 8px 0;
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
summary {
  cursor: pointer;
  font-weight: 600;
}
p {
  font-size: 0.8rem;
}
.sample-stage {
  padding: 24px;
  overflow: hidden;
}
.motion-sample {
  padding: 8px;
  background: var(--bg-accent);
  border: 1px solid var(--border);
  text-align: center;
}
</style>
