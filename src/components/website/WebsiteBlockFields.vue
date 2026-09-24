<script setup lang="ts">
import type { BlockOptions } from '../../../functions/src/websiteBlocks'
defineProps<{ kind: string; value?: BlockOptions }>()
const emit = defineEmits<{ update: [value: BlockOptions] }>()
</script>
<template>
  <fieldset
    v-if="
      [
        'list',
        'team',
        'testimonials',
        'statistics',
        'logos',
        'chart',
        'button',
        'badge',
        'alert',
      ].includes(kind)
    "
  >
    <legend>Widget options</legend>
    <label v-if="['team', 'testimonials', 'statistics', 'logos'].includes(kind)"
      >Columns
      <select
        aria-label="Columns"
        :value="value?.columns || 3"
        @change="
          emit('update', { ...value, columns: Number(($event.target as HTMLSelectElement).value) })
        "
      >
        <option v-for="n in 6" :key="n" :value="n">{{ n }}</option>
      </select>
    </label>
    <label v-if="kind === 'chart'"
      >Chart type
      <select
        aria-label="Chart type"
        :value="value?.chartType || 'bar'"
        @change="
          emit('update', {
            ...value,
            chartType: ($event.target as HTMLSelectElement).value as BlockOptions['chartType'],
          })
        "
      >
        <option value="bar">Bar</option>
        <option value="line">Line</option>
        <option value="area">Area</option>
        <option value="donut">Donut</option>
      </select>
    </label>
    <label v-if="kind === 'list'"
      >List style
      <select
        aria-label="List style"
        :value="value?.listStyle || 'bullet'"
        @change="
          emit('update', {
            ...value,
            listStyle: ($event.target as HTMLSelectElement).value as BlockOptions['listStyle'],
          })
        "
      >
        <option value="bullet">Bullets</option>
        <option value="numbered">Numbered</option>
        <option value="check">Checklist</option>
      </select>
    </label>
    <label v-if="['button', 'badge', 'alert'].includes(kind)"
      >Variant
      <select
        aria-label="Variant"
        :value="value?.variant || 'solid'"
        @change="
          emit('update', {
            ...value,
            variant: ($event.target as HTMLSelectElement).value as BlockOptions['variant'],
          })
        "
      >
        <option value="solid">Solid</option>
        <option value="outline">Outline</option>
      </select>
    </label>
    <label v-if="kind === 'chart'"
      ><input
        type="checkbox"
        :checked="value?.showData !== false"
        @change="
          emit('update', { ...value, showData: ($event.target as HTMLInputElement).checked })
        "
      />Always show chart data</label
    >
    <p v-if="kind === 'chart'">
      Enter labels and values below. Charts display the values you save here.
    </p>
  </fieldset>
</template>
<style scoped>
fieldset,
label {
  display: grid;
  gap: 0.5rem;
  min-width: 0;
}
fieldset {
  border: 1px solid var(--border);
  padding: 0.7rem;
}
select {
  font: inherit;
  min-width: 0;
  color: var(--text);
  background: var(--field);
  padding: 0.4rem;
  border: 1px solid var(--border);
}
p {
  font-size: 0.8rem;
}
</style>
