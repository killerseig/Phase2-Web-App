<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import Toast from '../../components/Toast.vue'
import AdminCardWrapper from '../../components/admin/AdminCardWrapper.vue'
import AdminFormModal from '../../components/admin/AdminFormModal.vue'
import StatusBadge from '../../components/admin/StatusBadge.vue'
import type { Role, UserProfile } from '../../services/Users'
import type { Employee } from '../../services/Employees'
import { useUsersStore } from '../../stores/users'
import { useEmployeesStore } from '../../stores/employees'
import { useAuthStore } from '../../stores/auth'

const route = useRoute()
const auth = useAuthStore()
const usersStore = useUsersStore()
const employeesStore = useEmployeesStore()
const toastRef = ref<InstanceType<typeof Toast> | null>(null)

const activeTab = ref<'users' | 'employees'>(route.query.tab === 'employees' ? 'employees' : 'users')

// User form modal
const showUserModal = ref(false)
const userForm = ref({
  email: '',
  firstName: '',
  lastName: '',
  role: 'none' as Role,
})
const creatingUser = ref(false)

// Edit user
const editingUserId = ref<string | null>(null)
const editUserForm = ref({
  email: '',
  firstName: '',
  lastName: '',
  role: 'none' as Role,
})
const editUserFormOriginal = ref({
  email: '',
  firstName: '',
  lastName: '',
  role: 'none' as Role,
})
const savingUserEdit = ref(false)

// Employees form modal
const showEmployeeModal = ref(false)
const employeeForm = ref({
  firstName: '',
  lastName: '',
  employeeNumber: '',
  occupation: '',
})
const creatingEmployee = ref(false)

// Edit employee
const editingEmployeeId = ref<string | null>(null)
const editForm = ref({
  firstName: '',
  lastName: '',
  employeeNumber: '',
  occupation: '',
})
const editFormOriginal = ref({
  firstName: '',
  lastName: '',
  employeeNumber: '',
  occupation: '',
})
const savingEmployeeEdit = ref(false)

// Employee columns for list component
const employeeColumns = [
  { key: 'firstName', label: 'First Name', sortable: true },
  { key: 'lastName', label: 'Last Name', sortable: true },
  { key: 'employeeNumber', label: 'Employee #', sortable: true },
  { key: 'occupation', label: 'Occupation', sortable: true },
]

// Computed properties from stores
const users = computed(() => usersStore.allUsers)
const loadingUsers = computed(() => usersStore.isLoading)
const err = computed(() => usersStore.error || '')

const employees = computed(() => employeesStore.allEmployees)
const loadingEmployees = computed(() => employeesStore.isLoading)

function friendlyError(message: string) {
  if (message.toLowerCase().includes('missing or insufficient permissions')) {
    return 'Missing permissions. Admin user profile required.'
  }
  return message
}

async function loadUsers() {
  await usersStore.fetchAllUsers()
}

async function loadEmployees() {
  await employeesStore.fetchAllEmployees()
}

async function submitUserForm() {
  if (!userForm.value.email.trim() || !userForm.value.firstName.trim() || !userForm.value.lastName.trim()) {
    toastRef.value?.show('Email, first name, and last name are required', 'error')
    return
  }

  creatingUser.value = true
  try {
    const result = await usersStore.createUser(
      userForm.value.email.trim(),
      userForm.value.firstName.trim(),
      userForm.value.lastName.trim(),
      userForm.value.role
    )
    toastRef.value?.show(`User created successfully. Welcome email sent to ${userForm.value.email}`, 'success')
    showUserModal.value = false
    userForm.value = { email: '', firstName: '', lastName: '', role: 'none' }
    await loadUsers()
  } catch (e: any) {
    const msg = e?.message ?? String(e)
    toastRef.value?.show(friendlyError(msg), 'error')
  } finally {
    creatingUser.value = false
  }
}

async function handleEditUser(user: UserProfile) {
  editingUserId.value = user.id
  // Create draft copy for cancel functionality
  editUserForm.value = {
    email: user.email || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    role: user.role,
  }
  // Keep original for comparison
  editUserFormOriginal.value = {
    email: user.email || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    role: user.role,
  }
}

