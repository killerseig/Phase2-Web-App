<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Toast from '../components/Toast.vue'
import { useAuthStore } from '../stores/auth'
import { finalizeRegisteredUserProfile } from '@/services'
import { normalizeError } from '@/services/serviceUtils'
import { getFirstValidationMessage, validateSignUpForm } from '@/utils/validation'

const router = useRouter()
const auth = useAuthStore()
const toastRef = ref<InstanceType<typeof Toast> | null>(null)

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const firstName = ref('')
const lastName = ref('')
const loading = ref(false)
const err = ref('')

const getAuthErrorCode = (error: unknown): string | null => {
  if (typeof error !== 'object' || error === null) return null
  if (!('code' in error)) return null
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

async function handleSignUp() {
  err.value = ''

  const validation = validateSignUpForm({
    email: email.value,
    password: password.value,
    confirmPassword: confirmPassword.value,
  })
  const validationMessage = getFirstValidationMessage(validation)
  if (validationMessage) {
    err.value = validationMessage
    toastRef.value?.show(validationMessage, 'error')
    return
  }

  const normalizedEmail = email.value.trim()
  const normalizedFirstName = firstName.value.trim()
  const normalizedLastName = lastName.value.trim()

  loading.value = true
  try {
    // Register using auth store (creates both auth account and Firestore profile)
    const cred = await auth.register(normalizedEmail, password.value)
    
    if (cred.user) {
      await finalizeRegisteredUserProfile(cred.user, normalizedFirstName, normalizedLastName)
    }
    
    toastRef.value?.show('Account created! Redirecting...', 'success')
    
    // Redirect to dashboard
    setTimeout(() => {
      router.push({ name: 'dashboard' })
    }, 1000)
  } catch (e) {
    const code = getAuthErrorCode(e)
    let message = normalizeError(e, 'Failed to create account')

    if (code === 'auth/email-already-in-use') {
      message = 'Email already in use'
    } else if (code === 'auth/invalid-email') {
      message = 'Invalid email address'
    } else if (code === 'auth/operation-not-allowed') {
      message = 'Sign up is currently disabled'
    } else if (code === 'auth/weak-password') {
      message = 'Password is too weak'
    }
    
    err.value = message
    toastRef.value?.show(message, 'error')
    console.error('Sign up error:', e)
  } finally {
    loading.value = false
  }
}

function goToLogin() {
  router.push({ name: 'login' })
}
</script>

<template>
  <Toast ref="toastRef" />
  
  <div class="container auth-container">
    <div class="mt-5 card">
      <div class="card-body">
        <h4 class="mb-3">Create Account</h4>

        <!-- Sign Up Form -->
        <form @submit.prevent="handleSignUp">
          <!-- First Name & Last Name -->
          <div class="row g-2 mb-3">
            <div class="col-6">
              <label class="form-label" for="signup-first-name">First Name</label>
              <input
                id="signup-first-name"
                v-model="firstName"
                type="text"
                class="form-control"
                placeholder="First name"
                autocomplete="given-name"
              />
            </div>
            <div class="col-6">
              <label class="form-label" for="signup-last-name">Last Name</label>
              <input
                id="signup-last-name"
                v-model="lastName"
                type="text"
                class="form-control"
                placeholder="Last name"
                autocomplete="family-name"
              />
            </div>
          </div>

          <!-- Email -->
          <div class="mb-3">
            <label class="form-label" for="signup-email">Email Address</label>
            <input
              id="signup-email"
              v-model="email"
              type="email"
              class="form-control"
              placeholder="you@example.com"
              autocomplete="email"
              required
            />
          </div>

          <!-- Password -->
          <div class="mb-3">
            <label class="form-label" for="signup-password">Password</label>
            <input
              id="signup-password"
              v-model="password"
              type="password"
              class="form-control"
              placeholder="At least 6 characters"
              autocomplete="new-password"
              required
            />
          </div>

          <!-- Confirm Password -->
          <div class="mb-3">
            <label class="form-label" for="signup-confirm-password">Confirm Password</label>
            <input
              id="signup-confirm-password"
              v-model="confirmPassword"
              type="password"
              class="form-control"
              placeholder="Confirm your password"
              autocomplete="new-password"
              required
            />
          </div>

          <!-- Error Message -->
          <div v-if="err" class="alert alert-danger" role="alert">
            {{ err }}
          </div>

          <!-- Sign Up Button -->
          <button
            type="submit"
            :disabled="loading"
            class="btn btn-primary w-100"
          >
            <span v-if="loading" class="spinner-border spinner-border-sm me-2" />
            {{ loading ? 'Creating Account...' : 'Create Account' }}
          </button>
        </form>

        <!-- Login Link -->
        <div class="mt-3 text-center">
          <p class="mb-0">
            Already have an account?
            <button
              type="button"
              class="btn btn-link p-0"
              @click="goToLogin"
            >
              Sign In
            </button>
          </p>
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

