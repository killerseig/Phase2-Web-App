<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Toast from '@/components/Toast.vue'
import { useAuthStore } from '@/stores/auth'
import { sendPasswordResetEmail } from '@/services'
import { ROUTE_NAMES } from '@/constants/app'
import { normalizeError } from '@/services/serviceUtils'
import { getFirstValidationMessage, validateEmail, validateLoginForm } from '@/utils/validation'

const authStore = useAuthStore()
const router = useRouter()
const toastRef = ref<InstanceType<typeof Toast> | null>(null)

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
    toastRef.value?.show(validationMessage, 'error')
    return
  }

  loading.value = true
  try {
    await authStore.login(email.value.trim(), password.value)
    await router.replace({ name: ROUTE_NAMES.DASHBOARD })
  } catch (e) {
    err.value = normalizeError(e, 'Auth failed')
    toastRef.value?.show(err.value, 'error')
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
    toastRef.value?.show(emailErrorMessage, 'error')
    return
  }

  resetLoading.value = true
  try {
    await sendPasswordResetEmail(resetEmail.value.trim())
    toastRef.value?.show('Password reset email sent! Check your inbox.', 'success')
    closeResetModal()
  } catch (e) {
    toastRef.value?.show(normalizeError(e, 'Failed to send reset email'), 'error')
  } finally {
    resetLoading.value = false
  }
}
</script>

<template>
  <Toast ref="toastRef" />
  
  <div class="container auth-container">
    <div class="mt-5 card">
      <div class="card-body">
        <h4 class="mb-3">Sign In</h4>

        <div class="mb-3">
          <label class="form-label" for="login-email">Email</label>
          <input
            id="login-email"
            v-model="email"
            class="form-control"
            autocomplete="email"
            type="email"
            placeholder="you@example.com"
            @keyup.enter="submit"
          />
        </div>

        <div class="mb-3">
          <label class="form-label" for="login-password">Password</label>
          <input
            id="login-password"
            v-model="password"
            class="form-control"
            type="password"
            autocomplete="current-password"
            placeholder="********"
            @keyup.enter="submit"
          />
        </div>

        <button class="btn btn-primary w-100" :disabled="loading" @click="submit">
          <span v-if="loading" class="spinner-border spinner-border-sm me-2" />
          Sign In
        </button>
        <div v-if="err" class="alert alert-danger mt-3 mb-0" role="alert" aria-live="assertive">
          {{ err }}
        </div>

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
  <div
    v-if="showResetModal"
    class="modal d-block bg-dark bg-opacity-50"
    role="dialog"
    aria-modal="true"
    aria-labelledby="reset-password-title"
    tabindex="-1"
    @keydown.esc="handleResetModalEscape"
  >
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 id="reset-password-title" class="modal-title">Reset Password</h5>
          <button type="button" class="btn-close" aria-label="Close reset password dialog" @click="closeResetModal" :disabled="resetLoading"></button>
        </div>
        <div class="modal-body">
          <p class="text-muted small mb-3">Enter your email address and we'll send you a link to reset your password.</p>
          <div class="mb-3">
            <label class="form-label" for="reset-email">Email Address</label>
            <input
              id="reset-email"
              v-model="resetEmail"
              class="form-control"
              type="email"
              placeholder="you@example.com"
              @keyup.enter="sendReset"
              :disabled="resetLoading"
            />
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="closeResetModal" :disabled="resetLoading">
            Cancel
          </button>
          <button type="button" class="btn btn-primary" @click="sendReset" :disabled="resetLoading">
            <span v-if="resetLoading" class="spinner-border spinner-border-sm me-2" />
            Send Reset Link
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as vars;

.auth-container {
  max-width: 420px;
}

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


