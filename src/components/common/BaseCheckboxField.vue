<script setup lang="ts">
import { useAttrs } from 'vue'

defineOptions({
  name: 'BaseCheckboxField',
  inheritAttrs: false,
})

interface Props {
  id?: string
  modelValue: boolean
  label?: string
  labelClass?: string
  wrapperClass?: string
  inputClass?: string
  helperText?: string
  helperClass?: string
  variant?: 'checkbox' | 'switch'
  disabled?: boolean
  required?: boolean
  inputAriaLabel?: string
}

withDefaults(defineProps<Props>(), {
  id: '',
  label: '',
  labelClass: '',
  wrapperClass: '',
  inputClass: '',
  helperText: '',
  helperClass: '',
  variant: 'checkbox',
  disabled: false,
  required: false,
  inputAriaLabel: '',
})

const attrs = useAttrs()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  change: [event: Event]
}>()

function handleChange(event: Event) {
  emit('update:modelValue', Boolean((event.target as HTMLInputElement).checked))
  emit('change', event)
}
</script>

<template>
  <div
    :class="[
      'app-checkbox-field',
      'form-check',
      variant === 'switch' ? 'form-switch' : '',
      wrapperClass,
    ]"
  >
    <input
      v-bind="attrs"
      :id="id || undefined"
      :checked="modelValue"
      type="checkbox"
      :class="['form-check-input', inputClass]"
      :disabled="disabled"
      :required="required"
      :aria-label="inputAriaLabel || undefined"
      @change="handleChange"
    />
    <label v-if="label" :for="id || undefined" :class="['form-check-label', labelClass]">
      {{ label }}
    </label>
    <div v-if="helperText || $slots.helper" :class="['form-text', helperClass]">
      <slot name="helper">
        {{ helperText }}
      </slot>
    </div>
  </div>
</template>
