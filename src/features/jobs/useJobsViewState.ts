import { computed } from 'vue'
import {
  ALL_JOBS_ID,
  buildJobForemanOptions,
  buildJobGcSuggestions,
  buildJobTypeOptions,
  filterJobForemanOptions,
  filterJobsForDirectory,
  getJobStatusCounts,
  getSelectedJobForJobsView,
} from '@/features/jobs/jobViewHelpers'
import type { JobRecord, UserProfile } from '@/types/domain'
import type { ReadonlyRef } from '@/types/reactivity'
import type { DirectoryStatusFilter } from '@/utils/directoryFilters'

interface UseJobsViewStateOptions {
  activeJobs: ReadonlyRef<JobRecord[]>
  allJobs: ReadonlyRef<JobRecord[]>
  editDrawerOpen: ReadonlyRef<boolean>
  foremanSearchTerm: ReadonlyRef<string>
  getCanCreateJobs: () => boolean
  getCanManageJobs: () => boolean
  getCanUseJobSetupEditor: () => boolean
  jobStatusFilter: ReadonlyRef<DirectoryStatusFilter>
  searchTerm: ReadonlyRef<string>
  selectedJobId: ReadonlyRef<string | null>
  users: ReadonlyRef<UserProfile[]>
}

export function useJobsViewState({
  activeJobs,
  allJobs,
  editDrawerOpen,
  foremanSearchTerm,
  getCanCreateJobs,
  getCanManageJobs,
  getCanUseJobSetupEditor,
  jobStatusFilter,
  searchTerm,
  selectedJobId,
  users,
}: UseJobsViewStateOptions) {
  const visibleJobs = computed(() => filterJobsForDirectory(
    getCanManageJobs() ? allJobs.value : activeJobs.value,
    getCanManageJobs() ? jobStatusFilter.value : 'both',
    searchTerm.value,
  ))
  const selectedJob = computed(() => getSelectedJobForJobsView(allJobs.value, selectedJobId.value))
  const isCreateMode = computed(() => getCanCreateJobs() && selectedJobId.value === 'new')
  const isAllJobsMode = computed(() => getCanManageJobs() && selectedJobId.value === ALL_JOBS_ID)
  const foremen = computed(() => buildJobForemanOptions(users.value))
  const filteredForemen = computed(() => filterJobForemanOptions(foremen.value, foremanSearchTerm.value))
  const jobStatusCounts = computed(() => getJobStatusCounts(allJobs.value))
  const activeJobCount = computed(() => jobStatusCounts.value.active)
  const archivedJobCount = computed(() => jobStatusCounts.value.archived)
  const showAllJobsEntry = computed(() => getCanManageJobs() && getCanUseJobSetupEditor() && editDrawerOpen.value)
  const jobTypeOptions = computed(() => buildJobTypeOptions(allJobs.value))
  const gcSuggestions = computed(() => buildJobGcSuggestions(allJobs.value))

  return {
    activeJobCount,
    archivedJobCount,
    filteredForemen,
    gcSuggestions,
    isAllJobsMode,
    isCreateMode,
    jobTypeOptions,
    selectedJob,
    showAllJobsEntry,
    visibleJobs,
  }
}
