import { computed, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { createEmptyDailyLogPayload } from '@/features/dailyLogs/schema'
import { useDailyLogRepeaters } from '@/features/dailyLogs/useDailyLogRepeaters'
import type { DailyLogPayload } from '@/types/domain'

function mountRepeaters(options: {
  canEdit?: boolean
  currentUserId?: string | null
  form?: DailyLogPayload
} = {}) {
  const canEdit = ref(options.canEdit ?? true)
  const currentUserId = ref<string | null>(options.currentUserId === undefined ? 'user-1' : options.currentUserId)
  const form = ref(options.form ?? createEmptyDailyLogPayload())

  const repeaters = useDailyLogRepeaters({
    canEditSelectedLog: computed(() => canEdit.value),
    currentUserId: computed(() => currentUserId.value),
    form,
  })

  return {
    canEdit,
    currentUserId,
    form,
    repeaters,
  }
}

describe('useDailyLogRepeaters', () => {
  it('adds manpower lines with the current user attached', () => {
    const { form, repeaters } = mountRepeaters({ currentUserId: 'foreman-1' })

    repeaters.addManpowerLine()

    expect(form.value.manpowerLines).toHaveLength(2)
    expect(form.value.manpowerLines[1]).toEqual({
      addedByUserId: 'foreman-1',
      areas: '',
      count: 0,
      trade: '',
    })
  })

  it('updates manpower fields while preserving blank count drafts', () => {
    const { form, repeaters } = mountRepeaters()

    repeaters.updateManpowerLineField({ index: 0, field: 'trade', value: 'Acoustical Carpenter' })
    repeaters.updateManpowerLineField({ index: 0, field: 'areas', value: 'Level 1' })
    repeaters.updateManpowerLineField({ index: 0, field: 'addedByUserId', value: '' })
    repeaters.updateManpowerLineField({ index: 0, field: 'count', value: '' })

    expect(form.value.manpowerLines[0]).toEqual({
      addedByUserId: null,
      areas: 'Level 1',
      count: '',
      trade: 'Acoustical Carpenter',
    })

    repeaters.updateManpowerLineField({ index: 0, field: 'count', value: '4' })

    expect(form.value.manpowerLines[0]?.count).toBe(4)
  })

  it('removes manpower rows and resets to one blank row when the last row is removed', () => {
    const { form, repeaters } = mountRepeaters({
      form: createEmptyDailyLogPayload({
        manpowerLines: [
          { addedByUserId: 'user-1', areas: 'Level 1', count: 2, trade: 'Paint' },
          { addedByUserId: 'user-2', areas: 'Level 2', count: 3, trade: 'Drywall' },
        ],
      }),
    })

    repeaters.removeManpowerLine(0)

    expect(form.value.manpowerLines).toEqual([
      { addedByUserId: 'user-2', areas: 'Level 2', count: 3, trade: 'Drywall' },
    ])

    repeaters.removeManpowerLine(0)

    expect(form.value.manpowerLines).toEqual([
      { addedByUserId: null, areas: '', count: 0, trade: '' },
    ])
  })

  it('adds, updates, removes, and resets indoor climate readings', () => {
    const { form, repeaters } = mountRepeaters()

    repeaters.addIndoorClimateReading()

    expect(form.value.indoorClimateReadings).toHaveLength(2)

    repeaters.updateIndoorClimateReadingField({ index: 1, field: 'area', value: 'Level 2' })
    repeaters.updateIndoorClimateReadingField({ index: 1, field: 'high', value: '72' })
    repeaters.updateIndoorClimateReadingField({ index: 1, field: 'low', value: '64' })
    repeaters.updateIndoorClimateReadingField({ index: 1, field: 'humidity', value: '35' })

    expect(form.value.indoorClimateReadings[1]).toEqual({
      area: 'Level 2',
      high: '72',
      humidity: '35',
      low: '64',
    })

    repeaters.removeIndoorClimateReading(0)

    expect(form.value.indoorClimateReadings).toEqual([
      { area: 'Level 2', high: '72', humidity: '35', low: '64' },
    ])

    repeaters.removeIndoorClimateReading(0)

    expect(form.value.indoorClimateReadings).toEqual([
      { area: '', high: '', humidity: '', low: '' },
    ])
  })

  it('ignores row mutations when the selected log is read-only', () => {
    const { form, repeaters } = mountRepeaters({ canEdit: false })

    repeaters.addManpowerLine()
    repeaters.updateManpowerLineField({ index: 0, field: 'trade', value: 'Paint' })
    repeaters.removeManpowerLine(0)
    repeaters.addIndoorClimateReading()
    repeaters.updateIndoorClimateReadingField({ index: 0, field: 'area', value: 'Level 1' })
    repeaters.removeIndoorClimateReading(0)

    expect(form.value.manpowerLines).toEqual([
      { addedByUserId: null, areas: '', count: 0, trade: '' },
    ])
    expect(form.value.indoorClimateReadings).toEqual([
      { area: '', high: '', humidity: '', low: '' },
    ])
  })

  it('ignores updates for missing row indexes', () => {
    const { form, repeaters } = mountRepeaters()

    repeaters.updateManpowerLineField({ index: 99, field: 'trade', value: 'Paint' })
    repeaters.updateIndoorClimateReadingField({ index: 99, field: 'area', value: 'Level 1' })

    expect(form.value.manpowerLines).toEqual([
      { addedByUserId: null, areas: '', count: 0, trade: '' },
    ])
    expect(form.value.indoorClimateReadings).toEqual([
      { area: '', high: '', humidity: '', low: '' },
    ])
  })
})
