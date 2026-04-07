<script setup lang="ts">
import { useSlots } from 'vue'
import BaseCard from '@/components/common/BaseCard.vue'

withDefaults(defineProps<{
  bodyClass?: string
  headerClass?: string
}>(), {
  bodyClass: '',
  headerClass: '',
})

const slots = useSlots()
</script>

<template>
  <BaseCard
    card-class="app-toolbar-card"
    :body-class="bodyClass"
    :header-class="headerClass"
  >
    <template v-if="slots.header" #header>
      <slot name="header" />
    </template>

    <slot />
  </BaseCard>
</template>
