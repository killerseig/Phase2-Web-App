export declare const sendNewJobNotification: import("firebase-functions/core").CloudFunction<import("firebase-functions/v2/firestore").FirestoreEvent<import("firebase-functions/v2/firestore").QueryDocumentSnapshot | undefined, {
    jobId: string;
}>>;
export declare const sendFieldUserAssignmentNotification: import("firebase-functions/core").CloudFunction<import("firebase-functions/v2/firestore").FirestoreEvent<import("firebase-functions/v2/firestore").Change<import("firebase-functions/v2/firestore").QueryDocumentSnapshot> | undefined, {
    jobId: string;
}>>;
//# sourceMappingURL=jobNotificationFunctions.d.ts.map