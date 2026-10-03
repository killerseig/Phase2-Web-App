import { type FormRecord, type FormVersion } from './formModel';
export declare const formTemplates: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    id: string;
    latestVersion?: undefined;
    revision?: undefined;
    archived?: undefined;
} | {
    draft: import("./formModel").FormDefinition;
    revision: any;
    latestVersion: any;
    archived: boolean;
    used: any;
    updatedAt: number;
    id: string;
} | {
    id: string;
    latestVersion: any;
    revision: any;
    archived?: undefined;
} | {
    archived: boolean;
    id?: undefined;
    latestVersion?: undefined;
    revision?: undefined;
} | {
    templates: ({
        definition?: FormVersion | undefined;
        id: string;
        latestVersion?: undefined;
    } | {
        id: string;
        definition: FormVersion;
        latestVersion: any;
    })[];
}>, unknown>;
export declare const formWorkspace: import("firebase-functions/v2/https").CallableFunction<any, Promise<FormRecord | {
    records: (FormRecord | undefined)[];
    base64?: undefined;
    contentType?: undefined;
} | {
    base64: string;
    contentType: string;
    records?: undefined;
}>, unknown>;
//# sourceMappingURL=formFunctions.d.ts.map