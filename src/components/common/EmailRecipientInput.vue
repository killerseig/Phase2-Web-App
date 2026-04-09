<script setup lang="ts">
import { computed, ref } from 'vue'
import AppBadge from '@/components/common/AppBadge.vue'
import BaseInputField from '@/components/common/BaseInputField.vue'
import { isValidEmail } from '@/utils/emailValidation'

interface Props {
  emails: string[]
  label?: string
  showLabel?: boolean
  placeholder?: string
  disabled?: boolean
  compact?: boolean
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
  showLabel: true,
  placeholder: 'email@example.com',
  disabled: false,
  compact: false,
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
  <div :class="['email-recipient-input', { 'email-recipient-input--compact': props.compact }]">
    <label v-if="props.showLabel" class="form-label small fw-semibold email-recipient-input__label">
      {{ label }}
    </label>

    <div v-if="emails.length > 0" class="email-recipient-input__chips">
      <AppBadge
        v-for="email in emails"
        :key="email"
        variant-class="text-bg-primary"
        class="email-recipient-input__chip d-flex align-items-center gap-1"
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

    <div class="row g-2 align-items-center email-recipient-input__entry">
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
          class="btn btn-primary btn-sm email-recipient-input__add"
          @click="addEmail"
          :disabled="!newEmail.trim() || disabled"
        >
          <i class="bi bi-plus-lg me-1"></i>Add
        </button>
      </div>
    </div>

    <small v-if="emails.length === 0" class="text-muted d-block mt-2 email-recipient-input__empty">
      {{ emptyText }}
    </small>

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
