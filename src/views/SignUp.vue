<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Toast from '../components/Toast.vue'
import { updateProfile } from 'firebase/auth'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthStore } from '../stores/auth'

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

async function handleSignUp() {
  err.value = ''
  
  // Validation
  if (!email.value.trim()) {
    err.value = 'Email is required'
    toastRef.value?.show(err.value, 'error')
    return
  }
  
  if (!password.value) {
    err.value = 'Password is required'
    toastRef.value?.show(err.value, 'error')
    return
  }
  
  if (password.value !== confirmPassword.value) {
    err.value = 'Passwords do not match'
    toastRef.value?.show(err.value, 'error')
    return
  }
  
  if (password.value.length < 6) {
    err.value = 'Password must be at least 6 characters'
    toastRef.value?.show(err.value, 'error')
    return
  }

  loading.value = true
  try {
    // Register using auth store (creates both auth account and Firestore profile)
    const cred = await auth.register(email.value, password.value)
    
    // Update display name in Firebase Auth if provided
    const displayName = `${firstName.value.trim()} ${lastName.value.trim()}`.trim()
    if (displayName && cred.user) {
      await updateProfile(cred.user, {
        displayName,
      })
    }
    
    // Update first name and last name (role is already set to 'none' by auth.register)
    if (cred.user) {
      await updateDoc(doc(db, 'users', cred.user.uid), {
        firstName: firstName.value.trim() || null,
        lastName: lastName.value.trim() || null,
      })
    }
    
    toastRef.value?.show('Account created! Redirecting...', 'success')
    
    // Redirect to dashboard
    setTimeout(() => {
      router.push({ name: 'dashboard' })
    }, 1000)
  } catch (e: any) {
    let message = 'Failed to create account'
    
    if (e.code === 'auth/email-already-in-use') {
      message = 'Email already in use'
    } else if (e.code === 'auth/invalid-email') {
      message = 'Invalid email address'
    } else if (e.code === 'auth/operation-not-allowed') {
      message = 'Sign up is currently disabled'
    } else if (e.code === 'auth/weak-password') {
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
  router.push({ name: 'Login' })
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
              <label class="form-label">First Name</label>
              <input
                v-model="firstName"
                type="text"
                class="form-control"
                placeholder="First name"
              />
            </div>
            <div class="col-6">
              <label class="form-label">Last Name</label>
              <input
                v-model="lastName"
                type="text"
                class="form-control"
                placeholder="Last name"
              />
            </div>
          </div>

          <!-- Email -->
          <div class="mb-3">
            <label class="form-label">Email Address</label>
            <input
              v-model="email"
              type="email"
              class="form-control"
              placeholder="you@example.com"
              required
            />
          </div>

          <!-- Password -->
          <div class="mb-3">
            <label class="form-label">Password</label>
            <input
              v-model="password"
              type="password"
              class="form-control"
              placeholder="At least 6 characters"
              required
            />
          </div>

          <!-- Confirm Password -->
          <div class="mb-3">
            <label class="form-label">Confirm Password</label>
            <input
              v-model="confirmPassword"
              type="password"
              class="form-control"
              placeholder="Confirm your password"
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
  padding: 0 !important;
}

.btn-link:hover {
  text-decoration: underline;
}
</style>
