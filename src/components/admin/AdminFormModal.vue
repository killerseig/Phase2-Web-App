<script setup lang="ts">
import { ref, watch } from 'vue'

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
  initialData?: Record<string, any>
  loading?: boolean
  submitLabel?: string
  cancelLabel?: string
}

interface Emits {
  submit: [data: Record<string, any>]
  cancel: []
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  submitLabel: 'Save',
  cancelLabel: 'Cancel',
  initialData: () => ({}),
})

const emit = defineEmits<Emits>()

const formData = ref<Record<string, any>>(
  props.fields.reduce((acc, field) => {
    acc[field.name] = props.initialData?.[field.name] || ''
    return acc
  }, {})
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
  <div class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5)">
    <div class="modal-dialog">
      <div class="modal-content">
        <!-- Header -->
        <div class="modal-header">
          <h5 class="modal-title">{{ title }}</h5>
          <button
            type="button"
            class="btn-close"
            @click="handleCancel"
            :disabled="loading"
            aria-label="Close"
          ></button>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <form @submit.prevent="handleSubmit">
            <div v-for="field in fields" :key="field.name" class="mb-3">
              <label :for="field.name" class="form-label">
                {{ field.label }}
                <span v-if="field.required" class="text-danger">*</span>
              </label>

              <!-- Text/Email Input -->
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

              <!-- Textarea -->
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

              <!-- Select -->
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
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            @click="handleCancel"
            :disabled="loading"
          >
            {{ cancelLabel }}
          </button>
          <button
            type="button"
            class="btn btn-primary"
            @click="handleSubmit"
            :disabled="loading"
          >
            <span v-if="loading" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            {{ submitLabel }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
