<script setup lang="ts">
import AuthCard from '@/components/auth/AuthCard.vue'
import AppButtonLink from '@/components/common/AppButtonLink.vue'
</script>

<template>
  <AuthCard
    eyebrow="404"
    title="Page not found"
    copy="The workspace route you opened does not exist in the current scaffold."
  >
    <AppButtonLink to="/jobs" variant="primary">Back to Jobs</AppButtonLink>
  </AuthCard>
</template>
