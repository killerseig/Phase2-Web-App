<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import Toast from '../../components/Toast.vue'
import AdminCardWrapper from '../../components/admin/AdminCardWrapper.vue'
import StatusBadge from '../../components/admin/StatusBadge.vue'
import BaseAccordionCard from '../../components/common/BaseAccordionCard.vue'
import BaseTable from '../../components/common/BaseTable.vue'
import { useUsersStore } from '../../stores/users'
import { useEmployeesStore } from '../../stores/employees'
import { useAuthStore } from '../../stores/auth'
import { type Employee, type UserProfile } from '@/services'
import { type Role } from '@/constants/app'

type Align = 'start' | 'center' | 'end'
type Column = { key: string; label: string; sortable?: boolean; width?: string; align?: Align; slot?: string }

type SortDir = 'asc' | 'desc'
type UserSortKey = 'email' | 'firstName' | 'lastName' | 'role'

const route = useRoute()
const auth = useAuthStore()
const usersStore = useUsersStore()
const employeesStore = useEmployeesStore()
const toastRef = ref<InstanceType<typeof Toast> | null>(null)

const activeTab = ref<'users' | 'employees'>(route.query.tab === 'employees' ? 'employees' : 'users')

// User form
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
const activeUserActionsId = ref('')

// Employee form
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
const activeEmployeeActionsId = ref('')

// Computed properties from stores
const users = computed(() => usersStore.allUsers)
const loadingUsers = computed(() => usersStore.isLoading)
const err = computed(() => usersStore.error || '')

const userColumns: Column[] = [
  { key: 'email', label: 'Email', sortable: true },
  { key: 'firstName', label: 'First Name', sortable: true, width: '16%' },
  { key: 'lastName', label: 'Last Name', sortable: true, width: '16%' },
  { key: 'role', label: 'Role', sortable: true, width: '12%', slot: 'role' },
  { key: 'status', label: 'Status', width: '12%', slot: 'status' },
  { key: 'actions', label: 'Actions', width: '18%', align: 'end', slot: 'actions' },
]

const userSortKey = ref<UserSortKey>('email')
const userSortDir = ref<SortDir>('asc')

const sortedUsers = computed(() => {
  const key = userSortKey.value
  const dir = userSortDir.value === 'asc' ? 1 : -1
  const normalize = (val: unknown) => {
    if (val === undefined || val === null) return ''
    if (typeof val === 'string') return val.toLowerCase()
    return String(val).toLowerCase()
  }
  return [...users.value].sort((a, b) => {
    const aVal = normalize((a as any)[key])
    const bVal = normalize((b as any)[key])
    if (aVal === bVal) return 0
    return aVal > bVal ? dir : -dir
  })
})

const employees = computed(() => employeesStore.allEmployees)
const loadingEmployees = computed(() => employeesStore.isLoading)

const employeeColumns: Column[] = [
  { key: 'firstName', label: 'First Name', sortable: true, width: '26%', slot: 'firstName' },
  { key: 'lastName', label: 'Last Name', sortable: true, width: '24%', slot: 'lastName' },
  { key: 'employeeNumber', label: 'Employee #', sortable: true, width: '18%', slot: 'employeeNumber' },
  { key: 'occupation', label: 'Occupation', sortable: true, width: '22%', slot: 'occupation' },
  { key: 'actions', label: 'Actions', width: '10%', align: 'end', slot: 'emp-actions' },
]

type EmployeeSortKey = 'firstName' | 'lastName' | 'employeeNumber' | 'occupation'

const employeeSortKey = ref<EmployeeSortKey>('firstName')
const employeeSortDir = ref<SortDir>('asc')

