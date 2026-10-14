import type { HttpsFunction } from 'firebase-functions/v2/https'

/** Preserve the deployed callable endpoint and its POST validation while adding
 * a read-only HTML/JSON handler for ordinary browser requests. */
export function withPublicHtmlReader<T extends HttpsFunction>(callable: T, reader: HttpsFunction): T {
  const handler = ((request, response) => request.method === 'POST'
    ? callable(request, response)
    : reader(request, response)) as T
  // Copy Firebase deployment metadata, including non-enumerable trigger getters.
  for (const key of Reflect.ownKeys(callable)) {
    if (['name', 'length', 'prototype', 'arguments', 'caller'].includes(String(key))) continue
    Object.defineProperty(handler, key, Object.getOwnPropertyDescriptor(callable, key)!)
  }
  return handler
}
