import {
  DEFAULT_TIMECARD_BURDEN,
  buildCardDisplayName,
  buildEmployeeCard,
  getWeekStartFromSaturday,
  recalculateCardTotals,
  type TimecardEmployeeSeed,
} from '@/features/timecards/workbook'
import type {
  DailyLogPayload,
  DailyLogRecord,
  EmployeeRecord,
  JobRecord,
  NotificationModuleKey,
  NotificationRecipients,
  ShopCatalogItemRecord,
  ShopCategoryRecord,
  ShopOrderItemRecord,
  ShopOrderRecord,
  ShopOrderStatus,
  TimecardCardRecord,
  TimecardWeekRecord,
  UserProfile,
} from '@/types/domain'

declare global {
  interface Window {
    __PHASE2_E2E_STATE__?: Phase2E2EState | null
  }
}

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

export interface Phase2E2EDelays {
  dailyLogUpdateMs?: number
  jobUpdateMs?: number
  shopOrderUpdateMs?: number
  timecardUpdateMs?: number
}

export interface Phase2E2ETimecardCardState extends TimecardCardRecord {
  weekId: string
}

export interface Phase2E2EState {
  auth: Phase2E2EAuthState
  delays?: Phase2E2EDelays
  now?: string | number | null
  users?: UserProfile[]
  jobs: JobRecord[]
  employees?: EmployeeRecord[]
  shopCategories: ShopCategoryRecord[]
  shopCatalogItems: ShopCatalogItemRecord[]
  shopOrders: ShopOrderRecord[]
  dailyLogs?: DailyLogRecord[]
  timecardWeeks?: TimecardWeekRecord[]
  timecardCards?: Phase2E2ETimecardCardState[]
  globalNotificationRecipients?: NotificationRecipients
}

type JobsListener = (jobs: JobRecord[]) => void
type JobListener = (job: JobRecord | null) => void
type UsersListener = (users: UserProfile[]) => void
type EmployeesListener = (employees: EmployeeRecord[]) => void
type GlobalRecipientsListener = (recipients: NotificationRecipients) => void
type CategoriesListener = (categories: ShopCategoryRecord[]) => void
type CatalogItemsListener = (items: ShopCatalogItemRecord[]) => void
type ShopOrdersListener = (orders: ShopOrderRecord[]) => void
type DailyLogsListener = (logs: DailyLogRecord[]) => void
type TimecardWeeksListener = (weeks: TimecardWeekRecord[]) => void
type TimecardCardsListener = (cards: TimecardCardRecord[]) => void

let cachedState: Phase2E2EState | null | undefined
let sequence = 1

const visibleJobsListeners = new Set<{
  options: { assignedOnlyForUid?: string; assignedJobIds?: string[] } | undefined
  listener: JobsListener
}>()
const jobListeners = new Map<string, Set<JobListener>>()
const userListeners = new Set<UsersListener>()
const employeeListeners = new Set<EmployeesListener>()
const globalRecipientsListeners = new Set<GlobalRecipientsListener>()
const categoryListeners = new Set<CategoriesListener>()
const catalogItemListeners = new Set<CatalogItemsListener>()
const shopOrderListeners = new Map<string, Set<ShopOrdersListener>>()
const dailyLogListeners = new Set<{ jobId: string; logDate: string; listener: DailyLogsListener }>()
const timecardWeekListeners = new Set<{
  jobId: string
  ownerForemanUserId: string | null
  listener: TimecardWeeksListener
}>()
const allTimecardWeekListeners = new Set<TimecardWeeksListener>()
const timecardCardListeners = new Set<{
  weekId: string
  weekStartDate: string
  burden: number
  listener: TimecardCardsListener
}>()

function cloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

function normalizeNotificationRecipients(value: unknown): NotificationRecipients {
  const source = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  return {
    dailyLogs: Array.isArray(source.dailyLogs)
      ? source.dailyLogs.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim().toLowerCase()).filter(Boolean)
      : [],
    timecards: Array.isArray(source.timecards)
      ? source.timecards.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim().toLowerCase()).filter(Boolean)
      : [],
    shopOrders: Array.isArray(source.shopOrders)
      ? source.shopOrders.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim().toLowerCase()).filter(Boolean)
      : [],
  }
}

