<script setup lang="ts">
import { computed, ref, useAttrs } from 'vue'
import BaseFieldShell from '@/components/common/BaseFieldShell.vue'

defineOptions({
  name: 'BasePasswordField',
  inheritAttrs: false,
})

type PasswordValue = string | null | undefined

interface Props {
  id?: string
  modelValue: PasswordValue
  label?: string
  labelClass?: string
  wrapperClass?: string
  helperText?: string
  helperClass?: string
  groupClass?: string
  inputClass?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  autocomplete?: string
  autofocus?: boolean
  inputAriaLabel?: string
  showToggle?: boolean
  initiallyVisible?: boolean
  toggleButtonClass?: string
  showPasswordLabel?: string
  hidePasswordLabel?: string
  hiddenIconClass?: string
  visibleIconClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  id: '',
  label: '',
  labelClass: '',
  wrapperClass: '',
  helperText: '',
  helperClass: '',
  groupClass: 'input-group app-password-field',
  inputClass: 'form-control',
  placeholder: '',
  disabled: false,
  readonly: false,
  required: false,
  autocomplete: 'current-password',
  autofocus: false,
  inputAriaLabel: '',
  showToggle: true,
  initiallyVisible: false,
  toggleButtonClass: 'btn btn-outline-secondary app-password-field__toggle',
  showPasswordLabel: 'Show password',
  hidePasswordLabel: 'Hide password',
  hiddenIconClass: 'bi bi-eye',
  visibleIconClass: 'bi bi-eye-slash',
})

const attrs = useAttrs()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  input: [event: Event]
  change: [event: Event]
  'toggle-visibility': [visible: boolean]
}>()

const isVisible = ref(props.initiallyVisible)

const inputType = computed(() => (isVisible.value ? 'text' : 'password'))
const toggleLabel = computed(() => (isVisible.value ? props.hidePasswordLabel : props.showPasswordLabel))
const toggleIconClass = computed(() => (isVisible.value ? props.visibleIconClass : props.hiddenIconClass))

function handleInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
  emit('input', event)
}

function handleChange(event: Event) {
  emit('change', event)
}

function toggleVisibility() {
  isVisible.value = !isVisible.value
  emit('toggle-visibility', isVisible.value)
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
      <input
        v-bind="attrs"
        :id="id || undefined"
        :value="modelValue ?? ''"
        :type="inputType"
        :class="inputClass"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        :autocomplete="autocomplete"
        :autofocus="autofocus"
        :aria-label="inputAriaLabel || undefined"
        @input="handleInput"
        @change="handleChange"
      />
      <button
        v-if="showToggle"
        type="button"
        :class="toggleButtonClass"
        :aria-label="toggleLabel"
        :title="toggleLabel"
        :disabled="disabled"
        @click="toggleVisibility"
      >
        <i :class="toggleIconClass"></i>
      </button>
    </div>
  </BaseFieldShell>
</template>
