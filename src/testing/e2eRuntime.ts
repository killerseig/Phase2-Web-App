import type {
  JobRecord,
  ShopCatalogItemRecord,
  ShopCategoryRecord,
  ShopOrderItemRecord,
  ShopOrderRecord,
  ShopOrderStatus,
  UserProfile,
} from '@/types/domain'

interface Phase2E2EUser {
  uid: string
  email: string | null
  displayName: string | null
}

export interface Phase2E2EAuthState {
  user: Phase2E2EUser
  profile: UserProfile
}

export interface Phase2E2EShopOrderUpdateInput {
  deliveryDate?: string | null
  comments?: string
  items?: ShopOrderItemRecord[]
  status?: ShopOrderStatus
}

export interface Phase2E2EShopOrderActor {
  userId: string | null
  displayName: string | null
}

export interface Phase2E2EState {
  auth: Phase2E2EAuthState
  now?: string | number | null
  jobs: JobRecord[]
  shopCategories: ShopCategoryRecord[]
  shopCatalogItems: ShopCatalogItemRecord[]
  shopOrders: ShopOrderRecord[]
}

type JobsListener = (jobs: JobRecord[]) => void
type JobListener = (job: JobRecord | null) => void
type CategoriesListener = (categories: ShopCategoryRecord[]) => void
type CatalogItemsListener = (items: ShopCatalogItemRecord[]) => void
type ShopOrdersListener = (orders: ShopOrderRecord[]) => void

let cachedState: Phase2E2EState | null | undefined
let sequence = 1

const visibleJobsListeners = new Set<{
  options: { assignedOnlyForUid?: string; assignedJobIds?: string[] } | undefined
  listener: JobsListener
}>()
const jobListeners = new Map<string, Set<JobListener>>()
const categoryListeners = new Set<CategoriesListener>()
const catalogItemListeners = new Set<CatalogItemsListener>()
const shopOrderListeners = new Map<string, Set<ShopOrdersListener>>()

function cloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

function normalizeState(state: Phase2E2EState): Phase2E2EState {
  return cloneValue(state)
}

function getState() {
  if (cachedState !== undefined) return cachedState

  if (typeof window === 'undefined' || !window.__PHASE2_E2E__) {
    cachedState = null
    return cachedState
  }

  cachedState = normalizeState(window.__PHASE2_E2E__)
  return cachedState
}

function requireState() {
  const state = getState()
  if (!state) {
    throw new Error('E2E runtime is not active.')
  }

  return state
}

