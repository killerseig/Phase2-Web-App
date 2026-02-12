import { storage } from '../firebase'
import { ref, uploadBytes, deleteObject, getDownloadURL, listAll } from 'firebase/storage'
import { requireUser } from './serviceGuards'
import type { Attachment, AttachmentType } from '@/types/documents'
import { normalizeError } from './serviceUtils'

/**
 * Upload a file to Storage and return attachment metadata
 */
export async function uploadAttachment(
  file: File,
  logId: string,
  type: AttachmentType = 'photo'
): Promise<Attachment> {
  try {
    const u = requireUser()

    // Sanitize filename
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const timestamp = Date.now()
    const storagePath = `daily-logs/${logId}/${timestamp}-${safeName}`

    const storageRef = ref(storage, storagePath)

    // Upload with metadata
    const metadata = {
      customMetadata: {
        type,
        uploadedBy: u.uid,
        uploadedAt: new Date().toISOString(),
      },
    }

    await uploadBytes(storageRef, file, metadata)
    const url = await getDownloadURL(storageRef)

    return {
      name: file.name,
      url,
      path: storagePath,
      type,
      createdAt: new Date(),
    }
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to upload attachment'))
  }
}

/**
 * Delete an attachment file from Storage
 */
export async function deleteAttachmentFile(path: string): Promise<void> {
  try {
    requireUser()
    const storageRef = ref(storage, path)
    await deleteObject(storageRef)
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to delete attachment'))
  }
}

/**
 * List all attachments in a daily log folder
 */
export async function listAttachments(logId: string): Promise<string[]> {
  try {
    requireUser()
    const folderRef = ref(storage, `daily-logs/${logId}`)
    const result = await listAll(folderRef)
    return result.items.map((item) => item.fullPath)
  } catch (e: any) {
    if (e?.code === 'storage/object-not-found') {
      return []
    }
    throw new Error(normalizeError(e, 'Failed to list attachments'))
  }
}