async function saveUserEdit(user: UserProfile) {
  if (!editUserForm.value.firstName.trim() || !editUserForm.value.lastName.trim()) {
    toastRef.value?.show('First name and last name are required', 'error')
    return
  }

  savingUserEdit.value = true
  try {
    // Only update fields that changed
    const updates: Record<string, any> = {}
    
    if (editUserForm.value.firstName.trim() !== editUserFormOriginal.value.firstName) {
      updates.firstName = editUserForm.value.firstName.trim()
    }
    if (editUserForm.value.lastName.trim() !== editUserFormOriginal.value.lastName) {
      updates.lastName = editUserForm.value.lastName.trim()
    }
    if (editUserForm.value.role !== editUserFormOriginal.value.role) {
      updates.role = editUserForm.value.role
    }

    // Only make API call if there are changes
    if (Object.keys(updates).length > 0) {
      await usersStore.updateUserProfile(user.id, updates)
      toastRef.value?.show('User updated', 'success')
    }
    
    editingUserId.value = null
  } catch (e: any) {
    toastRef.value?.show('Failed to update user', 'error')
  } finally {
    savingUserEdit.value = false
  }
}

function cancelUserEdit() {
  editingUserId.value = null
  editUserForm.value = { email: '', firstName: '', lastName: '', role: 'none' }
  editUserFormOriginal.value = { email: '', firstName: '', lastName: '', role: 'none' }
}

async function handleDeleteUser(user: UserProfile) {
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return

  try {
    await usersStore.deleteUser(user.id)
    toastRef.value?.show('User deleted', 'success')
  } catch (e: any) {
    toastRef.value?.show('Failed to delete user', 'error')
  }
}

async function submitEmployeeForm() {
  creatingEmployee.value = true
  try {
    await employeesStore.createEmployee(null, {
      firstName: employeeForm.value.firstName,
      lastName: employeeForm.value.lastName,
      employeeNumber: employeeForm.value.employeeNumber,
      occupation: employeeForm.value.occupation,
      active: true,
    })
    toastRef.value?.show('Employee created', 'success')
    showEmployeeModal.value = false
    employeeForm.value = { firstName: '', lastName: '', employeeNumber: '', occupation: '' }
    await loadEmployees()
  } catch (e: any) {
    toastRef.value?.show('Failed to create employee', 'error')
  } finally {
    creatingEmployee.value = false
  }
}

async function handleEditEmployee(emp: Employee) {
  editingEmployeeId.value = emp.id
  // Create draft copy
  editForm.value = {
    firstName: emp.firstName,
    lastName: emp.lastName,
    employeeNumber: emp.employeeNumber || '',
    occupation: emp.occupation,
  }
  // Keep original for comparison
  editFormOriginal.value = {
    firstName: emp.firstName,
    lastName: emp.lastName,
    employeeNumber: emp.employeeNumber || '',
    occupation: emp.occupation,
  }
}

async function saveEmployeeEdit(emp: Employee) {
  savingEmployeeEdit.value = true
  try {
    // Only update fields that changed
    const updates: Record<string, any> = {}

    if (editForm.value.firstName !== editFormOriginal.value.firstName) {
      updates.firstName = editForm.value.firstName
    }
    if (editForm.value.lastName !== editFormOriginal.value.lastName) {
      updates.lastName = editForm.value.lastName
    }
    if (editForm.value.employeeNumber !== editFormOriginal.value.employeeNumber) {
      updates.employeeNumber = editForm.value.employeeNumber || null
    }
    if (editForm.value.occupation !== editFormOriginal.value.occupation) {
      updates.occupation = editForm.value.occupation
    }

    // Only make API call if there are changes
    if (Object.keys(updates).length > 0) {
      await employeesStore.updateEmployee(emp.id, updates)
      toastRef.value?.show('Employee updated', 'success')
    }
    
    editingEmployeeId.value = null
  } catch (e: any) {
    toastRef.value?.show('Failed to update employee', 'error')
  } finally {
    savingEmployeeEdit.value = false
  }
}

