<script setup lang="ts">
import { computed, ref } from 'vue'
import type { JobRosterEmployee } from '@/types/models'
import { useJobRosterStore } from '../stores/jobRoster'

interface Props {
  jobId: string
  canManage?: boolean
  showSearch?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canManage: false,
  showSearch: true,
})

const roster = useJobRosterStore()
const search = ref('')

// Filtered roster employees
const filteredEmployees = computed(() => {
  const q = search.value.trim().toLowerCase()
  const employees = roster.currentJobRoster
  
  if (!q) return employees
  
  return employees.filter(e =>
    e.firstName.toLowerCase().includes(q) ||
    e.lastName.toLowerCase().includes(q) ||
    e.employeeNumber.includes(q) ||
    e.occupation?.toLowerCase().includes(q)
  )
})

const activeEmployees = computed(() =>
  filteredEmployees.value.filter(e => e.active)
)

const inactiveEmployees = computed(() =>
  filteredEmployees.value.filter(e => !e.active)
)

const primaryForeman = computed(() =>
  roster.currentJobRoster.find(e => e.isPrimaryForeman ?? false)
)
</script>

<template>
  <div class="job-roster-manager">
    <!-- Search -->
    <div v-if="showSearch && roster.currentJobRoster.length > 0" class="mb-3">
      <input
        v-model="search"
        type="text"
        class="form-control form-control-sm"
        placeholder="Search employees…"
      />
    </div>

    <!-- Primary Foreman Badge -->
    <div v-if="primaryForeman" class="mb-3">
      <small class="text-muted d-block mb-1">Primary Foreman:</small>
      <div class="badge bg-success">
        <i class="bi bi-person-badge me-1"></i>
        {{ primaryForeman.firstName }} {{ primaryForeman.lastName }}
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="roster.currentJobRoster.length === 0" class="alert alert-info mb-0">
      <i class="bi bi-inbox me-2"></i>No employees on roster.
    </div>

    <!-- Employees List -->
    <div v-else>
      <!-- Active Employees -->
      <div v-if="activeEmployees.length > 0">
        <h6 class="text-muted small mb-2">Active ({{ activeEmployees.length }})</h6>
        <div class="list-group list-group-sm mb-3">
          <div
            v-for="emp in activeEmployees"
            :key="emp.id"
            class="list-group-item d-flex justify-content-between align-items-start py-2"
          >
            <div>
              <div class="fw-semibold">
                {{ emp.firstName }} {{ emp.lastName }}
                <span v-if="emp.isPrimaryForeman" class="badge bg-success ms-1">Foreman</span>
              </div>
              <small class="text-muted d-block">
                #{{ emp.employeeNumber }} • {{ emp.occupation || 'Unspecified' }}
              </small>
            </div>
            <slot name="actions" :employee="emp"></slot>
          </div>
        </div>
      </div>

      <!-- Inactive Employees -->
      <div v-if="inactiveEmployees.length > 0">
        <h6 class="text-muted small mb-2">Inactive ({{ inactiveEmployees.length }})</h6>
        <div class="list-group list-group-sm">
          <div
            v-for="emp in inactiveEmployees"
            :key="emp.id"
            class="list-group-item d-flex justify-content-between align-items-start py-2 opacity-50"
          >
            <div>
              <div class="fw-semibold">
                {{ emp.firstName }} {{ emp.lastName }}
              </div>
              <small class="text-muted d-block">
                #{{ emp.employeeNumber }} • {{ emp.occupation || 'Unspecified' }}
              </small>
            </div>
            <slot name="actions" :employee="emp"></slot>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.job-roster-manager {
  display: flex;
  flex-direction: column;
}

.list-group-item {
  border-left: 3px solid transparent;
}

.list-group-item:hover {
  background-color: rgba(0, 0, 0, 0.02);
  border-left-color: var(--bs-primary);
}
</style>
