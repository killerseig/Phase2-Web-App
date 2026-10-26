// Private bytes only, scoped to one mounted explorer. Never persisted or shared
// across accounts/jobs. A fresh openSheet authorization supplies every cache key.
export function createDocumentCache(maxBytes = 12 * 1024 * 1024, maxEntries = 3) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !Number.isSafeInteger(maxEntries) || maxEntries < 1) throw new Error('Invalid document cache bounds')
  const entries = new Map<string, Uint8Array<ArrayBuffer>>()
  const revisions = new Map<string, string>()
  let bytes = 0, generation = 0
  function remove(key: string) {
    const value = entries.get(key)
    if (value) bytes -= value.byteLength
    entries.delete(key)
  }
  function authorize(id: string, revision: string | undefined) {
    const previous = revisions.get(id)
    if (!revision) {
      if (previous) remove(previous)
      revisions.delete(id)
      return '' // Old backends safely opt out; never guess revision.
    }
    const key = JSON.stringify([id, revision])
    if (previous && previous !== key) remove(previous)
    revisions.delete(id)
    revisions.set(id, key)
    while (revisions.size > maxEntries) {
      const oldest = revisions.keys().next().value!
      remove(revisions.get(oldest)!); revisions.delete(oldest)
    }
    return key
  }
  return {
    maxBytes,
    authorize,
    read(key: string) {
      const value = entries.get(key)
      if (!value) return undefined
      entries.delete(key); entries.set(key, value)
      // PDF/preview workers transfer and detach input: keep the cache independent.
      return value.slice()
    },
    put(key: string, value: Uint8Array | ArrayBuffer, expectedGeneration: number) {
      const view = value instanceof Uint8Array ? value : new Uint8Array(value)
      if (!key || expectedGeneration !== generation || !view.byteLength || view.byteLength > maxBytes || maxEntries < 1) return
      if (![...revisions.values()].includes(key)) return
      remove(key)
      while (entries.size && (bytes + view.byteLength > maxBytes || entries.size >= maxEntries)) remove(entries.keys().next().value!)
      entries.set(key, new Uint8Array(view)); bytes += view.byteLength
    },
    clear() { entries.clear(); revisions.clear(); bytes = 0; generation++ },
    get generation() { return generation },
    get size() { return bytes },
    get count() { return entries.size },
  }
}
