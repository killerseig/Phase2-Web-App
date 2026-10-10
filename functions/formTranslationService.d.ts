import { type CallableRequest } from 'firebase-functions/v2/https';
import { type FormTranslation, type TranslationAdapter } from './formTranslation';
import type { FormRecord } from './formModel';
export declare const formTranslationEnabled: import("firebase-functions/params").BooleanParam;
export declare const formTranslationProcessingApproved: import("firebase-functions/params").BooleanParam;
export declare const formTranslationApiKey: import("firebase-functions/params").SecretParam;
/** Cloud Translation Basic, explicit provisioning; no Firebase built-in translation. */
export declare function configuredFormTranslationAdapter(): TranslationAdapter | undefined;
export declare function prepareFormTranslation(record: FormRecord, injectedAdapter?: TranslationAdapter, reauthorize?: () => Promise<unknown>): Promise<FormTranslation>;
export declare function formTranslationHandler(request: CallableRequest<{
    id: string;
    action: string;
    revision?: number;
    corrections?: Record<string, string>;
}>, prepare?: (record: FormRecord, reauthorize: () => Promise<unknown>) => Promise<FormTranslation>): Promise<{
    translation: FormTranslation;
}>;
export declare const formTranslation: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    translation: FormTranslation;
}>, unknown>;
//# sourceMappingURL=formTranslationService.d.ts.map