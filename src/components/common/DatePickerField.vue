<script setup lang="ts">
import { computed, ref } from 'vue'
import flatPickr from 'vue-flatpickr-component'
import 'flatpickr/dist/flatpickr.css'
import { getDateInputValueFromSelection } from '@/utils/dateInputs'

type FlatpickrOpenHandle = {
  open?: () => void
}

type FlatpickrRefHandle = {
  fp?: FlatpickrOpenHandle
  flatpickr?: FlatpickrOpenHandle
}

const props = withDefaults(defineProps<{
  modelValue: string
  config: Record<string, unknown>
  inputAriaLabel: string
  label?: string
  labelClass?: string
  wrapperClass?: string
  groupClass?: string
  inputClass?: string
  placeholder?: string
  prependIcon?: string
  size?: 'sm' | 'md'
  disabled?: boolean
  showOpenButton?: boolean
  openOnFocus?: boolean
  openButtonAriaLabel?: string
  openButtonTitle?: string
  openButtonIcon?: string
}>(), {
  label: '',
  labelClass: 'form-label',
  wrapperClass: '',
  groupClass: '',
  inputClass: '',
  placeholder: '',
  prependIcon: '',
  size: 'md',
  disabled: false,
  showOpenButton: false,
  openOnFocus: false,
  openButtonAriaLabel: 'Open date picker',
  openButtonTitle: 'Open date picker',
  openButtonIcon: 'bi bi-calendar3',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'change': [value: string]
  'focus': []
}>()

const pickerRef = ref<FlatpickrRefHandle | null>(null)

const model = computed({
  get: () => props.modelValue,
  set: (value: string | number | null | undefined) => {
    emit('update:modelValue', String(value ?? ''))
  },
})

const groupClasses = computed(() => [
  'input-group',
  props.size === 'sm' ? 'input-group-sm' : '',
  props.groupClass,
].filter(Boolean))

const inputClasses = computed(() => [
  'form-control',
  props.size === 'sm' ? 'form-control-sm' : '',
  props.inputClass,
].filter(Boolean))

function openPicker() {
  const picker = pickerRef.value?.fp || pickerRef.value?.flatpickr
  if (picker?.open) picker.open()
}

function handleChange(selectedDates: Date[]) {
  const nextValue = getDateInputValueFromSelection(selectedDates)
  if (!nextValue) return
  emit('update:modelValue', nextValue)
  emit('change', nextValue)
}

function handleFocus() {
  if (props.openOnFocus) {
    openPicker()
  }
  emit('focus')
}

defineExpose({ open: openPicker })
</script>

<template>
  <div :class="wrapperClass">
    <label v-if="label" :class="labelClass">{{ label }}</label>
    <div :class="groupClasses">
      <span v-if="prependIcon" class="input-group-text">
        <i :class="prependIcon" />
      </span>
      <flat-pickr
        ref="pickerRef"
        v-model="model"
        :config="config"
        :class="inputClasses"
        :placeholder="placeholder"
        :aria-label="inputAriaLabel"
        :disabled="disabled"
        @on-change="handleChange"
        @focus="handleFocus"
      />
      <button
        v-if="showOpenButton"
        type="button"
        class="btn btn-outline-secondary"
        :title="openButtonTitle"
        :aria-label="openButtonAriaLabel"
        :disabled="disabled"
        @click="openPicker"
      >
        <i :class="openButtonIcon" />
      </button>
    </div>
  </div>
</template>
