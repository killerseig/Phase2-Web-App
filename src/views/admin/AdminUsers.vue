<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Toast from '../../components/Toast.vue'
import AdminCardWrapper from '../../components/admin/AdminCardWrapper.vue'
import StatusBadge from '../../components/admin/StatusBadge.vue'
import { useUsersStore } from '../../stores/users'
import { useEmployeesStore } from '../../stores/employees'
import { useAuthStore } from '../../stores/auth'
import { type Employee, type UserProfile } from '@/services'
import { type Role } from '@/constants/app'

const route = useRoute()
const auth = useAuthStore()
const usersStore = useUsersStore()
const employeesStore = useEmployeesStore()
const toastRef = ref<InstanceType<typeof Toast> | null>(null)

const userFormRef = ref<HTMLElement | null>(null)
const employeeFormRef = ref<HTMLElement | null>(null)
const userFormHeight = ref(0)
const employeeFormHeight = ref(0)

const activeTab = ref<'users' | 'employees'>(route.query.tab === 'employees' ? 'employees' : 'users')

// User form modal
const showUserForm = ref(false)
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
const showEmployeeForm = ref(false)
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
    showUserForm.value = false
    resetUserForm()
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

function resetUserForm() {
  userForm.value = { email: '', firstName: '', lastName: '', role: 'none' }
}

function cancelUserForm() {
  resetUserForm()
  showUserForm.value = false
}

function setUserFormRef(el: HTMLElement | null) {
  userFormRef.value = el
  measureUserForm()
}

function measureUserForm() {
  if (!userFormRef.value) return
  userFormHeight.value = userFormRef.value.scrollHeight
}

function getUserFormStyle() {
  const h = userFormHeight.value || (userFormRef.value?.scrollHeight ?? 0)
  return {
    maxHeight: showUserForm.value ? `${h}px` : '0px',
    opacity: showUserForm.value ? '1' : '0',
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
    showEmployeeForm.value = false
    resetEmployeeForm()
    await loadEmployees()
  } catch (e: any) {
    toastRef.value?.show('Failed to create employee', 'error')
  } finally {
    creatingEmployee.value = false
  }
}

function resetEmployeeForm() {
  employeeForm.value = { firstName: '', lastName: '', employeeNumber: '', occupation: '' }
}

function cancelEmployeeForm() {
  resetEmployeeForm()
  showEmployeeForm.value = false
}

function setEmployeeFormRef(el: HTMLElement | null) {
  employeeFormRef.value = el
  measureEmployeeForm()
}

function measureEmployeeForm() {
  if (!employeeFormRef.value) return
  employeeFormHeight.value = employeeFormRef.value.scrollHeight
}

function getEmployeeFormStyle() {
  const h = employeeFormHeight.value || (employeeFormRef.value?.scrollHeight ?? 0)
  return {
    maxHeight: showEmployeeForm.value ? `${h}px` : '0px',
    opacity: showEmployeeForm.value ? '1' : '0',
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
  nextTick(() => {
    measureUserForm()
    measureEmployeeForm()
  })
})

watch(showUserForm, (open) => {
  if (open) nextTick(measureUserForm)
})

watch(showEmployeeForm, (open) => {
  if (open) nextTick(measureEmployeeForm)
})
</script>

