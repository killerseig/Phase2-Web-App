<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Toast from '../components/Toast.vue'
import { useAuthStore } from '../stores/auth'

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
  loading.value = true
  try {
    await authStore.login(email.value, password.value)
    router.push('/dashboard')
  } catch (e: any) {
    err.value = e?.message ?? 'Auth failed'
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

const sendReset = async () => {
  if (!resetEmail.value.trim()) {
    toastRef.value?.show('Please enter your email', 'warning')
    return
  }

  resetLoading.value = true
  try {
    // Use Firebase REST API directly - no reCAPTCHA issues
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email: resetEmail.value,
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to send reset email')
    }

    toastRef.value?.show('Password reset email sent! Check your inbox.', 'success')
    closeResetModal()
  } catch (e: any) {
    toastRef.value?.show(e?.message ?? 'Failed to send reset email', 'error')
  } finally {
    resetLoading.value = false
  }
}
</script>

<template>
  <Toast ref="toastRef" />
  
  <div class="container" style="max-width: 420px;">
    <div class="mt-5 card">
      <div class="card-body">
        <h4 class="mb-3">Sign In</h4>

        <div class="mb-3">
          <label class="form-label">Email</label>
          <input
            v-model="email"
            class="form-control"
            autocomplete="email"
            type="email"
            placeholder="you@example.com"
            @keyup.enter="submit"
          />
        </div>

        <div class="mb-3">
          <label class="form-label">Password</label>
          <input
            v-model="password"
            class="form-control"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            @keyup.enter="submit"
          />
        </div>

        <button class="btn btn-primary w-100" :disabled="loading" @click="submit">
          <span v-if="loading" class="spinner-border spinner-border-sm me-2" />
          Sign In
        </button>

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
  <div v-if="showResetModal" class="modal d-block" style="background: rgba(0, 0, 0, 0.5);">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Reset Password</h5>
          <button type="button" class="btn-close" @click="closeResetModal" :disabled="resetLoading"></button>
        </div>
        <div class="modal-body">
          <p class="text-muted small mb-3">Enter your email address and we'll send you a link to reset your password.</p>
          <div class="mb-3">
            <label class="form-label">Email Address</label>
            <input
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

<style scoped>
.btn-link {
  color: #0d6efd;
  text-decoration: none;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0 !important;
}

.btn-link:hover {
  text-decoration: underline;
}
</style>
