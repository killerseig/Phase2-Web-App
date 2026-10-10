import { type FormRecord } from './formModel';
export interface FormPhotoPreview {
    fieldId: string;
    position: number;
    contentId: string;
    groupId?: string;
    instanceId?: string;
}
export declare function buildFormEmailHtml(record: FormRecord, previews?: FormPhotoPreview[], url?: string): string;
export declare function buildFormEmailText(record: FormRecord, url?: string): string;
//# sourceMappingURL=formEmailRender.d.ts.map