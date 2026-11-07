<script setup lang="ts">
import type { PublishedAnnouncement } from '@/features/dashboard/sharedDashboards'
import type { JobRecord } from '@/types/domain'
defineProps<{ items: PublishedAnnouncement[]; jobs?: JobRecord[] }>()
</script>
<template>
  <div class="announcement-list">
    <article v-for="item in items" :key="item.id">
      <h3>{{ item.title }}</h3>
      <small
        >{{
          item.audience === 'everyone'
            ? 'Everyone'
            : item.audience === 'people'
              ? 'Specific people'
              : jobs?.find((job) => job.id === item.jobId)?.name || 'Assigned job'
        }}
        · {{ new Date(item.publishedAt).toLocaleString() }}</small
      >
      <p>{{ item.body }}</p>
    </article>
  </div>
</template>
<style scoped>
.announcement-list {
  overflow-wrap: anywhere;
}
article + article {
  border-top: 1px solid var(--border);
  margin-top: 1.25rem;
  padding-top: 1.25rem;
}
h3 {
  margin: 0 0 0.5rem;
}
p {
  white-space: pre-wrap;
  line-height: 1.6;
  margin-bottom: 0;
}
small {
  color: var(--text-muted);
}
</style>
