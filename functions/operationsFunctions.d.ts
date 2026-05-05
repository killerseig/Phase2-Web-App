/**
 * Send Daily Log via email
 */
export declare const sendDailyLogEmail: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
/**
 * Send Timecard via email
 */
export declare const sendTimecardEmail: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
/**
 * List filtered weekly timecards across jobs for controller review.
 * Access: admin and controller roles
 */
export declare const listTimecardStaffingEmployees: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    employees: {
        id: string;
        employeeNumber: string;
        firstName: string;
        lastName: string;
        occupation: string;
        active: boolean;
    }[];
}>, unknown>;
export declare const addEmployeeToTimecardRoster: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    action: string;
    rosterEmployeeId: string;
    employee: {
        id: string;
        employeeNumber: string;
        firstName: string;
        lastName: string;
        occupation: string;
        active: boolean;
    };
}>, unknown>;
export declare const getForemanTimecardWorkspace: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    rosterEmployees: {
        id: string;
        employeeNumber: string;
        firstName: string;
        lastName: string;
        occupation: string;
        active: boolean;
    }[];
    timecards: {
        id: string;
        jobId: string;
        weekStartDate: string;
        weekEndingDate: string;
        status: string;
        createdByUid: string;
        submittedAt: null;
        employeeRosterId: string;
        employeeNumber: string;
        employeeName: string;
        firstName: string;
        lastName: string;
        occupation: string;
        employeeWage: null;
        productionBurden: null;
        subcontractedEmployee: boolean;
        regularHoursOverride: any;
        overtimeHoursOverride: any;
        footerJobOrGl: string;
        footerAccount: string;
        footerOffice: string;
        footerAmount: string;
        jobs: any;
        days: any;
        totals: any;
        notes: string;
        archived: boolean;
    }[];
}>, unknown>;
export declare const saveForemanTimecard: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    timecard: {
        id: string;
        jobId: string;
        weekStartDate: string;
        weekEndingDate: string;
        status: string;
        createdByUid: string;
        submittedAt: null;
        employeeRosterId: string;
        employeeNumber: string;
        employeeName: string;
        firstName: string;
        lastName: string;
        occupation: string;
        employeeWage: null;
        productionBurden: null;
        subcontractedEmployee: boolean;
        regularHoursOverride: any;
        overtimeHoursOverride: any;
        footerJobOrGl: string;
        footerAccount: string;
        footerOffice: string;
        footerAmount: string;
        jobs: any;
        days: any;
        totals: any;
        notes: string;
        archived: boolean;
    };
}>, unknown>;
export declare const submitForemanTimecardsForWeek: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    count: number;
    submittedIds: string[];
}>, unknown>;
export declare const listTimecardsForWeek: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    startWeek: string;
    endWeek: string;
    startWeekEnding: string;
    endWeekEnding: string;
    filters: {
        jobId: string;
        trade: string;
        firstName: string;
        lastName: string;
        subcontracted: "all" | "subcontracted" | "direct";
        status: "draft" | "submitted" | "all";
    };
    totalCount: number;
    submittedCount: number;
    draftCount: number;
    totalHours: number;
    totalProduction: number;
    totalLine: number;
    timecards: {
        id: string;
        timecardId: string;
        jobId: string;
        jobName: string;
        jobCode: string;
        createdByUid: string;
        createdByName: string;
        employeeNumber: string;
        employeeName: string;
        firstName: string;
        lastName: string;
        occupation: string;
        status: string;
        weekStart: string;
        weekEnding: string;
        totalHours: number;
        totalProduction: number;
        totalLine: number;
        subcontractedEmployee: boolean;
        submittedAt: string | null;
        submittedAtMs: number | null;
    }[];
}>, unknown>;
/**
 * Download filtered timecards as CSV or PDF.
 * Access: admin and controller roles
 */
export declare const downloadTimecardsForWeek: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    format: string;
    fileName: string;
    contentType: string;
    contentBase64: string;
    weekStart: string;
    weekEnding: string;
    startWeek: string;
    endWeek: string;
    startWeekEnding: string;
    endWeekEnding: string;
    timecardCount: number;
}>, unknown>;
/**
 * Send Shop Order via email
 */
export declare const sendShopOrderEmail: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
//# sourceMappingURL=operationsFunctions.d.ts.map