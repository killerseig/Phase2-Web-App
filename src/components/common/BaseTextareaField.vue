<script setup lang="ts">
import { useAttrs } from 'vue'
import BaseFieldShell from '@/components/common/BaseFieldShell.vue'

defineOptions({
  name: 'BaseTextareaField',
  inheritAttrs: false,
})

interface Props {
  id?: string
  modelValue: string
  label?: string
  labelClass?: string
  wrapperClass?: string
  helperText?: string
  helperClass?: string
  textareaClass?: string
  rows?: number
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
}

withDefaults(defineProps<Props>(), {
  id: '',
  label: '',
  labelClass: '',
  wrapperClass: '',
  helperText: '',
  helperClass: '',
  textareaClass: 'form-control',
  rows: 3,
  placeholder: '',
  disabled: false,
  readonly: false,
  required: false,
})

const attrs = useAttrs()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  input: [event: Event]
  change: [event: Event]
}>()

function handleInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
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
    <textarea
      v-bind="attrs"
      :id="id || undefined"
      :value="modelValue"
      :class="textareaClass"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :required="required"
      @input="handleInput"
      @change="handleChange"
    />
  </BaseFieldShell>
</template>
