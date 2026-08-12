import { type TargetFunctionRoleKey } from './targetRoleCapabilities';
export interface TargetFunctionFieldWorkflowAccessInput {
    assignedJobIds?: readonly string[] | null;
    isShopJob?: boolean;
    jobId: string;
    role: TargetFunctionRoleKey;
}
export declare function targetFunctionRoleCanOpenFieldWorkflow(input: TargetFunctionFieldWorkflowAccessInput): boolean;
export declare function targetFunctionRoleCanViewSubmittedFieldWorkflow(input: TargetFunctionFieldWorkflowAccessInput): boolean;
export declare function targetFunctionRoleCanCreateFieldWorkflow(input: TargetFunctionFieldWorkflowAccessInput): boolean;
export declare function targetFunctionRoleCanEditFieldWorkflowDraft(input: TargetFunctionFieldWorkflowAccessInput): boolean;
export declare function targetFunctionRoleCanSubmitFieldWorkflow(input: TargetFunctionFieldWorkflowAccessInput): boolean;
//# sourceMappingURL=targetFieldWorkflowAccess.d.ts.map