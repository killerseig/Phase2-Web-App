import type { FormRecord } from './formModel';
export interface TranslationSegment {
    key: string;
    original: string;
    translated: string;
}
export interface FormTranslation {
    sourceHash: string;
    target: 'en';
    status: 'ready' | 'disabled' | 'failed' | 'pending';
    provider: 'google-cloud-translation' | 'none';
    createdAt: number;
    revision: number;
    segments: TranslationSegment[];
    correction?: {
        by: string;
        at: number;
    };
}
export interface TranslationAdapter {
    translate: (texts: string[]) => Promise<string[]>;
}
export declare function currentFormTranslation(record: FormRecord, value: unknown): FormTranslation | undefined;
export declare function translationSource(record: FormRecord): {
    sourceHash: string;
    segments: TranslationSegment[];
};
export declare function translateFormRecord(record: FormRecord, adapter?: TranslationAdapter): Promise<FormTranslation>;
/** Output-only projection. The stored submitted record and all field/instance IDs remain untouched. */
export declare function translatedFormProjection(record: FormRecord, translation: FormTranslation): FormRecord;
//# sourceMappingURL=formTranslation.d.ts.map