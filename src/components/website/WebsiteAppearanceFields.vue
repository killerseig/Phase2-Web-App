<script setup lang="ts">
import { appearanceNumbers } from '@/features/website/appearance'
import type { WidgetAppearance } from '@/features/website/types'
import { computed } from 'vue'
const props = defineProps<{
  value?: WidgetAppearance
  layoutLocked?: boolean
  standalone?: boolean
  kind?: string
  hasImage?: boolean
  inherited?: boolean
  overrides?: WidgetAppearance
}>()
const authored = computed(() => (props.inherited ? props.overrides : props.value))
const emit = defineEmits<{ update: [value: WidgetAppearance | undefined] }>()
function update(key: keyof WidgetAppearance, value: string | number | undefined) {
  const next = { ...authored.value }
  if (value === undefined || value === '') delete next[key]
  else Object.assign(next, { [key]: value })
  emit('update', Object.keys(next).length ? next : undefined)
}
function number(key: keyof WidgetAppearance, event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.validity.valid) {
    input.reportValidity()
    input.value = String(props.value?.[key] ?? '')
    return
  }
  update(key, input.value === '' ? undefined : Number(input.value))
}
const choices = [
  {
    key: 'fontFamily',
    label: 'Font family',
    values: [
      ['sans', 'Sans serif'],
      ['serif', 'Serif'],
      ['mono', 'Monospace'],
    ],
  },
  {
    key: 'textAlign',
    label: 'Text alignment',
    values: [
      ['left', 'Left'],
      ['center', 'Center'],
      ['right', 'Right'],
    ],
  },
  {
    key: 'imageFit',
    label: 'Image fit',
    values: [
      ['cover', 'Fill / crop'],
      ['contain', 'Fit whole image'],
    ],
  },
] as const
const colors = [
  { key: 'background', label: 'Background color' },
  { key: 'color', label: 'Text color' },
  { key: 'borderColor', label: 'Border color' },
] as const
const groups = computed(() => {
  const text = !['image', 'spacer', 'divider'].includes(props.kind || '')
  const image =
    props.hasImage ||
    ['image', 'image-text', 'gallery', 'cards', 'card', 'profile-card', 'team', 'logos'].includes(
      props.kind || '',
    ) ||
    props.value?.imageFit !== undefined
  return [
    { label: 'Colors', open: true, keys: text ? ['background', 'color'] : ['background'] },
    { label: 'Spacing and corners', open: true, keys: ['padding', 'margin', 'radius'] },
    {
      label: 'Individual spacing sides',
      open: false,
      keys: [
        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',
        'marginTop',
        'marginRight',
        'marginBottom',
        'marginLeft',
      ],
    },
    ...(text
      ? [
          {
            label: 'Text',
            open: false,
            keys: ['fontFamily', 'textAlign', 'fontSize', 'headingSize'],
          },
        ]
      : []),
    ...(image ? [{ label: 'Image', open: true, keys: ['imageFit'] }] : []),
    {
      label: 'Advanced style',
      open: false,
      keys: ['borderColor', 'borderWidth', 'opacity', 'rotation'],
    },
  ]
})
const resetHint = computed(() =>
  props.inherited ? 'Use the desktop value' : 'Use the default value',
)
</script>
<template>
  <component
    :is="standalone ? 'section' : 'details'"
    class="appearance-fields"
    :class="{ standalone }"
    open
  >
    <summary v-if="!standalone">Appearance and rotation</summary>
    <details v-for="group in groups" :key="group.label" class="style-group" :open="group.open">
      <summary>{{ group.label }}</summary>
      <div class="appearance-grid">
        <label
          v-for="{ label, key } in colors.filter((field) => group.keys.includes(field.key))"
          :key="key"
        >
          {{ label }}
          <span class="color-control">
            <input
              type="color"
              :aria-label="label"
              :value="value?.[key] || (key === 'background' ? '#ffffff' : '#172c40')"
              @input="update(key, ($event.target as HTMLInputElement).value)"
            />
            <button
              type="button"
              :aria-label="`Reset ${label.toLowerCase()}`"
              :title="resetHint"
              :disabled="authored?.[key] === undefined"
              @click="update(key, undefined)"
            >
              <i class="pi pi-undo" aria-hidden="true" />
            </button>
          </span>
        </label>
        <label
          v-for="choice in choices.filter((field) => group.keys.includes(field.key))"
          :key="choice.key"
          >{{ choice.label }}
          <span class="color-control">
            <select
              :aria-label="choice.label"
              :value="value?.[choice.key] || ''"
              @change="update(choice.key, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">{{ inherited ? 'Use desktop' : 'Default' }}</option>
              <option v-for="[id, label] in choice.values" :key="id" :value="id">
                {{ label }}
              </option>
            </select>
            <button
              type="button"
              :aria-label="`Reset ${choice.label.toLowerCase()}`"
              :title="resetHint"
              :disabled="authored?.[choice.key] === undefined"
              @click="update(choice.key, undefined)"
            >
              <i class="pi pi-undo" aria-hidden="true" />
            </button>
          </span>
        </label>
        <label
          v-for="field in appearanceNumbers.filter((field) => group.keys.includes(field.key))"
          :key="field.key"
          >{{ field.label }}
          <span class="color-control">
            <input
              :aria-label="field.label"
              type="number"
              step="any"
              :min="field.min"
              :max="field.max"
              :value="value?.[field.key] ?? ''"
              :disabled="layoutLocked && field.key === 'rotation'"
              placeholder="Default"
              @change="number(field.key, $event)"
            />
            <button
              type="button"
              :aria-label="`Reset ${field.label.toLowerCase()}`"
              :title="resetHint"
              :disabled="
                authored?.[field.key] === undefined || (layoutLocked && field.key === 'rotation')
              "
              @click="update(field.key, undefined)"
            >
              <i class="pi pi-undo" aria-hidden="true" />
            </button>
          </span>
        </label>
      </div>
    </details>
    <small>{{
      inherited ? 'Reset a setting to follow desktop again.' : 'Reset a setting to use its default.'
    }}</small>
    <button
      type="button"
      :disabled="!authored || !Object.keys(authored).length"
      @click="emit('update', undefined)"
    >
      Reset appearance
    </button>
  </component>
</template>
<style scoped>
.appearance-fields {
  border-block: 1px solid var(--border);
  padding: 0.65rem 0;
}
.appearance-fields.standalone {
  border: 0;
  padding: 0;
}
summary {
  cursor: pointer;
  font-weight: 600;
  margin-bottom: 0.65rem;
}
.appearance-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}
.style-group {
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--border);
}
.color-control button {
  flex: 0 0 28px;
}
label {
  display: grid;
  gap: 0.3rem;
  font-size: 0.8rem;
  min-width: 0;
}
input,
select {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 0.4rem;
  font: inherit;
}
input,
select,
button {
  background: var(--field);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
}
button {
  cursor: pointer;
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
input:focus-visible,
select:focus-visible,
button:focus-visible {
  outline: 2px solid #168bd4;
  outline-offset: 1px;
}
.color-control {
  display: flex;
  gap: 0.25rem;
}
input[type='color'] {
  height: 36px;
  padding: 2px;
}
button {
  padding: 0.3rem;
  font-size: 0.75rem;
}
small {
  display: block;
  margin: 0.6rem 0;
  color: var(--text-muted);
  font-size: 0.75rem;
}
</style>
