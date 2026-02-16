<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import Toast from '../../components/Toast.vue'
import AdminCardWrapper from '../../components/admin/AdminCardWrapper.vue'
import AdminFormModal from '../../components/admin/AdminFormModal.vue'
import StatusBadge from '../../components/admin/StatusBadge.vue'
import { useJobRosterStore } from '../../stores/jobRoster'
import { useEmployeesStore } from '../../stores/employees'
import type { JobRosterEmployee } from '@/types/models'

const route = useRoute()
const rosterStore = useJobRosterStore()
const employeesStore = useEmployeesStore()
const toastRef = ref<InstanceType<typeof Toast> | null>(null)

const jobId = computed(() => String(route.params.jobId))
const search = ref('')
const showModal = ref(false)
const saving = ref(false)
const loading = ref(true)
const err = ref('')

const formData = ref({
  firstName: '',
  lastName: '',
  occupation: '',
  employeeNumber: '',
})

// Computed from stores
const rosterEmployees = computed(() => rosterStore.currentJobRoster)
const allEmployees = computed(() => employeesStore.allEmployees)

const availableEmployees = computed(() => {
  const rosteredIds = new Set(rosterEmployees.value.map(e => e.id))
  return allEmployees.value.filter(e => !rosteredIds.has(e.id))
})

const filteredRosterEmployees = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return rosterEmployees.value
  return rosterEmployees.value.filter(e =>
    e.firstName.toLowerCase().includes(q) ||
    e.lastName.toLowerCase().includes(q) ||
    e.occupation.toLowerCase().includes(q) ||
    e.employeeNumber.includes(q)
  )
})

async function loadRoster() {
  try {
    loading.value = true
    await rosterStore.setCurrentJob(jobId.value)
    await Promise.all([
      rosterStore.fetchJobRoster(jobId.value),
      employeesStore.fetchAllEmployees()
    ])
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to load data'
    toastRef.value?.show(err.value, 'error')
  } finally {
    loading.value = false
  }
}

async function addToRoster(employee: any) {
  saving.value = true
  try {
    await rosterStore.addEmployee(jobId.value, {
      firstName: employee.firstName,
      lastName: employee.lastName,
      occupation: employee.occupation,
      employeeNumber: employee.employeeNumber,
      active: true,
      isPrimaryForeman: false,
    })
    toastRef.value?.show(`Added ${employee.firstName} ${employee.lastName} to roster`, 'success')
    showModal.value = false
    await rosterStore.fetchJobRoster(jobId.value)
  } catch (e: any) {
    toastRef.value?.show(e?.message ?? 'Failed to add employee', 'error')
  } finally {
    saving.value = false
  }
}

async function toggleActive(emp: JobRosterEmployee) {
  saving.value = true
  try {
    await rosterStore.updateEmployee(jobId.value, emp.id, { active: !emp.active })
    toastRef.value?.show(`Employee ${!emp.active ? 'activated' : 'deactivated'}`, 'success')
  } catch (e: any) {
    toastRef.value?.show('Failed to update employee', 'error')
  } finally {
    saving.value = false
  }
}

async function removeFromRoster(emp: JobRosterEmployee) {
  const fullName = `${emp.firstName} ${emp.lastName}`.trim()
  if (!confirm(`Remove "${fullName}" from roster?`)) return

  saving.value = true
  try {
    await rosterStore.removeEmployee(jobId.value, emp.id)
    toastRef.value?.show('Employee removed from roster', 'success')
  } catch (e: any) {
    toastRef.value?.show('Failed to remove employee', 'error')
  } finally {
    saving.value = false
  }
}

function selectEmployeeToAdd(emp: any) {
  formData.value = {
    firstName: emp.firstName,
    lastName: emp.lastName,
    occupation: emp.occupation,
    employeeNumber: emp.employeeNumber,
  }
  addToRoster(emp)
}

onMounted(() => loadRoster())
</script>

