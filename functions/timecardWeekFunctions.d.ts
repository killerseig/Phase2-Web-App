interface SubmitTimecardWeekResponse {
    success: boolean;
    emailSent: boolean;
    emailMessage: string;
}
export declare const ensureTimecardWeekRecord: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    id: string;
}>, unknown>;
export declare const createTimecardCardRecord: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    id: string;
}>, unknown>;
export declare const updateTimecardCardRecord: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
}>, unknown>;
export declare const deleteTimecardCardRecord: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
}>, unknown>;
export declare const deleteTimecardWeekRecord: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
}>, unknown>;
export declare const submitTimecardWeekRecord: import("firebase-functions/v2/https").CallableFunction<any, Promise<SubmitTimecardWeekResponse>, unknown>;
export {};
//# sourceMappingURL=timecardWeekFunctions.d.ts.map