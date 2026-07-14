import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { cloneDailyLogPayload, type DailyLogTextFieldKey } from '@/features/dailyLogs/schema'
import { updateDailyLogRecord, type DailyLogActor } from '@/services/dailyLogs'
import type { DailyLogPayload, DailyLogRecord } from '@/types/domain'

interface UseDailyLogDraftSaveOptions {
  canEditSelectedLog: ComputedRef<boolean>
  form: Ref<DailyLogPayload>
  getActor: () => DailyLogActor
  normalizeError: (error: unknown, fallback: string) => string
  preparePayload: (payload?: DailyLogPayload) => DailyLogPayload
  selectedLog: ComputedRef<DailyLogRecord | null>
  setActionError: (message: string) => void
}

export function useDailyLogDraftSave(options: UseDailyLogDraftSaveOptions) {
  const hydratingForm = ref(false)
  const savingDraft = ref(false)
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
    const prepared = options.preparePayload(payload)
    lastSavedPayload.value = cloneDailyLogPayload(prepared)
    lastSavedSignature.value = JSON.stringify(prepared)
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
    const log = options.selectedLog.value
    if (!log || !options.canEditSelectedLog.value) return true

    const nextPayload = options.preparePayload(options.form.value)
    const nextSignature = JSON.stringify(nextPayload)
    if (nextSignature === lastSavedSignature.value) return true

    savingDraft.value = true
    options.setActionError('')

    try {
      await updateDailyLogRecord(log.id, { payload: nextPayload }, options.getActor())
      lastSavedPayload.value = cloneDailyLogPayload(nextPayload)
      lastSavedSignature.value = nextSignature
      return true
    } catch (error) {
      options.setActionError(options.normalizeError(error, 'Failed to save the daily log draft.'))
      return false
    } finally {
      savingDraft.value = false
    }
  }

  async function saveDailyLogTextField(fieldKey: DailyLogTextFieldKey) {
    const log = options.selectedLog.value
    if (!log || !options.canEditSelectedLog.value) return true

    const nextPayload = options.preparePayload(options.form.value)
    const nextValue = String(nextPayload[fieldKey] ?? '')
    const savedValue = String(lastSavedPayload.value[fieldKey] ?? '')
    if (nextValue === savedValue) return true

    savingDraft.value = true
    options.setActionError('')

    try {
      await updateDailyLogRecord(log.id, { payloadFields: { [fieldKey]: nextValue } }, options.getActor())
      lastSavedPayload.value[fieldKey] = nextValue

      if (fieldKey === 'qcAreasInspected') {
        lastSavedPayload.value.qcInspection = nextValue
      }

      lastSavedSignature.value = JSON.stringify(lastSavedPayload.value)
      return true
    } catch (error) {
      options.setActionError(options.normalizeError(error, 'Failed to save the daily log field.'))
      return false
    } finally {
      savingDraft.value = false
    }
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
    saveDailyLogTextField,
    saveDraftImmediately,
    savingDraft,
    serializePayload,
    setSavedPayloadSnapshot,
  }
}
