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
import type { DirectoryStatusFilter } from '@/utils/directoryFilters'

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseJobsViewStateOptions {
  activeJobs: ReadonlyRef<JobRecord[]>
  allJobs: ReadonlyRef<JobRecord[]>
  editDrawerOpen: ReadonlyRef<boolean>
  foremanSearchTerm: ReadonlyRef<string>
  getIsAdmin: () => boolean
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
  getIsAdmin,
  jobStatusFilter,
  searchTerm,
  selectedJobId,
  users,
}: UseJobsViewStateOptions) {
  const visibleJobs = computed(() => filterJobsForDirectory(
    getIsAdmin() ? allJobs.value : activeJobs.value,
    getIsAdmin() ? jobStatusFilter.value : 'both',
    searchTerm.value,
  ))
  const selectedJob = computed(() => getSelectedJobForJobsView(allJobs.value, selectedJobId.value))
  const isCreateMode = computed(() => getIsAdmin() && selectedJobId.value === 'new')
  const isAllJobsMode = computed(() => getIsAdmin() && selectedJobId.value === ALL_JOBS_ID)
  const foremen = computed(() => buildJobForemanOptions(users.value))
  const filteredForemen = computed(() => filterJobForemanOptions(foremen.value, foremanSearchTerm.value))
  const jobStatusCounts = computed(() => getJobStatusCounts(allJobs.value))
  const activeJobCount = computed(() => jobStatusCounts.value.active)
  const archivedJobCount = computed(() => jobStatusCounts.value.archived)
  const showAllJobsEntry = computed(() => getIsAdmin() && editDrawerOpen.value)
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
