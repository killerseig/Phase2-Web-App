export const dashboardTextVariables = {
  'job.name': 'Job name',
  'job.code': 'Job number',
  'job.gc': 'General contractor',
  'job.jobAddress': 'Job address',
  'job.startDate': 'Job start date',
  'job.finishDate': 'Job finish date',
  'user.name': 'Your name',
  'user.role': 'Your role',
} as const
export interface DashboardTextContext {
  job?: Record<string, unknown> | null
  user: { name: string; role: string }
}
export function resolveDashboardText(value: string, context: DashboardTextContext) {
  const unavailable: string[] = [],
    unknown: string[] = []
  const text = value.replace(/\{\{([^{}]*)\}\}/g, (_match: string, input: string) => {
    const key = input.trim()
    if (!Object.prototype.hasOwnProperty.call(dashboardTextVariables, key)) {
      unknown.push(key)
      return '[Unknown variable: ' + key + ']'
    }
    const [owner, field] = key.split('.')
    const record: Record<string, unknown> | null | undefined =
      owner === 'job' ? context.job : context.user
    const resolved = record?.[field!]
    if (typeof resolved !== 'string' || !resolved.trim()) {
      unavailable.push(key)
      return '[Not available: ' + key + ']'
    }
    return resolved
  })
  return { text, unavailable: [...new Set(unavailable)], unknown: [...new Set(unknown)] }
}
