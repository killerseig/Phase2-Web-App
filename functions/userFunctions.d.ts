import { type DocumentData } from 'firebase-admin/firestore';
import { sendEmail } from './emailService';
declare function createSetupTokenRecord(): {
    setupToken: string;
    setupTokenExpiry: Date;
};
interface UserInviteStateTransition<TResult> {
    update?: DocumentData;
    result: TResult;
}
interface UserInviteStateStore {
    transact: <TResult>(uid: string, transition: (current: DocumentData) => UserInviteStateTransition<TResult>) => Promise<TResult>;
}
interface SendUserInviteDependencies {
    createDeliveryId: () => string;
    createTokenRecord: () => ReturnType<typeof createSetupTokenRecord>;
    deleteField: () => unknown;
    deliverEmail: typeof sendEmail;
    now: () => Date;
    serverTimestamp: () => unknown;
    stateStore: UserInviteStateStore;
}
export declare function sendUserInvite(options: {
    uid: string;
    email: string;
    firstName: string;
    sentByUid?: string | null;
}, dependencies?: SendUserInviteDependencies): Promise<void>;
interface AdminUserEmailActionRequest {
    auth?: {
        uid?: string;
    } | null;
    data?: {
        uid?: unknown;
    } | null;
}
interface AdminUserEmailActionDependencies {
    verifyAdminRole: (uid: string) => Promise<unknown>;
    isEmailEnabled: () => boolean;
    getUserProfile: (uid: string) => Promise<DocumentData | null>;
    getAuthUser: (uid: string) => Promise<{
        email?: string | null;
        displayName?: string | null;
    }>;
    sendInvite: (options: {
        uid: string;
        email: string;
        firstName: string;
        sentByUid?: string | null;
    }) => Promise<void>;
    sendPasswordReset: (options: {
        email: string;
        displayName: string;
    }) => Promise<void>;
}
export declare function handleResendUserInviteByAdmin(request: AdminUserEmailActionRequest, dependencies?: AdminUserEmailActionDependencies): Promise<{
    success: boolean;
    email: string;
    message: string;
}>;
export declare function handleSendUserPasswordResetByAdmin(request: AdminUserEmailActionRequest, dependencies?: AdminUserEmailActionDependencies): Promise<{
    success: boolean;
    email: string;
    message: string;
}>;
export declare const resendUserInviteByAdmin: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    email: string;
    message: string;
}>, unknown>;
export declare const sendUserPasswordResetByAdmin: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    email: string;
    message: string;
}>, unknown>;
export declare const removeEmailFromAllRecipientLists: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
    removedFromRecipientLists: boolean;
    updatedJobCount: number;
}>, unknown>;
export declare const listAssignableFieldUsers: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    users: {
        id: string;
        email: string | null;
        firstName: string | null;
        lastName: string | null;
        role: "admin" | "payroll" | "shop-foreman" | "project-manager" | "foreman" | "none";
        active: boolean;
        assignedJobIds: string[];
        inviteStatus: string | null;
        inviteSentAt: any;
    }[];
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
export {};
//# sourceMappingURL=userFunctions.d.ts.map