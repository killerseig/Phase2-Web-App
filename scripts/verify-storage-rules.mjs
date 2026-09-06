import { deleteApp, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously, signOut } from 'firebase/auth'
import {
  connectStorageEmulator,
  deleteObject,
  getBytes,
  getStorage,
  ref,
  uploadBytes,
} from 'firebase/storage'

const app = initializeApp(
  {
    apiKey: 'storage-rules-test-key',
    authDomain: 'phase2-website.firebaseapp.com',
    projectId: 'phase2-website',
    storageBucket: 'phase2-website.firebasestorage.app',
  },
  'storage-rules-verification',
)

const auth = getAuth(app)
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })

const storage = getStorage(app)
connectStorageEmulator(storage, '127.0.0.1', 9199)

const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])

function imageMetadata(logId, uploadedBy) {
  return {
    contentType: 'image/jpeg',
    customMetadata: {
      jobId: 'job-1',
      dailyLogId: logId,
      uploadedBy,
    },
  }
}

async function expectDenied(label, operation) {
  try {
    await operation()
  } catch (error) {
    if (error?.code === 'storage/unauthorized') {
      return
    }

    throw new Error(`${label} failed with ${error?.code ?? error}`)
  }

  throw new Error(`${label} was unexpectedly allowed`)
}

try {
  const uploader = await signInAnonymously(auth)
  const uploaderUid = uploader.user.uid
  const logId = 'daily-log-rules-check'
  const validPhoto = ref(storage, `daily-logs/${logId}/valid-photo.jpg`)

  await uploadBytes(validPhoto, imageBytes, imageMetadata(logId, uploaderUid))
  await getBytes(validPhoto)

  await expectDenied('Mismatched uploader metadata', () =>
    uploadBytes(
      ref(storage, `daily-logs/${logId}/wrong-uploader.jpg`),
      imageBytes,
      imageMetadata(logId, 'another-user'),
    ),
  )

  await expectDenied('Mismatched daily log metadata', () =>
    uploadBytes(
      ref(storage, `daily-logs/${logId}/wrong-log.jpg`),
      imageBytes,
      imageMetadata('another-log', uploaderUid),
    ),
  )

  await expectDenied('Non-image upload', () =>
    uploadBytes(ref(storage, `daily-logs/${logId}/not-an-image.txt`), imageBytes, {
      ...imageMetadata(logId, uploaderUid),
      contentType: 'text/plain',
    }),
  )

  await signOut(auth)
  await expectDenied('Unauthenticated upload', () =>
    uploadBytes(
      ref(storage, `daily-logs/${logId}/signed-out.jpg`),
      imageBytes,
      imageMetadata(logId, uploaderUid),
    ),
  )

  await signInAnonymously(auth)
  await getBytes(validPhoto)
  await deleteObject(validPhoto)

  console.log('Storage rules verified: valid field upload/read/delete allowed; invalid requests denied.')
} finally {
  await deleteApp(app)
}
