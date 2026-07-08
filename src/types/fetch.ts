/**
 * Simple wrapper for fetch json response.
 * global augmentation makes Response.json take a type argument and this is the default wrapper.
 */
export type FetchResponse<T> = { data: T };
