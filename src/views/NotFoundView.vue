<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <span class="auth-card__eyebrow">404</span>
      <h1 class="auth-card__title">Page not found</h1>
      <p class="auth-card__copy">The workspace route you opened does not exist in the current scaffold.</p>
      <RouterLink to="/jobs" class="app-button app-button--primary">Back to Jobs</RouterLink>
    </div>
  </div>
</template>
