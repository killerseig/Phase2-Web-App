import { computed, reactive, ref, watch } from 'vue'
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
  context?: () => string
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
  let generation = 0
  const debounceMs = options.debounceMs ?? 900
  const saveErrorFallback = options.saveErrorFallback ?? 'Save failed.'

  const pendingSaveCount = computed(() => Object.keys(scheduledSaveIds).length)
  const activeSaveCount = computed(() => Object.keys(savingIds).length)
  if (options.context) watch(options.context, () => resetSaveQueueState({ clearQueued: true }), { flush: 'sync' })

  function clearSaveTimer(cardId: string) {
    const timer = saveTimers.get(cardId)
    if (timer) clearTimeout(timer)
    saveTimers.delete(cardId)
    delete scheduledSaveIds[cardId]
  }

  async function persistCard(card: TCard): Promise<void> {
    if (!options.canSave()) return
    clearSaveTimer(card.id)
    scheduledSaveIds[card.id] = true
    const existingSave = savePromises.get(card.id)
    if (existingSave) {
      queuedSaveIds[card.id] = true
      await existingSave
      return
    }

    const requestGeneration = generation
    savingIds[card.id] = true
    saveError.value = ''
    const operation = (async () => {
      try {
        // The promise owns every edit queued while its write is in flight.
        // Navigation cannot finish between a first write and its follow-up.
        while (requestGeneration === generation && scheduledSaveIds[card.id]) {
          if (!options.canSave()) throw new Error('Timecard changes cannot currently be saved.')
          clearSaveTimer(card.id)
          delete queuedSaveIds[card.id]
          await options.saveCard(options.getCards().find(item => item.id === card.id) ?? card)
          if (requestGeneration === generation) lastSavedAt.value = Date.now()
        }
      } catch (error) {
        if (requestGeneration === generation) {
          scheduledSaveIds[card.id] = true
          saveError.value = normalizeError(error, saveErrorFallback)
        }
        throw error
      }
    })()
    const savePromise = operation.finally(() => {
      if (savePromises.get(card.id) === savePromise) {
        savePromises.delete(card.id)
        delete savingIds[card.id]
        delete queuedSaveIds[card.id]
      }
    })
    savePromises.set(card.id, savePromise)
    await savePromise
  }

  function scheduleCardSave(card: TCard) {
    if (!options.canSave()) return

    clearSaveTimer(card.id)
    scheduledSaveIds[card.id] = true
    saveError.value = ''
    if (savePromises.has(card.id)) {
      queuedSaveIds[card.id] = true
      return
    }
    saveTimers.set(card.id, setTimeout(() => {
      // The queue retains the error and unsaved card for explicit retry.
      void persistCard(card).catch(() => undefined)
    }, debounceMs))
  }

  async function flushPendingSaves() {
    const requestGeneration = generation
    while (hasQueuedWork()) {
      if (!options.canSave()) throw new Error('Timecard changes cannot currently be saved.')
      if (savePromises.size) {
        const results = await Promise.allSettled(Array.from(savePromises.values()))
        const failed = results.find(result => result.status === 'rejected')
        if (failed?.status === 'rejected') throw failed.reason
      } else {
        const pendingCards = options.getCards().filter(card => scheduledSaveIds[card.id])
        if (!pendingCards.length) throw new Error('Unsaved timecards are no longer available. Keep this page open and retry.')
        for (const card of pendingCards) {
          if (requestGeneration !== generation) throw new Error('The timecard context changed before saving finished.')
          await persistCard(card)
        }
      }
      if (requestGeneration !== generation) throw new Error('The timecard context changed before saving finished.')
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
    generation++
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
    return Object.keys(scheduledSaveIds).length > 0 || savePromises.size > 0
  }

  function disposeSaveQueue() {
    generation++
    saveTimers.forEach((timer) => clearTimeout(timer))
    saveTimers.clear()
    savePromises.clear()
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
