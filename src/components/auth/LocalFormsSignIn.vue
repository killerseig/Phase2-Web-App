<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore(),
  router = useRouter(),
  busy = ref(false),
  error = ref('')
const enabled =
  import.meta.env.DEV &&
  import.meta.env.VITE_FORM_EMULATORS === 'true' &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID === 'demo-phase2-security' &&
  ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
async function signIn(role: 'admin' | 'foreman') {
  if (!enabled || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await auth.login(role + '@forms.local', 'Local-Forms-Only-123!')
    if (!auth.hasWorkspaceAccess) {
      await auth.signOut()
      throw new Error('The local demo profile is unavailable. Restart npm run dev:forms.')
    }
    await router.replace(role === 'admin' ? '/admin/forms' : '/dashboards/personal')
  } catch (caught) {
    error.value = auth.getLoginErrorMessage(caught)
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <section v-if="enabled" aria-label="Local Forms demo access" class="local-demo">
    <h2>Local Forms demo</h2>
    <p>
      This server uses isolated demo accounts and retained local records. Your usual company login
      is not available here. No production data or real email is used.
    </p>
    <p>Choose Admin to review the Form Builder, or Foreman to review form responses.</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <button type="button" :disabled="busy" @click="signIn('admin')">
      Sign in as local demo Admin
    </button>
    <button type="button" :disabled="busy" @click="signIn('foreman')">
      Sign in as local demo Foreman
    </button>
    <small>Admin: admin@forms.local · Foreman: foreman@forms.local</small>
  </section>
</template>
<style scoped>
.local-demo {
  border: 1px solid var(--border);
  border-radius: 0.6rem;
  padding: 1rem;
  margin: 1rem 0;
}
.local-demo h2 {
  font-size: 1.1rem;
}
.local-demo button {
  display: block;
  width: 100%;
  margin: 0.6rem 0;
  padding: 0.65rem;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0.35rem;
  cursor: pointer;
}
.local-demo button:disabled {
  opacity: 0.6;
  cursor: wait;
}
.local-demo small {
  display: block;
  overflow-wrap: anywhere;
}
</style>
