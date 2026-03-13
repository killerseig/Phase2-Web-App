import { makeDaysArray, type TimecardJobUi, type TimecardModel } from './timecardUtils'

type DiffField = 'difH' | 'difP' | 'difC'
type MetricField = 'hours' | 'production' | 'unitCost'

type UseTimecardJobEditingOptions = {
  getWeekStartDate: (timecard: TimecardModel) => string
  recalcTotals: (timecard: TimecardModel) => void
  autoSave: (timecard: TimecardModel) => void
}

export function useTimecardJobEditing(options: UseTimecardJobEditingOptions) {
  const { getWeekStartDate, recalcTotals, autoSave } = options

  const clampHours = (value: number) => {
    if (!Number.isFinite(value)) return 0
    return Math.min(24, Math.max(0, value))
  }

  const toNonNegative = (value: number) => {
    if (!Number.isFinite(value) || Number.isNaN(value)) return 0
    return Math.max(0, value)
  }

  const getJobDay = (job: TimecardJobUi, dayIndex: number) => {
    return job.days?.[dayIndex] ?? null
  }

  const getDayMetric = (job: TimecardJobUi, dayIndex: number, field: MetricField) => {
    const day = getJobDay(job, dayIndex)
    return day?.[field] ?? 0
  }

  const addJobRow = (timecard: TimecardModel) => {
    if (!timecard.jobs) timecard.jobs = []
    timecard.jobs.push({
      jobNumber: '',
      subsectionArea: '',
      area: '',
      account: '',
      acct: '',
      difH: '',
      difP: '',
      difC: '',
      days: makeDaysArray(getWeekStartDate(timecard)),
    })
    recalcTotals(timecard)
    autoSave(timecard)
  }

  const removeJobRow = (timecard: TimecardModel, index: number) => {
    if (timecard.jobs && timecard.jobs.length > 1) {
      timecard.jobs.splice(index, 1)
      recalcTotals(timecard)
      autoSave(timecard)
    }
  }

  const updateJobNumber = (timecard: TimecardModel, index: number, value: string) => {
    const job = timecard.jobs?.[index]
    if (!job) return
    job.jobNumber = value
    autoSave(timecard)
  }

  const updateSubsectionArea = (timecard: TimecardModel, index: number, value: string) => {
    const job = timecard.jobs?.[index]
    if (!job) return
    job.subsectionArea = value
    job.area = value
    autoSave(timecard)
  }

  const updateAccount = (timecard: TimecardModel, index: number, value: string) => {
    const job = timecard.jobs?.[index]
    if (!job) return
    job.account = value
    job.acct = value
    autoSave(timecard)
  }

  const updateDiffValue = (timecard: TimecardModel, index: number, field: DiffField, value: string) => {
    const job = timecard.jobs?.[index]
    if (!job) return
    job[field] = value
    autoSave(timecard)
  }

  const handleHoursInput = (timecard: TimecardModel, jobIndex: number, dayIndex: number, rawValue: number) => {
    const job = timecard.jobs?.[jobIndex]
    const day = job ? getJobDay(job, dayIndex) : null
    if (!day) return
    day.hours = clampHours(rawValue)
    recalcTotals(timecard)
    autoSave(timecard)
  }

  const handleProductionInput = (timecard: TimecardModel, jobIndex: number, dayIndex: number, rawValue: number) => {
    const job = timecard.jobs?.[jobIndex]
    const day = job ? getJobDay(job, dayIndex) : null
    if (!day) return
    day.production = toNonNegative(rawValue)
    recalcTotals(timecard)
    autoSave(timecard)
  }

  const handleUnitCostInput = (timecard: TimecardModel, jobIndex: number, dayIndex: number, rawValue: number) => {
    const job = timecard.jobs?.[jobIndex]
    const day = job ? getJobDay(job, dayIndex) : null
    if (!day) return
    day.unitCost = toNonNegative(rawValue)
    recalcTotals(timecard)
    autoSave(timecard)
  }

  return {
    addJobRow,
    removeJobRow,
    updateJobNumber,
    updateSubsectionArea,
    updateAccount,
    updateDiffValue,
    getJobDay,
    getDayMetric,
    handleHoursInput,
    handleProductionInput,
    handleUnitCostInput,
  }
}
