<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useIdleSessionTimeout } from '@/composables/useIdleSessionTimeout'

useIdleSessionTimeout()
</script>

<template>
  <div class="app-theme-dark">
    <RouterView />
  </div>
</template>