<template>
  <Toast ref="toastRef" />
  <div class="container-xl py-4">
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
      <!-- Create User Accordion -->
      <div class="card mb-4">
        <div
          class="card-header d-flex align-items-center justify-content-between cursor-pointer"
          role="button"
          @click="showUserForm = !showUserForm; nextTick(measureUserForm)"
          :aria-expanded="showUserForm"
        >
          <div>
            <h5 class="mb-1">Create User</h5>
            <p class="text-muted small mb-0">Add a new user account and set their role</p>
          </div>
          <i :class="['bi', 'bi-chevron-down', 'chevron', { open: showUserForm }]" aria-hidden="true"></i>
        </div>
        <div
          class="card-body border-top inline-collapse"
          :style="getUserFormStyle()"
          :ref="setUserFormRef"
        >
          <div class="collapse-inner p-3">
            <form class="row g-3" @submit.prevent="submitUserForm">
              <div class="col-md-4">
                <label class="form-label small">Email</label>
                <input
                  v-model="userForm.email"
                  type="email"
                  class="form-control"
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div class="col-md-4">
                <label class="form-label small">First Name</label>
                <input
                  v-model="userForm.firstName"
                  type="text"
                  class="form-control"
                  placeholder="John"
                  required
                />
              </div>
              <div class="col-md-4">
                <label class="form-label small">Last Name</label>
                <input
                  v-model="userForm.lastName"
                  type="text"
                  class="form-control"
                  placeholder="Doe"
                  required
                />
              </div>
              <div class="col-md-4">
                <label class="form-label small">Role</label>
                <select v-model="userForm.role" class="form-select" required>
                  <option value="none">None (No Access)</option>
                  <option value="employee">Employee</option>
                  <option value="shop">Shop</option>
                  <option value="foreman">Foreman</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div class="col-12 d-flex gap-2 justify-content-end pt-2">
                <button type="button" class="btn btn-outline-secondary" @click.stop="cancelUserForm" :disabled="creatingUser">
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary" :disabled="creatingUser">
                  <span v-if="creatingUser" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Create User
                </button>
              </div>
            </form>
          </div>
          </div>
      </div>

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
                  <th class="small fw-semibold">Email</th>
                <th style="width: 15%;" class="small fw-semibold">First Name</th>
                <th style="width: 15%;" class="small fw-semibold">Last Name</th>
                <th style="width: 12%;" class="small fw-semibold">Role</th>
                <th style="width: 12%;" class="small fw-semibold">Status</th>
                  <th class="small fw-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users" :key="user.id">
                <td class="p-2">
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
                <td class="p-2">
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
                <td class="p-2">
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
                <td class="p-2">
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
                <td class="p-2">
                  <StatusBadge :status="user.active ? 'active' : 'inactive'" />
                </td>
                <td class="p-2 text-center">
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
      <!-- Create Employee Accordion -->
      <div class="card mb-4">
        <div
          class="card-header d-flex align-items-center justify-content-between cursor-pointer"
          role="button"
          @click="showEmployeeForm = !showEmployeeForm; nextTick(measureEmployeeForm)"
          :aria-expanded="showEmployeeForm"
        >
          <div>
            <h5 class="mb-1">Add Employee</h5>
            <p class="text-muted small mb-0">Create an employee profile for job rosters</p>
          </div>
          <i :class="['bi', 'bi-chevron-down', 'chevron', { open: showEmployeeForm }]" aria-hidden="true"></i>
        </div>
        <div
          class="card-body border-top inline-collapse"
          :style="getEmployeeFormStyle()"
          :ref="setEmployeeFormRef"
        >
          <div class="collapse-inner p-3">
            <form class="row g-3" @submit.prevent="submitEmployeeForm">
              <div class="col-md-4">
                <label class="form-label small">First Name</label>
                <input
                  v-model="employeeForm.firstName"
                  type="text"
                  class="form-control"
                  placeholder="John"
                  required
                />
              </div>
              <div class="col-md-4">
                <label class="form-label small">Last Name</label>
                <input
                  v-model="employeeForm.lastName"
                  type="text"
                  class="form-control"
                  placeholder="Doe"
                  required
                />
              </div>
              <div class="col-md-4">
                <label class="form-label small">Employee Number</label>
                <input
                  v-model="employeeForm.employeeNumber"
                  type="text"
                  class="form-control"
                  placeholder="EMP-001"
                />
              </div>
              <div class="col-md-6">
                <label class="form-label small">Occupation</label>
                <input
                  v-model="employeeForm.occupation"
                  type="text"
                  class="form-control"
                  placeholder="Carpenter"
                  required
                />
              </div>
              <div class="col-12 d-flex gap-2 justify-content-end pt-2">
                <button type="button" class="btn btn-outline-secondary" @click.stop="cancelEmployeeForm" :disabled="creatingEmployee">
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary" :disabled="creatingEmployee">
                  <span v-if="creatingEmployee" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Add Employee
                </button>
              </div>
            </form>
          </div>
          </div>
      </div>

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
                <th class="small fw-semibold">Employee #</th>
                <th style="width: 24%;" class="small fw-semibold">Occupation</th>
                <th class="small fw-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="emp in employees" :key="emp.id">
                <td class="p-2 fw-semibold">
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
                <td class="p-2">
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
                <td class="p-2 text-muted">
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
                <td class="p-2 text-center">
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

<style scoped>
.cursor-pointer {
  cursor: pointer;
}

.chevron {
  transition: transform 0.3s ease-in-out;
}

.chevron.open {
  transform: rotate(180deg);
}

.inline-collapse {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  padding: 0;
  transition: max-height 0.3s ease, opacity 0.2s ease;
}

.collapse-inner {
  padding: 1rem 1.25rem;
}
</style>
