<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useToastMessages } from '@/composables/useToastMessages'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { hasFirebaseConfig } from '@/firebase'
import { sendPasswordResetEmail } from '@/services/auth'
import { useAuthStore } from '@/stores/auth'
import { normalizeError } from '@/utils/normalizeError'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const email = ref('')
const error = ref('')
const info = ref('')
const loading = ref(false)
const initializing = computed(() => !auth.ready)

useToastMessages([
  { source: error, severity: 'error', summary: 'Reset Password' },
  { source: info, severity: 'success', summary: 'Reset Password' },
])

function readQueryParam(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return ''
}

onMounted(async () => {
  await auth.init()

  if (auth.hasWorkspaceAccess) {
    await router.replace('/jobs')
    return
  }

  email.value = readQueryParam(route.query.email)
})

async function handleSubmit() {
  error.value = ''
  info.value = ''

  if (!email.value.trim()) {
    error.value = 'Enter your email first.'
    return
  }

  loading.value = true
  try {
    await sendPasswordResetEmail(email.value)
    info.value = 'Password reset email sent. Check your inbox.'
  } catch (nextError) {
    error.value = normalizeError(nextError, 'Failed to send reset email.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <span class="auth-card__eyebrow">Phase 2</span>
      <h1 class="auth-card__title">Reset Password</h1>

      <div v-if="initializing" class="auth-card__note">
        Checking your current session...
      </div>

      <template v-else>
        <form @submit.prevent="handleSubmit">
          <div class="auth-field">
            <label for="forgot-email">Email</label>
            <input
              id="forgot-email"
              v-model="email"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
            />
          </div>

          <button class="app-button app-button--primary auth-card__button" :disabled="loading || !hasFirebaseConfig">
            {{ loading ? 'Sending Reset...' : 'Send Reset Link' }}
          </button>
        </form>

        <RouterLink class="auth-card__link" to="/login">
          Back to login
        </RouterLink>
      </template>

      <div v-if="!hasFirebaseConfig" class="auth-card__note">
        Firebase is not configured yet. Copy the `v1` `VITE_FIREBASE_*` values into `.env.local`
        so this app can use the same project.
      </div>
    </div>
  </div>
</template>
