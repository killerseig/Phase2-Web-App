<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import AuthStatusMessage from '@/components/auth/AuthStatusMessage.vue'
import AuthSubmitButton from '@/components/auth/AuthSubmitButton.vue'
import AuthTextLink from '@/components/auth/AuthTextLink.vue'
import AppField from '@/components/common/AppField.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'
import { useToastMessages } from '@/composables/useToastMessages'
import { useRoute, useRouter } from 'vue-router'
import {
  getSetPasswordValidationMessage,
  invalidSetupLinkMessage,
  readSetupLinkParams,
} from '@/features/auth/authViewHelpers'
import { setPasswordFromSetupLink, verifySetupToken } from '@/services/auth'
import { hasConfiguredFirebase } from '@/services/firebaseConfig'
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
let active = true

onBeforeUnmount(() => { active = false })

useToastMessages([
  { source: error, severity: 'error', summary: 'Create Password', clear: false },
  { source: info, severity: 'success', summary: 'Create Password', clear: false },
])

async function verifyLink() {
  if (!hasConfiguredFirebase) {
    error.value = 'Firebase is not configured yet. Add the v1 VITE_FIREBASE_* values first.'
    verifying.value = false
    return
  }

  const { setupToken: nextToken, uid: nextUid } = readSetupLinkParams(route.query)

  if (!nextToken || !nextUid) {
    error.value = invalidSetupLinkMessage
    verifying.value = false
    return
  }

  setupToken.value = nextToken
  uid.value = nextUid

  try {
    const verifiedEmail = await verifySetupToken(nextUid, nextToken)
    if (active) email.value = verifiedEmail
  } catch (nextError) {
    if (active) error.value = normalizeError(nextError, 'Invalid or expired password setup link.')
  } finally {
    if (active) verifying.value = false
  }
}

async function handleSubmit() {
  if (!active || loading.value) return
  error.value = ''
  info.value = ''

  const validationMessage = getSetPasswordValidationMessage(password.value, confirmPassword.value)
  if (validationMessage) {
    error.value = validationMessage
    return
  }

  loading.value = true
  try {
    await setPasswordFromSetupLink(uid.value, password.value, setupToken.value)
    if (!active) return
    try {
      await auth.login(email.value, password.value)
      if (!active) return
      await router.replace('/jobs')
      return
    } catch {
      if (!active) return
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
    if (active) error.value = normalizeError(nextError, 'Failed to set password.')
  } finally {
    if (active) loading.value = false
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
    copy="Choose a password to finish setting up your account."
  >
    <AuthStatusMessage v-if="verifying">
      Verifying your setup link...
    </AuthStatusMessage>

    <form v-else-if="email" @submit.prevent="handleSubmit">
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

      <AuthSubmitButton
        label="Create Password & Login"
        loading-label="Creating Password..."
        :loading="loading"
      />
    </form>

    <AuthStatusMessage v-if="error" :message="error" tone="error" />
    <AuthStatusMessage v-if="info" :message="info" tone="success" />
    <AuthTextLink v-if="!verifying" to="/login">Back to login</AuthTextLink>
  </AuthCard>
</template>
