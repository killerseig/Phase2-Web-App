import { computed } from 'vue'
import {
  buildTimecardExportAvailableForemen,
  buildTimecardExportCreateForemanOptions,
  buildTimecardExportForemanFilterOptions,
  buildTimecardExportJobOptions,
  filterTimecardExportEmployees,
  filterTimecardExportUserForemen,
  getTimecardExportCreateTrayMessage,
  resolveTimecardExportCreateWeekTarget,
  type TimecardExportDateFilterMode,
} from '@/features/timecards/exportViewHelpers'
import type { EmployeeRecord, JobRecord, TimecardWeekRecord, UserProfile } from '@/types/domain'

interface ReadonlyRef<T> {
  readonly value: T
}

interface TimecardExportCreateContextFilters {
  dateMode: TimecardExportDateFilterMode
  singleWeekEndDate: string
}

interface UseTimecardExportCreateContextOptions {
  collator: Intl.Collator
  createCardJobId: ReadonlyRef<string>
  employeeSearchTerm: ReadonlyRef<string>
  employees: ReadonlyRef<EmployeeRecord[]>
  filters: TimecardExportCreateContextFilters
  getCurrentUserId: () => string | null
  getDisplayName: () => string | null
  getJobs: () => JobRecord[]
  users: ReadonlyRef<UserProfile[]>
  weeks: ReadonlyRef<TimecardWeekRecord[]>
}

export function useTimecardExportCreateContext({
  collator,
  createCardJobId,
  employeeSearchTerm,
  employees,
  filters,
  getCurrentUserId,
  getDisplayName,
  getJobs,
  users,
  weeks,
}: UseTimecardExportCreateContextOptions) {
  const availableJobOptions = computed(() => buildTimecardExportJobOptions(getJobs(), collator))
  const availableForemen = computed(() => buildTimecardExportAvailableForemen(weeks.value, collator))
  const availableForemanOptions = computed(() => buildTimecardExportForemanFilterOptions(availableForemen.value))
  const availableUserForemen = computed(() => filterTimecardExportUserForemen(users.value))

  const createCardJobOptions = computed(() => availableJobOptions.value)
  const createCardJobRecord = computed(() => (
    getJobs().find((job) => job.id === createCardJobId.value) ?? null
  ))
  const targetCreateWeek = computed(() => resolveTimecardExportCreateWeekTarget({
    dateMode: filters.dateMode,
    jobId: createCardJobId.value,
    weekEndDate: filters.singleWeekEndDate,
    weeks: weeks.value,
    jobOptions: createCardJobOptions.value,
    ownerUserId: getCurrentUserId(),
    ownerName: getDisplayName(),
  }))
  const createCardForemanOptions = computed(() => (
    buildTimecardExportCreateForemanOptions(createCardJobRecord.value, availableUserForemen.value)
  ))
  const availableEmployees = computed(() => filterTimecardExportEmployees(employees.value, employeeSearchTerm.value))
  const createTrayMessage = computed(() => (
    getTimecardExportCreateTrayMessage(filters.dateMode, !!createCardJobOptions.value.length)
  ))

  return {
    availableEmployees,
    availableForemanOptions,
    availableForemen,
    availableJobOptions,
    availableUserForemen,
    createCardForemanOptions,
    createCardJobOptions,
    createCardJobRecord,
    createTrayMessage,
    targetCreateWeek,
  }
}
