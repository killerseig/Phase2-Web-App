import { computed, reactive, ref } from 'vue'
import { normalizeError } from '@/utils/normalizeError'
import { clearBooleanRecord, pruneRecordToIds } from './stateMapHelpers'

type SaveQueueTimer = ReturnType<typeof setTimeout>

export interface TimecardSaveQueueItem {
  id: string
}

interface TimecardSaveQueueOptions<TCard extends TimecardSaveQueueItem> {
  canSave: () => boolean
  getCards: () => readonly TCard[]
  saveCard: (card: TCard) => Promise<void>
  debounceMs?: number
  saveErrorFallback?: string
}

interface ResetSaveQueueOptions {
  clearQueued?: boolean
}

export function useTimecardSaveQueue<TCard extends TimecardSaveQueueItem>(
  options: TimecardSaveQueueOptions<TCard>,
) {
  const savingIds = reactive<Record<string, boolean>>({})
  const scheduledSaveIds = reactive<Record<string, boolean>>({})
  const queuedSaveIds = reactive<Record<string, boolean>>({})
  const lastSavedAt = ref<number | null>(null)
  const saveError = ref('')

  const saveTimers = new Map<string, SaveQueueTimer>()
  const savePromises = new Map<string, Promise<void>>()
  const debounceMs = options.debounceMs ?? 900
  const saveErrorFallback = options.saveErrorFallback ?? 'Save failed.'

  const pendingSaveCount = computed(() => Object.keys(scheduledSaveIds).length)
  const activeSaveCount = computed(() => Object.keys(savingIds).length)

  function clearSaveTimer(cardId: string) {
    const timer = saveTimers.get(cardId)
    if (timer) clearTimeout(timer)
    saveTimers.delete(cardId)
    delete scheduledSaveIds[cardId]
  }

  async function persistCard(card: TCard): Promise<void> {
    if (!options.canSave()) return

    const existingSave = savePromises.get(card.id)
    if (existingSave) {
      queuedSaveIds[card.id] = true
      await existingSave
      if (!queuedSaveIds[card.id]) return
      delete queuedSaveIds[card.id]
      await persistCard(card)
      return
    }

    clearSaveTimer(card.id)
    savingIds[card.id] = true
    saveError.value = ''

    const savePromise = (async () => {
      try {
        await options.saveCard(card)
        lastSavedAt.value = Date.now()
      } catch (error) {
        saveError.value = normalizeError(error, saveErrorFallback)
        throw error
      } finally {
        delete savingIds[card.id]
      }
    })()

    savePromises.set(card.id, savePromise)
    try {
      await savePromise
    } finally {
      if (savePromises.get(card.id) === savePromise) {
        savePromises.delete(card.id)
      }
    }
  }

  function scheduleCardSave(card: TCard) {
    if (!options.canSave()) return

    clearSaveTimer(card.id)
    scheduledSaveIds[card.id] = true
    saveError.value = ''
    saveTimers.set(card.id, setTimeout(() => {
      void persistCard(card)
    }, debounceMs))
  }

  async function flushPendingSaves() {
    const pendingCards = options.getCards().filter((card) => saveTimers.has(card.id))
    for (const card of pendingCards) {
      await persistCard(card)
    }

    if (savePromises.size) {
      await Promise.allSettled(Array.from(savePromises.values()))
    }
  }

  function pruneSaveQueueToIds(validIds: ReadonlySet<string>) {
    saveTimers.forEach((timer, cardId) => {
      if (validIds.has(cardId)) return
      clearTimeout(timer)
      saveTimers.delete(cardId)
    })

    pruneRecordToIds(scheduledSaveIds, validIds)
    pruneRecordToIds(savingIds, validIds)
    pruneRecordToIds(queuedSaveIds, validIds)
  }

  function resetSaveQueueState(resetOptions: ResetSaveQueueOptions = {}) {
    saveTimers.forEach((timer) => {
      clearTimeout(timer)
    })
    saveTimers.clear()
    savePromises.clear()
    clearBooleanRecord(scheduledSaveIds)
    clearBooleanRecord(savingIds)
    if (resetOptions.clearQueued) {
      clearBooleanRecord(queuedSaveIds)
    }
    lastSavedAt.value = null
    saveError.value = ''
  }

  function hasQueuedWork() {
    return saveTimers.size > 0 || savePromises.size > 0
  }

  function disposeSaveQueue() {
    saveTimers.forEach((timer) => clearTimeout(timer))
    saveTimers.clear()
  }

  return {
    activeSaveCount,
    flushPendingSaves,
    hasQueuedWork,
    lastSavedAt,
    pendingSaveCount,
    persistCard,
    pruneSaveQueueToIds,
    queuedSaveIds,
    resetSaveQueueState,
    saveError,
    savingIds,
    scheduleCardSave,
    scheduledSaveIds,
    disposeSaveQueue,
  }
}
