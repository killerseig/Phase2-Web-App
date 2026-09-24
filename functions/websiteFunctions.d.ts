import { type WebsiteSite } from './websiteModel';
export declare const websiteBuilder: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
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
    revisions: {
        id: string;
        version: any;
        savedAt: any;
        name: any;
    }[];
    images?: undefined;
    nextCursor?: undefined;
    id?: undefined;
    base64?: undefined;
    version?: undefined;
    draft?: undefined;
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
    revisions?: undefined;
    id?: undefined;
    base64?: undefined;
    version?: undefined;
    draft?: undefined;
    publishedAt?: undefined;
    hasPrevious?: undefined;
    savedAt?: undefined;
} | {
    id: any;
    base64: string;
    revisions?: undefined;
    images?: undefined;
    nextCursor?: undefined;
    version?: undefined;
    draft?: undefined;
    publishedAt?: undefined;
    hasPrevious?: undefined;
    savedAt?: undefined;
} | {
    version: any;
    draft: any;
    publishedAt: any;
    hasPrevious: boolean;
    savedAt: any;
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