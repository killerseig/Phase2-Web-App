export declare const DOCUMENT_MIME: {
    readonly pdf: "application/pdf";
    readonly jpg: "image/jpeg";
    readonly jpeg: "image/jpeg";
    readonly png: "image/png";
    readonly webp: "image/webp";
    readonly txt: "text/plain";
    readonly csv: "text/csv";
    readonly docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    readonly xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
};
export type DocumentExtension = keyof typeof DOCUMENT_MIME;
export declare function documentExtension(value: unknown): DocumentExtension;
export declare function printable(extension?: string): boolean;
export declare function validateDocument(bytes: Buffer, extension: DocumentExtension): Promise<{
    pageCount: number;
}>;
export declare function imageToPdf(bytes: Buffer): Promise<Uint8Array<ArrayBufferLike>>;
//# sourceMappingURL=documentFormats.d.ts.map