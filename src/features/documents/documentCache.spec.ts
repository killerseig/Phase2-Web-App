import { describe, expect, it } from 'vitest'
import { createDocumentCache } from './documentCache'
describe('bounded authorized-revision document memory', () => {
  it('requires a server revision and isolates transferable copies', () => {
    const cache = createDocumentCache(10, 3)
    const missing = cache.authorize('one', undefined)
    cache.put(missing, new Uint8Array([1]), cache.generation)
    expect(cache.count).toBe(0)
    const key = cache.authorize('one', 'r1'), input = new Uint8Array([1, 2])
    cache.put(key, input, cache.generation); input[0] = 9
    const copy = cache.read(key)!; copy[0] = 8
    expect(cache.read(key)).toEqual(new Uint8Array([1, 2]))
    structuredClone(copy, { transfer: [copy.buffer] })
    expect(cache.read(key)?.byteLength).toBe(2)
  })
  it('enforces byte and entry limits, skipping oversized books', () => {
    const cache = createDocumentCache(10, 3)
    const keys = ['a', 'b', 'c', 'd'].map(id => {
      const key = cache.authorize(id, 'r1'); cache.put(key, new Uint8Array(4), cache.generation); return key
    })
    expect(cache.size).toBe(8); expect(cache.count).toBe(2)
    expect(cache.read(keys[0]!)).toBeUndefined(); expect(cache.read(keys[1]!)).toBeUndefined()
    const huge = cache.authorize('huge', 'r1'); cache.put(huge, new Uint8Array(11), cache.generation)
    expect(cache.read(huge)).toBeUndefined(); expect(cache.size).toBeLessThanOrEqual(10)
  })
  it('invalidates revisions and ignores late data from a prior access context', () => {
    const cache = createDocumentCache(10, 3)
    const old = cache.authorize('a', 'r1'), generation = cache.generation
    cache.put(old, new Uint8Array([1]), generation)
    const latest = cache.authorize('a', 'r2')
    expect(cache.read(old)).toBeUndefined()
    cache.put(old, new Uint8Array([2]), generation)
    expect(cache.count).toBe(0)
    cache.put(latest, new Uint8Array([3]), generation)
    cache.clear(); cache.authorize('a', 'r2')
    cache.put(latest, new Uint8Array([4]), generation)
    expect(cache.count).toBe(0); expect(cache.size).toBe(0)
  })
  it('purges a cached document if a backend stops supplying its revision', () => {
    const cache = createDocumentCache()
    const key = cache.authorize('one', 'r1'); cache.put(key, new Uint8Array([1]), cache.generation)
    expect(cache.authorize('one', undefined)).toBe('')
    expect(cache.read(key)).toBeUndefined()
  })
})
