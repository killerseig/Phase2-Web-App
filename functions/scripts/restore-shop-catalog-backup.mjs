import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const __filename = fileURLToPath(import.meta.url)
const BATCH_LIMIT = 400

function parseArgs(argv) {
  const options = {
    apply: false,
    file: undefined,
    projectId: undefined,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--apply') {
      options.apply = true
      continue
    }

    if (arg === '--file') {
      options.file = path.resolve(argv[index + 1] ?? '')
      index += 1
      continue
    }

    if (arg === '--project') {
      options.projectId = argv[index + 1]
      index += 1
    }
  }

  return options
}

function initializeAdmin(projectId) {
  const existingApp = getApps()[0]
  if (existingApp) return existingApp
  return projectId ? initializeApp({ projectId }) : initializeApp()
}

function deserializeBackupValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => deserializeBackupValue(entry))
  }

  if (value && typeof value === 'object') {
    if (value.__type === 'Timestamp') {
      return new Timestamp(value.seconds, value.nanoseconds)
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, deserializeBackupValue(entry)])
    )
  }

  return value
}

function sanitizeFirestoreData(data) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  )
}

async function commitOperations(db, operations) {
  let batch = db.batch()
  let count = 0

  const flush = async () => {
    if (count === 0) return
    await batch.commit()
    batch = db.batch()
    count = 0
  }

  for (const operation of operations) {
    if (count >= BATCH_LIMIT) {
      await flush()
    }

    if (operation.type === 'set') {
      batch.set(operation.ref, operation.data)
    } else if (operation.type === 'delete') {
      batch.delete(operation.ref)
    }

    count += 1
  }

  await flush()
}

export async function restoreShopCatalogBackup(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)

  if (!options.file) {
    throw new Error('Missing --file <backup.json>')
  }

  if (!options.apply) {
    throw new Error('Restore is destructive. Re-run with --apply once you are sure.')
  }

  const rawBackup = JSON.parse(await fs.readFile(options.file, 'utf8'))
  const categories = (rawBackup.categories ?? []).map((entry) => deserializeBackupValue(entry))
  const items = (rawBackup.items ?? []).map((entry) => deserializeBackupValue(entry))

  const app = initializeAdmin(options.projectId)
  const db = getFirestore(app)
  const [currentCategories, currentItems] = await Promise.all([
    db.collection('shopCategories').listDocuments(),
    db.collection('shopCatalog').listDocuments(),
  ])

  const deleteOperations = [
    ...currentCategories.map((ref) => ({ type: 'delete', ref })),
    ...currentItems.map((ref) => ({ type: 'delete', ref })),
  ]

  const setOperations = [
    ...categories.map((category) => ({
      type: 'set',
      ref: db.collection('shopCategories').doc(category.id),
      data: sanitizeFirestoreData({
        ...category,
        id: undefined,
      }),
    })),
    ...items.map((item) => ({
      type: 'set',
      ref: db.collection('shopCatalog').doc(item.id),
      data: sanitizeFirestoreData({
        ...item,
        id: undefined,
      }),
    })),
  ]

  await commitOperations(db, deleteOperations)
  await commitOperations(db, setOperations)

  console.log(`Restored shop catalog backup from ${options.file}`)
  return { restored: true, file: options.file }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  restoreShopCatalogBackup().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
