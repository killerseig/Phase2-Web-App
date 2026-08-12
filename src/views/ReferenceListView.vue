<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ReferenceListPageShell from '@/components/referenceLists/ReferenceListPageShell.vue'
import { getReferenceListTitle } from '@/features/referenceLists/viewHelpers'

const route = useRoute()

const title = computed(() => getReferenceListTitle(route.params.listKey))
</script>

<template>
  <ReferenceListPageShell :title="title" />
</template>
