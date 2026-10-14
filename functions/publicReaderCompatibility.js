"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withPublicHtmlReader = withPublicHtmlReader;
/** Preserve the deployed callable endpoint and its POST validation while adding
 * a read-only HTML/JSON handler for ordinary browser requests. */
function withPublicHtmlReader(callable, reader) {
    const handler = ((request, response) => request.method === 'POST'
        ? callable(request, response)
        : reader(request, response));
    // Copy Firebase deployment metadata, including non-enumerable trigger getters.
    for (const key of Reflect.ownKeys(callable)) {
        if (['name', 'length', 'prototype', 'arguments', 'caller'].includes(String(key)))
            continue;
        Object.defineProperty(handler, key, Object.getOwnPropertyDescriptor(callable, key));
    }
    return handler;
}
//# sourceMappingURL=publicReaderCompatibility.js.map