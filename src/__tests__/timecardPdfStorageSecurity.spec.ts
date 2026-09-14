import { beforeEach, describe, expect, it } from 'vitest'
import { clearTimecardPdfExports, loadTimecardPdfExportPayload, saveTimecardPdfExportPayload, transferTimecardPdfExport } from '@/features/timecards/pdf-export'

const key = 'phase2-timecard-pdf-exports'
const payload = () => ({ title: 'Test', subtitle: '', generatedAt: Date.now(), cards: [] })
describe('payroll export storage', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
  it('clears legacy persistent data and transfers only the selected export to the print tab', () => {
    localStorage.setItem(key, 'old sensitive data')
    const id = saveTimecardPdfExportPayload(payload())
    expect(localStorage.getItem(key)).toBeNull()
    const values = new Map<string, string>()
    transferTimecardPdfExport(id, { sessionStorage: { setItem: (k: string, v: string) => values.set(k, v) } } as unknown as Window)
    expect(Object.keys(JSON.parse(values.get(key)!))).toEqual([id])
    expect(sessionStorage.getItem(key)).toBeNull()
  })
  it('rejects old exports and removes both storage copies on cleanup', () => {
    const id = saveTimecardPdfExportPayload({ ...payload(), generatedAt: Date.now() - 6 * 60 * 1000 })
    expect(loadTimecardPdfExportPayload(id)).toBeNull()
    saveTimecardPdfExportPayload(payload())
    clearTimecardPdfExports()
    expect(sessionStorage.getItem(key)).toBeNull()
    expect(localStorage.getItem(key)).toBeNull()
  })
})
