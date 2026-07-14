import { nextTick, reactive, ref, watch } from 'vue'
import type { UserProfile } from '@/types/domain'
import {
  areUserDetailSnapshotsEqual,
  getUserDetailFormSnapshot,
  getUserDetailSnapshot,
  type EditableUserRole,
  type UserCreateFormState,
  type UserCreateTextField,
  type UserDetailFormState,
  type UserDetailTextField,
} from './userViewHelpers'

type UseUserFormStateOptions = {
  resetCreateMessages: () => void
}

const defaultRole: EditableUserRole = 'foreman'

function toggleAssignedJob(target: string[], jobId: string) {
  if (target.includes(jobId)) {
    const index = target.indexOf(jobId)
    target.splice(index, 1)
    return
  }

  target.push(jobId)
}

export function useUserFormState({ resetCreateMessages }: UseUserFormStateOptions) {
  const createJobSearchTerm = ref('')
  const detailJobSearchTerm = ref('')
  const syncingDetailForm = ref(false)

  const createForm = reactive<UserCreateFormState>({
    email: '',
    firstName: '',
    lastName: '',
    role: defaultRole,
    assignedJobIds: [],
  })

  const detailForm = reactive<UserDetailFormState>({
    firstName: '',
    lastName: '',
    role: defaultRole,
    active: true,
    assignedJobIds: [],
  })

  function resetCreateForm() {
    createForm.email = ''
    createForm.firstName = ''
    createForm.lastName = ''
    createForm.role = defaultRole
    createForm.assignedJobIds = []
    createJobSearchTerm.value = ''
    resetCreateMessages()
  }

  async function applyUserToDetailForm(user: UserProfile | null) {
    syncingDetailForm.value = true
    try {
      if (!user) {
        detailForm.firstName = ''
        detailForm.lastName = ''
        detailForm.role = defaultRole
        detailForm.active = true
        detailForm.assignedJobIds = []
      } else {
        detailForm.firstName = user.firstName ?? ''
        detailForm.lastName = user.lastName ?? ''
        detailForm.role = user.role === 'admin'
          ? 'admin'
          : user.role === 'project-manager'
            ? 'project-manager'
            : defaultRole
        detailForm.active = user.active
        detailForm.assignedJobIds = [...user.assignedJobIds]
      }

      await nextTick()
    } finally {
      syncingDetailForm.value = false
    }
  }

  function resetDetailJobSearchTerm() {
    detailJobSearchTerm.value = ''
  }

  function toggleCreateAssignedJob(jobId: string) {
    toggleAssignedJob(createForm.assignedJobIds, jobId)
  }

  function toggleDetailAssignedJob(jobId: string) {
    toggleAssignedJob(detailForm.assignedJobIds, jobId)
  }

  function getDetailFormSnapshot() {
    return getUserDetailFormSnapshot(detailForm)
  }

  function hasUnsavedDetailChanges(user: UserProfile | null) {
    return !areUserDetailSnapshotsEqual(getUserDetailSnapshot(user), getDetailFormSnapshot())
  }

  function updateCreateTextField(field: UserCreateTextField, value: string) {
    createForm[field] = value
  }

  function updateCreateRole(value: EditableUserRole) {
    createForm.role = value
  }

  function updateDetailTextField(field: UserDetailTextField, value: string) {
    detailForm[field] = value
  }

  function updateDetailRole(value: EditableUserRole) {
    detailForm.role = value
  }

  function updateDetailActive(value: boolean) {
    detailForm.active = value
  }

  watch(
    () => createForm.role,
    (role) => {
      if (role === 'admin') {
        createForm.assignedJobIds = []
      }
    },
  )

  watch(
    () => detailForm.role,
    (role) => {
      if (role === 'admin') {
        detailForm.assignedJobIds = []
      }
    },
  )

  return {
    applyUserToDetailForm,
    createForm,
    createJobSearchTerm,
    detailForm,
    detailJobSearchTerm,
    getDetailFormSnapshot,
    hasUnsavedDetailChanges,
    resetCreateForm,
    resetDetailJobSearchTerm,
    syncingDetailForm,
    toggleCreateAssignedJob,
    toggleDetailAssignedJob,
    updateCreateRole,
    updateCreateTextField,
    updateDetailActive,
    updateDetailRole,
    updateDetailTextField,
  }
}
