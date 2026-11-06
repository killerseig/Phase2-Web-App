<script setup lang="ts">
import AppShell from '@/layouts/AppShell.vue'
import DashboardAnnouncements from '@/components/dashboard/DashboardAnnouncements.vue'
</script>
<template>
  <AppShell>
    <section class="announcements-page" aria-label="Announcements">
      <h1>Announcements</h1>
      <p>Updates for everyone, your assigned jobs and messages sent to you.</p>
      <DashboardAnnouncements scope="personal" :layout-editing="false" />
    </section>
  </AppShell>
</template>
<style scoped>
.announcements-page { width: min(100%, 70rem); margin-inline: auto; padding: clamp(1rem, 3vw, 2rem); }
</style>
