<script setup lang="ts">
import {
  isHtmlInputElement,
  useTemplateElementRef,
  type TemplateElementRefValue,
} from '@/composables/useTemplateElementRef'
import { readInputValue } from '@/utils/domEvents'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  inputRef?: (element: HTMLInputElement | null) => void
  modelValue: string | number
  type?: string
}>(), {
  inputRef: undefined,
  type: 'text',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  input: [event: Event]
  commit: []
  cancel: []
}>()

const { elementRef: inputElementRef, setElementRef: setInputElementRef } = useTemplateElementRef(isHtmlInputElement)

function handleInput(event: Event) {
  emit('update:modelValue', readInputValue(event))
  emit('input', event)
}

function handleInputRef(element: TemplateElementRefValue) {
  setInputElementRef(element)
  props.inputRef?.(inputElementRef.value)
}
</script>

<template>
  <input
    v-bind="$attrs"
    :ref="handleInputRef"
    class="app-inline-input"
    :type="props.type"
    :value="props.modelValue"
    @input="handleInput"
    @click.stop
    @blur="emit('commit')"
    @keydown.enter.prevent="emit('commit')"
    @keydown.esc.prevent="emit('cancel')"
  />
</template>

<style scoped>
.app-inline-input {
  min-width: 0;
  width: 100%;
  min-height: var(--app-inline-input-min-height, 1.9rem);
  padding: 0 var(--app-inline-input-padding-x, 0.45rem);
  border: 1px solid var(--app-inline-input-border, var(--border));
  border-radius: var(--app-inline-input-radius, var(--radius-sm));
  background: var(--app-inline-input-background, rgba(21, 36, 48, 0.96));
  color: var(--app-inline-input-color, var(--text));
  box-sizing: border-box;
  font: var(--app-inline-input-font, inherit);
  outline: var(--app-inline-input-outline, none);
}

.app-inline-input:focus {
  border-color: var(--app-inline-input-focus-border, var(--border-strong));
  box-shadow: var(--app-inline-input-focus-shadow, var(--focus-ring));
}
</style>