function normalizeState(state: Phase2E2EState): Phase2E2EState {
  const cloned = cloneValue(state)

  return {
    ...cloned,
    users: Array.isArray(cloned.users) ? cloned.users : [cloned.auth.profile],
    employees: Array.isArray(cloned.employees) ? cloned.employees : [],
    dailyLogs: Array.isArray(cloned.dailyLogs) ? cloned.dailyLogs : [],
    timecardWeeks: Array.isArray(cloned.timecardWeeks) ? cloned.timecardWeeks : [],
    timecardCards: Array.isArray(cloned.timecardCards) ? cloned.timecardCards : [],
    globalNotificationRecipients: normalizeNotificationRecipients(cloned.globalNotificationRecipients),
  }
}

function getState() {
  if (cachedState !== undefined) return cachedState

  if (typeof window === 'undefined' || !window.__PHASE2_E2E__) {
    cachedState = null
    if (typeof window !== 'undefined') {
      window.__PHASE2_E2E_STATE__ = cachedState
    }
    return cachedState
  }

  cachedState = normalizeState(window.__PHASE2_E2E__ as Phase2E2EState)
  window.__PHASE2_E2E_STATE__ = cachedState
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

function sortUsers(users: UserProfile[]) {
  return users.slice().sort((left, right) => {
    const leftName = `${left.firstName ?? ''} ${left.lastName ?? ''}`.trim()
    const rightName = `${right.firstName ?? ''} ${right.lastName ?? ''}`.trim()

    if (leftName && rightName && leftName !== rightName) {
      return leftName.localeCompare(rightName)
    }

    return (left.email ?? '').localeCompare(right.email ?? '')
  })
}

function sortEmployees(employees: EmployeeRecord[]) {
  return employees.slice().sort((left, right) => {
    const leftLast = left.lastName.toLowerCase()
    const rightLast = right.lastName.toLowerCase()
    if (leftLast !== rightLast) return leftLast.localeCompare(rightLast)

    const leftFirst = left.firstName.toLowerCase()
    const rightFirst = right.firstName.toLowerCase()
    if (leftFirst !== rightFirst) return leftFirst.localeCompare(rightFirst)

    return left.employeeNumber.localeCompare(right.employeeNumber)
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

function sortDailyLogs(logs: DailyLogRecord[]) {
  return logs
    .slice()
    .sort((left, right) => {
      const rank = (status: string) => (status === 'submitted' ? 0 : 1)
      if (rank(left.status) !== rank(right.status)) return rank(left.status) - rank(right.status)

      const rightTimestamp = toMillis(right.submittedAt) || toMillis(right.updatedAt) || toMillis(right.createdAt)
      const leftTimestamp = toMillis(left.submittedAt) || toMillis(left.updatedAt) || toMillis(left.createdAt)
      if (rightTimestamp !== leftTimestamp) return rightTimestamp - leftTimestamp

      if (right.sequenceNumber !== left.sequenceNumber) return right.sequenceNumber - left.sequenceNumber
      return right.id.localeCompare(left.id)
    })
}

function sortWeeks(weeks: TimecardWeekRecord[]) {
  return weeks.slice().sort((left, right) => (
    right.weekEndDate.localeCompare(left.weekEndDate)
    || right.id.localeCompare(left.id)
  ))
}

function sortCards(cards: TimecardCardRecord[]) {
  return cards.slice().sort((left, right) => (
    left.sortIndex - right.sortIndex
    || buildCardDisplayName(left).localeCompare(buildCardDisplayName(right))
    || left.id.localeCompare(right.id)
  ))
}

function filterVisibleJobs(
  jobs: JobRecord[],
  options: { assignedOnlyForUid?: string; assignedJobIds?: string[] } | undefined,
) {
  const assignedJobIds = Array.isArray(options?.assignedJobIds) ? options.assignedJobIds : []
  if (assignedJobIds.length > 0) {
    return jobs.filter((job) => assignedJobIds.includes(job.id))
  }

  const assignedOnlyForUid = options?.assignedOnlyForUid
  if (assignedOnlyForUid) {
    return jobs.filter((job) => job.assignedForemanIds.includes(assignedOnlyForUid))
  }

  return jobs
}

function getVisibleUsers() {
  const state = requireState()
  const users = Array.isArray(state.users) ? [...state.users] : []
  const authProfile = state.auth.profile
  if (!users.some((user) => user.id === authProfile.id)) {
    users.push(authProfile)
  }
  return sortUsers(users)
}

function getShopOrdersForJob(jobId: string) {
  return sortShopOrders(requireState().shopOrders.filter((order) => order.jobId === jobId))
}

function getDailyLogsForDate(jobId: string, logDate: string) {
  return sortDailyLogs(requireState().dailyLogs?.filter((log) => log.jobId === jobId && log.logDate === logDate) ?? [])
}

function getTimecardWeeksForJob(jobId: string, ownerForemanUserId: string | null) {
  const weeks = requireState().timecardWeeks ?? []
  return sortWeeks(
    weeks.filter((week) => (
      week.jobId === jobId
      && (!ownerForemanUserId || week.ownerForemanUserId === ownerForemanUserId)
    )),
  )
}

function getTimecardCardsForWeek(weekId: string, weekStartDate: string, burden: number) {
  const cards = (requireState().timecardCards ?? [])
    .filter((card) => card.weekId === weekId)
    .map((card) => {
      const cloned = cloneValue(card)
      cloned.fullName = buildCardDisplayName(cloned)
      recalculateCardTotals(cloned, weekStartDate, burden || DEFAULT_TIMECARD_BURDEN)
      return cloned
    })

  return sortCards(cards)
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

function notifyUserListeners() {
  const users = cloneValue(getVisibleUsers())
  for (const listener of userListeners) {
    listener(users)
  }
}

function notifyEmployeeListeners() {
  const employees = cloneValue(sortEmployees(requireState().employees ?? []))
  for (const listener of employeeListeners) {
    listener(employees)
  }
}

function notifyGlobalRecipientsListeners() {
  const recipients = cloneValue(requireState().globalNotificationRecipients ?? normalizeNotificationRecipients(null))
  for (const listener of globalRecipientsListeners) {
    listener(recipients)
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

function notifyDailyLogListeners(jobId: string, logDate: string) {
  const matchingListeners = Array.from(dailyLogListeners).filter((entry) => entry.jobId === jobId && entry.logDate === logDate)
  if (!matchingListeners.length) return

  const logs = cloneValue(getDailyLogsForDate(jobId, logDate))
  for (const entry of matchingListeners) {
    entry.listener(logs)
  }
}

function notifyTimecardWeekListeners(jobId: string) {
  const matchingListeners = Array.from(timecardWeekListeners).filter((entry) => entry.jobId === jobId)
  if (!matchingListeners.length) return

  for (const entry of matchingListeners) {
    entry.listener(cloneValue(getTimecardWeeksForJob(jobId, entry.ownerForemanUserId)))
  }
}

function notifyAllTimecardWeekListeners() {
  if (!allTimecardWeekListeners.size) return

  const weeks = cloneValue(sortWeeks(requireState().timecardWeeks ?? []))
  for (const listener of allTimecardWeekListeners) {
    listener(weeks)
  }
}

function notifyTimecardCardListeners(weekId: string) {
  const matchingListeners = Array.from(timecardCardListeners).filter((entry) => entry.weekId === weekId)
  if (!matchingListeners.length) return

  for (const entry of matchingListeners) {
    entry.listener(cloneValue(getTimecardCardsForWeek(weekId, entry.weekStartDate, entry.burden)))
  }
}

function notifyJobsChanged(jobId?: string | null) {
  notifyVisibleJobsListeners()
  notifyUserListeners()
  if (jobId) {
    notifyJobListeners(jobId)
  }
}

function notifyShopOrdersChanged(jobId: string) {
  notifyShopOrderListeners(jobId)
}

function notifyDailyLogsChanged(jobId: string, logDate: string) {
  notifyDailyLogListeners(jobId, logDate)
}

function notifyTimecardsChanged(jobId: string, weekId?: string | null) {
  notifyTimecardWeekListeners(jobId)
  notifyAllTimecardWeekListeners()
  if (weekId) {
    notifyTimecardCardListeners(weekId)
  }
}

function makeId(prefix: string) {
  const timestamp = getNowValue().getTime()
  return `${prefix}-${timestamp}-${sequence++}`
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

function getDelayMs(key: keyof Phase2E2EDelays) {
  const state = requireState()
  const rawValue = state.delays?.[key]
  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.round(parsed)
}

async function waitForDelay(key: keyof Phase2E2EDelays) {
  const delayMs = getDelayMs(key)
  if (!delayMs) return
  await new Promise((resolve) => {
    globalThis.setTimeout(resolve, delayMs)
  })
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getWeekEndDateFromStart(weekStartDate: string) {
  const start = new Date(`${weekStartDate}T00:00:00`)
  start.setDate(start.getDate() + 6)
  return formatIsoDate(start)
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

function getNextDailyLogSequence(jobId: string, logDate: string) {
  const matchingLogs = requireState().dailyLogs?.filter((log) => log.jobId === jobId && log.logDate === logDate) ?? []
  return matchingLogs.reduce((maxValue, log) => Math.max(maxValue, Number(log.sequenceNumber ?? 0) || 0), 0) + 1
}

function updateUserAssignments(jobId: string, nextAssignedForemanIds: string[]) {
  const state = requireState()
  if (!state.users) return

  state.users = state.users.map((user) => {
    if (user.role !== 'foreman') return user

    const nextAssignedJobIds = new Set(user.assignedJobIds)
    if (nextAssignedForemanIds.includes(user.id)) {
      nextAssignedJobIds.add(jobId)
    } else {
      nextAssignedJobIds.delete(jobId)
    }

    return {
      ...user,
      assignedJobIds: Array.from(nextAssignedJobIds),
    }
  })
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

export function subscribeE2EUsers(onUpdate: UsersListener) {
  userListeners.add(onUpdate)
  onUpdate(cloneValue(getVisibleUsers()))

  return () => {
    userListeners.delete(onUpdate)
  }
}

export function subscribeE2EEmployees(onUpdate: EmployeesListener) {
  employeeListeners.add(onUpdate)
  onUpdate(cloneValue(sortEmployees(requireState().employees ?? [])))

  return () => {
    employeeListeners.delete(onUpdate)
  }
}

export function subscribeE2EGlobalNotificationRecipients(onUpdate: GlobalRecipientsListener) {
  globalRecipientsListeners.add(onUpdate)
  onUpdate(cloneValue(requireState().globalNotificationRecipients ?? normalizeNotificationRecipients(null)))

  return () => {
    globalRecipientsListeners.delete(onUpdate)
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

export function subscribeE2EDailyLogsForDate(
  jobId: string,
  logDate: string,
  onUpdate: DailyLogsListener,
) {
  const entry = { jobId, logDate, listener: onUpdate }
  dailyLogListeners.add(entry)
  onUpdate(cloneValue(getDailyLogsForDate(jobId, logDate)))

  return () => {
    dailyLogListeners.delete(entry)
  }
}

export function subscribeE2ETimecardWeeks(
  jobId: string,
  ownerForemanUserId: string | null,
  onUpdate: TimecardWeeksListener,
) {
  const entry = { jobId, ownerForemanUserId, listener: onUpdate }
  timecardWeekListeners.add(entry)
  onUpdate(cloneValue(getTimecardWeeksForJob(jobId, ownerForemanUserId)))

  return () => {
    timecardWeekListeners.delete(entry)
  }
}

export function subscribeE2EAllTimecardWeeks(onUpdate: TimecardWeeksListener) {
  allTimecardWeekListeners.add(onUpdate)
  onUpdate(cloneValue(sortWeeks(requireState().timecardWeeks ?? [])))

  return () => {
    allTimecardWeekListeners.delete(onUpdate)
  }
}

export function subscribeE2ETimecardCards(
  weekId: string,
  weekStartDate: string,
  burden: number,
  onUpdate: TimecardCardsListener,
) {
  const entry = { weekId, weekStartDate, burden, listener: onUpdate }
  timecardCardListeners.add(entry)
  onUpdate(cloneValue(getTimecardCardsForWeek(weekId, weekStartDate, burden)))

  return () => {
    timecardCardListeners.delete(entry)
  }
}

export async function createE2EJob(input: {
  name: string
  code: string
  type: string
  gc: string
  jobAddress: string
  startDate: string
  finishDate: string
  productionBurden: string
  assignedForemanIds: string[]
  notificationRecipients: NotificationRecipients
  active: boolean
}) {
  const state = requireState()
  const jobId = makeId('job')
  const burdenValue = Number(input.productionBurden.trim())
  const notificationRecipients = normalizeNotificationRecipients(input.notificationRecipients)

  state.jobs.push({
    id: jobId,
    name: input.name.trim(),
    code: input.code.trim() || null,
    type: input.type || 'general',
    gc: input.gc.trim() || null,
    projectManager: null,
    foreman: null,
    jobAddress: input.jobAddress.trim() || null,
    startDate: input.startDate.trim() || null,
    finishDate: input.finishDate.trim() || null,
    productionBurden: Number.isFinite(burdenValue) ? burdenValue : null,
    active: input.active,
    assignedForemanIds: [...input.assignedForemanIds],
    timecardStatus: 'pending',
    timecardPeriodEndDate: null,
    notificationRecipients,
    adminDailyLogRecipients: [],
    dailyLogRecipients: notificationRecipients.dailyLogs,
  })

  updateUserAssignments(jobId, input.assignedForemanIds)
  notifyJobsChanged(jobId)
  return jobId
}

export async function updateE2EJob(
  jobId: string,
  input: {
    name: string
    code: string
    type: string
    gc: string
    jobAddress: string
    startDate: string
    finishDate: string
    productionBurden: string
    assignedForemanIds: string[]
    notificationRecipients: NotificationRecipients
    active: boolean
  },
) {
  const state = requireState()
  const index = state.jobs.findIndex((job) => job.id === jobId)
  if (index === -1) {
    throw new Error('Job not found.')
  }

  await waitForDelay('jobUpdateMs')

  const existingJob = state.jobs[index]!
  const burdenValue = Number(input.productionBurden.trim())
  const notificationRecipients = normalizeNotificationRecipients(input.notificationRecipients)
  state.jobs[index] = {
    ...existingJob,
    name: input.name.trim(),
    code: input.code.trim() || null,
    type: input.type || 'general',
    gc: input.gc.trim() || null,
    jobAddress: input.jobAddress.trim() || null,
    startDate: input.startDate.trim() || null,
    finishDate: input.finishDate.trim() || null,
    productionBurden: Number.isFinite(burdenValue) ? burdenValue : null,
    active: input.active,
    assignedForemanIds: [...input.assignedForemanIds],
    notificationRecipients,
    dailyLogRecipients: notificationRecipients.dailyLogs,
  }

  updateUserAssignments(jobId, input.assignedForemanIds)
  notifyJobsChanged(jobId)
}

export async function setE2EJobActive(jobId: string, active: boolean) {
  const state = requireState()
  const index = state.jobs.findIndex((job) => job.id === jobId)
  if (index === -1) {
    throw new Error('Job not found.')
  }

  state.jobs[index] = {
    ...state.jobs[index]!,
    active,
  }
  notifyJobsChanged(jobId)
}

export async function deleteE2EJob(jobId: string) {
  const state = requireState()
  state.jobs = state.jobs.filter((job) => job.id !== jobId)
  updateUserAssignments(jobId, [])
  notifyJobsChanged(jobId)
}

export async function updateE2EJobNotificationRecipients(
  jobId: string,
  moduleKey: NotificationModuleKey,
  recipients: string[],
) {
  const state = requireState()
  const index = state.jobs.findIndex((job) => job.id === jobId)
  if (index === -1) {
    throw new Error('Job not found.')
  }

  const existingJob = state.jobs[index]!
  const sanitized = recipients.map((entry) => entry.trim().toLowerCase()).filter(Boolean)
  const notificationRecipients = normalizeNotificationRecipients({
    ...(existingJob.notificationRecipients ?? {}),
    [moduleKey]: sanitized,
  })

  state.jobs[index] = {
    ...existingJob,
    notificationRecipients,
    dailyLogRecipients: moduleKey === 'dailyLogs' ? sanitized : existingJob.dailyLogRecipients ?? [],
  }

  notifyJobsChanged(jobId)
}

export async function updateE2EGlobalNotificationRecipients(
  moduleKey: NotificationModuleKey,
  recipients: string[],
) {
  const state = requireState()
  state.globalNotificationRecipients = normalizeNotificationRecipients({
    ...(state.globalNotificationRecipients ?? {}),
    [moduleKey]: recipients,
  })
  notifyGlobalRecipientsListeners()
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

  await waitForDelay('shopOrderUpdateMs')

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

export async function createE2EDailyLog(input: {
  jobId: string
  jobCode: string | null
  jobName: string | null
  logDate: string
  foremanUserId: string | null
  foremanName: string | null
  additionalRecipients?: string[]
  payload: DailyLogPayload
}) {
  const state = requireState()
  const now = getNowValue().toISOString()
  const logId = makeId('daily-log')

  state.dailyLogs ??= []
  state.dailyLogs.push({
    id: logId,
    jobId: input.jobId,
    jobCode: input.jobCode,
    jobName: input.jobName,
    logDate: input.logDate,
    sequenceNumber: getNextDailyLogSequence(input.jobId, input.logDate),
    status: 'draft',
    foremanUserId: input.foremanUserId,
    foremanName: input.foremanName,
    additionalRecipients: Array.isArray(input.additionalRecipients) ? [...input.additionalRecipients] : [],
    payload: cloneValue(input.payload),
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
  })

  notifyDailyLogsChanged(input.jobId, input.logDate)
  return logId
}

export async function updateE2EDailyLog(
  dailyLogId: string,
  input: {
    payload?: DailyLogPayload
    status?: 'draft' | 'submitted'
    additionalRecipients?: string[]
  },
  actor?: { userId: string | null; displayName: string | null },
) {
  const state = requireState()
  const index = state.dailyLogs?.findIndex((log) => log.id === dailyLogId) ?? -1
  if (index === -1 || !state.dailyLogs) {
    throw new Error('Daily log not found.')
  }

  await waitForDelay('dailyLogUpdateMs')

  const existingLog = state.dailyLogs[index]!
  const now = getNowValue().toISOString()
  const nextLog: DailyLogRecord = {
    ...existingLog,
    updatedAt: now,
  }

  if ('payload' in input && input.payload) {
    nextLog.payload = cloneValue(input.payload)
  }

  if ('additionalRecipients' in input && Array.isArray(input.additionalRecipients)) {
    nextLog.additionalRecipients = input.additionalRecipients.map((entry) => entry.trim().toLowerCase()).filter(Boolean)
  }

  if ('status' in input && input.status) {
    nextLog.status = input.status
    if (input.status === 'submitted') {
      nextLog.submittedAt = now
      if (!nextLog.foremanName && actor?.displayName) {
        nextLog.foremanName = actor.displayName
      }
    }
  }

  state.dailyLogs[index] = nextLog
  notifyDailyLogsChanged(nextLog.jobId, nextLog.logDate)
}

export async function deleteE2EDailyLog(dailyLogId: string) {
  const state = requireState()
  const target = state.dailyLogs?.find((log) => log.id === dailyLogId)
  if (!target || !state.dailyLogs) {
    throw new Error('Daily log not found.')
  }

  state.dailyLogs = state.dailyLogs.filter((log) => log.id !== dailyLogId)
  notifyDailyLogsChanged(target.jobId, target.logDate)
}

export async function sendE2EDailyLogEmail() {
  return 'Email sent successfully'
}

export async function ensureE2ETimecardWeek(input: {
  jobId: string
  jobCode: string | null
  jobName: string | null
  ownerForemanUserId: string | null
  ownerForemanName: string | null
  weekEndDate: string
}) {
  const state = requireState()
  state.timecardWeeks ??= []

  const existingWeek = state.timecardWeeks.find((week) => (
    week.jobId === input.jobId
    && week.weekEndDate === input.weekEndDate
    && week.ownerForemanUserId === (input.ownerForemanUserId ?? null)
  ))

  if (existingWeek) {
    return existingWeek.id
  }

  const now = getNowValue().toISOString()
  const weekId = makeId('week')
  state.timecardWeeks.push({
    id: weekId,
    jobId: input.jobId,
    jobCode: input.jobCode,
    jobName: input.jobName,
    ownerForemanUserId: input.ownerForemanUserId ?? null,
    ownerForemanName: input.ownerForemanName ?? null,
    weekStartDate: getWeekStartFromSaturday(input.weekEndDate),
    weekEndDate: input.weekEndDate,
    status: 'draft',
    employeeCardCount: 0,
    submittedAt: null,
    createdAt: now,
    updatedAt: now,
  })

  notifyTimecardsChanged(input.jobId, weekId)
  return weekId
}

export async function createE2ETimecardCard(
  weekId: string,
  weekStartDate: string,
  employee: TimecardEmployeeSeed,
  sortIndex: number,
  linkedJobNumber?: string | null,
) {
  const state = requireState()
  state.timecardCards ??= []
  state.timecardWeeks ??= []

  const week = state.timecardWeeks.find((entry) => entry.id === weekId)
  if (!week) {
    throw new Error('Timecard week not found.')
  }

  const cardId = makeId('timecard-card')
  const card = buildEmployeeCard(
    employee,
    getWeekEndDateFromStart(weekStartDate),
    sortIndex,
    linkedJobNumber ?? '',
  )

  state.timecardCards.push({
    weekId,
    id: cardId,
    ...card,
    createdAt: getNowValue().toISOString(),
    updatedAt: getNowValue().toISOString(),
  })

  const weekIndex = state.timecardWeeks.findIndex((entry) => entry.id === weekId)
  state.timecardWeeks[weekIndex] = {
    ...week,
    employeeCardCount: (week.employeeCardCount ?? 0) + 1,
    updatedAt: getNowValue().toISOString(),
  }

  notifyTimecardsChanged(week.jobId, weekId)
  return cardId
}

export async function updateE2ETimecardCard(
  weekId: string,
  cardId: string,
  weekStartDate: string,
  card: TimecardCardRecord,
  burden = DEFAULT_TIMECARD_BURDEN,
) {
  const state = requireState()
  state.timecardCards ??= []

  const index = state.timecardCards.findIndex((entry) => entry.weekId === weekId && entry.id === cardId)
  if (index === -1) {
    throw new Error('Timecard card not found.')
  }

  const nextCard = cloneValue(card)
  nextCard.fullName = buildCardDisplayName(nextCard)
  recalculateCardTotals(nextCard, weekStartDate, burden)

  state.timecardCards[index] = {
    ...state.timecardCards[index]!,
    ...nextCard,
    weekId,
    updatedAt: getNowValue().toISOString(),
  }

  const weekIndex = state.timecardWeeks?.findIndex((entry) => entry.id === weekId) ?? -1
  if (weekIndex !== -1 && state.timecardWeeks) {
    const week = state.timecardWeeks[weekIndex]!
    state.timecardWeeks[weekIndex] = {
      ...week,
      updatedAt: getNowValue().toISOString(),
    }
    notifyTimecardsChanged(week.jobId, weekId)
  }
}

export async function deleteE2ETimecardCard(weekId: string, cardId: string) {
  const state = requireState()
  const week = state.timecardWeeks?.find((entry) => entry.id === weekId)
  if (!week || !state.timecardCards || !state.timecardWeeks) {
    throw new Error('Timecard week not found.')
  }

  state.timecardCards = state.timecardCards.filter((entry) => !(entry.weekId === weekId && entry.id === cardId))
  const weekIndex = state.timecardWeeks.findIndex((entry) => entry.id === weekId)
  state.timecardWeeks[weekIndex] = {
    ...week,
    employeeCardCount: Math.max(0, (week.employeeCardCount ?? 0) - 1),
    updatedAt: getNowValue().toISOString(),
  }

  notifyTimecardsChanged(week.jobId, weekId)
}

export async function submitE2ETimecardWeek(
  weekId: string,
  actor?: { userId: string | null; displayName: string | null },
) {
  const state = requireState()
  const weekIndex = state.timecardWeeks?.findIndex((entry) => entry.id === weekId) ?? -1
  if (weekIndex === -1 || !state.timecardWeeks) {
    throw new Error('Timecard week not found.')
  }

  const week = state.timecardWeeks[weekIndex]!
  const now = getNowValue().toISOString()
  state.timecardWeeks[weekIndex] = {
    ...week,
    status: 'submitted',
    submittedAt: now,
    updatedAt: now,
  }

  if (actor?.displayName && !week.ownerForemanName) {
    state.timecardWeeks[weekIndex]!.ownerForemanName = actor.displayName
  }

  notifyTimecardsChanged(week.jobId, weekId)

  return {
    success: true,
    emailSent: true,
    emailMessage: 'Week submitted and emailed to 1 recipient.',
  }
}
