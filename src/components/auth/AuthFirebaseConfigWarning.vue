<script setup lang="ts">
import AuthStatusMessage from '@/components/auth/AuthStatusMessage.vue'
</script>

<template>
  <AuthStatusMessage tone="warning">
    Firebase is not configured yet. Copy the `v1` `VITE_FIREBASE_*` values into `.env.local`
    so this app can use the same project.
  </AuthStatusMessage>
</template>
