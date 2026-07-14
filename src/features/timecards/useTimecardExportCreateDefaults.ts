import { watch } from 'vue'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface JobOption {
  id: string
}

interface ForemanOption {
  id: string
  label: string
}

interface CreateWeekOption {
  id: string
  jobId: string
}

interface UseTimecardExportCreateDefaultsOptions {
  createCardForemanId: Ref<string>
  createCardForemanOptions: ReadonlyRef<ForemanOption[]>
  createCardJobId: Ref<string>
  createCardJobOptions: ReadonlyRef<JobOption[]>
  selectedForemanFilter: ReadonlyRef<string>
  targetCreateWeek: ReadonlyRef<CreateWeekOption | null>
}

function buildOptionSignature(options: readonly JobOption[] | readonly ForemanOption[]) {
  return options.map((option) => option.id).join('|')
}

export function useTimecardExportCreateDefaults({
  createCardForemanId,
  createCardForemanOptions,
  createCardJobId,
  createCardJobOptions,
  selectedForemanFilter,
  targetCreateWeek,
}: UseTimecardExportCreateDefaultsOptions) {
  watch(
    () => buildOptionSignature(createCardJobOptions.value),
    () => {
      if (!createCardJobOptions.value.length) {
        createCardJobId.value = ''
        return
      }

      if (createCardJobOptions.value.some((job) => job.id === createCardJobId.value)) {
        return
      }

      const currentWeekJobId = targetCreateWeek.value?.jobId
      if (currentWeekJobId && createCardJobOptions.value.some((job) => job.id === currentWeekJobId)) {
        createCardJobId.value = currentWeekJobId
        return
      }

      if (createCardJobOptions.value.length === 1) {
        createCardJobId.value = createCardJobOptions.value[0]?.id ?? ''
        return
      }

      createCardJobId.value = ''
    },
    { immediate: true },
  )

  watch(
    () => buildOptionSignature(createCardForemanOptions.value),
    () => {
      if (!createCardForemanOptions.value.length) {
        createCardForemanId.value = ''
        return
      }

      if (createCardForemanOptions.value.some((foreman) => foreman.id === createCardForemanId.value)) {
        return
      }

      if (targetCreateWeek.value?.id && createCardForemanOptions.value.length === 1) {
        createCardForemanId.value = createCardForemanOptions.value[0]?.id ?? ''
        return
      }

      if (selectedForemanFilter.value !== 'all') {
        const matchingForeman = createCardForemanOptions.value.find((foreman) => (
          foreman.label === selectedForemanFilter.value
        ))
        if (matchingForeman) {
          createCardForemanId.value = matchingForeman.id
          return
        }
      }

      if (createCardForemanOptions.value.length === 1) {
        createCardForemanId.value = createCardForemanOptions.value[0]?.id ?? ''
        return
      }

      createCardForemanId.value = ''
    },
    { immediate: true },
  )
}
