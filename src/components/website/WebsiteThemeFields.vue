<script setup lang="ts">
import { computed, ref } from 'vue'
import WebsiteFontPicker from './WebsiteFontPicker.vue'
import WebsiteTextStyles from './WebsiteTextStyles.vue'
import {
  defaultTheme,
  themeColors,
  themeNumbers,
  themeWarnings,
  type WebsiteTheme,
  type BrandPreset,
} from '../../../functions/src/websiteTheme'
const props = defineProps<{ theme?: WebsiteTheme; accent: string }>()
const emit = defineEmits<{
  update: [theme: WebsiteTheme | undefined]
  apply: [preset: { theme: WebsiteTheme; accent: string }]
}>()
const presetName = ref('')
const phase2: BrandPreset = {
  name: 'Phase 2',
  accent: '#00437f',
  theme: {
    ...defaultTheme,
    bodyFont: 'Source Sans 3',
    headingFont: 'Saira Semi Condensed',
    radius: 6,
  },
}
function apply(preset: BrandPreset) {
  emit('apply', {
    ...preset,
    theme: { ...JSON.parse(JSON.stringify(preset.theme)), presets: props.theme?.presets || [] },
  })
}
function savePreset() {
  if (!presetName.value.trim() || (props.theme?.presets?.length || 0) >= 12) return
  const { presets = [], ...theme } = value.value
  emit('update', {
    ...value.value,
    presets: [
      ...presets,
      {
        name: presetName.value.trim(),
        accent: props.accent,
        theme: JSON.parse(JSON.stringify(theme)),
      },
    ],
  })
  presetName.value = ''
}
const value = computed(() => ({ ...defaultTheme, ...props.theme }))
const labels = {
  background: 'Page background',
  surface: 'Widget background',
  text: 'Body text',
  muted: 'Secondary text',
  border: 'Border color',
  buttonText: 'Button text',
}
function set(key: keyof WebsiteTheme, next: string | number) {
  emit('update', { ...value.value, [key]: next })
}
</script>
<template>
  <fieldset class="theme-fields">
    <legend>Shared design</legend>
    <p>
      Coordinate colors, typography and buttons across every page. Individual widget overrides take
      precedence.
    </p>
    <details>
      <summary>Brand presets</summary>
      <p>
        Apply shared colors, fonts, text styles and button corners. Individual widget overrides stay
        in place.
      </p>
      <button type="button" @click="apply(phase2)">Apply Phase 2 brand</button>
      <div v-for="(preset, index) in theme?.presets || []" :key="index">
        <button type="button" @click="apply(preset)">Apply {{ preset.name }}</button>
        <button
          type="button"
          :aria-label="`Delete brand preset ${preset.name}`"
          @click="
            emit('update', { ...value, presets: theme!.presets!.filter((_, i) => i !== index) })
          "
        >
          Delete
        </button>
      </div>
      <label>Preset name<input v-model="presetName" maxlength="64" /></label>
      <button
        type="button"
        :disabled="!presetName.trim() || (theme?.presets?.length || 0) >= 12"
        @click="savePreset"
      >
        Save brand preset
      </button>
    </details>
    <button
      v-if="!theme || theme.enabled === false"
      type="button"
      @click="emit('update', { ...defaultTheme, ...theme, enabled: true })"
    >
      Enable shared design
    </button>
    <template v-else>
      <h3 class="settings-group-title">Colors</h3>
      <div class="theme-color-grid">
        <label v-for="key in themeColors" :key="key"
          >{{ labels[key]
          }}<input
            type="color"
            :value="value[key]"
            @input="set(key, ($event.target as HTMLInputElement).value)"
        /></label>
      </div>
      <h3 class="settings-group-title">Typography</h3>
      <label
        >Body font<WebsiteFontPicker
          label="Body font"
          :value="value.bodyFont"
          @update="set('bodyFont', $event || 'sans')"
      /></label>
      <label
        >Heading font<WebsiteFontPicker
          label="Heading font"
          :value="value.headingFont"
          @update="set('headingFont', $event || 'display')"
      /></label>
      <WebsiteTextStyles
        :value="theme?.textStyles"
        @update="emit('update', { ...value, textStyles: $event })"
      />
      <h3 class="settings-group-title">Sizing and spacing</h3>
      <div class="theme-number-grid">
        <label v-for="(field, key) in themeNumbers" :key="key"
          >{{ field.label
          }}<input
            type="number"
            :value="value[key]"
            :min="field.min"
            :max="field.max"
            :step="field.step"
            @change="set(key, ($event.target as HTMLInputElement).valueAsNumber)"
        /></label>
      </div>
      <p>
        Spacing and width apply to flow layouts. Page spacing overrides still apply; free-grid
        positions stay editable.
      </p>
      <ul v-if="themeWarnings(theme, accent).length" aria-label="Design readability warnings">
        <li v-for="warning in themeWarnings(theme, accent)" :key="warning">{{ warning }}</li>
      </ul>
      <button type="button" @click="emit('update', { ...value, enabled: false })">
        Disable shared design
      </button>
    </template>
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
  padding: 0.8rem;
}
p,
li {
  font-size: 0.8rem;
}
input,
select,
button {
  font: inherit;
  min-width: 0;
  padding: 0.4rem;
  border: 1px solid var(--border);
  background: var(--field);
  color: var(--text);
}
input[type='color'] {
  width: 100%;
  height: 2rem;
  padding: 0;
}
</style>
