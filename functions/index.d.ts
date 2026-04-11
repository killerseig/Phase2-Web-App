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
export declare const removeEmailFromAllRecipientLists: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    removedFromRecipientLists: boolean;
    updatedJobCount: number;
}>, unknown>;
export declare const handleUserAccessRevocationCleanup: import("firebase-functions/core").CloudFunction<import("firebase-functions/v2/firestore").FirestoreEvent<import("firebase-functions/v2/firestore").Change<import("firebase-functions/v2/firestore").QueryDocumentSnapshot> | undefined, {
    uid: string;
}>>;
/**
 * Delete a user from both Firestore and Firebase Authentication
 * Only callable by authenticated admin users
 */
export declare const deleteUser: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    removedFromRecipientLists: boolean;
    updatedJobCount: number;
}>, unknown>;
/**
 * Create a new user account (admin-only)
 * Generates password reset link and sends welcome email
 */
export declare const createUserByAdmin: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    uid: string;
}>, unknown>;
/**
 * Verify setup token for new user account
 * Called from the SetPassword page to validate the token before password creation
 * No authentication required - uses token for validation
 */
export declare const verifySetupToken: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    email: any;
    message: string;
}>, unknown>;
/**
 * Set password for new user account using custom setup token
 * Called from the SetPassword page
 */
export declare const setUserPassword: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
/**
 * Scheduled function to notify admins of upcoming secret expiration
 * Runs daily at 9:00 AM UTC
 * Sends notification 30 days before secret expiration (Jan 10, 2027)
 */
export declare const notifySecretExpiration: import("firebase-functions/v2/scheduler").ScheduleFunction;
//# sourceMappingURL=index.d.ts.map