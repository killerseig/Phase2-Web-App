<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useToastMessages } from '@/composables/useToastMessages'
import { useRoute, useRouter } from 'vue-router'
import { hasFirebaseConfig } from '@/firebase'
import { setPasswordFromSetupLink, verifySetupToken } from '@/services/auth'
import { useAuthStore } from '@/stores/auth'
import { normalizeError } from '@/utils/normalizeError'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const setupToken = ref('')
const uid = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const verifying = ref(true)
const error = ref('')
const info = ref('')

useToastMessages([
  { source: error, severity: 'error', summary: 'Create Password' },
  { source: info, severity: 'success', summary: 'Create Password' },
])

function readQueryParam(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return ''
}

async function verifyLink() {
  if (!hasFirebaseConfig) {
    error.value = 'Firebase is not configured yet. Add the v1 VITE_FIREBASE_* values first.'
    verifying.value = false
    return
  }

  const nextToken = readQueryParam(route.query.setupToken)
  const nextUid = readQueryParam(route.query.uid)

  if (!nextToken || !nextUid) {
    error.value = 'Invalid setup link. Please request a new password creation link.'
    verifying.value = false
    return
  }

  setupToken.value = nextToken
  uid.value = nextUid

  try {
    email.value = await verifySetupToken(nextUid, nextToken)
  } catch (nextError) {
    error.value = normalizeError(nextError, 'Invalid or expired password setup link.')
  } finally {
    verifying.value = false
  }
}

async function handleSubmit() {
  error.value = ''
  info.value = ''

  if (!password.value.trim()) {
    error.value = 'Password is required.'
    return
  }

  if (password.value.length < 6) {
    error.value = 'Password must be at least 6 characters.'
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    return
  }

  loading.value = true
  try {
    await setPasswordFromSetupLink(uid.value, password.value, setupToken.value)
    try {
      await auth.login(email.value, password.value)
      await router.replace('/jobs')
      return
    } catch {
      await router.replace({
        name: 'login',
        query: {
          email: email.value,
          passwordCreated: '1',
        },
      })
      return
    }
  } catch (nextError) {
    error.value = normalizeError(nextError, 'Failed to set password.')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void verifyLink()
})
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <span class="auth-card__eyebrow">Phase 2</span>
      <h1 class="auth-card__title">Create Your Password</h1>
      <p class="auth-card__copy">
        Finish the admin-created account setup using the same link flow from the current app.
      </p>

      <div v-if="verifying" class="auth-card__note">
        Verifying your setup link...
      </div>

      <template v-else-if="email">
        <div class="auth-field">
          <label>Email</label>
          <input :value="email" type="email" readonly />
        </div>

        <div class="auth-field">
          <label for="setup-password">New Password</label>
          <input
            id="setup-password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            placeholder="Create a secure password"
          />
        </div>

        <div class="auth-field">
          <label for="setup-confirm-password">Confirm Password</label>
          <input
            id="setup-confirm-password"
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            placeholder="Repeat your password"
          />
        </div>

        <button class="app-button app-button--primary auth-card__button" :disabled="loading" @click="handleSubmit">
          {{ loading ? 'Creating Password...' : 'Create Password & Login' }}
        </button>
      </template>
    </div>
  </div>
</template>
