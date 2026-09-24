<script setup lang="ts">
import type { ContainerLayout, ItemSizing } from '@/features/website/types'
const props = defineProps<{
  container?: ContainerLayout
  sizing?: ItemSizing
  isContainer: boolean
  contained: boolean
  disabled?: boolean
  inherited?: boolean
  sizingOverrides?: ItemSizing
}>()
const emit = defineEmits<{
  container: [value: ContainerLayout]
  sizing: [value: ItemSizing | undefined]
}>()
function setSizing(key: keyof ItemSizing, value: number | string | undefined) {
  const next = { ...(props.inherited ? props.sizingOverrides : props.sizing) }
  if (value === undefined || value === '') delete next[key]
  else Object.assign(next, { [key]: value })
  emit('sizing', Object.keys(next).length ? next : undefined)
}
function updateContainer(patch: Partial<ContainerLayout>) {
  emit('container', { direction: 'row', gap: 16, ...props.container, ...patch })
}
function number(key: keyof ItemSizing, event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.validity.valid) {
    input.reportValidity()
    return
  }
  setSizing(key, input.value === '' ? undefined : Number(input.value))
}
function gap(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.value && input.validity.valid) updateContainer({ gap: Number(input.value) })
  else input.reportValidity()
}
</script>
<template>
  <fieldset v-if="isContainer" :disabled="disabled">
    <legend>Container layout</legend>
    <label
      >Child layout<select
        aria-label="Child layout"
        :value="container?.direction || 'row'"
        @change="
          updateContainer({
            direction: ($event.target as HTMLSelectElement).value as 'row' | 'column',
          })
        "
      >
        <option value="row">Row</option>
        <option value="column">Column</option>
      </select></label
    >
    <label
      >Child gap (px)<input
        type="number"
        min="0"
        max="160"
        :value="container?.gap ?? 16"
        @change="gap"
    /></label>
    <label
      ><input
        type="checkbox"
        :checked="container?.wrap"
        @change="updateContainer({ wrap: ($event.target as HTMLInputElement).checked })"
      />
      Wrap children</label
    >
    <label
      >Child alignment<select
        aria-label="Child alignment"
        :value="container?.align || 'stretch'"
        @change="
          updateContainer({
            align: ($event.target as HTMLSelectElement).value as ContainerLayout['align'],
          })
        "
      >
        <option v-for="value in ['stretch', 'start', 'center', 'end']" :key="value">
          {{ value }}
        </option>
      </select></label
    >
    <label
      >Child distribution<select
        aria-label="Child distribution"
        :value="container?.justify || 'start'"
        @change="
          updateContainer({
            justify: ($event.target as HTMLSelectElement).value as ContainerLayout['justify'],
          })
        "
      >
        <option
          v-for="value in ['start', 'center', 'end', 'space-between', 'space-around']"
          :key="value"
        >
          {{ value }}
        </option>
      </select></label
    >
  </fieldset>
  <fieldset :disabled="disabled">
    <legend>Flexible sizing</legend>
    <template v-if="contained">
      <label
        >Grow proportion<input
          type="number"
          min="0"
          max="12"
          step="any"
          :value="sizing?.grow"
          placeholder="1"
          @change="number('grow', $event)"
      /></label>
      <label
        >Starting size (%)<input
          type="number"
          min="0"
          max="100"
          step="any"
          :value="sizing?.basis"
          placeholder="Automatic"
          @change="number('basis', $event)"
      /></label>
      <label
        >Item alignment<select
          aria-label="Item alignment"
          :value="sizing?.align || 'auto'"
          @change="setSizing('align', ($event.target as HTMLSelectElement).value)"
        >
          <option v-if="inherited" value="">Use desktop</option>
          <option v-for="value in ['auto', 'stretch', 'start', 'center', 'end']" :key="value">
            {{ value }}
          </option>
        </select></label
      >
    </template>
    <label
      >Height (px)<input
        type="number"
        min="32"
        max="2000"
        :value="sizing?.height"
        placeholder="Fit content"
        @change="number('height', $event)"
    /></label>
    <small>Clear Height to fit the content automatically.</small>
    <label
      >Minimum height (px)<input
        type="number"
        min="0"
        max="2000"
        :value="sizing?.minHeight"
        placeholder="Automatic"
        @change="number('minHeight', $event)"
    /></label>
  </fieldset>
</template>
<style scoped>
fieldset {
  display: grid;
  gap: 0.6rem;
  min-width: 0;
}
label {
  display: grid;
  gap: 0.3rem;
}
</style>
