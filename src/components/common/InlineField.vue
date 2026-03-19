<script setup lang="ts">
import { computed } from 'vue'

type InlineFieldType = 'text' | 'email' | 'date' | 'number' | 'select'
type InlineFieldValue = string | number | boolean | null | undefined

type SelectOption = {
  value: string | number | boolean
  label: string
}

const props = withDefaults(defineProps<{
  editing: boolean
  modelValue: InlineFieldValue
  type?: InlineFieldType
  disabled?: boolean
  placeholder?: string
  inputClass?: string
  selectClass?: string
  options?: readonly SelectOption[]
  stopPointer?: boolean
  step?: string
}>(), {
  type: 'text',
  disabled: false,
  placeholder: '',
  inputClass: 'form-control form-control-sm',
  selectClass: 'form-select form-select-sm',
  options: () => [],
  stopPointer: true,
  step: undefined,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | boolean]
  enter: []
  escape: []
}>()

const model = computed({
  get: () => props.modelValue ?? '',
  set: (value: string | number | boolean) => emit('update:modelValue', value),
})

function stopPointer(event: Event) {
  if (props.stopPointer) {
    event.stopPropagation()
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    emit('enter')
    return
  }
  if (event.key === 'Escape') {
    emit('escape')
  }
}
</script>

<template>
  <template v-if="editing">
    <input
      v-if="type !== 'select'"
      v-model="model"
      :type="type"
      :step="type === 'number' ? step : undefined"
      :class="inputClass"
      :placeholder="placeholder"
      :disabled="disabled"
      @click="stopPointer"
      @mousedown="stopPointer"
      @keydown="handleKeydown"
    />
    <select
      v-else
      v-model="model"
      :class="selectClass"
      :disabled="disabled"
      @click="stopPointer"
      @mousedown="stopPointer"
      @keydown="handleKeydown"
    >
      <option
        v-for="option in options"
        :key="String(option.value)"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </template>
  <slot v-else />
</template>
