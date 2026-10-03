import type { UserRole } from './constants';
export type SharedDashboardScope = 'job' | 'role';
export type SharedDashboardWidgetType = 'workflows' | 'text' | 'jobs' | 'dates' | 'notes' | 'documents' | 'resources' | 'form';
export interface SharedDashboardWidget {
    id: string;
    type: SharedDashboardWidgetType;
    span: 4 | 6 | 8 | 12;
    title: string;
    text: string;
    textStyle?: {
        size: number;
        color: string;
        weight: number;
        align: 'left' | 'center' | 'right';
        lineHeight: number;
    };
    form?: {
        templateId: string;
        version: number;
        presentation: 'inline' | 'launcher';
    };
}
export declare const sharedWidgetLabels: Record<SharedDashboardWidgetType, string>;
export declare function sharedWidgetTypes(scope: SharedDashboardScope): SharedDashboardWidgetType[];
export declare function defaultSharedWidgets(scope: SharedDashboardScope): SharedDashboardWidget[];
export declare function sharedDashboardKey(scope: SharedDashboardScope, role: UserRole): string;
export declare function validateSharedWidgets(value: unknown, scope: SharedDashboardScope): SharedDashboardWidget[];
export interface SharedCalendarEntry {
    id: string;
    title: string;
    date: string;
}
export declare function validateSharedCalendar(value: unknown): SharedCalendarEntry[];
//# sourceMappingURL=sharedDashboardModel.d.ts.map