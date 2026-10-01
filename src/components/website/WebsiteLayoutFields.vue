<script setup lang="ts">
import BuilderSettingSource from '@/components/builder/BuilderSettingSource.vue'
import type { ContainerLayout, ItemSizing } from '@/features/website/types'
const props = defineProps<{
  container?: ContainerLayout
  sizing?: ItemSizing
  isContainer: boolean
  contained: boolean
  disabled?: boolean
  inherited?: boolean
  sizingOverrides?: ItemSizing
  automatic?: boolean
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
    <small v-if="automatic"
      >Columns wrap on tablets and stack on phones automatically. Changes here apply to this screen
      size.</small
    >
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
        <option
          v-for="(label, value) in {
            stretch: 'Stretch',
            start: 'Start',
            center: 'Center',
            end: 'End',
          }"
          :key="value"
          :value="value"
        >
          {{ label }}
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
          v-for="(label, value) in {
            start: 'Start',
            center: 'Center',
            end: 'End',
            'space-between': 'Space between',
            'space-around': 'Space around',
          }"
          :key="value"
          :value="value"
        >
          {{ label }}
        </option>
      </select></label
    >
  </fieldset>
  <fieldset :disabled="disabled">
    <legend>Flexible sizing</legend>
    <template v-if="contained">
      <label
        ><span
          >Grow proportion<BuilderSettingSource
            v-if="inherited"
            :automatic="automatic"
            :overridden="sizingOverrides?.grow !== undefined" /></span
        ><input
          type="number"
          min="0"
          max="12"
          step="any"
          :aria-label="'Grow proportion'"
          :value="sizing?.grow"
          placeholder="1"
          @change="number('grow', $event)"
      /></label>
      <label
        ><span
          >Starting size (%)<BuilderSettingSource
            v-if="inherited"
            :automatic="automatic"
            :overridden="sizingOverrides?.basis !== undefined" /></span
        ><input
          type="number"
          min="0"
          max="100"
          step="any"
          :aria-label="'Starting size (%)'"
          :value="sizing?.basis"
          placeholder="Automatic"
          @change="number('basis', $event)"
      /></label>
      <label
        ><span
          >Item alignment<BuilderSettingSource
            v-if="inherited"
            :automatic="automatic"
            :overridden="sizingOverrides?.align !== undefined" /></span
        ><select
          aria-label="Item alignment"
          :value="sizing?.align || 'auto'"
          @change="setSizing('align', ($event.target as HTMLSelectElement).value)"
        >
          <option v-if="inherited" value="">{{ automatic ? 'Automatic' : 'Use desktop' }}</option>
          <option
            v-for="(label, value) in {
              auto: 'Automatic',
              stretch: 'Stretch',
              start: 'Start',
              center: 'Center',
              end: 'End',
            }"
            :key="value"
            :value="value"
          >
            {{ label }}
          </option>
        </select></label
      >
    </template>
    <div class="builder-field-grid">
      <label
        ><span
          >Height (px)<BuilderSettingSource
            v-if="inherited"
            :automatic="automatic"
            :overridden="sizingOverrides?.height !== undefined" /></span
        ><input
          type="number"
          min="32"
          max="2000"
          :aria-label="'Height (px)'"
          :value="sizing?.height"
          placeholder="Fit content"
          @change="number('height', $event)"
      /></label>
      <label
        ><span
          >Minimum height (px)<BuilderSettingSource
            v-if="inherited"
            :automatic="automatic"
            :overridden="sizingOverrides?.minHeight !== undefined" /></span
        ><input
          type="number"
          min="0"
          max="2000"
          :aria-label="'Minimum height (px)'"
          :value="sizing?.minHeight"
          placeholder="Automatic"
          @change="number('minHeight', $event)"
      /></label>
    </div>
    <small>{{
      inherited
        ? automatic
          ? 'Clear a value to use the automatic layout for this screen size.'
          : 'Clear a value to follow desktop.'
        : 'Clear Height to fit the content automatically.'
    }}</small>
    <button
      v-if="inherited"
      type="button"
      :disabled="!sizingOverrides || !Object.keys(sizingOverrides).length"
      @click="emit('sizing', undefined)"
    >
      {{ automatic ? 'Use automatic sizing' : 'Use desktop sizing' }}
    </button>
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
