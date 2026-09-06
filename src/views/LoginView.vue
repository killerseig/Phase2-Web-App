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
  buildForgotPasswordTarget,
  getAuthEmailQueryPrefill,
  getLoginValidationMessage,
  getPasswordCreatedLoginInfo,
  getWorkspaceRedirectTarget,
  redirectToWorkspaceIfAllowed,
} from '@/features/auth/authViewHelpers'
import { hasConfiguredFirebase } from '@/services/firebaseConfig'
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
const forgotPasswordTarget = computed(() => buildForgotPasswordTarget(email.value))
const workspaceTarget = computed(() => getWorkspaceRedirectTarget(route.query.redirect))

useToastMessages([
  { source: error, severity: 'error', summary: 'Login' },
  { source: info, severity: 'success', summary: 'Login' },
])

async function routeIntoWorkspaceIfAllowed() {
  await redirectToWorkspaceIfAllowed({
    hasWorkspaceAccess: auth.hasWorkspaceAccess,
    replace: (target) => router.replace(target),
    workspaceTarget: workspaceTarget.value,
  })
}

onMounted(async () => {
  const nextEmail = getAuthEmailQueryPrefill(route.query)
  if (nextEmail) {
    email.value = nextEmail
  }

  info.value = getPasswordCreatedLoginInfo(route.query.passwordCreated)

  await auth.init()
  await routeIntoWorkspaceIfAllowed()
})

async function handleLogin() {
  error.value = ''
  info.value = ''

  const validationMessage = getLoginValidationMessage(email.value, password.value)
  if (validationMessage) {
    error.value = validationMessage
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
    <AuthStatusMessage v-if="initializing"> Checking your current session... </AuthStatusMessage>

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

      <AuthSubmitButton
        type="submit"
        label="Login"
        loading-label="Signing In..."
        :loading="loading"
      />

      <AuthTextLink :to="forgotPasswordTarget"> Forgot Password? </AuthTextLink>
    </form>

    <AuthFirebaseConfigWarning v-if="!hasConfiguredFirebase" />
  </AuthCard>
</template>
