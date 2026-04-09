<script setup lang="ts">
import AdminCardWrapper from '@/components/admin/AdminCardWrapper.vue'
import AppBadge from '@/components/common/AppBadge.vue'
import EmailRecipientInput from '@/components/common/EmailRecipientInput.vue'

const props = defineProps<{
  title: string
  icon: string
  subtitle: string
  emails: string[]
  label: string
  inputName: string
  autocompleteSection: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  add: [email: string]
  remove: [email: string]
}>()
</script>

<template>
  <AdminCardWrapper
    :title="props.title"
    :icon="props.icon"
    :subtitle="props.subtitle"
  >
    <template #header-actions>
      <AppBadge
        :label="`${props.emails.length} recipient${props.emails.length === 1 ? '' : 's'}`"
        variant-class="text-bg-secondary"
      />
    </template>

    <EmailRecipientInput
      :emails="props.emails"
      :label="props.label"
      :input-name="props.inputName"
      :autocomplete-section="props.autocompleteSection"
      :disabled="props.disabled ?? false"
      @add="emit('add', $event)"
      @remove="emit('remove', $event)"
    />
  </AdminCardWrapper>
</template>
