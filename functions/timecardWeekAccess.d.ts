import type { JobDetails } from './firestoreService';
import type { CurrentFunctionUser } from './roleAccess';
export { isFunctionShopJob } from './jobIdentity';
export declare function canCreateTimecardWeekForJob(user: CurrentFunctionUser, jobId: string, job: Pick<JobDetails, 'assignedForemanIds' | 'name' | 'number'> | null | undefined): boolean;
//# sourceMappingURL=timecardWeekAccess.d.ts.map