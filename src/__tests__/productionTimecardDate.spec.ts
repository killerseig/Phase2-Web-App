// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { build } from 'vite'
import { fileURLToPath } from 'node:url'

describe('production timecard date', () => {
  it('uses the real date after the production build removes the test runtime', async () => {
    const result = await build({
      configFile: fileURLToPath(new URL('../../vite.config.ts', import.meta.url)),
      logLevel: 'silent',
      build: {
        write: false,
        lib: {
          entry: fileURLToPath(new URL('../features/timecards/workbook.ts', import.meta.url)),
          formats: ['es'],
        },
      },
    })
    const outputs = Array.isArray(result) ? result : [result]
    const chunk = outputs.flatMap(output => 'output' in output ? output.output : [])
      .find(output => output.type === 'chunk' && output.isEntry)
    if (!chunk || chunk.type !== 'chunk') throw new Error('Missing production workbook bundle')

    expect(chunk.code).not.toContain('__PHASE2_E2E_STATE__')
    const workbook = await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`)
    const before = workbook.formatIsoDate(new Date())
    const today = workbook.getTodayIsoDate()
    const after = workbook.formatIsoDate(new Date())
    expect([before, after]).toContain(today)
    expect(workbook.snapToSaturday('')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
