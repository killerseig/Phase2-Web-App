import type { JobType } from '@/types/models'

export const JOB_TYPE_OPTIONS = [
  { value: 'paint', label: 'Paint' },
  { value: 'acoustics', label: 'Acoustics' },
  { value: 'drywall', label: 'Drywall' },
  { value: 'small-jobs', label: 'Small Jobs' },
] as const satisfies readonly { value: JobType; label: string }[]

export function isSelectableJobType(value: string | null | undefined): value is JobType {
  return JOB_TYPE_OPTIONS.some((option) => option.value === value)
}
