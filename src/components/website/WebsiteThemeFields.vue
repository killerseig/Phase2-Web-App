<script setup lang="ts">
import { computed } from 'vue'
import {
  defaultTheme,
  themeColors,
  themeNumbers,
  themeWarnings,
  type WebsiteTheme,
} from '../../../functions/src/websiteTheme'
const props = defineProps<{ theme?: WebsiteTheme; accent: string }>()
const emit = defineEmits<{ update: [theme: WebsiteTheme | undefined] }>()
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
    <button v-if="!theme" type="button" @click="emit('update', { ...defaultTheme })">
      Enable shared design
    </button>
    <template v-else>
      <label v-for="key in themeColors" :key="key"
        >{{ labels[key]
        }}<input
          type="color"
          :value="value[key]"
          @input="set(key, ($event.target as HTMLInputElement).value)"
      /></label>
      <label
        >Body font<select
          aria-label="Body font"
          :value="value.bodyFont"
          @change="set('bodyFont', ($event.target as HTMLSelectElement).value)"
        >
          <option value="sans">Sans serif</option>
          <option value="serif">Serif</option>
          <option value="mono">Monospace</option>
        </select></label
      >
      <label
        >Heading font<select
          aria-label="Heading font"
          :value="value.headingFont"
          @change="set('headingFont', ($event.target as HTMLSelectElement).value)"
        >
          <option value="display">Condensed</option>
          <option value="sans">Sans serif</option>
          <option value="serif">Serif</option>
        </select></label
      >
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
      <p>
        Spacing and width apply to flow layouts. Page spacing overrides still apply; free-grid
        positions stay editable.
      </p>
      <ul v-if="themeWarnings(theme, accent).length" aria-label="Design readability warnings">
        <li v-for="warning in themeWarnings(theme, accent)" :key="warning">{{ warning }}</li>
      </ul>
      <button type="button" @click="emit('update', undefined)">Disable shared design</button>
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
