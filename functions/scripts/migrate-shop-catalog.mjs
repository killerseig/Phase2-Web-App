import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { planShopCatalogMigration } from './shop-catalog-migration-lib.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEFAULT_BACKUP_DIR = path.join(__dirname, 'backups')
const BATCH_LIMIT = 400

function parseArgs(argv) {
  const options = {
    apply: false,
    backupDir: DEFAULT_BACKUP_DIR,
    projectId: undefined,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--apply') {
      options.apply = true
      continue
    }

    if (arg === '--project') {
      options.projectId = argv[index + 1]
      index += 1
      continue
    }

    if (arg === '--backup-dir') {
      options.backupDir = path.resolve(argv[index + 1] ?? DEFAULT_BACKUP_DIR)
      index += 1
      continue
    }
  }

  return options
}

function initializeAdmin(projectId) {
  const existingApp = getApps()[0]
  if (existingApp) return existingApp

  if (projectId) {
    return initializeApp({ projectId })
  }

  return initializeApp()
}

function normalizeCategoryDoc(snapshot) {
  const data = snapshot.data() ?? {}
  return {
    id: snapshot.id,
    name: data.name ?? '',
    parentId: typeof data.parentId === 'string' ? data.parentId : null,
    sku: typeof data.sku === 'string' ? data.sku : undefined,
    price: typeof data.price === 'number' ? data.price : undefined,
    active: data.active ?? true,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  }
}

function normalizeItemDoc(snapshot) {
  const data = snapshot.data() ?? {}
  return {
    id: snapshot.id,
    description: data.description ?? '',
    categoryId: typeof data.categoryId === 'string' ? data.categoryId : null,
    sku: typeof data.sku === 'string' ? data.sku : undefined,
    price: typeof data.price === 'number' ? data.price : undefined,
    active: data.active ?? true,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  }
}

function serializeBackupValue(value) {
  if (value instanceof Timestamp) {
    return {
      __type: 'Timestamp',
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
    }
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeBackupValue(entry))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serializeBackupValue(entry)])
    )
  }

  return value
}

function sanitizeFirestoreData(data) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  )
}

async function writeBackupFile({ backupDir, projectId, categories, items, plan }) {
  await fs.mkdir(backupDir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(backupDir, `shop-catalog-backup-${timestamp}.json`)
  const payload = {
    version: 1,
    projectId: projectId ?? null,
    createdAt: new Date().toISOString(),
    planSummary: plan.summary,
    categories: categories.map((category) => serializeBackupValue(category)),
    items: items.map((item) => serializeBackupValue(item)),
  }

  await fs.writeFile(backupPath, JSON.stringify(payload, null, 2), 'utf8')
  return backupPath
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
    } else if (operation.type === 'update') {
      batch.update(operation.ref, operation.data)
    } else if (operation.type === 'delete') {
      batch.delete(operation.ref)
    }

    count += 1
  }

  await flush()
}

function buildFirestoreOperations(db, plan) {
  const now = Timestamp.now()
  const categoriesCollection = db.collection('shopCategories')
  const itemsCollection = db.collection('shopCatalog')
  const operations = []

  for (const entry of plan.createCategoriesFromItems) {
    operations.push({
      type: 'set',
      ref: categoriesCollection.doc(entry.id),
      data: sanitizeFirestoreData({
        ...entry.data,
        updatedAt: now,
      }),
    })
  }

  for (const entry of plan.updateCategories) {
    operations.push({
      type: 'update',
      ref: categoriesCollection.doc(entry.id),
      data: sanitizeFirestoreData({
        ...entry.updates,
        updatedAt: now,
      }),
    })
  }

  for (const entry of plan.updateItems) {
    operations.push({
      type: 'update',
      ref: itemsCollection.doc(entry.id),
      data: sanitizeFirestoreData({
        ...entry.updates,
        updatedAt: now,
      }),
    })
  }

  for (const entry of plan.createItemsFromCategories) {
    operations.push({
      type: 'set',
      ref: itemsCollection.doc(entry.id),
      data: sanitizeFirestoreData({
        ...entry.data,
        updatedAt: now,
      }),
    })
  }

  for (const itemId of plan.deleteItemIds) {
    operations.push({
      type: 'delete',
      ref: itemsCollection.doc(itemId),
    })
  }

  for (const categoryId of plan.deleteCategoryIds) {
    operations.push({
      type: 'delete',
      ref: categoriesCollection.doc(categoryId),
    })
  }

  return operations
}

function printPlan(plan) {
  console.log('Shop Catalog migration summary:')
  console.log(`- final categories: ${plan.summary.finalCategories}`)
  console.log(`- final items: ${plan.summary.finalItems}`)
  console.log(`- items -> categories: ${plan.summary.convertItemsToCategories}`)
  console.log(`- categories -> items: ${plan.summary.convertCategoriesToItems}`)
  console.log(`- category updates: ${plan.summary.updateCategories}`)
  console.log(`- item updates: ${plan.summary.updateItems}`)
  console.log(`- item deletes: ${plan.summary.deleteItemIds}`)
  console.log(`- category deletes: ${plan.summary.deleteCategoryIds}`)

  if (plan.warnings.finalItemIdsWithoutPurchasingFields.length) {
    console.log(
      `- note: ${plan.warnings.finalItemIdsWithoutPurchasingFields.length} final items have no SKU/price`
    )
  }

  if (plan.warnings.unresolvedCategoryParents.length) {
    console.log(
      `- warning: ${plan.warnings.unresolvedCategoryParents.length} categories had unresolved parents and will be rooted`
    )
  }

  if (plan.warnings.unresolvedItemParents.length) {
    console.log(
      `- warning: ${plan.warnings.unresolvedItemParents.length} items had unresolved parents and will be uncategorized`
    )
  }

  if (plan.conflicts.itemToCategoryIdConflicts.length || plan.conflicts.categoryToItemIdConflicts.length) {
    console.log('- conflicts detected:')
    if (plan.conflicts.itemToCategoryIdConflicts.length) {
      console.log(`  item -> category id conflicts: ${plan.conflicts.itemToCategoryIdConflicts.join(', ')}`)
    }
    if (plan.conflicts.categoryToItemIdConflicts.length) {
      console.log(`  category -> item id conflicts: ${plan.conflicts.categoryToItemIdConflicts.join(', ')}`)
    }
  }
}

export async function runShopCatalogMigration(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  const app = initializeAdmin(options.projectId)
  const db = getFirestore(app)
  const projectId = options.projectId ?? app.options.projectId ?? process.env.GCLOUD_PROJECT ?? null

  const [categoriesSnapshot, itemsSnapshot] = await Promise.all([
    db.collection('shopCategories').get(),
    db.collection('shopCatalog').get(),
  ])

  const categories = categoriesSnapshot.docs.map(normalizeCategoryDoc)
  const items = itemsSnapshot.docs.map(normalizeItemDoc)
  const plan = planShopCatalogMigration(categories, items)

  printPlan(plan)

  if (plan.summary.conflicts > 0) {
    throw new Error('Migration conflicts detected. Resolve them before applying the migration.')
  }

  if (!options.apply) {
    console.log('Dry run complete. Re-run with --apply to back up and migrate the catalog.')
    return { applied: false, plan }
  }

  const backupPath = await writeBackupFile({
    backupDir: options.backupDir,
    projectId,
    categories,
    items,
    plan,
  })

  const operations = buildFirestoreOperations(db, plan)
  await commitOperations(db, operations)

  console.log(`Backup saved to ${backupPath}`)
  console.log('Migration applied successfully.')
  return { applied: true, backupPath, plan }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runShopCatalogMigration().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
