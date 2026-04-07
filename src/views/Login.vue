<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppAlert from '@/components/common/AppAlert.vue'
import BaseInputField from '@/components/common/BaseInputField.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { sendPasswordResetEmail } from '@/services'
import { ROUTE_NAMES } from '@/constants/app'
import { normalizeError } from '@/services/serviceUtils'
import { getFirstValidationMessage, validateEmail, validateLoginForm } from '@/utils/validation'

const authStore = useAuthStore()
const router = useRouter()
const toast = useToast()

const email = ref('')
const password = ref('')
const err = ref('')
const loading = ref(false)
const showResetModal = ref(false)
const resetEmail = ref('')
const resetLoading = ref(false)

const submit = async () => {
  err.value = ''
  const validation = validateLoginForm({
    email: email.value,
    password: password.value,
  })
  const validationMessage = getFirstValidationMessage(validation)
  if (validationMessage) {
    err.value = validationMessage
    toast.show(validationMessage, 'error')
    return
  }

  loading.value = true
  try {
    await authStore.login(email.value.trim(), password.value)
    await router.replace({ name: ROUTE_NAMES.DASHBOARD })
  } catch (e) {
    err.value = normalizeError(e, 'Auth failed')
    toast.show(err.value, 'error')
  } finally {
    loading.value = false
  }
}

function openResetModal() {
  resetEmail.value = email.value
  showResetModal.value = true
}

function closeResetModal() {
  showResetModal.value = false
  resetEmail.value = ''
}

function handleResetModalEscape() {
  if (resetLoading.value) return
  closeResetModal()
}

const sendReset = async () => {
  const emailErrors = validateEmail(resetEmail.value)
  const emailErrorMessage = emailErrors[0]?.message
  if (emailErrorMessage) {
    toast.show(emailErrorMessage, 'error')
    return
  }

  resetLoading.value = true
  try {
    await sendPasswordResetEmail(resetEmail.value.trim())
    toast.show('Password reset email sent! Check your inbox.', 'success')
    closeResetModal()
  } catch (e) {
    toast.show(normalizeError(e, 'Failed to send reset email'), 'error')
  } finally {
    resetLoading.value = false
  }
}
</script>

<template>
  <div class="auth-shell">
    <div class="card auth-card auth-card--narrow">
      <div class="card-body">
        <div class="app-page__eyebrow">Phase 2</div>
        <h1 class="h3 mb-2">Sign In</h1>
        <p class="text-muted small mb-4">Access daily logs, timecards, shop orders, and admin tools.</p>

        <BaseInputField
          id="login-email"
          v-model="email"
          type="email"
          label="Email"
          autocomplete="email"
          placeholder="you@example.com"
          wrapper-class="mb-3"
          @keyup.enter="submit"
        />

        <BaseInputField
          id="login-password"
          v-model="password"
          type="password"
          label="Password"
          autocomplete="current-password"
          placeholder="********"
          wrapper-class="mb-3"
          @keyup.enter="submit"
        />

        <button class="btn btn-primary w-100" :disabled="loading" @click="submit">
          <span v-if="loading" class="spinner-border spinner-border-sm me-2" />
          Sign In
        </button>
        <AppAlert
          v-if="err"
          variant="danger"
          class="mt-3 mb-0"
          :message="err"
          aria-live="assertive"
        />

        <div class="mt-3 text-center">
          <p class="mb-0">
            <button type="button" class="btn btn-link p-0 btn-sm" @click="openResetModal">
              Forgot password?
            </button>
          </p>
        </div>
      </div>
    </div>
  </div>
  <!-- Password Reset Modal -->
  <BaseModal
    :open="showResetModal"
    title="Reset Password"
    :close-on-backdrop="!resetLoading"
    :close-on-escape="!resetLoading"
    :close-disabled="resetLoading"
    @close="handleResetModalEscape"
  >
    <p class="text-muted small mb-3">Enter your email address and we'll send you a link to reset your password.</p>
    <BaseInputField
      id="reset-email"
      v-model="resetEmail"
      type="email"
      label="Email Address"
      placeholder="you@example.com"
      :disabled="resetLoading"
      autofocus
      @keyup.enter="sendReset"
    />

    <template #footer>
      <button type="button" class="btn btn-secondary" @click="closeResetModal" :disabled="resetLoading">
        Cancel
      </button>
      <button type="button" class="btn btn-primary" @click="sendReset" :disabled="resetLoading">
        <span v-if="resetLoading" class="spinner-border spinner-border-sm me-2" />
        Send Reset Link
      </button>
    </template>
  </BaseModal>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as vars;

.btn-link {
  color: var(--color-primary, vars.$primary);
  text-decoration: none;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
}

.btn-link:hover {
  text-decoration: underline;
}
</style>


