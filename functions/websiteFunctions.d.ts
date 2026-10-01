import { type WebsiteSite } from './websiteModel';
export declare const websiteBuilder: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    publishedAt: any;
    changes: import("./websiteChanges").WebsiteChange[];
    total: number;
} | {
    version: any;
    draft: WebsiteSite;
    savedAt: number;
    publishedAt?: undefined;
    hasPrevious?: undefined;
} | {
    version: any;
    savedAt: number;
    draft?: undefined;
    publishedAt?: undefined;
    hasPrevious?: undefined;
} | {
    version: any;
    publishedAt: null;
    hasPrevious: boolean;
    draft?: undefined;
    savedAt?: undefined;
} | {
    version: any;
    publishedAt: number;
    hasPrevious: boolean;
    draft?: undefined;
    savedAt?: undefined;
} | {
    draft: any;
    activity?: undefined;
    revisions?: undefined;
    images?: undefined;
    nextCursor?: undefined;
    id?: undefined;
    base64?: undefined;
    version?: undefined;
    publishedAt?: undefined;
    hasPrevious?: undefined;
    savedAt?: undefined;
} | {
    activity: {
        id: string;
    }[];
    revisions: {
        id: string;
        version: any;
        savedAt: any;
        name: any;
        savedBy: any;
        action: any;
    }[];
    draft?: undefined;
    images?: undefined;
    nextCursor?: undefined;
    id?: undefined;
    base64?: undefined;
    version?: undefined;
    publishedAt?: undefined;
    hasPrevious?: undefined;
    savedAt?: undefined;
} | {
    images: {
        id: string;
        name: any;
        size: any;
        createdAt: any;
    }[];
    nextCursor: string | null;
    draft?: undefined;
    activity?: undefined;
    revisions?: undefined;
    id?: undefined;
    base64?: undefined;
    version?: undefined;
    publishedAt?: undefined;
    hasPrevious?: undefined;
    savedAt?: undefined;
} | {
    id: any;
    base64: string;
    draft?: undefined;
    activity?: undefined;
    revisions?: undefined;
    images?: undefined;
    nextCursor?: undefined;
    version?: undefined;
    publishedAt?: undefined;
    hasPrevious?: undefined;
    savedAt?: undefined;
} | {
    version: any;
    draft: any;
    publishedAt: any;
    hasPrevious: boolean;
    savedAt: any;
    activity?: undefined;
    revisions?: undefined;
    images?: undefined;
    nextCursor?: undefined;
    id?: undefined;
    base64?: undefined;
}>, unknown>;
export declare const getPublishedWebsite: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    site: WebsiteSite;
}>, unknown>;
export declare const websiteImage: import("firebase-functions/v2/https").HttpsFunction;
//# sourceMappingURL=websiteFunctions.d.ts.map