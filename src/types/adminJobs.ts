import type { JobType } from '@/types/models'

export type SortDir = 'asc' | 'desc'
export type JobFormType = JobType | ''

export type JobSortKey =
  | 'code'
  | 'name'
  | 'projectManager'
  | 'foreman'
  | 'gc'
  | 'jobAddress'
  | 'startDate'
  | 'finishDate'
  | 'status'
  | 'taxExempt'
  | 'certified'
  | 'cip'
  | 'kjic'

export type JobFormInput = {
  name: string
  code: string
  projectManager: string
  foreman: string
  gc: string
  jobAddress: string
  startDate: string
  finishDate: string
  taxExempt: string
  certified: string
  cip: string
  kjic: string
  productionBurden: string
  type: JobFormType
}

export function createJobForm(): JobFormInput {
  return {
    name: '',
    code: '',
    projectManager: '',
    foreman: '',
    gc: '',
    jobAddress: '',
    startDate: '',
    finishDate: '',
    taxExempt: '',
    certified: '',
    cip: '',
    kjic: '',
    productionBurden: '0.33',
    type: '',
  }
}
