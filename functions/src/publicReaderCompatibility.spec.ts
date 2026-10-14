import { describe, expect, it, vi } from 'vitest'
import type { HttpsFunction } from 'firebase-functions/v2/https'
import { withPublicHtmlReader } from './publicReaderCompatibility'

describe('existing callable reader compatibility', () => {
  it('retains endpoint metadata and callable POST validation while routing browser reads to HTML', () => {
    const callable = vi.fn() as unknown as HttpsFunction
    callable.__endpoint = { platform: 'gcfv2', callableTrigger: {} }
    Object.defineProperty(callable, '__trigger', { get: () => ({ labels: { 'deployment-callable': 'true' } }) })
    const reader = vi.fn() as unknown as HttpsFunction
    const combined = withPublicHtmlReader(callable, reader)
    const response = {} as Parameters<HttpsFunction>[1]
    for (const method of ['GET', 'HEAD', 'OPTIONS']) combined({ method } as Parameters<HttpsFunction>[0], response)
    combined({ method: 'POST' } as Parameters<HttpsFunction>[0], response)
    expect(callable).toHaveBeenCalledTimes(1)
    expect(reader).toHaveBeenCalledTimes(3)
    expect(combined.__endpoint).toBe(callable.__endpoint)
    expect(combined.__trigger).toEqual(callable.__trigger)
  })
})
