export declare const removeEmailFromAllRecipientLists: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    removedFromRecipientLists: boolean;
    updatedJobCount: number;
}>, unknown>;
export declare const handleUserAccessRevocationCleanup: import("firebase-functions/core").CloudFunction<import("firebase-functions/v2/firestore").FirestoreEvent<import("firebase-functions/v2/firestore").Change<import("firebase-functions/v2/firestore").QueryDocumentSnapshot> | undefined, {
    uid: string;
}>>;
export declare const deleteUser: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    removedFromRecipientLists: boolean;
    updatedJobCount: number;
}>, unknown>;
export declare const createUserByAdmin: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    uid: string;
}>, unknown>;
export declare const sendPendingUserInvites: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    sentCount: number;
    skippedCount: number;
    message: string;
}>, unknown>;
export declare const verifySetupToken: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    email: any;
    message: string;
}>, unknown>;
export declare const requestPasswordResetEmail: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
export declare const setUserPassword: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
//# sourceMappingURL=userFunctions.d.ts.map