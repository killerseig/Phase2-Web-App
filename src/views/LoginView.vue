<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useToastMessages } from '@/composables/useToastMessages'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { hasFirebaseConfig } from '@/firebase'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref('')
const info = ref('')
const loading = ref(false)
const initializing = computed(() => !auth.ready)
const forgotPasswordTarget = computed(() => {
  const nextEmail = email.value.trim()
  return {
    name: 'forgot-password',
    query: nextEmail ? { email: nextEmail } : undefined,
  }
})

useToastMessages([
  { source: error, severity: 'error', summary: 'Login' },
  { source: info, severity: 'success', summary: 'Login' },
])

async function routeIntoWorkspaceIfAllowed() {
  if (!auth.hasWorkspaceAccess) return
  await router.replace('/jobs')
}

onMounted(async () => {
  const nextEmail = route.query.email
  if (typeof nextEmail === 'string') {
    email.value = nextEmail
  }

  if (route.query.passwordCreated === '1') {
    info.value = 'Password created. Sign in with your new password.'
  }

  await auth.init()
  await routeIntoWorkspaceIfAllowed()
})

async function handleLogin() {
  error.value = ''
  info.value = ''

  if (!email.value.trim() || !password.value) {
    error.value = 'Enter your email and password.'
    return
  }

  loading.value = true
  try {
    await auth.login(email.value, password.value)

    if (!auth.hasWorkspaceAccess) {
      await auth.signOut()
      error.value = 'This account signed in, but it does not currently have access to the app.'
      return
    }

    await routeIntoWorkspaceIfAllowed()
  } catch (nextError) {
    error.value = auth.getLoginErrorMessage(nextError)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <span class="auth-card__eyebrow">Phase 2</span>
      <h1 class="auth-card__title">Phase 2 Web Application</h1>

      <div v-if="initializing" class="auth-card__note">
        Checking your current session...
      </div>

      <form v-else @submit.prevent="handleLogin">
        <div class="auth-field">
          <label for="login-email">Email</label>
          <input
            id="login-email"
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
          />
        </div>

        <div class="auth-field">
          <label for="login-password">Password</label>
          <input
            id="login-password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="Enter your password"
          />
        </div>

        <button class="app-button app-button--primary auth-card__button" :disabled="loading">
          {{ loading ? 'Signing In...' : 'Login' }}
        </button>

        <RouterLink class="auth-card__link" :to="forgotPasswordTarget">
          Forgot Password?
        </RouterLink>
      </form>
      <div v-if="!hasFirebaseConfig" class="auth-card__note">
        Firebase is not configured yet. Copy the `v1` `VITE_FIREBASE_*` values into `.env.local`
        so this app can use the same project.
      </div>
    </div>
  </div>
</template>

