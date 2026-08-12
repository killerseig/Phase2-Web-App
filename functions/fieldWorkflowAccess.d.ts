import type { JobDetails } from './firestoreService';
import type { CurrentFunctionUser } from './roleAccess';
export type FieldWorkflowWriteAction = 'create' | 'edit-draft' | 'submit';
export declare function canWriteFieldWorkflowForJob(user: CurrentFunctionUser, jobId: string, job: Pick<JobDetails, 'assignedForemanIds' | 'name' | 'number'> | null | undefined, action: FieldWorkflowWriteAction): boolean;
//# sourceMappingURL=fieldWorkflowAccess.d.ts.map