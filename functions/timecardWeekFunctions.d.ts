import { type DocumentReference, type DocumentSnapshot, type Transaction } from 'firebase-admin/firestore';
import { buildSubmittedEmailStatusUpdate } from './emailStatus';
import { getJobDetails } from './firestoreService';
import { claimSubmittedEmailOperation } from './submittedEmailOperations';
import { type CurrentFunctionUser } from './roleAccess';
interface SubmitTimecardWeekResponse {
    success: boolean;
    emailSent: boolean;
    emailMessage: string;
}
export interface TimecardRequiredFieldIssue {
    cardId: string;
    employeeName: string;
    lineNumber: number;
    missingFields: string[];
}
interface CallableRequestLike {
    auth?: {
        uid: string;
    } | null;
    data?: any;
}
export declare function findTimecardRequiredFieldIssues(value: unknown): TimecardRequiredFieldIssue[];
export declare function buildTimecardRequiredFieldsMessage(issues: TimecardRequiredFieldIssue[]): string;
declare function getAuthorizedUser(uid: string): Promise<CurrentFunctionUser>;
declare function getWeekDoc(weekId: string): Promise<{
    weekRef: DocumentReference<FirebaseFirestore.DocumentData, FirebaseFirestore.DocumentData>;
    weekSnap: DocumentSnapshot<FirebaseFirestore.DocumentData, FirebaseFirestore.DocumentData>;
    week: FirebaseFirestore.DocumentData;
    jobId: string;
}>;
declare function listWeekCards(weekId: string): Promise<any[]>;
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
interface ReopenTimecardWeekDependencies {
    getWeekDoc: typeof getWeekDoc;
    getAuthorizedUser: typeof getAuthorizedUser;
    runTransaction<T>(updateFunction: (transaction: Transaction) => Promise<T>): Promise<T>;
}
export declare function handleReopenTimecardWeekRecord(request: CallableRequestLike, deps?: ReopenTimecardWeekDependencies): Promise<{
    success: boolean;
    reopened: boolean;
}>;
export declare const reopenTimecardWeekRecord: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    reopened: boolean;
}>, unknown>;
interface SubmitTimecardWeekDependencies {
    getWeekDoc: typeof getWeekDoc;
    getAuthorizedUser: typeof getAuthorizedUser;
    getJobDetails: typeof getJobDetails;
    listWeekCards: typeof listWeekCards;
    claimSubmittedEmailOperation: typeof claimSubmittedEmailOperation;
    sendSubmittedWeekEmail: typeof sendSubmittedWeekEmail;
    buildSubmittedEmailStatusUpdate: typeof buildSubmittedEmailStatusUpdate;
}
export declare function handleSubmitTimecardWeekRecord(request: CallableRequestLike, deps?: SubmitTimecardWeekDependencies): Promise<SubmitTimecardWeekResponse>;
export declare const submitTimecardWeekRecord: import("firebase-functions/v2/https").CallableFunction<any, Promise<SubmitTimecardWeekResponse>, unknown>;
export {};
//# sourceMappingURL=timecardWeekFunctions.d.ts.map