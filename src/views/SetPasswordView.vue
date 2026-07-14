<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import AppField from '@/components/common/AppField.vue'
import AppLoadingButton from '@/components/common/AppLoadingButton.vue'
import AppStatusMessage from '@/components/common/AppStatusMessage.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'
import { useToastMessages } from '@/composables/useToastMessages'
import { useRoute, useRouter } from 'vue-router'
import { hasFirebaseConfig } from '@/firebase'
import { setPasswordFromSetupLink, verifySetupToken } from '@/services/auth'
import { useAuthStore } from '@/stores/auth'
import { normalizeError } from '@/utils/normalizeError'
import { readFirstQueryParam } from '@/utils/routerQuery'

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

async function verifyLink() {
  if (!hasFirebaseConfig) {
    error.value = 'Firebase is not configured yet. Add the v1 VITE_FIREBASE_* values first.'
    verifying.value = false
    return
  }

  const nextToken = readFirstQueryParam(route.query.setupToken)
  const nextUid = readFirstQueryParam(route.query.uid)

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
  <AuthCard
    eyebrow="Phase 2"
    title="Create Your Password"
    copy="Finish the admin-created account setup using the same link flow from the current app."
  >
    <AppStatusMessage v-if="verifying" class="auth-card__status">
      Verifying your setup link...
    </AppStatusMessage>

    <template v-else-if="email">
      <AppField class="auth-field" label="Email">
        <AppTextInput :model-value="email" type="email" readonly />
      </AppField>

      <AppField class="auth-field" label="New Password">
        <AppTextInput
          id="setup-password"
          v-model="password"
          type="password"
          autocomplete="new-password"
          placeholder="Create a secure password"
        />
      </AppField>

      <AppField class="auth-field" label="Confirm Password">
        <AppTextInput
          id="setup-confirm-password"
          v-model="confirmPassword"
          type="password"
          autocomplete="new-password"
          placeholder="Repeat your password"
        />
      </AppField>

      <AppLoadingButton
        class="auth-card__button"
        variant="primary"
        label="Create Password & Login"
        loading-label="Creating Password..."
        :loading="loading"
        @click="handleSubmit"
      />
    </template>
  </AuthCard>
</template>
