<script setup lang="ts">
import { ref, watch } from 'vue'
import BaseInputField from '@/components/common/BaseInputField.vue'
import BaseFormModal from '@/components/common/BaseFormModal.vue'
import BaseSelectField from '@/components/common/BaseSelectField.vue'
import BaseTextareaField from '@/components/common/BaseTextareaField.vue'

interface FormField {
  name: string
  label: string
  type: 'text' | 'email' | 'textarea' | 'select'
  placeholder?: string
  required?: boolean
  options?: Array<{ value: string; label: string }>
  rows?: number
}

interface Props {
  open?: boolean
  title: string
  fields: FormField[]
  initialData?: Record<string, string>
  loading?: boolean
  submitLabel?: string
  cancelLabel?: string
}

interface Emits {
  submit: [data: Record<string, string>]
  cancel: []
}

const props = withDefaults(defineProps<Props>(), {
  open: true,
  loading: false,
  submitLabel: 'Save',
  cancelLabel: 'Cancel',
  initialData: () => ({}),
})

const emit = defineEmits<Emits>()

const formData = ref<Record<string, string>>(
  props.fields.reduce((acc, field) => {
    acc[field.name] = props.initialData?.[field.name] || ''
    return acc
  }, {} as Record<string, string>)
)

watch(() => props.initialData, (newData) => {
  if (newData) {
    props.fields.forEach(field => {
      formData.value[field.name] = newData[field.name] || ''
    })
  }
})

function handleSubmit() {
  emit('submit', formData.value)
}

function handleCancel() {
  emit('cancel')
}
</script>

<template>
  <BaseFormModal
    :open="open"
    :title="title"
    :loading="loading"
    :submit-label="submitLabel"
    :cancel-label="cancelLabel"
    @close="handleCancel"
    @cancel="handleCancel"
    @submit="handleSubmit"
  >
    <div>
      <div v-for="field in fields" :key="field.name" class="mb-3">
        <BaseInputField
          v-if="field.type === 'text' || field.type === 'email'"
          :id="field.name"
          :model-value="formData[field.name] || ''"
          :type="field.type"
          :label="field.label"
          :placeholder="field.placeholder || ''"
          :required="field.required ?? false"
          :disabled="loading"
          @update:model-value="formData[field.name] = $event"
        />

        <BaseTextareaField
          v-else-if="field.type === 'textarea'"
          :id="field.name"
          :model-value="formData[field.name] || ''"
          :label="field.label"
          :placeholder="field.placeholder || ''"
          :rows="field.rows || 3"
          :required="field.required ?? false"
          :disabled="loading"
          @update:model-value="formData[field.name] = $event"
        />

        <BaseSelectField
          v-else-if="field.type === 'select'"
          :id="field.name"
          :model-value="formData[field.name] || ''"
          :label="field.label"
          :options="field.options || []"
          :required="field.required ?? false"
          :disabled="loading"
          include-empty-option
          @update:model-value="formData[field.name] = String($event)"
        />
      </div>
    </div>
  </BaseFormModal>
</template>
