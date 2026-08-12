import { type TargetFunctionRoleKey } from './targetRoleCapabilities';
export interface TargetFunctionTimecardAccessInput {
    assignedJobIds?: readonly string[] | null;
    isShopJob?: boolean;
    jobId: string;
    role: TargetFunctionRoleKey;
}
export declare function targetFunctionRoleCanUseTimecardExport(role: TargetFunctionRoleKey): boolean;
export declare function targetFunctionRoleCanLockTimecards(role: TargetFunctionRoleKey): boolean;
export declare function targetFunctionRoleCanDeleteDraftTimecardWeeks(role: TargetFunctionRoleKey): boolean;
export declare function targetFunctionRoleCanUseJobTimecardWorkflow(input: TargetFunctionTimecardAccessInput): boolean;
export declare function targetFunctionRoleCanSubmitJobTimecards(input: TargetFunctionTimecardAccessInput): boolean;
export declare function targetFunctionRoleCanViewSubmittedTimecards(input: TargetFunctionTimecardAccessInput): boolean;
export declare function targetFunctionRoleCanViewSubmittedTimecardReport(input: TargetFunctionTimecardAccessInput): boolean;
//# sourceMappingURL=targetTimecardAccess.d.ts.map