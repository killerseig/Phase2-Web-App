<script setup lang="ts">
import AdminAccordionFormCard from '@/components/admin/AdminAccordionFormCard.vue'
import BaseInputField from '@/components/common/BaseInputField.vue'
import BaseSelectField from '@/components/common/BaseSelectField.vue'
import type { Role } from '@/constants/app'

interface UserCreateForm {
  email: string
  firstName: string
  lastName: string
  role: Role
}

const props = defineProps<{
  open: boolean
  form: UserCreateForm
  loading: boolean
  roleOptions: readonly { value: Role; label: string }[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:form': [value: UserCreateForm]
  submit: []
  cancel: []
}>()

function updateField<K extends keyof UserCreateForm>(field: K, value: UserCreateForm[K]) {
  emit('update:form', {
    ...props.form,
    [field]: value,
  })
}
</script>

<template>
  <AdminAccordionFormCard
    :open="open"
    title="New User"
    subtitle="Create an account and assign initial access."
    form-class="row g-2 align-items-end"
    body-class="p-2"
    :loading="loading"
    submit-label="Create User"
    @update:open="(value) => emit('update:open', value)"
    @submit="emit('submit')"
    @cancel="emit('cancel')"
  >
    <div class="col-xl-4 col-md-6">
      <BaseInputField
        :model-value="form.email"
        type="email"
        label="Email"
        label-class="small"
        placeholder="user@example.com"
        required
        @update:model-value="updateField('email', $event)"
      />
    </div>
    <div class="col-xl-3 col-md-6">
      <BaseInputField
        :model-value="form.firstName"
        label="First Name"
        label-class="small"
        placeholder="John"
        required
        @update:model-value="updateField('firstName', $event)"
      />
    </div>
    <div class="col-xl-3 col-md-6">
      <BaseInputField
        :model-value="form.lastName"
        label="Last Name"
        label-class="small"
        placeholder="Doe"
        required
        @update:model-value="updateField('lastName', $event)"
      />
    </div>
    <div class="col-xl-2 col-md-6">
      <BaseSelectField
        :model-value="form.role"
        label="Role"
        label-class="small"
        :options="[...roleOptions]"
        required
        @update:model-value="updateField('role', $event as Role)"
      />
    </div>
  </AdminAccordionFormCard>
</template>
