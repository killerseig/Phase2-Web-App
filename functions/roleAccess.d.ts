import { type UserRole } from './constants';
export type CurrentFunctionRole = UserRole;
export interface FunctionUserRoleProfile {
    role?: unknown;
    active?: unknown;
    assignedJobIds?: unknown;
    firstName?: unknown;
    lastName?: unknown;
    email?: unknown;
}
export interface CurrentFunctionUser {
    uid: string;
    role: CurrentFunctionRole;
    active: boolean;
    assignedJobIds: string[];
    displayName: string | null;
}
export declare function isValidStoredRole(value: unknown): value is UserRole;
export declare function normalizeStoredRole(value: unknown): UserRole;
export declare function getCurrentFunctionRole(value: unknown): CurrentFunctionRole;
export declare function getFunctionAssignedJobIds(user: FunctionUserRoleProfile): string[];
export declare function getFunctionDisplayName(user: FunctionUserRoleProfile): string | null;
export declare function buildCurrentFunctionUser(uid: string, user: FunctionUserRoleProfile): CurrentFunctionUser;
export declare function currentFunctionUserHasAnyRole(user: CurrentFunctionUser, roles: readonly CurrentFunctionRole[]): boolean;
export declare function currentFunctionUserCanAccessAssignedJob(user: CurrentFunctionUser, jobId: unknown): boolean;
export declare function canSendInviteForStoredRole(value: unknown): boolean;
//# sourceMappingURL=roleAccess.d.ts.map