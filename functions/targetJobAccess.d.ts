import { type TargetFunctionRoleKey } from './targetRoleCapabilities';
export interface TargetFunctionJobAccessInput {
    assignedJobIds?: readonly string[] | null;
    isShopJob?: boolean;
    jobId: string;
    role: TargetFunctionRoleKey;
}
export declare function targetFunctionRoleCanCreateJobs(role: TargetFunctionRoleKey): boolean;
export declare function targetFunctionRoleCanDeleteOrArchiveJobs(role: TargetFunctionRoleKey): boolean;
export declare function targetFunctionRoleCanSeeJobListEntry(input: TargetFunctionJobAccessInput): boolean;
export declare function targetFunctionRoleCanOpenJobDashboard(input: TargetFunctionJobAccessInput): boolean;
export declare function targetFunctionRoleCanEditJobSetup(input: TargetFunctionJobAccessInput): boolean;
//# sourceMappingURL=targetJobAccess.d.ts.map