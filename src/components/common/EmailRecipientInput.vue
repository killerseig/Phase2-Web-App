<script setup lang="ts">
import { computed, ref } from 'vue'
import AppBadge from '@/components/common/AppBadge.vue'
import BaseInputField from '@/components/common/BaseInputField.vue'
import { isValidEmail } from '@/utils/emailValidation'

interface Props {
  emails: string[]
  label?: string
  placeholder?: string
  disabled?: boolean
  maxEmails?: number
  inputName?: string
  autocompleteSection?: string
  readOnlyEmails?: string[]
  readOnlyLabel?: string
  readOnlyBadgeLabel?: string
  emptyText?: string
}

const emit = defineEmits<{
  add: [email: string]
  remove: [email: string]
}>()

const props = withDefaults(defineProps<Props>(), {
  label: 'Email Recipients',
  placeholder: 'email@example.com',
  disabled: false,
  maxEmails: undefined,
  inputName: '',
  autocompleteSection: '',
  readOnlyEmails: () => [],
  readOnlyLabel: '',
  readOnlyBadgeLabel: 'Read only',
  emptyText: 'No recipients added yet',
})

const newEmail = ref('')
const uniqueReadOnlyEmails = computed(() =>
  Array.from(new Set((props.readOnlyEmails ?? []).filter(Boolean)))
)

function addEmail() {
  const email = newEmail.value.trim()
  if (!email) return

  if (!isValidEmail(email)) {
    return
  }

  if (props.emails.includes(email)) {
    return
  }

  if (props.maxEmails && props.emails.length >= props.maxEmails) {
    return
  }

  emit('add', email)
  newEmail.value = ''
}

function removeEmail(email: string) {
  emit('remove', email)
}
</script>

<template>
  <div>
    <!-- Label -->
    <label class="form-label small fw-semibold">{{ label }}</label>

    <!-- Current Emails -->
    <div v-if="emails.length > 0" class="d-flex flex-wrap gap-2 mb-3">
      <AppBadge
        v-for="email in emails"
        :key="email"
        variant-class="text-bg-primary"
        class="d-flex align-items-center gap-1"
      >
        {{ email }}
        <button
          type="button"
          class="btn-close btn-close-white recipient-remove-btn"
          @click="removeEmail(email)"
          :disabled="disabled"
          aria-label="Remove"
        ></button>
      </AppBadge>
    </div>

    <!-- Add New Email -->
    <div class="row g-2">
      <div class="col">
        <BaseInputField
          v-model="newEmail"
          type="email"
          input-class="form-control form-control-sm"
          wrapper-class="mb-0"
          :placeholder="placeholder"
          :name="inputName || undefined"
          :autocomplete="autocompleteSection ? `section-${autocompleteSection} email` : 'off'"
          @keyup.enter="addEmail"
          :disabled="disabled"
        />
      </div>
      <div class="col-auto">
        <button
          type="button"
          class="btn btn-primary btn-sm"
          @click="addEmail"
          :disabled="!newEmail.trim() || disabled"
        >
          <i class="bi bi-plus-lg me-1"></i>Add
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <small v-if="emails.length === 0" class="text-muted d-block mt-2">
      {{ emptyText }}
    </small>

    <!-- Max Emails Warning -->
    <small v-if="maxEmails && emails.length >= maxEmails" class="text-warning d-block mt-2">
      Maximum {{ maxEmails }} recipients reached
    </small>

    <div v-if="uniqueReadOnlyEmails.length > 0" class="mt-3">
      <p v-if="readOnlyLabel" class="text-muted small mb-2">{{ readOnlyLabel }}</p>
      <div class="list-group">
        <div
          v-for="email in uniqueReadOnlyEmails"
          :key="`readonly-${email}`"
          class="list-group-item d-flex justify-content-between align-items-center"
        >
          <small>{{ email }}</small>
          <AppBadge :label="readOnlyBadgeLabel" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recipient-remove-btn {
  font-size: 0.65rem;
  padding: 0;
}
</style>
