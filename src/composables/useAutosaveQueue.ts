import { computed, ref } from 'vue'
import { normalizeError } from '@/utils/normalizeError'

interface AutosaveQueueOptions {
  canSave?: () => boolean
  debounceMs?: number
  save: () => Promise<unknown> | unknown
  saveErrorFallback?: string
}

export function useAutosaveQueue({
  canSave = () => true,
  debounceMs = 450,
  save,
  saveErrorFallback = 'Save failed.',
}: AutosaveQueueOptions) {
  const isQueued = ref(false)
  const isSaving = ref(false)
  const isScheduled = ref(false)
  const lastSavedAt = ref<number | null>(null)
  const saveError = ref('')

  let activeSave: Promise<boolean> | null = null
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  const hasQueuedWork = computed(() => isScheduled.value || isSaving.value || isQueued.value)

  function clearQueuedSave() {
    if (!saveTimer) return

    clearTimeout(saveTimer)
    saveTimer = null
    isScheduled.value = false
  }

  async function runAutosaveNow(): Promise<boolean> {
    if (activeSave) {
      isQueued.value = true
      await activeSave

      if (!isQueued.value) return true
      isQueued.value = false
      return runAutosaveNow()
    }

    clearQueuedSave()
    if (!canSave()) return true

    isSaving.value = true
    saveError.value = ''

    const savePromise = (async () => {
      try {
        await save()
        lastSavedAt.value = Date.now()
        return true
      } catch (error) {
        saveError.value = normalizeError(error, saveErrorFallback)
        return false
      } finally {
        isSaving.value = false
      }
    })()

    activeSave = savePromise
    try {
      return await savePromise
    } finally {
      if (activeSave === savePromise) {
        activeSave = null
      }
    }
  }

  function queueAutosave(delay = debounceMs) {
    if (!canSave()) return

    clearQueuedSave()
    isScheduled.value = true
    saveError.value = ''
    saveTimer = setTimeout(() => {
      void runAutosaveNow()
    }, delay)
  }

  async function flushAutosaveQueue() {
    if (saveTimer) {
      return runAutosaveNow()
    }

    if (activeSave) {
      return activeSave
    }

    return true
  }

  function resetAutosaveQueueState() {
    clearQueuedSave()
    isQueued.value = false
    isSaving.value = false
    lastSavedAt.value = null
    saveError.value = ''
  }

  function disposeAutosaveQueue() {
    clearQueuedSave()
  }

  return {
    clearQueuedSave,
    disposeAutosaveQueue,
    flushAutosaveQueue,
    hasQueuedWork,
    isQueued,
    isSaving,
    isScheduled,
    lastSavedAt,
    queueAutosave,
    resetAutosaveQueueState,
    runAutosaveNow,
    saveError,
  }
}
