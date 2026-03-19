<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AppLoadingState from '@/components/common/AppLoadingState.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { setPasswordFromSetupLink, verifySetupToken } from '@/services'
import { ROLES, ROUTE_NAMES } from '@/constants/app'
import { logError } from '@/utils/logger'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()

const setupToken = ref('')
const uid = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const verifying = ref(true)
const err = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return ''
}

const readQueryParam = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return ''
}

async function verifySetupLink() {
  const token = readQueryParam(route.query.setupToken)
  const userId = readQueryParam(route.query.uid)

  if (!token || !userId) {
    err.value = 'Invalid setup link. Please request a new password creation link.'
    verifying.value = false
    toast.show(err.value, 'error')
    return
  }

  setupToken.value = token
  uid.value = userId

  // Verify the token using Cloud Function
  try {
    email.value = await verifySetupToken(userId, token)
    verifying.value = false
  } catch (e) {
    let errorMsg = 'Invalid or expired password setup link.'
    const message = getErrorMessage(e)
    logError('SetPassword', 'Error during verification', message)
    
    if (message.includes('Token expired')) {
      errorMsg = 'This link has expired. Please request a new password setup link.'
    } else if (message.includes('Invalid token')) {
      errorMsg = 'This link is invalid. Please request a new password setup link.'
    } else if (message.includes('User not found')) {
      errorMsg = 'User account not found.'
    }
    err.value = errorMsg
    verifying.value = false
    toast.show(errorMsg, 'error')
  }
}

onMounted(() => {
  void verifySetupLink()
})

const submit = async () => {
  err.value = ''

  // Validation
  if (!password.value.trim()) {
    toast.show('Password is required', 'error')
    return
  }

  if (password.value.length < 6) {
    toast.show('Password must be at least 6 characters', 'error')
    return
  }

  if (password.value !== confirmPassword.value) {
    toast.show('Passwords do not match', 'error')
    return
  }

  loading.value = true
  try {
    await setPasswordFromSetupLink(uid.value, password.value, setupToken.value)
    await authStore.login(email.value, password.value)
    toast.show('Password set successfully! Logging you in...', 'success')
    if (authStore.role === ROLES.NONE) {
      await router.push({ name: ROUTE_NAMES.UNAUTHORIZED })
    } else {
      await router.push({ name: ROUTE_NAMES.DASHBOARD })
    }
  } catch (e) {
    let errorMsg = 'Failed to set password. Please try again.'
    const message = getErrorMessage(e)
    if (message.includes('auth/weak-password')) {
      errorMsg = 'Password is too weak. Please use a stronger password.'
    } else if (message.includes('requires recent authentication')) {
      errorMsg = 'Please request a new password setup link.'
    } else if (message) {
      errorMsg = message
    }
    err.value = errorMsg
    toast.show(errorMsg, 'error')
  } finally {
    loading.value = false
  }
}

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}

const toggleConfirmPasswordVisibility = () => {
  showConfirmPassword.value = !showConfirmPassword.value
}
</script>

<template>
  <div class="auth-shell">
    <div class="card auth-card auth-card--narrow set-password-card">
      <div class="card-body">
        <!-- Loading state -->
        <AppLoadingState
          v-if="verifying"
          sr-label="Verifying link..."
          message="Verifying your link..."
          spinner-class=""
          message-class="mt-3 text-muted mb-0"
        />

        <!-- Error state -->
        <div v-else-if="err && !email" class="text-center py-5">
          <div class="mb-3">
            <i class="bi bi-exclamation-circle text-danger invalid-link-icon"></i>
          </div>
          <h5 class="card-title">Link Invalid or Expired</h5>
          <p class="text-muted mb-4">{{ err }}</p>
          <router-link :to="{ name: ROUTE_NAMES.LOGIN }" class="btn btn-primary btn-sm">Back to Login</router-link>
        </div>

        <!-- Form state -->
        <div v-else>
          <div class="app-page__eyebrow">Phase 2</div>
          <h1 class="card-title h3 mb-1">Set Your Password</h1>
          <p class="text-muted small mb-4">Create a password for your new Phase 2 account</p>

          <div class="mb-3">
            <label class="form-label">Email</label>
            <input
              type="email"
              class="form-control"
              :value="email"
              readonly
              disabled
            />
          </div>

          <div class="mb-3">
            <label class="form-label">Password</label>
            <div class="input-group">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                class="form-control"
                placeholder="Enter your password"
                @keyup.enter="submit"
                :disabled="loading"
              />
              <button
                type="button"
                class="btn btn-outline-secondary"
                @click="togglePasswordVisibility"
                :disabled="loading"
              >
                <i :class="showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
              </button>
            </div>
            <small class="d-block text-muted mt-1">At least 6 characters</small>
          </div>

          <div class="mb-4">
            <label class="form-label">Confirm Password</label>
            <div class="input-group">
              <input
                v-model="confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                class="form-control"
                placeholder="Confirm your password"
                @keyup.enter="submit"
                :disabled="loading"
              />
              <button
                type="button"
                class="btn btn-outline-secondary"
                @click="toggleConfirmPasswordVisibility"
                :disabled="loading"
              >
                <i :class="showConfirmPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
              </button>
            </div>
          </div>

          <button
            @click="submit"
            class="btn btn-primary w-100"
            :disabled="loading || !password || !confirmPassword"
          >
            <span v-if="!loading">Create Password & Login</span>
            <span v-else>
              <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Creating...
            </span>
          </button>

          <hr class="my-4" />

          <div class="text-center">
              <small class="text-muted"
              >Already have an account?
              <router-link :to="{ name: ROUTE_NAMES.LOGIN }" class="text-decoration-none">Sign in here</router-link>
            </small>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.input-group > .btn-outline-secondary {
  border: 1px solid $border-color;
}

.input-group > .btn-outline-secondary:hover {
  background-color: $surface-2;
}

.set-password-card {
  width: 100%;
}

.invalid-link-icon {
  font-size: 3rem;
}
</style>

