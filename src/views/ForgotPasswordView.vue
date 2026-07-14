<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import AppField from '@/components/common/AppField.vue'
import AppLoadingButton from '@/components/common/AppLoadingButton.vue'
import AppStatusMessage from '@/components/common/AppStatusMessage.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'
import { useToastMessages } from '@/composables/useToastMessages'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { hasFirebaseConfig } from '@/firebase'
import { sendPasswordResetEmail } from '@/services/auth'
import { useAuthStore } from '@/stores/auth'
import { normalizeError } from '@/utils/normalizeError'
import { readFirstQueryParam } from '@/utils/routerQuery'

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

  if (auth.hasWorkspaceAccess) {
    await router.replace('/jobs')
    return
  }

  email.value = readFirstQueryParam(route.query.email)
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
  <AuthCard eyebrow="Phase 2" title="Reset Password">
    <AppStatusMessage v-if="initializing" class="auth-card__status">
      Checking your current session...
    </AppStatusMessage>

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

        <AppLoadingButton
          class="auth-card__button"
          type="submit"
          variant="primary"
          label="Send Reset Link"
          loading-label="Sending Reset..."
          :loading="loading"
          :disabled="!hasFirebaseConfig"
        />
      </form>

      <RouterLink class="auth-card__link" to="/login">
        Back to login
      </RouterLink>
    </template>

    <AppStatusMessage v-if="!hasFirebaseConfig" class="auth-card__status" tone="warning">
      Firebase is not configured yet. Copy the `v1` `VITE_FIREBASE_*` values into `.env.local`
      so this app can use the same project.
    </AppStatusMessage>
  </AuthCard>
</template>
