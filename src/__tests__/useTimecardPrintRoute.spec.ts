import { describe, expect, it, vi } from 'vitest'

import { useTimecardPrintRoute } from '@/features/timecards/useTimecardPrintRoute'
import type { TimecardPdfExportCard, TimecardPdfExportPayload } from '@/features/timecards/pdf-export'
import { missingTimecardPrintPayloadMessage } from '@/features/timecards/printViewHelpers'

function makeCard(id: string) {
  return { id } as TimecardPdfExportCard
}

function makePayload(overrides: Partial<TimecardPdfExportPayload> = {}): TimecardPdfExportPayload {
  return {
    cards: [makeCard('card-1'), makeCard('card-2'), makeCard('card-3')],
    exportId: 'export-1',
    generatedAt: Date.UTC(2026, 5, 13, 18, 30),
    subtitle: 'Week Ending 6/13/2026',
    title: 'Timecard Export',
    ...overrides,
  }
}

describe('useTimecardPrintRoute', () => {
  it('loads the requested payload, chunks printable pages, and schedules printing', async () => {
    const payload = makePayload()
    const loadPayload = vi.fn(() => payload)
    const print = vi.fn()
    const scheduledPrint: { callback?: () => void } = {}
    const schedulePrint = vi.fn((callback: () => void) => {
      scheduledPrint.callback = callback
    })

    const route = useTimecardPrintRoute({
      loadPayload,
      print,
      query: { exportId: 'export-1' },
      schedulePrint,
    })

    await expect(route.loadPrintPayload()).resolves.toBe(true)

    expect(loadPayload).toHaveBeenCalledWith('export-1')
    expect(route.payload.value).toEqual(payload)
    expect(route.loadError.value).toBe('')
    expect(route.pagedCards.value.map((page) => page.map((card) => card.id))).toEqual([
      ['card-1', 'card-2'],
      ['card-3'],
    ])
    expect(route.autoPrinting.value).toBe(true)
    expect(schedulePrint).toHaveBeenCalledWith(expect.any(Function), 150)
    expect(print).not.toHaveBeenCalled()
    expect(scheduledPrint.callback).toEqual(expect.any(Function))

    scheduledPrint.callback?.()

    expect(print).toHaveBeenCalledTimes(1)
    expect(route.autoPrinting.value).toBe(false)
  })

  it('shows the missing-payload message and does not print when no payload exists', async () => {
    const print = vi.fn()
    const schedulePrint = vi.fn()
    const route = useTimecardPrintRoute({
      loadPayload: vi.fn(() => null),
      print,
      query: {},
      schedulePrint,
    })

    await expect(route.loadPrintPayload()).resolves.toBe(false)

    expect(route.payload.value).toBeNull()
    expect(route.loadError.value).toBe(missingTimecardPrintPayloadMessage)
    expect(route.pagedCards.value).toEqual([])
    expect(schedulePrint).not.toHaveBeenCalled()
    expect(print).not.toHaveBeenCalled()
  })

  it('does not schedule duplicate prints while a print is pending', async () => {
    const route = useTimecardPrintRoute({
      loadPayload: vi.fn(() => makePayload()),
      print: vi.fn(),
      query: {},
      schedulePrint: vi.fn(),
    })

    await route.loadPrintPayload()
    await expect(route.triggerPrint()).resolves.toBe(false)
  })
})
