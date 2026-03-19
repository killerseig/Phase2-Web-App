<script setup lang="ts">
import { ref, watch } from 'vue'
import AdminFormActions from '@/components/admin/AdminFormActions.vue'
import BaseModal from '@/components/common/BaseModal.vue'

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
  <BaseModal
    :open="true"
    :title="title"
    :close-disabled="loading"
    :close-on-backdrop="!loading"
    :close-on-escape="!loading"
    @close="handleCancel"
  >
    <form @submit.prevent="handleSubmit">
      <div v-for="field in fields" :key="field.name" class="mb-3">
        <label :for="field.name" class="form-label">
          {{ field.label }}
          <span v-if="field.required" class="text-danger">*</span>
        </label>

        <input
          v-if="field.type === 'text' || field.type === 'email'"
          :id="field.name"
          :type="field.type"
          class="form-control"
          :placeholder="field.placeholder || ''"
          v-model="formData[field.name]"
          :required="field.required"
          :disabled="loading"
        />

        <textarea
          v-else-if="field.type === 'textarea'"
          :id="field.name"
          class="form-control"
          :placeholder="field.placeholder || ''"
          :rows="field.rows || 3"
          v-model="formData[field.name]"
          :required="field.required"
          :disabled="loading"
        ></textarea>

        <select
          v-else-if="field.type === 'select'"
          :id="field.name"
          class="form-select"
          v-model="formData[field.name]"
          :required="field.required"
          :disabled="loading"
        >
          <option value="">-- Select --</option>
          <option
            v-for="option in field.options"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>
    </form>

    <template #footer>
      <AdminFormActions
        wrapper-class="d-flex gap-2 justify-content-end w-100"
        submit-type="button"
        :loading="loading"
        :submit-label="submitLabel"
        :cancel-label="cancelLabel"
        cancel-button-class="btn btn-secondary"
        @cancel="handleCancel"
        @submit="handleSubmit"
      />
    </template>
  </BaseModal>
</template>