<template>
  <Toast ref="toastRef" />

  <div class="container-xl py-4">
    <!-- Header -->
    <div class="mb-4">
      <h2 class="h3 mb-1">Job Roster</h2>
      <p class="text-muted small mb-0">Manage employees assigned to this job</p>
    </div>

    <!-- Error -->
    <div v-if="err" class="alert alert-danger alert-dismissible fade show mb-4">
      <strong>Error:</strong> {{ err }}
      <button type="button" class="btn-close" @click="err = ''"></button>
    </div>

    <!-- Add Employee Button -->
    <div class="mb-4">
      <button 
        v-if="availableEmployees.length > 0"
        @click="showModal = true" 
        class="btn btn-primary"
      >
        <i class="bi bi-person-plus me-2"></i>Add Employee to Roster
      </button>
      <div v-else class="text-muted small">
        <i class="bi bi-info-circle me-2"></i>All employees are already in the roster
      </div>
    </div>

    <!-- Select Employee Modal -->
    <div v-if="showModal" class="modal d-block bg-dark bg-opacity-50">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Add Employee to Roster</h5>
            <button type="button" class="btn-close" @click="showModal = false"></button>
          </div>
          <div class="modal-body">
            <div v-if="availableEmployees.length === 0" class="alert alert-info">
              All employees are already in the roster.
            </div>
            <div v-else class="table-responsive">
                <table class="table table-sm table-striped table-hover mb-0">
                  <thead>
                  <tr>
                    <th class="small fw-semibold">Name</th>
                    <th class="small fw-semibold">Employee #</th>
                    <th class="small fw-semibold">Occupation</th>
                    <th class="small fw-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                    <tr v-for="emp in availableEmployees" :key="emp.id">
                    <td class="p-2 fw-semibold">{{ emp.firstName }} {{ emp.lastName }}</td>
                    <td class="p-2 text-muted small">#{{ emp.employeeNumber }}</td>
                    <td class="p-2 text-muted small">{{ emp.occupation || '—' }}</td>
                    <td class="p-2 text-center">
                      <button
                        @click="selectEmployeeToAdd(emp)"
                        :disabled="saving"
                        class="btn btn-sm btn-primary"
                      >
                        <i class="bi bi-plus me-1"></i>Add
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Roster List -->
    <AdminCardWrapper
      title="Current Roster"
      icon="people"
      :loading="loading"
      :subtitle="`Showing ${filteredRosterEmployees.length} of ${rosterEmployees.length}`"
    >
      <template #default>
        <!-- Search -->
        <div class="mb-3">
          <input
            v-model="search"
            type="text"
            class="form-control"
            placeholder="Search by name, number, or occupation…"
          />
        </div>

        <!-- Empty State -->
        <div v-if="filteredRosterEmployees.length === 0" class="alert alert-info text-center mb-0">
          <i class="bi bi-inbox" style="font-size: 1.5rem; opacity: 0.5;"></i>
          <p class="mt-2 mb-0">
            {{ rosterEmployees.length === 0 ? 'No employees in roster yet' : 'No matching employees' }}
          </p>
        </div>

        <!-- Table -->
        <div v-else class="table-responsive">
          <table class="table table-sm table-striped table-hover mb-0">
              <thead>
              <tr>
                <th class="small fw-semibold">Name</th>
                <th class="small fw-semibold">Employee #</th>
                <th class="small fw-semibold">Occupation</th>
                <th class="small fw-semibold text-center">Status</th>
                <th class="small fw-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="emp in filteredRosterEmployees" :key="emp.id">
                <td class="p-2 fw-semibold">{{ emp.firstName }} {{ emp.lastName }}</td>
                <td class="p-2 text-muted small">#{{ emp.employeeNumber }}</td>
                <td class="p-2 text-muted small">{{ emp.occupation || '—' }}</td>
                <td class="p-2 text-center">
                  <StatusBadge :status="emp.active ? 'active' : 'inactive'" />
                </td>
                <td class="p-2 text-center">
                  <button
                    @click="toggleActive(emp)"
                    :disabled="saving"
                    class="btn btn-sm btn-outline-warning me-2"
                  >
                    <i :class="emp.active ? 'bi bi-lock' : 'bi bi-unlock'" class="me-1"></i>
                    {{ emp.active ? 'Deactivate' : 'Activate' }}
                  </button>
                  <button
                    @click="removeFromRoster(emp)"
                    :disabled="saving"
                    class="btn btn-sm btn-outline-danger"
                  >
                    <i class="bi bi-trash me-1"></i>Remove
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </AdminCardWrapper>
  </div>
</template>