function cancelEmployeeEdit() {
  editingEmployeeId.value = null
  editForm.value = { firstName: '', lastName: '', employeeNumber: '', occupation: '' }
  editFormOriginal.value = { firstName: '', lastName: '', employeeNumber: '', occupation: '' }
}

async function handleDeleteEmployee(emp: Employee) {
  const name = `${emp.firstName} ${emp.lastName}`
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return

  try {
    await employeesStore.deleteEmployee(emp.id)
    toastRef.value?.show('Employee deleted', 'success')
  } catch (e: any) {
    toastRef.value?.show('Failed to delete employee', 'error')
  }
}

onMounted(() => {
  loadUsers()
  loadEmployees()
})
</script>

<template>
  <Toast ref="toastRef" />
  
  <div class="container-fluid py-4" style="max-width: 1200px;">
    <!-- Header -->
    <div class="mb-4">
      <h2 class="h3 mb-1">User Management</h2>
      <p class="text-muted small mb-0">Manage user profiles and employees</p>
    </div>

    <!-- Tab Navigation -->
    <ul class="nav nav-tabs mb-4" role="tablist">
      <li class="nav-item" role="presentation">
        <button
          class="nav-link"
          :class="{ active: activeTab === 'users' }"
          @click="activeTab = 'users'"
          role="tab"
        >
          <i class="bi bi-person-circle me-2"></i>Users
        </button>
      </li>
      <li class="nav-item" role="presentation">
        <button
          class="nav-link"
          :class="{ active: activeTab === 'employees' }"
          @click="activeTab = 'employees'"
          role="tab"
        >
          <i class="bi bi-person-badge me-2"></i>Employees
        </button>
      </li>
    </ul>

    <!-- Users Tab -->
    <template v-if="activeTab === 'users'">
      <!-- Create User Button -->
      <div class="mb-4">
        <button
          v-if="!showUserModal"
          @click="showUserModal = true"
          class="btn btn-primary"
        >
          <i class="bi bi-plus-circle me-2"></i>Create User
        </button>
      </div>

      <!-- Create User Modal -->
      <AdminFormModal
        v-if="showUserModal"
        title="Create New User"
        :fields="[
          { name: 'email', label: 'Email', type: 'email', placeholder: 'user@example.com', required: true },
          { name: 'firstName', label: 'First Name', type: 'text', placeholder: 'John', required: true },
          { name: 'lastName', label: 'Last Name', type: 'text', placeholder: 'Doe', required: true },
          { name: 'role', label: 'Role', type: 'select', required: true, options: [
            { value: 'none', label: 'None (No Access)' },
            { value: 'employee', label: 'Employee' },
            { value: 'shop', label: 'Shop' },
            { value: 'foreman', label: 'Foreman' },
            { value: 'admin', label: 'Admin' },
          ]},
        ]"
        :initial-data="userForm"
        :loading="creatingUser"
        submit-label="Create User"
        @submit="(data) => {
          userForm = data as any
          submitUserForm()
        }"
        @cancel="showUserModal = false"
      />

      <!-- Users List -->
      <AdminCardWrapper
        title="User Profiles"
        icon="person-circle"
        :loading="loadingUsers"
        :error="err"
      >
        <div v-if="loadingUsers" class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading…</span>
          </div>
        </div>

        <div v-else-if="users.length === 0" class="alert alert-info text-center mb-0">
          No users yet. Create your first user above.
        </div>

        <div v-else class="table-responsive">
          <table class="table table-sm table-striped table-hover mb-0">
            <thead>
              <tr>
                <th style="width: 20%;" class="small fw-semibold">Email</th>
                <th style="width: 15%;" class="small fw-semibold">First Name</th>
                <th style="width: 15%;" class="small fw-semibold">Last Name</th>
                <th style="width: 12%;" class="small fw-semibold">Role</th>
                <th style="width: 12%;" class="small fw-semibold">Status</th>
                <th style="width: 26%;" class="small fw-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users" :key="user.id">
                <td style="padding: 8px;">
                  <template v-if="editingUserId === user.id">
                    <input
                      v-model="editUserForm.email"
                      class="form-control form-control-sm"
                      type="email"
                      disabled
                    />
                  </template>
                  <span v-else class="small">{{ user.email }}</span>
                </td>
                <td style="padding: 8px;">
                  <template v-if="editingUserId === user.id">
                    <input
                      v-model="editUserForm.firstName"
                      class="form-control form-control-sm"
                      placeholder="First name"
                      @keydown.enter="saveUserEdit(user)"
                      @keydown.esc="cancelUserEdit"
                    />
                  </template>
                  <span v-else>{{ user.firstName }}</span>
                </td>
                <td style="padding: 8px;">
                  <template v-if="editingUserId === user.id">
                    <input
                      v-model="editUserForm.lastName"
                      class="form-control form-control-sm"
                      placeholder="Last name"
                      @keydown.enter="saveUserEdit(user)"
                      @keydown.esc="cancelUserEdit"
                    />
                  </template>
                  <span v-else>{{ user.lastName }}</span>
                </td>
                <td style="padding: 8px;">
                  <template v-if="editingUserId === user.id">
                    <select 
                      v-model="editUserForm.role" 
                      class="form-select form-select-sm"
                      @keydown.enter="saveUserEdit(user)"
                      @keydown.esc="cancelUserEdit"
                    >
                      <option value="none">None</option>
                      <option value="employee">Employee</option>
                      <option value="shop">Shop</option>
                      <option value="foreman">Foreman</option>
                      <option value="admin">Admin</option>
                    </select>
                  </template>
                  <span v-else class="badge" :class="{
                    'bg-secondary': user.role === 'none',
                    'bg-info': user.role === 'employee',
                    'bg-success': user.role === 'shop',
                    'bg-warning': user.role === 'foreman',
                    'bg-danger': user.role === 'admin',
                  }">
                    {{ user.role }}
                  </span>
                </td>
                <td style="padding: 8px;">
                  <StatusBadge :status="user.active ? 'active' : 'inactive'" />
                </td>
                <td style="padding: 8px;" class="text-center">
                  <template v-if="editingUserId === user.id">
                    <button
                      @click="saveUserEdit(user)"
                      :disabled="savingUserEdit"
                      class="btn btn-sm btn-success"
                      title="Save changes (Enter)"
                    >
                      <i class="bi bi-check"></i>
                    </button>
                    <button
                      @click="cancelUserEdit"
                      :disabled="savingUserEdit"
                      class="btn btn-sm btn-outline-secondary ms-1"
                      title="Cancel edit (Esc)"
                    >
                      <i class="bi bi-x"></i>
                    </button>
                  </template>
                  <template v-else>
                    <button
                      @click="handleEditUser(user)"
                      class="btn btn-sm btn-outline-primary me-1"
                      title="Edit user"
                    >
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button
                      @click="handleDeleteUser(user)"
                      class="btn btn-sm btn-outline-danger"
                      title="Delete user"
                    >
                      <i class="bi bi-trash"></i>
                    </button>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </AdminCardWrapper>
    </template>

    <!-- Employees Tab -->
    <template v-if="activeTab === 'employees'">
      <!-- Create Employee Button -->
      <div class="mb-4">
        <button
          v-if="!showEmployeeModal"
          @click="showEmployeeModal = true"
          class="btn btn-primary"
        >
          <i class="bi bi-person-plus me-2"></i>Add Employee
        </button>
      </div>

      <!-- Create Employee Modal -->
      <AdminFormModal
        v-if="showEmployeeModal"
        title="Add Employee"
        :fields="[
          { name: 'firstName', label: 'First Name', type: 'text', placeholder: 'John', required: true },
          { name: 'lastName', label: 'Last Name', type: 'text', placeholder: 'Doe', required: true },
          { name: 'employeeNumber', label: 'Employee Number', type: 'text', placeholder: 'EMP-001' },
          { name: 'occupation', label: 'Occupation', type: 'text', placeholder: 'Carpenter', required: true },
        ]"
        :initial-data="employeeForm"
        :loading="creatingEmployee"
        submit-label="Add Employee"
        @submit="(data) => {
          employeeForm = data as any
          submitEmployeeForm()
        }"
        @cancel="showEmployeeModal = false"
      />

      <!-- Employees List -->
      <AdminCardWrapper
        title="Employees"
        icon="person-badge"
        :loading="loadingEmployees"
      >
        <div v-if="loadingEmployees" class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading…</span>
          </div>
        </div>

        <div v-else-if="employees.length === 0" class="alert alert-info text-center mb-0">
          No employees yet. Create your first employee above.
        </div>

        <div v-else class="table-responsive">
          <table class="table table-sm table-striped table-hover mb-0">
            <thead>
              <tr>
                <th style="width: 30%;" class="small fw-semibold">Name</th>
                <th style="width: 20%;" class="small fw-semibold">Employee #</th>
                <th style="width: 24%;" class="small fw-semibold">Occupation</th>
                <th style="width: 26%;" class="small fw-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="emp in employees" :key="emp.id">
                <td style="padding: 8px;" class="fw-semibold">
                  <template v-if="editingEmployeeId === emp.id">
                    <div class="row g-2">
                      <div class="col-6">
                        <input
                          v-model="editForm.firstName"
                          class="form-control form-control-sm"
                          placeholder="First name"
                          @keydown.enter="saveEmployeeEdit(emp)"
                          @keydown.esc="cancelEmployeeEdit"
                        />
                      </div>
                      <div class="col-6">
                        <input
                          v-model="editForm.lastName"
                          class="form-control form-control-sm"
                          placeholder="Last name"
                          @keydown.enter="saveEmployeeEdit(emp)"
                          @keydown.esc="cancelEmployeeEdit"
                        />
                      </div>
                    </div>
                  </template>
                  <span v-else>{{ emp.firstName }} {{ emp.lastName }}</span>
                </td>
                <td style="padding: 8px;">
                  <input
                    v-if="editingEmployeeId === emp.id"
                    v-model="editForm.employeeNumber"
                    class="form-control form-control-sm"
                    placeholder="EMP-001"
                    @keydown.enter="saveEmployeeEdit(emp)"
                    @keydown.esc="cancelEmployeeEdit"
                  />
                  <span v-else class="small">{{ emp.employeeNumber || '—' }}</span>
                </td>
                <td style="padding: 8px;" class="text-muted">
                  <input
                    v-if="editingEmployeeId === emp.id"
                    v-model="editForm.occupation"
                    class="form-control form-control-sm"
                    placeholder="Occupation"
                    @keydown.enter="saveEmployeeEdit(emp)"
                    @keydown.esc="cancelEmployeeEdit"
                  />
                  <span v-else>{{ emp.occupation }}</span>
                </td>
                <td style="padding: 8px;" class="text-center">
                  <template v-if="editingEmployeeId === emp.id">
                    <button
                      @click="saveEmployeeEdit(emp)"
                      :disabled="savingEmployeeEdit"
                      class="btn btn-sm btn-success me-1"
                      title="Save changes (Enter)"
                    >
                      <i class="bi bi-check"></i>
                    </button>
                    <button
                      @click="cancelEmployeeEdit"
                      :disabled="savingEmployeeEdit"
                      class="btn btn-sm btn-outline-secondary"
                      title="Cancel edit (Esc)"
                    >
                      <i class="bi bi-x"></i>
                    </button>
                  </template>
                  <template v-else>
                    <button
                      @click="handleEditEmployee(emp)"
                      class="btn btn-sm btn-outline-primary me-1"
                      title="Edit employee"
                    >
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button
                      @click="handleDeleteEmployee(emp)"
                      class="btn btn-sm btn-outline-danger"
                      title="Delete employee"
                    >
                      <i class="bi bi-trash"></i>
                    </button>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </AdminCardWrapper>
    </template>
  </div>
</template>
