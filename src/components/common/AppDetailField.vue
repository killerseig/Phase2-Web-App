<script setup lang="ts">
import { computed } from 'vue'
import BaseInputField from '@/components/common/BaseInputField.vue'

defineOptions({
  name: 'AppDetailField',
})

type DetailFieldValue = string | number | null | undefined

interface Props {
  id?: string
  editing: boolean
  label: string
  modelValue?: DetailFieldValue
  displayValue?: DetailFieldValue
  type?: 'text' | 'email' | 'number' | 'date' | 'password'
  placeholder?: string
  disabled?: boolean
  required?: boolean
  autocomplete?: string
  autofocus?: boolean
  min?: string | number
  max?: string | number
  step?: string | number
  fieldClass?: string
  labelClass?: string
  valueClass?: string
  inputClass?: string
  inputAriaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  id: '',
  modelValue: '',
  displayValue: undefined,
  type: 'text',
  placeholder: '',
  disabled: false,
  required: false,
  autocomplete: undefined,
  autofocus: false,
  min: undefined,
  max: undefined,
  step: undefined,
  fieldClass: '',
  labelClass: '',
  valueClass: '',
  inputClass: 'form-control',
  inputAriaLabel: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  input: [event: Event]
  change: [event: Event]
}>()

const normalizedDisplayValue = computed(() => {
  const rawValue = props.displayValue ?? props.modelValue

  if (rawValue == null || rawValue === '') {
    return '-'
  }

  return String(rawValue)
})

function stopPointer(event: Event) {
  event.stopPropagation()
}
</script>

<template>
  <div :class="['app-detail-field', fieldClass]">
    <div :class="['app-detail-field__label', labelClass]">
      {{ label }}
    </div>

    <div
      v-if="editing"
      class="app-detail-field__control"
      @click="stopPointer"
      @mousedown="stopPointer"
    >
      <slot name="input">
        <BaseInputField
          :id="id"
          :model-value="modelValue"
          :type="type"
          :placeholder="placeholder"
          :disabled="disabled"
          :required="required"
          :autocomplete="autocomplete"
          :autofocus="autofocus"
          :min="min"
          :max="max"
          :step="step"
          :input-class="inputClass"
          :input-aria-label="inputAriaLabel"
          wrapper-class="mb-0"
          @update:model-value="emit('update:modelValue', $event)"
          @input="emit('input', $event)"
          @change="emit('change', $event)"
        />
      </slot>
    </div>

    <div v-else :class="['app-detail-field__value', valueClass]">
      <slot name="value">
        {{ normalizedDisplayValue }}
      </slot>
    </div>
  </div>
</template>
