/**
 * Firestore Service
 * Reusable queries and data fetching functions
 */
export interface JobDetails {
    id: string;
    name: string;
    number: string;
}
export interface UserProfile {
    uid: string;
    email: string;
    firstName: string;
    lastName: string;
    displayName?: string;
    role: string;
    active: boolean;
}
/**
 * Get job details by ID
 */
export declare function getJobDetails(jobId: string): Promise<JobDetails | null>;
/**
 * Get user profile from Firestore
 */
export declare function getUserProfile(uid: string): Promise<UserProfile | null>;
/**
 * Get formatted user display name (firstName lastName or displayName)
 */
export declare function getUserDisplayName(uid: string, fallback?: string): Promise<string>;
/**
 * Verify that a user is an admin
 * Throws error if not an admin
 */
export declare function verifyAdminRole(uid: string): Promise<void>;
/**
 * Get daily log by ID
 */
export declare function getDailyLog(jobId: string, dailyLogId: string): Promise<any>;
/**
 * Get timecard by path
 */
export declare function getTimecard(jobId: string, weekStart: string, timecardId: string): Promise<any>;
/**
 * Get shop order by ID
 */
export declare function getShopOrder(shopOrderId: string): Promise<any>;
//# sourceMappingURL=firestoreService.d.ts.map