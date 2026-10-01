import { type FormRecord } from './formModel';
export interface FormEmailAdapter {
    enabled: () => boolean;
    send: (record: FormRecord, recipients: string[]) => Promise<void>;
}
export declare function deliverFormSubmission(id: string, retry?: boolean, adapter?: FormEmailAdapter): Promise<void>;
export declare const formEmail: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    emailStatus: any;
}>, unknown>;
export declare const deliverFormEmail: import("firebase-functions/core").CloudFunction<import("firebase-functions/v2/firestore").FirestoreEvent<import("firebase-functions/v2/firestore").QueryDocumentSnapshot | undefined, {
    id: string;
}>>;
//# sourceMappingURL=formDelivery.d.ts.map