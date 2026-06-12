/**
 * Provider-agnostic aggregation primitive.
 *
 * A `Contribution` is a normalized fragment of data keyed by some external identifier.
 * `mergeContributions` folds every contribution whose key matches a target into that
 * target — the single generic seam that lets central code reduce data from any number
 * of concrete sources without knowing which provider produced it.
 */
export interface Contribution<K, V> {
  key: K;
  values: V;
}

export interface Source<K, V> {
  collect(): Promise<Contribution<K, V>[]>;
}

export function mergeContributions<T, K, V>(
  targets: T[],
  contributions: Contribution<K, V>[],
  matches: (target: T, key: K) => boolean,
  merge: (acc: V, next: V) => V,
  seed: () => V
): Array<{ target: T; values: V }> {
  return targets.map((target) => {
    const values = contributions.reduce(
      (acc, contribution) =>
        matches(target, contribution.key) ? merge(acc, contribution.values) : acc,
      seed()
    );
    return { target, values };
  });
}
