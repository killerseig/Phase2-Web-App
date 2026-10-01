<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  websiteFonts,
  fontOptions,
  textFonts,
  fontCategory,
  type WebsiteFont,
} from '../../../functions/src/websiteFonts'
const props = defineProps<{
  value?: string
  label: string
  inheritLabel?: string
  inline?: boolean
}>()
const emit = defineEmits<{ update: [value: string] }>()
const open = ref(false)
const search = ref('')
const options = computed(() =>
  props.inline ? textFonts.map((value) => ({ value, label: value })) : fontOptions,
)
const groups = ['Sans serif', 'Serif', 'Condensed', 'Monospace', 'Script']
const matchingGroups = computed(() =>
  groups
    .map((name) => ({
      name,
      fonts: options.value.filter(
        (font) =>
          fontCategory(font.value) === name &&
          font.label.toLowerCase().includes(search.value.trim().toLowerCase()),
      ),
    }))
    .filter((group) => group.fonts.length),
)
function choose(value: string) {
  emit('update', value)
  open.value = false
}
</script>
<template>
  <span class="font-picker" @keydown.esc.stop="open = false">
    <select
      :aria-label="label"
      :value="value || ''"
      @change="choose(($event.target as HTMLSelectElement).value)"
    >
      <option value="">{{ inheritLabel || 'Default' }}</option>
      <optgroup v-for="group in groups" :key="group" :label="group">
        <option
          v-for="font in options.filter((font) => fontCategory(font.value) === group)"
          :key="font.value"
          :value="font.value"
          :style="{ fontFamily: websiteFonts[font.value as WebsiteFont] }"
        >
          {{ font.label }}
        </option>
      </optgroup>
    </select>
    <button
      type="button"
      :aria-label="`Preview ${label.toLowerCase()} choices`"
      :title="`Preview ${label.toLowerCase()} choices`"
      :aria-expanded="open"
      @pointerdown.prevent
      @click="open = !open"
    >
      Aa
    </button>
    <span v-if="open" class="font-gallery" :aria-label="`${label} previews`">
      <input v-model="search" type="search" aria-label="Search fonts" placeholder="Search fonts" />
      <template v-for="group in matchingGroups" :key="group.name">
        <strong>{{ group.name }}</strong>
        <button
          v-for="font in group.fonts"
          :key="font.value"
          type="button"
          :style="{ fontFamily: websiteFonts[font.value as WebsiteFont] }"
          :aria-pressed="font.value === value"
          @pointerdown.prevent
          @click="choose(font.value)"
        >
          {{ font.label }}
        </button>
      </template>
      <span v-if="!matchingGroups.length" role="status">No matching fonts.</span>
      <button v-if="search" type="button" @click="search = ''">Clear font search</button>
      <button type="button" @click="open = false">Close font previews</button>
    </span>
  </span>
</template>
<style scoped>
.font-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}
select {
  color-scheme: dark;
  min-width: 0;
  flex: 1;
}
button,
select,
input {
  font: inherit;
  color: inherit;
  background: var(--field, #203b4d);
  border: 1px solid var(--border, #61788b);
  border-radius: 4px;
  padding: 4px;
}
.font-gallery {
  display: grid;
  flex-basis: 100%;
  max-height: 260px;
  min-width: 180px;
  overflow: auto;
  gap: 4px;
  padding: 6px;
  border: 1px solid var(--border, #61788b);
}
.font-gallery button {
  text-align: left;
  font-size: 18px;
}
.font-gallery strong {
  font: 600 12px sans-serif;
  margin-top: 6px;
}
</style>
