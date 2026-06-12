/**
 * Provider-agnostic aggregation primitive.
 *
 * A `Contribution` is a normalized fragment of data keyed by some external identifier.
 * `mergeContributions` folds every contribution whose key shares a token with a target
 * into that target — the single generic seam that lets central code reduce data from any
 * number of concrete sources without knowing which provider produced it.
 *
 * Matching is expressed as overlapping *tokens* rather than an opaque predicate so the
 * join can index: contributions are bucketed by token once (O(M)) and each target probes
 * those buckets by its own tokens (O(N)), for an O(N + M) join instead of O(N × M).
 * Callers namespace tokens per key dimension (e.g. `plex:5`, `tmdb:5`) so values from
 * different dimensions never collide.
 */
export interface Contribution<K, V> {
  key: K;
  values: V;
}

export interface Source<K, V> {
  collect(): Promise<Contribution<K, V>[]>;
}

export type Token = string | number;

export function mergeContributions<T, K, V>(
  targets: T[],
  contributions: Contribution<K, V>[],
  targetTokens: (target: T) => Token[],
  keyTokens: (key: K) => Token[],
  merge: (acc: V, next: V) => V,
  seed: () => V
): Array<{ target: T; values: V }> {
  // Bucket each contribution (by original index, to preserve merge order) under every
  // token its key emits. Built once, regardless of how many targets probe it.
  const index = new Map<Token, number[]>();
  contributions.forEach((contribution, i) => {
    for (const token of keyTokens(contribution.key)) {
      const bucket = index.get(token);
      if (bucket) bucket.push(i);
      else index.set(token, [i]);
    }
  });

  return targets.map((target) => {
    // Gather candidate contribution indices across all of the target's tokens, deduping
    // any contribution reachable via more than one shared dimension.
    const matched = new Set<number>();
    for (const token of targetTokens(target)) {
      const bucket = index.get(token);
      if (bucket) for (const i of bucket) matched.add(i);
    }

    // Replay in original contribution order so later writes win, matching a single
    // forward scan over the source rows.
    const values = [...matched]
      .sort((a, b) => a - b)
      .reduce((acc, i) => merge(acc, contributions[i].values), seed());

    return { target, values };
  });
}
