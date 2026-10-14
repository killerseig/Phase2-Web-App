import type { HttpsFunction } from 'firebase-functions/v2/https';
/** Preserve the deployed callable endpoint and its POST validation while adding
 * a read-only HTML/JSON handler for ordinary browser requests. */
export declare function withPublicHtmlReader<T extends HttpsFunction>(callable: T, reader: HttpsFunction): T;
//# sourceMappingURL=publicReaderCompatibility.d.ts.map