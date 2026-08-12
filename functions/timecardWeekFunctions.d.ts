import * as admin from 'firebase-admin';
import { buildSubmittedEmailStatusUpdate } from './emailStatus';
import { getJobDetails } from './firestoreService';
import { claimSubmittedEmailOperation } from './submittedEmailOperations';
import { type CurrentFunctionUser } from './roleAccess';
interface SubmitTimecardWeekResponse {
    success: boolean;
    emailSent: boolean;
    emailMessage: string;
}
interface CallableRequestLike {
    auth?: {
        uid: string;
    } | null;
    data?: any;
}
declare function getAuthorizedUser(uid: string): Promise<CurrentFunctionUser>;
declare function getWeekDoc(weekId: string): Promise<{
    weekRef: admin.firestore.DocumentReference<admin.firestore.DocumentData, admin.firestore.DocumentData>;
    weekSnap: admin.firestore.DocumentSnapshot<admin.firestore.DocumentData, admin.firestore.DocumentData>;
    week: admin.firestore.DocumentData;
    jobId: string;
}>;
export declare const listTimecardWeeksForCurrentUser: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    weeks: any[];
}>, unknown>;
export declare const listTimecardCardsForCurrentUser: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    cards: any[];
}>, unknown>;
declare function sendSubmittedWeekEmail(weekId: string, week: any, jobId: string, submittedByName: string | null): Promise<SubmitTimecardWeekResponse>;
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
export declare const reopenTimecardWeekRecord: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
}>, unknown>;
interface SubmitTimecardWeekDependencies {
    getWeekDoc: typeof getWeekDoc;
    getAuthorizedUser: typeof getAuthorizedUser;
    getJobDetails: typeof getJobDetails;
    claimSubmittedEmailOperation: typeof claimSubmittedEmailOperation;
    sendSubmittedWeekEmail: typeof sendSubmittedWeekEmail;
    buildSubmittedEmailStatusUpdate: typeof buildSubmittedEmailStatusUpdate;
}
export declare function handleSubmitTimecardWeekRecord(request: CallableRequestLike, deps?: SubmitTimecardWeekDependencies): Promise<SubmitTimecardWeekResponse>;
export declare const submitTimecardWeekRecord: import("firebase-functions/v2/https").CallableFunction<any, Promise<SubmitTimecardWeekResponse>, unknown>;
export {};
//# sourceMappingURL=timecardWeekFunctions.d.ts.map