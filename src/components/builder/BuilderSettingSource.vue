<script setup lang="ts">
withDefaults(defineProps<{ overridden: boolean; automatic?: boolean }>(), { automatic: false })
</script>

<template>
  <span
    class="setting-source"
    :class="{ overridden }"
    aria-hidden="true"
    :title="
      overridden
        ? automatic
          ? 'Changed for this screen size. Reset to use the automatic layout.'
          : 'Changed for this screen size. Reset to follow desktop.'
        : automatic
          ? 'Adapts desktop settings to this screen size unless you override it.'
          : 'Follows desktop, including future changes.'
    "
    >{{ overridden ? 'Override' : automatic ? 'Automatic' : 'Desktop' }}</span
  >
</template>

<style scoped>
.setting-source {
  display: inline-block;
  margin-inline-start: 0.35rem;
  font-size: 0.65rem;
  font-weight: 500;
  line-height: 1.4;
  color: var(--muted);
}
.setting-source.overridden {
  color: var(--accent, #80c7f4);
}
</style>
