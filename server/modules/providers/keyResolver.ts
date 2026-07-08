export type KeySource = 'param' | 'db' | 'env' | 'none';

export interface ResolvedKey {
  key: string | undefined;
  source: KeySource;
}

/**
 * Resolves the best available API key by priority:
 *   explicit param → DB saved key → env/config key → none
 *
 * Empty strings are treated as absent.
 */
export function resolveApiKey(
  explicit: string | undefined,
  dbKey: string | null | undefined,
  envKey: string | undefined
): ResolvedKey {
  if (explicit) return { key: explicit, source: 'param' };
  if (dbKey) return { key: dbKey, source: 'db' };
  if (envKey) return { key: envKey, source: 'env' };
  return { key: undefined, source: 'none' };
}
