import type { FormRecord } from './formModel';
import type { FormTranslation } from './formTranslation';
/** Adds an English rendering alongside original submitted results. Original photos/PDF stay intact. */
export declare function formTranslationEmailContent(record: FormRecord, translation: FormTranslation): {
    html: string;
    text: string;
};
//# sourceMappingURL=formTranslationEmail.d.ts.map