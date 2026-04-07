<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import BaseFieldShell from '@/components/common/BaseFieldShell.vue'

defineOptions({
  name: 'BaseSearchField',
  inheritAttrs: false,
})

interface Props {
  id?: string
  modelValue: string | null | undefined
  label?: string
  labelClass?: string
  wrapperClass?: string
  helperText?: string
  helperClass?: string
  inputClass?: string
  groupClass?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  autocomplete?: string
  autofocus?: boolean
  spellcheck?: boolean
  showIcon?: boolean
  iconClass?: string
  clearable?: boolean
  clearButtonClass?: string
  clearButtonLabel?: string
  inputAriaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  id: '',
  label: '',
  labelClass: '',
  wrapperClass: '',
  helperText: '',
  helperClass: '',
  inputClass: 'form-control',
  groupClass: 'input-group',
  placeholder: '',
  disabled: false,
  required: false,
  autocomplete: 'off',
  autofocus: false,
  spellcheck: false,
  showIcon: true,
  iconClass: 'bi bi-search',
  clearable: false,
  clearButtonClass: 'btn btn-outline-secondary',
  clearButtonLabel: 'Clear',
  inputAriaLabel: '',
})

const attrs = useAttrs()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  input: [event: Event]
  change: [event: Event]
  clear: []
}>()

const hasValue = computed(() => String(props.modelValue ?? '').length > 0)

function handleInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
  emit('input', event)
}

function handleChange(event: Event) {
  emit('change', event)
}

function clearValue() {
  emit('update:modelValue', '')
  emit('clear')
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
    <div :class="groupClass">
      <span v-if="showIcon" class="input-group-text">
        <i :class="iconClass"></i>
      </span>

      <input
        v-bind="attrs"
        :id="id || undefined"
        :value="modelValue ?? ''"
        type="text"
        :class="inputClass"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :autocomplete="autocomplete"
        :autofocus="autofocus"
        :spellcheck="spellcheck"
        :aria-label="inputAriaLabel || undefined"
        @input="handleInput"
        @change="handleChange"
      />

      <button
        v-if="clearable && hasValue"
        type="button"
        :class="clearButtonClass"
        :disabled="disabled"
        @click="clearValue"
      >
        {{ clearButtonLabel }}
      </button>
    </div>
  </BaseFieldShell>
</template>