function toMillis(value: unknown): number {
  if (typeof (value as { toMillis?: () => number })?.toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis()
  }

  if (typeof (value as { toDate?: () => Date })?.toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime()
  }

  if (value instanceof Date) return value.getTime()

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime()
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function sortJobs(jobs: JobRecord[]) {
  return jobs.slice().sort((left, right) => {
    const leftActive = left.active !== false ? 0 : 1
    const rightActive = right.active !== false ? 0 : 1
    if (leftActive !== rightActive) return leftActive - rightActive

    const leftCode = left.code ?? ''
    const rightCode = right.code ?? ''
    if (leftCode !== rightCode) return leftCode.localeCompare(rightCode, undefined, { numeric: true })

    return left.name.localeCompare(right.name)
  })
}

function sortShopOrders(orders: ShopOrderRecord[]) {
  return orders
    .slice()
    .sort((left, right) => {
      const rightTimestamp = toMillis(right.submittedAt) || toMillis(right.updatedAt) || toMillis(right.createdAt)
      const leftTimestamp = toMillis(left.submittedAt) || toMillis(left.updatedAt) || toMillis(left.createdAt)
      if (rightTimestamp !== leftTimestamp) return rightTimestamp - leftTimestamp
      return right.id.localeCompare(left.id)
    })
}

function filterVisibleJobs(
  jobs: JobRecord[],
  options: { assignedOnlyForUid?: string; assignedJobIds?: string[] } | undefined,
) {
  const assignedJobIds = Array.isArray(options?.assignedJobIds) ? options.assignedJobIds : []
  if (assignedJobIds.length > 0) {
    return jobs.filter((job) => assignedJobIds.includes(job.id))
  }

  if (options?.assignedOnlyForUid) {
    return jobs.filter((job) => job.assignedForemanIds.includes(options.assignedOnlyForUid!))
  }

  return jobs
}

function getShopOrdersForJob(jobId: string) {
  return sortShopOrders(requireState().shopOrders.filter((order) => order.jobId === jobId))
}

function notifyVisibleJobsListeners() {
  const state = requireState()
  for (const entry of visibleJobsListeners) {
    entry.listener(cloneValue(sortJobs(filterVisibleJobs(state.jobs, entry.options))))
  }
}

function notifyJobListeners(jobId: string) {
  const listeners = jobListeners.get(jobId)
  if (!listeners?.size) return

  const state = requireState()
  const job = state.jobs.find((entry) => entry.id === jobId) ?? null
  for (const listener of listeners) {
    listener(cloneValue(job))
  }
}

function notifyCategoryListeners() {
  const categories = cloneValue(requireState().shopCategories.slice().sort((left, right) => left.name.localeCompare(right.name)))
  for (const listener of categoryListeners) {
    listener(categories)
  }
}

function notifyCatalogItemListeners() {
  const items = cloneValue(requireState().shopCatalogItems.slice().sort((left, right) => left.description.localeCompare(right.description)))
  for (const listener of catalogItemListeners) {
    listener(items)
  }
}

function notifyShopOrderListeners(jobId: string) {
  const listeners = shopOrderListeners.get(jobId)
  if (!listeners?.size) return

  const orders = cloneValue(getShopOrdersForJob(jobId))
  for (const listener of listeners) {
    listener(orders)
  }
}

function notifyJobsChanged(jobId?: string | null) {
  notifyVisibleJobsListeners()
  if (jobId) {
    notifyJobListeners(jobId)
  }
}

function notifyShopOrdersChanged(jobId: string) {
  notifyShopOrderListeners(jobId)
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${sequence++}`
}

function getNowValue() {
  const state = requireState()
  const now = state.now
  if (typeof now === 'string' || typeof now === 'number') {
    const dateValue = new Date(now)
    if (!Number.isNaN(dateValue.getTime())) return dateValue
  }

  return new Date()
}

function normalizeQuantity(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return null
  return Math.round(parsed)
}

function normalizeItems(items: ShopOrderItemRecord[]): ShopOrderItemRecord[] {
  return items
    .map((item): ShopOrderItemRecord => ({
      ...item,
      id: String(item.id || '').trim() || makeId('item'),
      description: item.description.trim(),
      note: item.note.trim(),
      quantity: normalizeQuantity(item.quantity),
      catalogItemId: item.catalogItemId?.trim() || null,
      categoryId: item.categoryId?.trim() || null,
      sku: item.sku?.trim() || null,
      sourceType: item.sourceType === 'custom' ? 'custom' : 'catalog',
    }))
    .filter((item) => item.description.length > 0)
}

export function isE2EActive() {
  return !!getState()
}

export function getE2EAuthState() {
  const state = getState()
  return state ? cloneValue(state.auth) : null
}

export function getE2ENowValue() {
  const state = getState()
  if (!state?.now) return null

  const dateValue = new Date(state.now)
  return Number.isNaN(dateValue.getTime()) ? null : dateValue
}

export function subscribeE2EVisibleJobs(
  options: { assignedOnlyForUid?: string; assignedJobIds?: string[] } | undefined,
  onUpdate: JobsListener,
) {
  const entry = { options, listener: onUpdate }
  visibleJobsListeners.add(entry)
  onUpdate(cloneValue(sortJobs(filterVisibleJobs(requireState().jobs, options))))

  return () => {
    visibleJobsListeners.delete(entry)
  }
}

export function subscribeE2EJob(jobId: string, onUpdate: JobListener) {
  const listeners = jobListeners.get(jobId) ?? new Set<JobListener>()
  listeners.add(onUpdate)
  jobListeners.set(jobId, listeners)
  onUpdate(cloneValue(requireState().jobs.find((entry) => entry.id === jobId) ?? null))

  return () => {
    const nextListeners = jobListeners.get(jobId)
    if (!nextListeners) return
    nextListeners.delete(onUpdate)
    if (!nextListeners.size) {
      jobListeners.delete(jobId)
    }
  }
}

export function subscribeE2EShopCategories(onUpdate: CategoriesListener) {
  categoryListeners.add(onUpdate)
  notifyCategoryListeners()

  return () => {
    categoryListeners.delete(onUpdate)
  }
}

export function subscribeE2EShopCatalogItems(onUpdate: CatalogItemsListener) {
  catalogItemListeners.add(onUpdate)
  notifyCatalogItemListeners()

  return () => {
    catalogItemListeners.delete(onUpdate)
  }
}

export function subscribeE2EShopOrders(jobId: string, onUpdate: ShopOrdersListener) {
  const listeners = shopOrderListeners.get(jobId) ?? new Set<ShopOrdersListener>()
  listeners.add(onUpdate)
  shopOrderListeners.set(jobId, listeners)
  onUpdate(cloneValue(getShopOrdersForJob(jobId)))

  return () => {
    const nextListeners = shopOrderListeners.get(jobId)
    if (!nextListeners) return
    nextListeners.delete(onUpdate)
    if (!nextListeners.size) {
      shopOrderListeners.delete(jobId)
    }
  }
}

export async function createE2EShopOrder(input: {
  jobId: string
  jobCode: string | null
  jobName: string | null
  foremanUserId: string | null
  foremanName: string | null
  deliveryDate: string | null
}) {
  const state = requireState()
  const now = getNowValue().toISOString()
  const orderId = makeId('order')

  state.shopOrders.push({
    id: orderId,
    jobId: input.jobId,
    jobCode: input.jobCode,
    jobName: input.jobName,
    orderNumber: null,
    orderDate: now,
    deliveryDate: input.deliveryDate?.trim() || null,
    status: 'draft',
    comments: '',
    foremanUserId: input.foremanUserId,
    foremanName: input.foremanName,
    items: [],
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
  })

  notifyShopOrdersChanged(input.jobId)
  return orderId
}

export async function updateE2EShopOrder(
  orderId: string,
  input: Phase2E2EShopOrderUpdateInput,
  actor?: Phase2E2EShopOrderActor,
) {
  const state = requireState()
  const index = state.shopOrders.findIndex((order) => order.id === orderId)
  if (index === -1) {
    throw new Error('Shop order not found.')
  }

  const existingOrder = state.shopOrders[index]!
  const now = getNowValue().toISOString()
  const nextOrder: ShopOrderRecord = {
    ...existingOrder,
    updatedAt: now,
  }

  if ('deliveryDate' in input) {
    nextOrder.deliveryDate = input.deliveryDate?.trim() || null
  }

  if ('comments' in input) {
    nextOrder.comments = typeof input.comments === 'string' ? input.comments.trim() : ''
  }

  if ('items' in input && Array.isArray(input.items)) {
    nextOrder.items = normalizeItems(input.items)
  }

  if ('status' in input && input.status) {
    nextOrder.status = input.status
    if (input.status === 'submitted') {
      nextOrder.submittedAt = now
      if (!nextOrder.orderDate) {
        nextOrder.orderDate = nextOrder.createdAt || now
      }
      if (!nextOrder.foremanName && actor?.displayName) {
        nextOrder.foremanName = actor.displayName
      }
    }
  }

  state.shopOrders[index] = nextOrder
  notifyShopOrdersChanged(nextOrder.jobId)
}

export async function deleteE2EShopOrder(orderId: string) {
  const state = requireState()
  const existingOrder = state.shopOrders.find((order) => order.id === orderId)
  if (!existingOrder) {
    throw new Error('Shop order not found.')
  }

  state.shopOrders = state.shopOrders.filter((order) => order.id !== orderId)
  notifyShopOrdersChanged(existingOrder.jobId)
}

export async function sendE2EShopOrderSubmissionEmail() {
  return
}