const sortedEmployees = computed(() => {
  const key = employeeSortKey.value
  const dir = employeeSortDir.value === 'asc' ? 1 : -1
  const normalize = (val: unknown) => {
    if (val === undefined || val === null) return ''
    if (typeof val === 'string') return val.toLowerCase()
    return String(val).toLowerCase()
  }
  return [...employees.value].sort((a, b) => {
    const aVal = normalize((a as any)[key])
    const bVal = normalize((b as any)[key])
    if (aVal === bVal) return 0
    return aVal > bVal ? dir : -dir
  })
})

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
    await usersStore.createUser(
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
  editUserForm.value = {
    email: user.email || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    role: user.role,
  }
  editUserFormOriginal.value = {
    email: user.email || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    role: user.role,
  }
}

function clearUserEdit() {
  editingUserId.value = null
  editUserForm.value = { email: '', firstName: '', lastName: '', role: 'none' }
  editUserFormOriginal.value = { email: '', firstName: '', lastName: '', role: 'none' }
}

function resetUserForm() {
  userForm.value = { email: '', firstName: '', lastName: '', role: 'none' }
}

function cancelUserForm() {
  resetUserForm()
  showUserForm.value = false
}

async function saveUserEdit(user: UserProfile, closeActions = false) {
  if (editingUserId.value !== user.id) return true
  if (!editUserForm.value.firstName.trim() || !editUserForm.value.lastName.trim()) {
    toastRef.value?.show('First name and last name are required', 'error')
    return false
  }

  savingUserEdit.value = true
  try {
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
    if (Object.keys(updates).length > 0) {
      await usersStore.updateUserProfile(user.id, updates)
      toastRef.value?.show('User updated', 'success')
    }
    clearUserEdit()
    if (closeActions) activeUserActionsId.value = ''
    return true
  } catch (e: any) {
    toastRef.value?.show('Failed to update user', 'error')
    return false
  } finally {
    savingUserEdit.value = false
  }
}

function cancelUserEdit() {
  clearUserEdit()
  activeUserActionsId.value = ''
}

async function handleDeleteUser(user: UserProfile) {
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return

  try {
    await usersStore.deleteUser(user.id)
    toastRef.value?.show('User deleted', 'success')
    if (activeUserActionsId.value === user.id) {
      cancelUserEdit()
    }
  } catch (e: any) {
    toastRef.value?.show('Failed to delete user', 'error')
  }
}

function handleUserSort({ sortKey, sortDir }: { sortKey: string; sortDir: SortDir }) {
  userSortKey.value = sortKey as UserSortKey
  userSortDir.value = sortDir
}

