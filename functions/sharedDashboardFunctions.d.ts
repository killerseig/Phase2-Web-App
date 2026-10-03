import { type SharedDashboardScope } from './sharedDashboardModel';
export declare const sharedDashboardWorkspace: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    version: number;
    notes: {};
    events: any;
    scope?: undefined;
    role?: undefined;
    widgets?: undefined;
    canEdit?: undefined;
    allowRoleEditing?: undefined;
    job?: undefined;
    notesVersion?: undefined;
} | {
    version: number;
    notes: {
        [k: string]: unknown;
    };
    events: import("./sharedDashboardModel").SharedCalendarEntry[];
    scope?: undefined;
    role?: undefined;
    widgets?: undefined;
    canEdit?: undefined;
    allowRoleEditing?: undefined;
    job?: undefined;
    notesVersion?: undefined;
} | {
    scope: SharedDashboardScope;
    role: "admin" | "payroll" | "shop-foreman" | "project-manager" | "foreman" | "none";
    widgets: any;
    version: number;
    canEdit: boolean;
    allowRoleEditing: any;
    job: {
        id: string;
        name: string;
        code: string;
        gc: string;
        jobAddress: string;
        startDate: string;
        finishDate: string;
        active: boolean;
    } | null;
    notes: {
        [k: string]: unknown;
    };
    events: any;
    notesVersion: number;
}>, unknown>;
//# sourceMappingURL=sharedDashboardFunctions.d.ts.map