/**
 * Send password reset email using Firebase Admin SDK
 * Works without authentication via HTTP callable
 */
export declare const sendPasswordResetEmail: import("firebase-functions/v2/https").HttpsFunction;
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
 * Send Shop Order via email
 */
export declare const sendShopOrderEmail: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
/**
 * Delete a user from both Firestore and Firebase Authentication
 * Only callable by authenticated admin users
 */
export declare const deleteUser: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
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