<script setup lang="ts">
import AppAlert from '@/components/common/AppAlert.vue'
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import SearchSelectField from '@/components/common/SearchSelectField.vue'
import type { JobAssignedForemanItem, JobForemanOption } from '@/types/adminJobTeam'

defineProps<{
  assignedForemen: JobAssignedForemanItem[]
  availableForemanOptions: JobForemanOption[]
  selectedForemanId: string
  assigningForemanId: string
  removingForemanId: string
  settingDisplayForemanId: string
  displayForeman: string
}>()

const emit = defineEmits<{
  'update:selectedForemanId': [value: string]
  assign: []
  remove: [foremanId: string]
  'set-display': [foremanId: string]
}>()
</script>

<template>
  <AppSectionCard
    title="Foremen"
    subtitle="Assign existing foreman users to this job."
    icon="bi bi-person-workspace"
    body-class="d-flex flex-column gap-3"
  >
    <div class="d-flex flex-column gap-2">
      <SearchSelectField
        :model-value="selectedForemanId"
        :options="availableForemanOptions"
        label="Add Foreman"
        placeholder="Search active foremen"
        prepend-icon="bi bi-search"
        clear-label="No selection"
        @update:model-value="emit('update:selectedForemanId', $event)"
      />

      <button
        type="button"
        class="btn btn-sm btn-outline-primary align-self-start"
        :disabled="!selectedForemanId || !!assigningForemanId"
        @click="emit('assign')"
      >
        <span v-if="assigningForemanId" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
        Add Foreman
      </button>
    </div>

    <div class="small text-muted">
      Display foreman:
      <strong>{{ displayForeman || 'Not set' }}</strong>
    </div>

    <AppAlert
      v-if="assignedForemen.length === 0"
      variant="info"
      class="mb-0"
      message="No foremen are assigned to this job yet."
    />

    <div v-else class="list-group list-group-flush">
      <div
        v-for="foreman in assignedForemen"
        :key="foreman.id"
        class="list-group-item bg-transparent px-0"
      >
        <div class="d-flex flex-column gap-2">
          <div class="d-flex flex-wrap align-items-center gap-2">
            <span class="fw-semibold">{{ foreman.label }}</span>
            <span
              v-if="foreman.isDisplayForeman"
              class="badge text-bg-primary"
            >
              Display
            </span>
            <span
              v-if="!foreman.active"
              class="badge text-bg-warning"
            >
              Inactive
            </span>
            <span
              v-if="foreman.missing"
              class="badge text-bg-danger"
            >
              Missing
            </span>
          </div>

          <div v-if="foreman.email" class="small text-muted">
            {{ foreman.email }}
          </div>

          <div class="d-flex flex-wrap gap-2">
            <button
              v-if="!foreman.isDisplayForeman && !foreman.missing"
              type="button"
              class="btn btn-sm btn-outline-secondary"
              :disabled="settingDisplayForemanId === foreman.id"
              @click="emit('set-display', foreman.id)"
            >
              <span
                v-if="settingDisplayForemanId === foreman.id"
                class="spinner-border spinner-border-sm me-2"
                aria-hidden="true"
              ></span>
              Use As Display
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-danger"
              :disabled="removingForemanId === foreman.id"
              @click="emit('remove', foreman.id)"
            >
              <span
                v-if="removingForemanId === foreman.id"
                class="spinner-border spinner-border-sm me-2"
                aria-hidden="true"
              ></span>
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppSectionCard>
</template>
