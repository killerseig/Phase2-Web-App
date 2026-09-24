export interface DashboardWidget {
    id: string;
    type: 'documents' | 'resources' | 'notes' | 'shortcuts';
    span: 4 | 6 | 8 | 12;
    title: string;
    text: string;
}
export declare function validateDashboardWidgets(value: unknown): DashboardWidget[];
export declare const dashboardWorkspace: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    version: any;
    canEdit: boolean;
    widgets: any;
}>, unknown>;
//# sourceMappingURL=dashboardFunctions.d.ts.map