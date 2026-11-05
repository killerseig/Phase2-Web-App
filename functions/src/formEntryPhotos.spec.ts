import { beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import type { FormRecord } from './formModel'
const storage = vi.hoisted(() => ({ asset: vi.fn(), file: vi.fn() }))
vi.mock('./runtime', () => ({ db: { doc: (path: string) => ({ get: () => storage.asset(path) }) }, storageBucket: { file: (path: string) => storage.file(path) } }))
import { entryPdfPhotos } from './formEntryPhotos'
function record(count: number): FormRecord {
  return { id: 'synthetic-entry', ownerUid: 'synthetic-owner', templateId: 'synthetic-form', templateVersion: 1, revision: 1, status: 'submitted', createdAt: 1, updatedAt: 1,
    definition: { title: 'Synthetic photo inspection', description: '', version: 1, createdAt: '', recipients: [], fields: [{ id: 'photos', kind: 'photo', label: 'Photos', required: false, options: [] }] },
    answers: { photos: Array.from({ length: count }, (_, i) => 'photo-' + i) } }
}
beforeEach(() => vi.resetAllMocks())
describe('bounded private-entry PDF photo preparation', () => {
  it.each([4, 20])('prepares every photo sequentially for a %i-photo inspection and preserves the entry', async (count) => {
    const entry = record(count), before = JSON.stringify(entry)
    const original = await sharp({ create: { width: 1536, height: 2048, channels: 3, background: '#305d85' } }).webp().toBuffer()
    let active = 0, peak = 0
    storage.asset.mockImplementation(async (path: string) => {
      const id = path.split('/').pop()
      return { data: () => ({ recordId: entry.id, ownerUid: entry.ownerUid, path: 'form-photos/' + entry.id + '/' + id + '.webp' }) }
    })
    storage.file.mockImplementation(() => ({ getMetadata: async () => [{ size: original.length }], download: async () => { active++; peak = Math.max(peak, active); await Promise.resolve(); active--; return [original] } }))
    const photos = await entryPdfPhotos(entry)
    expect(photos).toHaveLength(count); expect(peak).toBe(1)
    expect(JSON.stringify(entry)).toBe(before)
    const metadata = await sharp(Buffer.from(photos[0]!.contentBytes, 'base64')).metadata()
    expect(metadata.format).toBe('jpeg'); expect(metadata.width).toBe(1050); expect(metadata.height).toBe(1400)
    expect(photos.map(photo => photo.contentId)).toEqual((entry.answers.photos as string[]).map(id => 'entry-photo-' + id))
  }, 30000)
  it('refuses a foreign photo before downloading bytes', async () => {
    storage.asset.mockResolvedValue({ data: () => ({ recordId: 'another-entry', ownerUid: 'another-owner', path: 'foreign.webp' }) })
    await expect(entryPdfPhotos(record(1))).rejects.toMatchObject({ code: 'permission-denied' })
    expect(storage.file).not.toHaveBeenCalled()
  })
})
