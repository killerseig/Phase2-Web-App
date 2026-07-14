import { ref, watch } from 'vue'
import {
  cloneDailyLogPayload,
  createEmptyDailyLogPayload,
} from '@/features/dailyLogs/schema'
import type { DailyLogSiteInfoDisplay } from '@/features/dailyLogs/viewHelpers'
import type {
  DailyLogPayload,
  DailyLogRecord,
  JobRecord,
} from '@/types/domain'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseDailyLogFormHydrationOptions {
  canEditSelectedLog: ReadonlyRef<boolean>
  clearRecipientInput: () => void
  form: Ref<DailyLogPayload>
  getAuthDisplayName: () => string | null
  hydrateForm: (callback: () => void) => void
  job: ReadonlyRef<JobRecord | null>
  lastSavedSignature: ReadonlyRef<string>
  selectedLog: ReadonlyRef<DailyLogRecord | null>
  serializePayload: (payload: DailyLogPayload) => string
  setSavedPayloadSnapshot: (payload: DailyLogPayload) => void
  siteInfo: ReadonlyRef<DailyLogSiteInfoDisplay>
}

export function useDailyLogFormHydration({
  canEditSelectedLog,
  clearRecipientInput,
  form,
  getAuthDisplayName,
  hydrateForm,
  job,
  lastSavedSignature,
  selectedLog,
  serializePayload,
  setSavedPayloadSnapshot,
  siteInfo,
}: UseDailyLogFormHydrationOptions) {
  const lastHydratedLogId = ref<string | null>(null)

  function resetForm(log: DailyLogRecord | null = null) {
    hydrateForm(() => {
      form.value = log ? cloneDailyLogPayload(log.payload) : createEmptyDailyLogPayload()
      setSavedPayloadSnapshot(form.value)
      lastHydratedLogId.value = log?.id ?? null
    })
  }

  function applyJobSnapshotFieldsToDraft() {
    if (!canEditSelectedLog.value) return

    form.value.projectName = siteInfo.value.projectName
    form.value.jobSiteNumbers = siteInfo.value.jobNumber
    form.value.foremanOnSite = siteInfo.value.foreman
    form.value.siteForemanAssistant = siteInfo.value.projectManager
  }

  watch(
    () => selectedLog.value,
    (log, previousLog) => {
      if (!log) {
        clearRecipientInput()
        resetForm(null)
        return
      }

      const nextLogId = log.id
      const previousLogId = previousLog?.id ?? null
      const selectionChanged = nextLogId !== previousLogId || nextLogId !== lastHydratedLogId.value

      if (selectionChanged) {
        clearRecipientInput()
        resetForm(log)
        return
      }

      const localSignature = serializePayload(form.value)
      const incomingSignature = serializePayload(log.payload)
      const hasUnsavedLocalChanges = canEditSelectedLog.value && localSignature !== lastSavedSignature.value

      if (hasUnsavedLocalChanges) return
      if (incomingSignature === lastSavedSignature.value) return

      resetForm(log)
    },
    { immediate: true },
  )

  watch(
    () => [
      job.value?.name,
      job.value?.code,
      job.value?.projectManager,
      job.value?.gc,
      job.value?.jobAddress,
      getAuthDisplayName(),
    ],
    () => {
      applyJobSnapshotFieldsToDraft()
    },
  )

  return {
    applyJobSnapshotFieldsToDraft,
    resetForm,
  }
}
