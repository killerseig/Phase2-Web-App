<script setup lang="ts">
import { ref } from 'vue'
import { isValidEmail } from '../../utils/emailValidation'

interface Props {
  emails: string[]
  label?: string
  placeholder?: string
  disabled?: boolean
  maxEmails?: number
  inputName?: string
  autocompleteSection?: string
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
})

const newEmail = ref('')

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
      <span
        v-for="email in emails"
        :key="email"
        class="badge text-bg-primary d-flex align-items-center gap-1"
      >
        {{ email }}
        <button
          type="button"
          class="btn-close btn-close-white"
          style="font-size: 0.65rem; padding: 0"
          @click="removeEmail(email)"
          :disabled="disabled"
          aria-label="Remove"
        ></button>
      </span>
    </div>

    <!-- Add New Email -->
    <div class="row g-2">
      <div class="col">
        <input
          type="email"
          class="form-control form-control-sm"
          v-model="newEmail"
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
      No recipients added yet
    </small>

    <!-- Max Emails Warning -->
    <small v-if="maxEmails && emails.length >= maxEmails" class="text-warning d-block mt-2">
      Maximum {{ maxEmails }} recipients reached
    </small>
  </div>
</template>
