import { storage, auth } from '../firebase'
import {
  ref,
  uploadBytes,
  deleteObject,
  getDownloadURL,
  listAll,
} from 'firebase/storage'

export type AttachmentType = 'photo' | 'ptp' | 'other'

export type Attachment = {
  name: string
  url: string
  path: string
  type?: AttachmentType
  createdAt?: any
}

function requireUser() {
  const u = auth.currentUser
  if (!u) throw new Error('Not signed in')
  return u
}

/**
 * Upload a file to Storage and return attachment metadata
 */
export async function uploadAttachment(
  file: File,
  logId: string,
  type: AttachmentType = 'photo'
): Promise<Attachment> {
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
}

/**
 * Delete an attachment file from Storage
 */
export async function deleteAttachmentFile(path: string): Promise<void> {
  requireUser()
  const storageRef = ref(storage, path)
  await deleteObject(storageRef)
}

/**
 * List all attachments in a daily log folder
 */
export async function listAttachments(logId: string): Promise<string[]> {
  requireUser()
  const folderRef = ref(storage, `daily-logs/${logId}`)
  try {
    const result = await listAll(folderRef)
    return result.items.map((item) => item.fullPath)
  } catch (e: any) {
    if (e?.code === 'storage/object-not-found') {
      return []
    }
    throw e
  }
}
