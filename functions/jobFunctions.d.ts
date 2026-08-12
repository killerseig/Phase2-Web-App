interface VisibleJobRecord {
    id: string;
    name: string;
    code: string | null;
    gc: string | null;
    type: string;
    projectManager: string | null;
    foreman: string | null;
    jobAddress: string | null;
    startDate: string | null;
    finishDate: string | null;
    productionBurden: number | null;
    active: boolean;
    assignedForemanIds: string[];
    timecardStatus: string | null;
    timecardPeriodEndDate: string | null;
    notificationRecipients: {
        dailyLogs: string[];
        timecards: string[];
        shopOrders: string[];
    };
    adminDailyLogRecipients: string[];
    dailyLogRecipients: string[];
}
export declare const listVisibleJobsForCurrentUser: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    jobs: VisibleJobRecord[];
}>, unknown>;
export declare const getVisibleJobForCurrentUser: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    job: null;
} | {
    job: VisibleJobRecord;
}>, unknown>;
export declare const createJobRecordCallable: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    id: string;
}>, unknown>;
export declare const updateJobRecordCallable: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
}>, unknown>;
export {};
//# sourceMappingURL=jobFunctions.d.ts.map