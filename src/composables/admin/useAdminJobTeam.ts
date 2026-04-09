import { computed, onUnmounted, ref, watch, type ComputedRef } from 'vue'
import { storeToRefs } from 'pinia'
import { linkForemanToJob, unlinkForemanFromJob } from '@/services'
import { useToast } from '@/composables/useToast'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { ROLES } from '@/constants/app'
import { useEmployeesStore } from '@/stores/employees'
import { useJobRosterStore } from '@/stores/jobRoster'
import { useJobsStore } from '@/stores/jobs'
import type { EmployeeDirectoryEmployee, Job, UserProfile } from '@/types/models'
import {
  createJobRosterForm,
  type JobAssignedForemanItem,
  type EmployeeDirectoryOption,
  type JobForemanOption,
  type JobRosterFormInput,
} from '@/types/adminJobTeam'

type UseAdminJobTeamOptions = {
  selectedJob: ComputedRef<Job | null>
  users: ComputedRef<UserProfile[]>
}

function displayNameForUser(user: Pick<UserProfile, 'firstName' | 'lastName' | 'email'>) {
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User'
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function displayNameForEmployee(employee: Pick<EmployeeDirectoryEmployee, 'firstName' | 'lastName'>) {
  return `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'Unnamed Employee'
}

export function useAdminJobTeam(options: UseAdminJobTeamOptions) {
  const { selectedJob, users } = options
  const employeesStore = useEmployeesStore()
  const jobsStore = useJobsStore()
  const rosterStore = useJobRosterStore()
  const toast = useToast()
  const { confirm } = useConfirmDialog()
  const {
    activeEmployees,
    loading: employeeDirectoryLoading,
    error: employeeDirectoryError,
  } = storeToRefs(employeesStore)
  const { rosterByJob } = storeToRefs(rosterStore)

  const selectedJobId = computed(() => selectedJob.value?.id ?? '')

  const foremanSelectionId = ref('')
  const assigningForemanId = ref('')
  const removingForemanId = ref('')
  const settingDisplayForemanId = ref('')

  const rosterSearchTerm = ref('')
  const rosterForm = ref<JobRosterFormInput>(createJobRosterForm())
  const savingRosterEmployee = ref(false)
  const togglingRosterEmployeeId = ref('')
  const removingRosterEmployeeId = ref('')

  employeesStore.subscribeAllEmployees()

  const rosterEmployees = computed(() => {
    const jobId = selectedJobId.value
    return jobId ? (rosterByJob.value[jobId] ?? []) : []
  })

  const selectedDirectoryEmployee = computed(() => (
    activeEmployees.value.find((employee) => employee.id === rosterForm.value.selectedEmployeeId) ?? null
  ))

  const availableEmployeeOptions = computed<EmployeeDirectoryOption[]>(() => {
    const rosterNumbers = new Set(
      rosterEmployees.value.map((employee) => String(employee.employeeNumber || '').trim()),
    )

    return activeEmployees.value
      .filter((employee) => !rosterNumbers.has(String(employee.employeeNumber || '').trim()))
      .map((employee) => ({
        id: employee.id,
        label: `${displayNameForEmployee(employee)} | #${employee.employeeNumber} | ${employee.occupation || 'No occupation'}`,
      }))
  })

  const activeForemanUsers = computed(() => users.value.filter(
    (user) => user.role === ROLES.FOREMAN && user.active,
  ))

  const assignedForemen = computed<JobAssignedForemanItem[]>(() => {
    const foremanIds = selectedJob.value?.assignedForemanIds ?? []
    const displayForeman = String(selectedJob.value?.foreman ?? '').trim()

    return foremanIds.map((foremanId) => {
      const user = users.value.find((entry) => entry.id === foremanId)
      if (!user) {
        return {
          id: foremanId,
          label: `Missing User (${foremanId})`,
          email: '',
          active: false,
          isDisplayForeman: false,
          missing: true,
        }
      }

      const label = displayNameForUser(user)
      return {
        id: user.id,
        label,
        email: user.email || '',
        active: user.active,
        isDisplayForeman: Boolean(displayForeman && displayForeman === label),
        missing: false,
      }
    })
  })

  const availableForemanOptions = computed<JobForemanOption[]>(() => {
    const assignedIds = new Set(selectedJob.value?.assignedForemanIds ?? [])
    return activeForemanUsers.value
      .filter((user) => !assignedIds.has(user.id))
      .map((user) => ({
        id: user.id,
        label: displayNameForUser(user),
      }))
  })

  const currentDisplayForemanId = computed(() => (
    assignedForemen.value.find((entry) => entry.isDisplayForeman)?.id
    ?? ''
  ))

  const filteredRosterEmployees = computed(() => {
    const term = rosterSearchTerm.value.trim().toLowerCase()
    if (!term) return rosterEmployees.value

    return rosterEmployees.value.filter((employee) => (
      employee.employeeNumber.toLowerCase().includes(term)
      || employee.firstName.toLowerCase().includes(term)
      || employee.lastName.toLowerCase().includes(term)
      || employee.occupation.toLowerCase().includes(term)
      || employee.contractor?.name?.toLowerCase().includes(term)
      || employee.contractor?.category?.toLowerCase().includes(term)
    ))
  })

  function resetRosterForm() {
    rosterForm.value = createJobRosterForm()
  }

  function setRosterForm(value: JobRosterFormInput) {
    rosterForm.value = value
  }

  function setRosterSearchTerm(value: string) {
    rosterSearchTerm.value = value
  }

  function setSelectedEmployeeId(value: string) {
    const employee = activeEmployees.value.find((entry) => entry.id === value)
    rosterForm.value = {
      ...rosterForm.value,
      selectedEmployeeId: value,
      wageRate: employee?.wageRate != null ? String(employee.wageRate) : rosterForm.value.wageRate,
    }
  }

  function setForemanSelectionId(value: string) {
    foremanSelectionId.value = value
  }

  async function assignSelectedForeman() {
    const job = selectedJob.value
    const foremanId = foremanSelectionId.value
    if (!job || !foremanId) return

    const foreman = users.value.find((user) => user.id === foremanId)
    if (!foreman) {
      toast.show('Selected foreman could not be found', 'error')
      return
    }

    assigningForemanId.value = foremanId
    try {
      await linkForemanToJob(foremanId, job.id)
      if (!String(job.foreman ?? '').trim()) {
        await jobsStore.updateJob(job.id, {
          foreman: displayNameForUser(foreman),
        })
      }
      foremanSelectionId.value = ''
      toast.show('Foreman assigned to job', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to assign foreman'
      toast.show(message, 'error')
    } finally {
      assigningForemanId.value = ''
    }
  }

  async function removeAssignedForeman(foremanId: string) {
    const job = selectedJob.value
    if (!job || !foremanId) return

    const foreman = assignedForemen.value.find((entry) => entry.id === foremanId)
    const confirmed = await confirm(
      `Remove ${foreman?.label || 'this foreman'} from "${job.name}"?`,
      {
        title: 'Remove Foreman',
        confirmText: 'Remove',
        variant: 'warning',
      },
    )
    if (!confirmed) return

    removingForemanId.value = foremanId
    try {
      await unlinkForemanFromJob(foremanId, job.id)

      if (foreman?.isDisplayForeman) {
        const nextDisplay = assignedForemen.value.find((entry) => entry.id !== foremanId && !entry.missing)
        await jobsStore.updateJob(job.id, {
          foreman: nextDisplay?.label || null,
        })
      }

      toast.show('Foreman removed from job', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove foreman'
      toast.show(message, 'error')
    } finally {
      removingForemanId.value = ''
    }
  }

  async function setDisplayForeman(foremanId: string) {
    const job = selectedJob.value
    const foreman = assignedForemen.value.find((entry) => entry.id === foremanId)
    if (!job || !foreman || foreman.missing) return

    settingDisplayForemanId.value = foremanId
    try {
      await jobsStore.updateJob(job.id, { foreman: foreman.label })
      toast.show('Foreman updated', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update foreman'
      toast.show(message, 'error')
    } finally {
      settingDisplayForemanId.value = ''
    }
  }

  async function addRosterEmployee() {
    const jobId = selectedJobId.value
    if (!jobId) return

    const directoryEmployee = selectedDirectoryEmployee.value
    const contractorName = rosterForm.value.contractorName.trim()
    const contractorCategory = rosterForm.value.contractorCategory.trim()
    const wageRate = parseOptionalNumber(rosterForm.value.wageRate)

    if (!directoryEmployee) {
      toast.show('Select an employee to add to the crew', 'error')
      return
    }

    if (wageRate === null) {
      toast.show('Wage rate must be a valid number', 'error')
      return
    }

    if (rosterForm.value.subcontracted && (!contractorName || !contractorCategory)) {
      toast.show('Subcontracted employees need contractor name and category', 'error')
      return
    }

    savingRosterEmployee.value = true
    try {
      await rosterStore.addEmployee(jobId, {
        employeeNumber: directoryEmployee.employeeNumber,
        firstName: directoryEmployee.firstName,
        lastName: directoryEmployee.lastName,
        occupation: directoryEmployee.occupation,
        wageRate,
        unitCost: undefined,
        active: true,
        contractor: rosterForm.value.subcontracted
          ? {
              name: contractorName,
              category: contractorCategory,
            }
          : undefined,
      })
      resetRosterForm()
      toast.show('Crew member added to job', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add employee'
      toast.show(message, 'error')
    } finally {
      savingRosterEmployee.value = false
    }
  }

  async function toggleRosterEmployeeStatus(employeeId: string) {
    const jobId = selectedJobId.value
    if (!jobId) return

    togglingRosterEmployeeId.value = employeeId
    try {
      await rosterStore.toggleEmployeeStatus(jobId, employeeId)
      toast.show('Crew member status updated', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update employee status'
      toast.show(message, 'error')
    } finally {
      togglingRosterEmployeeId.value = ''
    }
  }

  async function removeRosterEmployee(employeeId: string) {
    const jobId = selectedJobId.value
    const employee = rosterEmployees.value.find((entry) => entry.id === employeeId)
    if (!jobId || !employee) return

    const confirmed = await confirm(
      `Remove ${employee.firstName} ${employee.lastName} from this crew?`,
      {
        title: 'Remove Crew Member',
        confirmText: 'Remove',
        variant: 'danger',
      },
    )
    if (!confirmed) return

    removingRosterEmployeeId.value = employeeId
    try {
      await rosterStore.removeEmployee(jobId, employeeId)
      toast.show('Crew member removed from job', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove employee'
      toast.show(message, 'error')
    } finally {
      removingRosterEmployeeId.value = ''
    }
  }

  watch(
    selectedJobId,
    (nextJobId, previousJobId) => {
      if (previousJobId && previousJobId !== nextJobId) {
        rosterStore.stopJobRosterSubscription(previousJobId)
      }

      rosterSearchTerm.value = ''
      resetRosterForm()
      foremanSelectionId.value = ''

      if (!nextJobId) return
      rosterStore.subscribeJobRoster(nextJobId)
    },
    { immediate: true },
  )

  watch(
    [selectedJobId, currentDisplayForemanId],
    ([jobId, displayForemanId]) => {
      if (!jobId) {
        foremanSelectionId.value = ''
        return
      }

      const hasSelection = assignedForemen.value.some((entry) => entry.id === foremanSelectionId.value)
      if (hasSelection && foremanSelectionId.value !== displayForemanId) return

      foremanSelectionId.value = displayForemanId
    },
    { immediate: true },
  )

  onUnmounted(() => {
    employeesStore.stopEmployeesSubscription()
    if (selectedJobId.value) {
      rosterStore.stopJobRosterSubscription(selectedJobId.value)
    }
  })

  return {
    assignedForemen,
    assigningForemanId,
    availableEmployeeOptions,
    availableForemanOptions,
    employeeDirectoryError,
    employeeDirectoryLoading,
    filteredRosterEmployees,
    foremanSelectionId,
    removingForemanId,
    removingRosterEmployeeId,
    rosterEmployees,
    rosterForm,
    rosterSearchTerm,
    savingRosterEmployee,
    selectedDirectoryEmployee,
    setDisplayForeman,
    setForemanSelectionId,
    setRosterForm,
    setSelectedEmployeeId,
    settingDisplayForemanId,
    addRosterEmployee,
    assignSelectedForeman,
    removeAssignedForeman,
    removeRosterEmployee,
    resetRosterForm,
    setRosterSearchTerm,
    toggleRosterEmployeeStatus,
    togglingRosterEmployeeId,
  }
}
