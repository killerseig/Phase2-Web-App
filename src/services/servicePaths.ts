export const JOBS_COLLECTION = 'jobs' as const

export const jobCollectionPath = (jobId: string, collectionName: string) =>
  [JOBS_COLLECTION, jobId, collectionName] as const

export const jobDocumentPath = (jobId: string, collectionName: string, docId: string) =>
  [JOBS_COLLECTION, jobId, collectionName, docId] as const
