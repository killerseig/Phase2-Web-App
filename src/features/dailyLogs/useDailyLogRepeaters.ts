import type { ComputedRef, Ref } from 'vue'
import {
  createEmptyIndoorClimateReading,
  createEmptyManpowerLine,
  type DailyLogIndoorClimateFieldKey,
  type DailyLogManpowerFieldKey,
} from '@/features/dailyLogs/schema'
import type { DailyLogPayload } from '@/types/domain'

interface UseDailyLogRepeatersOptions {
  canEditSelectedLog: ComputedRef<boolean>
  currentUserId: ComputedRef<string | null>
  form: Ref<DailyLogPayload>
}

export function useDailyLogRepeaters({
  canEditSelectedLog,
  currentUserId,
  form,
}: UseDailyLogRepeatersOptions) {
  function addManpowerLine() {
    if (!canEditSelectedLog.value) return

    form.value.manpowerLines.push({
      ...createEmptyManpowerLine(),
      addedByUserId: currentUserId.value,
    })
  }

  function removeManpowerLine(index: number) {
    if (!canEditSelectedLog.value) return

    if (form.value.manpowerLines.length <= 1) {
      form.value.manpowerLines = [createEmptyManpowerLine()]
      return
    }

    form.value.manpowerLines.splice(index, 1)
  }

  function updateManpowerLineField(payload: {
    index: number
    field: DailyLogManpowerFieldKey
    value: string | number
  }) {
    if (!canEditSelectedLog.value) return

    const line = form.value.manpowerLines[payload.index]
    if (!line) return

    if (payload.field === 'count') {
      line.count = (payload.value === '' ? '' : Number(payload.value)) as unknown as number
      return
    }

    if (payload.field === 'addedByUserId') {
      line.addedByUserId = payload.value ? String(payload.value) : null
      return
    }

    line[payload.field] = String(payload.value)
  }

  function addIndoorClimateReading() {
    if (!canEditSelectedLog.value) return

    form.value.indoorClimateReadings.push(createEmptyIndoorClimateReading())
  }

  function removeIndoorClimateReading(index: number) {
    if (!canEditSelectedLog.value) return

    if (form.value.indoorClimateReadings.length <= 1) {
      form.value.indoorClimateReadings = [createEmptyIndoorClimateReading()]
      return
    }

    form.value.indoorClimateReadings.splice(index, 1)
  }

  function updateIndoorClimateReadingField(payload: {
    index: number
    field: DailyLogIndoorClimateFieldKey
    value: string
  }) {
    if (!canEditSelectedLog.value) return

    const reading = form.value.indoorClimateReadings[payload.index]
    if (!reading) return

    reading[payload.field] = payload.value
  }

  return {
    addIndoorClimateReading,
    addManpowerLine,
    removeIndoorClimateReading,
    removeManpowerLine,
    updateIndoorClimateReadingField,
    updateManpowerLineField,
  }
}
