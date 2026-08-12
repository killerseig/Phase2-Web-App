<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import AuthFirebaseConfigWarning from '@/components/auth/AuthFirebaseConfigWarning.vue'
import AuthStatusMessage from '@/components/auth/AuthStatusMessage.vue'
import AuthSubmitButton from '@/components/auth/AuthSubmitButton.vue'
import AuthTextLink from '@/components/auth/AuthTextLink.vue'
import AppField from '@/components/common/AppField.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'
import { useToastMessages } from '@/composables/useToastMessages'
import { useRoute, useRouter } from 'vue-router'
import {
  getAuthEmailQueryPrefill,
  getForgotPasswordValidationMessage,
  redirectToWorkspaceIfAllowed,
} from '@/features/auth/authViewHelpers'
import { sendPasswordResetEmail } from '@/services/auth'
import { hasConfiguredFirebase } from '@/services/firebaseConfig'
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

onMounted(async () => {
  await auth.init()

  const redirected = await redirectToWorkspaceIfAllowed({
    hasWorkspaceAccess: auth.hasWorkspaceAccess,
    replace: (target) => router.replace(target),
  })
  if (redirected) {
    return
  }

  email.value = getAuthEmailQueryPrefill(route.query)
})

async function handleSubmit() {
  error.value = ''
  info.value = ''

  const validationMessage = getForgotPasswordValidationMessage(email.value)
  if (validationMessage) {
    error.value = validationMessage
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
  <AuthCard eyebrow="Phase 2" title="Reset Password">
    <AuthStatusMessage v-if="initializing">
      Checking your current session...
    </AuthStatusMessage>

    <template v-else>
      <form @submit.prevent="handleSubmit">
        <AppField class="auth-field" label="Email">
          <AppTextInput
            id="forgot-email"
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
          />
        </AppField>

        <AuthSubmitButton
          type="submit"
          label="Send Reset Link"
          loading-label="Sending Reset..."
          :loading="loading"
          :disabled="!hasConfiguredFirebase"
        />
      </form>

      <AuthTextLink to="/login">
        Back to login
      </AuthTextLink>
    </template>

    <AuthFirebaseConfigWarning v-if="!hasConfiguredFirebase" />
  </AuthCard>
</template>
