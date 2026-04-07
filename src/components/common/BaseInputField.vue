<script setup lang="ts">
import { useAttrs } from 'vue'
import BaseFieldShell from '@/components/common/BaseFieldShell.vue'

defineOptions({
  name: 'BaseInputField',
  inheritAttrs: false,
})

type InputValue = string | number | null | undefined

interface Props {
  id?: string
  modelValue: InputValue
  type?: 'text' | 'email' | 'number' | 'date' | 'password'
  label?: string
  labelClass?: string
  wrapperClass?: string
  helperText?: string
  helperClass?: string
  inputClass?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  autocomplete?: string
  autofocus?: boolean
  min?: string | number
  max?: string | number
  step?: string | number
  inputAriaLabel?: string
}

withDefaults(defineProps<Props>(), {
  id: '',
  type: 'text',
  label: '',
  labelClass: '',
  wrapperClass: '',
  helperText: '',
  helperClass: '',
  inputClass: 'form-control',
  placeholder: '',
  disabled: false,
  readonly: false,
  required: false,
  autocomplete: undefined,
  autofocus: false,
  min: undefined,
  max: undefined,
  step: undefined,
  inputAriaLabel: '',
})

const attrs = useAttrs()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  input: [event: Event]
  change: [event: Event]
}>()

function handleInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
  emit('input', event)
}

function handleChange(event: Event) {
  emit('change', event)
}
</script>

<template>
  <BaseFieldShell
    :id="id"
    :label="label"
    :label-class="labelClass"
    :wrapper-class="wrapperClass"
    :required="required"
    :helper-text="helperText"
    :helper-class="helperClass"
  >
    <input
      v-bind="attrs"
      :id="id || undefined"
      :value="modelValue ?? ''"
      :type="type"
      :class="inputClass"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :required="required"
      :autocomplete="autocomplete"
      :autofocus="autofocus"
      :min="min"
      :max="max"
      :step="step"
      :aria-label="inputAriaLabel || undefined"
      @input="handleInput"
      @change="handleChange"
    />
  </BaseFieldShell>
</template>
