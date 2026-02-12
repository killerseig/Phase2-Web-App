import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { uploadAttachment, deleteAttachmentFile, listAttachments } from '@/services/Storage'
import { requireUser } from '@/services/serviceGuards'
import { ref, uploadBytes, deleteObject, getDownloadURL, listAll } from 'firebase/storage'

vi.mock('@/firebase', () => ({ storage: {} }))

vi.mock('@/services/serviceGuards', () => ({
  requireUser: vi.fn(),
}))

vi.mock('firebase/storage', () => {
  const ref = vi.fn((_storage: any, path: string) => ({ fullPath: path }))
  const uploadBytes = vi.fn()
  const deleteObject = vi.fn()
  const getDownloadURL = vi.fn()
  const listAll = vi.fn()
  return { ref, uploadBytes, deleteObject, getDownloadURL, listAll }
})

const requireUserMock = requireUser as unknown as ReturnType<typeof vi.fn>
const refMock = ref as unknown as ReturnType<typeof vi.fn>
const uploadBytesMock = uploadBytes as unknown as ReturnType<typeof vi.fn>
const deleteObjectMock = deleteObject as unknown as ReturnType<typeof vi.fn>
const getDownloadURLMock = getDownloadURL as unknown as ReturnType<typeof vi.fn>
const listAllMock = listAll as unknown as ReturnType<typeof vi.fn>

describe('Storage service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-02-10T00:00:00Z'))
    requireUserMock.mockReturnValue({ uid: 'u1' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uploads attachment and returns metadata', async () => {
    const file = { name: 'bad name @#$ .png' } as unknown as File
    getDownloadURLMock.mockResolvedValue('https://cdn/test.png')

    const attachment = await uploadAttachment(file, 'log-1', 'photo')

    const expectedPath = 'daily-logs/log-1/1707523200000-bad_name_____.png'
    expect(refMock).toHaveBeenCalledWith(expect.anything(), expectedPath)
    expect(uploadBytesMock).toHaveBeenCalled()
    const metadata = uploadBytesMock.mock.calls[0][2]
    expect(metadata.customMetadata).toMatchObject({
      type: 'photo',
      uploadedBy: 'u1',
      uploadedAt: new Date().toISOString(),
    })
    expect(attachment).toMatchObject({
      name: 'bad name @#$ .png',
      url: 'https://cdn/test.png',
      path: expectedPath,
      type: 'photo',
      createdAt: new Date('2024-02-10T00:00:00Z'),
    })
  })

  it('deletes attachment file', async () => {
    await deleteAttachmentFile('daily-logs/log-1/test.png')

    expect(requireUserMock).toHaveBeenCalled()
    expect(deleteObjectMock).toHaveBeenCalled()
    expect(refMock).toHaveBeenCalledWith(expect.anything(), 'daily-logs/log-1/test.png')
  })

  it('lists attachments in a folder', async () => {
    listAllMock.mockResolvedValue({ items: [{ fullPath: 'a' }, { fullPath: 'b' }] })

    const paths = await listAttachments('log-1')

    expect(paths).toEqual(['a', 'b'])
    expect(refMock).toHaveBeenCalledWith(expect.anything(), 'daily-logs/log-1')
  })

  it('returns empty list when folder missing', async () => {
    listAllMock.mockRejectedValueOnce({ code: 'storage/object-not-found' })

    const paths = await listAttachments('log-missing')

    expect(paths).toEqual([])
  })
})
