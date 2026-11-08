import { computed, getCurrentScope, onScopeDispose, ref, watch } from 'vue'
import { cloneDailyLogPayload, type DailyLogTextFieldKey } from '@/features/dailyLogs/schema'
import { updateDailyLogRecord, type DailyLogActor } from '@/services/dailyLogs'
import type { DailyLogPayload, DailyLogRecord } from '@/types/domain'
import type { ReadonlyRef } from '@/types/reactivity'

interface UseDailyLogDraftSaveOptions {
  canEditSelectedLog: ReadonlyRef<boolean>
  form: ReadonlyRef<DailyLogPayload>
  getActor: () => DailyLogActor
  getContextEpoch?: () => number
  normalizeError: (error: unknown, fallback: string) => string
  preparePayload: (payload?: DailyLogPayload) => DailyLogPayload
  selectedLog: ReadonlyRef<DailyLogRecord | null>
  setActionError: (message: string) => void
}

export function useDailyLogDraftSave(options: UseDailyLogDraftSaveOptions) {
  const hydratingForm = ref(false)
  const activeSaveCount = ref(0)
  const savingDraft = computed(() => activeSaveCount.value > 0)
  const pendingSaves = new Set<Promise<boolean>>()
  let snapshotVersion = 0
  let contextVersion = 0
  let disposed = false
  watch([() => options.selectedLog.value?.id, () => options.canEditSelectedLog.value, () => options.getActor().userId, () => options.getContextEpoch?.()],
    () => { contextVersion += 1 }, { flush: 'sync' })
  if (getCurrentScope()) onScopeDispose(() => { disposed = true; contextVersion += 1 })
  const lastSavedPayload = ref<DailyLogPayload>(cloneDailyLogPayload(options.preparePayload(options.form.value)))
  const lastSavedSignature = ref(JSON.stringify(lastSavedPayload.value))

  const hasUnsavedDraftChanges = computed(() => {
    if (!options.canEditSelectedLog.value || hydratingForm.value) return false
    return serializePayload(options.form.value) !== lastSavedSignature.value
  })

  function serializePayload(payload: DailyLogPayload = options.form.value) {
    const prepared = options.preparePayload(payload)
    return JSON.stringify(prepared)
  }

  function setSavedPayloadSnapshot(payload: DailyLogPayload = options.form.value) {
    snapshotVersion += 1
    const prepared = options.preparePayload(payload)
    lastSavedPayload.value = cloneDailyLogPayload(prepared)
    lastSavedSignature.value = JSON.stringify(prepared)
  }

  function persistSnapshot(logId: string, input: Parameters<typeof updateDailyLogRecord>[1], apply: () => void) {
    const version = snapshotVersion
    const context = contextVersion
    const isCurrent = () => !disposed && context === contextVersion && options.selectedLog.value?.id === logId && snapshotVersion === version
    const actor = options.getActor()
    activeSaveCount.value += 1
    options.setActionError('')
    const write = (async () => {
      try {
        await updateDailyLogRecord(logId, input, actor)
        if (isCurrent()) apply()
        return isCurrent()
      } catch (error) {
        if (isCurrent()) options.setActionError(options.normalizeError(error, 'Failed to save the daily log draft.'))
        return false
      } finally {
        activeSaveCount.value -= 1
      }
    })()
    pendingSaves.add(write)
    void write.then(() => pendingSaves.delete(write))
    return write
  }

  async function prepareDraftNavigation() {
    const logId = options.selectedLog.value?.id
    const context = contextVersion
    const isCurrent = () => !disposed && context === contextVersion && options.selectedLog.value?.id === logId
    while (isCurrent() && pendingSaves.size) {
      const results = await Promise.all(pendingSaves)
      if (results.some(saved => !saved)) return false
    }
    while (isCurrent() && hasUnsavedDraftChanges.value) {
      if (!await saveDraftImmediately()) return false
    }
    return isCurrent()
  }

  function hydrateForm(callback: () => void) {
    hydratingForm.value = true
    try {
      callback()
    } finally {
      hydratingForm.value = false
    }
  }

  async function saveDraftImmediately() {
    if (disposed) return false
    const log = options.selectedLog.value
    if (!log || !options.canEditSelectedLog.value) return true

    const nextPayload = options.preparePayload(options.form.value)
    const nextSignature = JSON.stringify(nextPayload)
    if (nextSignature === lastSavedSignature.value) return true

    return persistSnapshot(log.id, { payload: cloneDailyLogPayload(nextPayload) }, () => {
      lastSavedPayload.value = cloneDailyLogPayload(nextPayload)
      lastSavedSignature.value = nextSignature
    })
  }

  async function saveDailyLogTextField(fieldKey: DailyLogTextFieldKey) {
    if (disposed) return false
    const log = options.selectedLog.value
    if (!log || !options.canEditSelectedLog.value) return true

    const nextPayload = options.preparePayload(options.form.value)
    const nextValue = String(nextPayload[fieldKey] ?? '')
    const savedValue = String(lastSavedPayload.value[fieldKey] ?? '')
    if (nextValue === savedValue) return true

    return persistSnapshot(log.id, { payloadFields: { [fieldKey]: nextValue } }, () => {
      lastSavedPayload.value[fieldKey] = nextValue

      if (fieldKey === 'qcAreasInspected') {
        lastSavedPayload.value.qcInspection = nextValue
      }

      lastSavedSignature.value = JSON.stringify(lastSavedPayload.value)
    })
  }

  async function handleDailyLogTextFieldBlur(fieldKey: DailyLogTextFieldKey) {
    await saveDailyLogTextField(fieldKey)
  }

  return {
    handleDailyLogTextFieldBlur,
    hasUnsavedDraftChanges,
    hydrateForm,
    hydratingForm,
    lastSavedPayload,
    lastSavedSignature,
    prepareDraftNavigation,
    saveDailyLogTextField,
    saveDraftImmediately,
    savingDraft,
    serializePayload,
    setSavedPayloadSnapshot,
  }
}
