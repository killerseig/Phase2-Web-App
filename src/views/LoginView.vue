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
import { useAuthStore } from '@/stores/auth'
import { readFirstQueryParam } from '@/utils/routerQuery'

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
  const nextEmail = readFirstQueryParam(route.query.email)
  if (nextEmail) {
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
  <AuthCard eyebrow="Phase 2" title="Phase 2 Web Application">
    <AppStatusMessage v-if="initializing" class="auth-card__status">
      Checking your current session...
    </AppStatusMessage>

    <form v-else @submit.prevent="handleLogin">
      <AppField class="auth-field" label="Email">
        <AppTextInput
          id="login-email"
          v-model="email"
          type="email"
          autocomplete="email"
          placeholder="you@example.com"
        />
      </AppField>

      <AppField class="auth-field" label="Password">
        <AppTextInput
          id="login-password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          placeholder="Enter your password"
        />
      </AppField>

      <AppLoadingButton
        class="auth-card__button"
        type="submit"
        variant="primary"
        label="Login"
        loading-label="Signing In..."
        :loading="loading"
      />

      <RouterLink class="auth-card__link" :to="forgotPasswordTarget">
        Forgot Password?
      </RouterLink>
    </form>

    <AppStatusMessage v-if="!hasFirebaseConfig" class="auth-card__status" tone="warning">
      Firebase is not configured yet. Copy the `v1` `VITE_FIREBASE_*` values into `.env.local`
      so this app can use the same project.
    </AppStatusMessage>
  </AuthCard>
</template>

