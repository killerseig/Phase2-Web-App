<script setup lang="ts">
import AdminCardWrapper from '@/components/admin/AdminCardWrapper.vue'
import BaseInputField from '@/components/common/BaseInputField.vue'

const props = defineProps<{
  purgeEmail: string
  purging: boolean
}>()

const emit = defineEmits<{
  'update:purgeEmail': [value: string]
  'remove-everywhere': []
}>()
</script>

<template>
  <AdminCardWrapper
    title="Remove Recipient Everywhere"
    icon="person-x"
    subtitle="Remove an email from all global recipient lists and all job-level daily log lists in one action."
  >
    <div class="row g-2 align-items-end">
      <div class="col-md-8">
        <BaseInputField
          :model-value="props.purgeEmail"
          type="email"
          label="Email to remove"
          label-class="small mb-1"
          placeholder="user@example.com"
          :disabled="props.purging"
          wrapper-class="mb-0"
          @update:model-value="emit('update:purgeEmail', $event)"
        />
      </div>

      <div class="col-md-4 d-grid">
        <button
          class="btn btn-outline-danger"
          :disabled="props.purging"
          @click="emit('remove-everywhere')"
        >
          <span v-if="props.purging" class="spinner-border spinner-border-sm me-2"></span>
          Remove From Everything
        </button>
      </div>
    </div>
  </AdminCardWrapper>
</template>
