<script setup lang="ts">
import { useSlots } from 'vue'

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
  <div class="card app-toolbar-card">
    <div
      v-if="slots.header"
      :class="['card-header', 'panel-header', headerClass]"
    >
      <slot name="header" />
    </div>
    <div :class="['card-body', bodyClass]">
      <slot />
    </div>
  </div>
</template>
