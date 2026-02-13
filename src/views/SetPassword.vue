<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Toast from '../components/Toast.vue'
import { updatePassword } from 'firebase/auth'
import { auth } from '../firebase'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const toastRef = ref<InstanceType<typeof Toast> | null>(null)
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

onMounted(async () => {
  // Get parameters from URL
  const token = route.query.setupToken as string
  const userId = route.query.uid as string

  console.log('[SetPassword] Mounted with params:', { token: token?.substring(0, 10) + '...', userId })

  if (!token || !userId) {
    err.value = 'Invalid setup link. Please request a new password creation link.'
    verifying.value = false
    toastRef.value?.show(err.value, 'error')
    return
  }

  setupToken.value = token
  uid.value = userId

  // Verify the token using Cloud Function
  try {
    console.log('[SetPassword] Calling verifySetupToken function')
    const verifyTokenFn = httpsCallable(functions, 'verifySetupToken')
    const result = await verifyTokenFn({ uid: userId, setupToken: token })
    
    console.log('[SetPassword] Token verified successfully:', (result.data as any).email)
    email.value = (result.data as any).email || ''
    verifying.value = false
  } catch (e: any) {
    let errorMsg = 'Invalid or expired password setup link.'
    console.error('[SetPassword] Error during verification:', e.message)
    
    if (e.message?.includes('Token expired')) {
      errorMsg = 'This link has expired. Please request a new password setup link.'
    } else if (e.message?.includes('Invalid token')) {
      errorMsg = 'This link is invalid. Please request a new password setup link.'
    } else if (e.message?.includes('User not found')) {
      errorMsg = 'User account not found.'
    }
    err.value = errorMsg
    verifying.value = false
    toastRef.value?.show(errorMsg, 'error')
  }
})

const submit = async () => {
  err.value = ''

  // Validation
  if (!password.value.trim()) {
    toastRef.value?.show('Password is required', 'error')
    return
  }

  if (password.value.length < 6) {
    toastRef.value?.show('Password must be at least 6 characters', 'error')
    return
  }

  if (password.value !== confirmPassword.value) {
    toastRef.value?.show('Passwords do not match', 'error')
    return
  }

  loading.value = true
  try {
    // Get the current user and update password
    try {
      // Try to update password directly using the auth user
      const currentUser = auth.currentUser
      if (currentUser && currentUser.uid === uid.value) {
        await updatePassword(currentUser, password.value)
        await authStore.login(email.value, password.value)
        toastRef.value?.show('Password set successfully! Logging you in...', 'success')
        if (authStore.role === 'none') {
          await router.push('/unauthorized')
        } else {
          await router.push('/dashboard')
        }
      } else {
        // User not currently signed in, use Firebase Admin SDK approach via function call
        const { httpsCallable } = await import('firebase/functions')
        const { functions } = await import('../firebase')
        
        const setUserPassword = httpsCallable(functions, 'setUserPassword')
        await setUserPassword({ 
          uid: uid.value, 
          password: password.value,
          setupToken: setupToken.value 
        })
        await authStore.login(email.value, password.value)
        toastRef.value?.show('Password set successfully! Logging you in...', 'success')
        if (authStore.role === 'none') {
          await router.push('/unauthorized')
        } else {
          await router.push('/dashboard')
        }
      }
    } catch (e: any) {
      throw e
    }
  } catch (e: any) {
    let errorMsg = 'Failed to set password. Please try again.'
    if (e.message?.includes('auth/weak-password')) {
      errorMsg = 'Password is too weak. Please use a stronger password.'
    } else if (e.message?.includes('requires recent authentication')) {
      errorMsg = 'Please request a new password setup link.'
    } else if (e.message) {
      errorMsg = e.message
    }
    err.value = errorMsg
    toastRef.value?.show(errorMsg, 'error')
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
  <Toast ref="toastRef" />

  <div class="container d-flex align-items-center justify-content-center" style="min-height: 100vh; max-width: 420px;">
    <div class="card w-100" style="margin-top: -100px;">
      <div class="card-body">
        <!-- Loading state -->
        <div v-if="verifying" class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Verifying link...</span>
          </div>
          <p class="mt-3 text-muted">Verifying your link...</p>
        </div>

        <!-- Error state -->
        <div v-else-if="err && !email" class="text-center py-5">
          <div class="mb-3">
            <i class="bi bi-exclamation-circle text-danger" style="font-size: 3rem;"></i>
          </div>
          <h5 class="card-title">Link Invalid or Expired</h5>
          <p class="text-muted mb-4">{{ err }}</p>
          <router-link to="/login" class="btn btn-primary btn-sm">Back to Login</router-link>
        </div>

        <!-- Form state -->
        <div v-else>
          <h4 class="card-title mb-1">Set Your Password</h4>
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
              <router-link to="/login" class="text-decoration-none">Sign in here</router-link>
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
</style>