async function toggleUserActions(user: UserProfile) {
  const isOpen = activeUserActionsId.value === user.id
  if (isOpen) {
    const saved = await saveUserEdit(user, true)
    if (!saved) return
    return
  }

  cancelUserEdit()
  handleEditUser(user)
  activeUserActionsId.value = user.id
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

async function handleEditEmployee(emp: Employee) {
  editingEmployeeId.value = emp.id
  editForm.value = {
    firstName: emp.firstName,
    lastName: emp.lastName,
    employeeNumber: emp.employeeNumber || '',
    occupation: emp.occupation,
  }
  editFormOriginal.value = {
    firstName: emp.firstName,
    lastName: emp.lastName,
    employeeNumber: emp.employeeNumber || '',
    occupation: emp.occupation,
  }
}

async function saveEmployeeEdit(emp: Employee, closeActions = false) {
  if (editingEmployeeId.value !== emp.id) return true
  savingEmployeeEdit.value = true
  try {
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
    if (Object.keys(updates).length > 0) {
      await employeesStore.updateEmployee(emp.id, updates)
      toastRef.value?.show('Employee updated', 'success')
    }
    editingEmployeeId.value = null
    if (closeActions) activeEmployeeActionsId.value = ''
    return true
  } catch (e: any) {
    toastRef.value?.show('Failed to update employee', 'error')
    return false
  } finally {
    savingEmployeeEdit.value = false
  }
}

function cancelEmployeeEdit() {
  editingEmployeeId.value = null
  editForm.value = { firstName: '', lastName: '', employeeNumber: '', occupation: '' }
  editFormOriginal.value = { firstName: '', lastName: '', employeeNumber: '', occupation: '' }
  activeEmployeeActionsId.value = ''
}

async function handleDeleteEmployee(emp: Employee) {
  const name = `${emp.firstName} ${emp.lastName}`
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return

  try {
    await employeesStore.deleteEmployee(emp.id)
    toastRef.value?.show('Employee deleted', 'success')
    if (activeEmployeeActionsId.value === emp.id) {
      cancelEmployeeEdit()
    }
  } catch (e: any) {
    toastRef.value?.show('Failed to delete employee', 'error')
  }
}

function handleEmployeeSort({ sortKey, sortDir }: { sortKey: string; sortDir: SortDir }) {
  employeeSortKey.value = sortKey as EmployeeSortKey
  employeeSortDir.value = sortDir
}

async function toggleEmployeeActions(emp: Employee) {
  const isOpen = activeEmployeeActionsId.value === emp.id
  if (isOpen) {
    const saved = await saveEmployeeEdit(emp, true)
    if (!saved) return
    return
  }

  cancelEmployeeEdit()
  handleEditEmployee(emp)
  activeEmployeeActionsId.value = emp.id
}

onMounted(() => {
  loadUsers()
  loadEmployees()
})
</script>

<template>
  <Toast ref="toastRef" />
  <div class="container-fluid py-4 wide-container-1200">
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
      <BaseAccordionCard
        v-model:open="showUserForm"
        title="Create User"
        subtitle="Add a new user account and set their role"
      >
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
      </BaseAccordionCard>

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

        <div v-else>
          <BaseTable
            :rows="sortedUsers"
            :columns="userColumns"
            row-key="id"
            :sort-key="userSortKey"
            :sort-dir="userSortDir"
            table-class="table-dark"
            @sort-change="handleUserSort"
          >
            <template #cell-email="{ row }">
              <template v-if="editingUserId === row.id">
                <input v-model="editUserForm.email" class="form-control form-control-sm" type="email" disabled />
              </template>
              <span v-else class="small">{{ row.email }}</span>
            </template>

            <template #cell-firstName="{ row }">
              <template v-if="editingUserId === row.id">
                <input
                  v-model="editUserForm.firstName"
                  class="form-control form-control-sm"
                  placeholder="First name"
                  @keydown.enter="saveUserEdit(row, true)"
                  @keydown.esc="cancelUserEdit"
                />
              </template>
              <span v-else>{{ row.firstName }}</span>
            </template>

            <template #cell-lastName="{ row }">
              <template v-if="editingUserId === row.id">
                <input
                  v-model="editUserForm.lastName"
                  class="form-control form-control-sm"
                  placeholder="Last name"
                  @keydown.enter="saveUserEdit(row, true)"
                  @keydown.esc="cancelUserEdit"
                />
              </template>
              <span v-else>{{ row.lastName }}</span>
            </template>

            <template #role="{ row }">
              <template v-if="editingUserId === row.id">
                <select
                  v-model="editUserForm.role"
                  class="form-select form-select-sm"
                  @keydown.enter="saveUserEdit(row, true)"
                  @keydown.esc="cancelUserEdit"
                >
                  <option value="none">None</option>
                  <option value="employee">Employee</option>
                  <option value="shop">Shop</option>
                  <option value="foreman">Foreman</option>
                  <option value="admin">Admin</option>
                </select>
              </template>
              <span
                v-else
                class="badge"
                :class="{
                  'bg-secondary': row.role === 'none',
                  'bg-info': row.role === 'employee',
                  'bg-success': row.role === 'shop',
                  'bg-warning': row.role === 'foreman',
                  'bg-danger': row.role === 'admin',
                }"
              >
                {{ row.role }}
              </span>
            </template>

            <template #status="{ row }">
              <StatusBadge :status="row.active ? 'active' : 'inactive'" />
            </template>

            <template #actions="{ row }">
              <div class="d-flex align-items-center justify-content-end gap-2 flex-nowrap">
                <div v-if="activeUserActionsId === row.id" class="btn-group btn-group-sm flex-nowrap" role="group">
                  <button
                    @click.stop="handleDeleteUser(row)"
                    class="btn btn-outline-danger"
                    title="Delete user"
                  >
                    <i class="bi bi-trash text-danger"></i>
                  </button>
                </div>

                <button
                  class="btn btn-sm btn-outline-secondary"
                  @click.stop="toggleUserActions(row)"
                  :aria-pressed="activeUserActionsId === row.id"
                  :disabled="savingUserEdit && editingUserId === row.id"
                  title="Toggle edit mode"
                >
                  <i class="bi bi-pencil"></i>
                </button>
              </div>
            </template>
          </BaseTable>
        </div>
      </AdminCardWrapper>
    </template>

    <!-- Employees Tab -->
    <template v-if="activeTab === 'employees'">
      <BaseAccordionCard
        v-model:open="showEmployeeForm"
        title="Add Employee"
        subtitle="Create an employee profile for job rosters"
      >
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
      </BaseAccordionCard>

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

        <div v-else>
          <BaseTable
            :rows="sortedEmployees"
            :columns="employeeColumns"
            row-key="id"
            :sort-key="employeeSortKey"
            :sort-dir="employeeSortDir"
            table-class="table-dark"
            @sort-change="handleEmployeeSort"
          >
            <template #firstName="{ row }">
              <template v-if="editingEmployeeId === row.id">
                <input
                  v-model="editForm.firstName"
                  class="form-control form-control-sm"
                  placeholder="First name"
                  @keydown.enter="saveEmployeeEdit(row, true)"
                  @keydown.esc="cancelEmployeeEdit"
                />
              </template>
              <span v-else class="fw-semibold">{{ row.firstName }}</span>
            </template>

            <template #lastName="{ row }">
              <template v-if="editingEmployeeId === row.id">
                <input
                  v-model="editForm.lastName"
                  class="form-control form-control-sm"
                  placeholder="Last name"
                  @keydown.enter="saveEmployeeEdit(row, true)"
                  @keydown.esc="cancelEmployeeEdit"
                />
              </template>
              <span v-else class="fw-semibold">{{ row.lastName }}</span>
            </template>

            <template #employeeNumber="{ row }">
              <template v-if="editingEmployeeId === row.id">
                <input
                  v-model="editForm.employeeNumber"
                  class="form-control form-control-sm"
                  placeholder="EMP-001"
                  @keydown.enter="saveEmployeeEdit(row, true)"
                  @keydown.esc="cancelEmployeeEdit"
                />
              </template>
              <span v-else class="small">{{ row.employeeNumber || '—' }}</span>
            </template>

            <template #occupation="{ row }">
              <template v-if="editingEmployeeId === row.id">
                <input
                  v-model="editForm.occupation"
                  class="form-control form-control-sm"
                  placeholder="Occupation"
                  @keydown.enter="saveEmployeeEdit(row, true)"
                  @keydown.esc="cancelEmployeeEdit"
                />
              </template>
              <span v-else class="text-muted">{{ row.occupation }}</span>
            </template>

            <template #emp-actions="{ row }">
              <div class="d-flex align-items-center justify-content-end gap-1 flex-nowrap" style="min-width: 200px;">
                <div v-if="activeEmployeeActionsId === row.id" class="btn-group btn-group-sm flex-nowrap" role="group">
                  <button
                    @click.stop="handleDeleteEmployee(row)"
                    class="btn btn-outline-danger"
                    title="Delete employee"
                  >
                    <i class="bi bi-trash text-danger"></i>
                  </button>
                </div>

                <button
                  class="btn btn-sm btn-outline-secondary"
                  @click.stop="toggleEmployeeActions(row)"
                  :aria-pressed="activeEmployeeActionsId === row.id"
                  :disabled="savingEmployeeEdit && editingEmployeeId === row.id"
                  title="Toggle edit mode"
                >
                  <i class="bi bi-pencil"></i>
                </button>
              </div>
            </template>
          </BaseTable>
        </div>
      </AdminCardWrapper>
    </template>
  </div>
</template>
