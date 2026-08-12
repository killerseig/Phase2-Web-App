export type TargetFunctionRoleKey = 'admin' | 'payroll' | 'shop-foreman' | 'project-manager' | 'foreman' | 'none';
export interface TargetFunctionRoleCapabilities {
    accessWorkspace: boolean;
    createJobs: boolean;
    deleteOrArchiveJobs: boolean;
    deleteDraftTimecardWeeks: boolean;
    editAllJobs: boolean;
    editAssignedFieldWorkflows: boolean;
    editAssignedTimecards: boolean;
    editAssignedJobs: boolean;
    editShopJobFieldWorkflows: boolean;
    editShopJobTimecards: boolean;
    lockTimecards: boolean;
    manageEmployees: boolean;
    manageReferenceLists: boolean;
    manageShopCatalog: boolean;
    manageUsers: boolean;
    receiveAssignedJobFieldEmails: boolean;
    receiveShopJobFieldEmails: boolean;
    useAssignedJobDashboards: boolean;
    useShopJobDashboard: boolean;
    useTimecardExport: boolean;
    viewAllJobs: boolean;
    viewSubmittedAssignedTimecards: boolean;
}
export declare const TARGET_FUNCTION_BUILT_IN_ROLE_KEYS: readonly ["admin", "payroll", "shop-foreman", "project-manager", "foreman"];
export declare const TARGET_FUNCTION_ROLE_CAPABILITIES: Readonly<Record<TargetFunctionRoleKey, TargetFunctionRoleCapabilities>>;
export declare function isTargetFunctionRoleKey(value: unknown): value is TargetFunctionRoleKey;
export declare function normalizeTargetFunctionRoleKey(value: unknown): TargetFunctionRoleKey;
export declare function getTargetFunctionRoleCapabilities(role: TargetFunctionRoleKey): TargetFunctionRoleCapabilities;
export declare function targetFunctionRoleCanBeAssignedJobs(role: TargetFunctionRoleKey): boolean;
//# sourceMappingURL=targetRoleCapabilities.d.ts.map