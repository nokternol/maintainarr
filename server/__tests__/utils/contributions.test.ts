import { type Contribution, mergeContributions } from '@server/utils/contributions';
import { describe, expect, it, vi } from 'vitest';

interface Target {
  id: number;
  rk: string;
}
type Vals = Record<string, number>;

describe('mergeContributions', () => {
  it('folds every contribution sharing a token with a target into that target', () => {
    const targets: Target[] = [
      { id: 1, rk: 'a' },
      { id: 2, rk: 'b' },
    ];
    const contributions: Contribution<{ rk: string }, Vals>[] = [
      { key: { rk: 'a' }, values: { x: 1 } },
      { key: { rk: 'a' }, values: { y: 2 } },
      { key: { rk: 'b' }, values: { x: 9 } },
      { key: { rk: 'z' }, values: { x: 99 } },
    ];

    const result = mergeContributions(
      targets,
      contributions,
      (t) => [t.rk],
      (k) => [k.rk],
      (acc, next) => ({ ...acc, ...next }),
      () => ({})
    );

    expect(result).toEqual([
      { target: targets[0], values: { x: 1, y: 2 } },
      { target: targets[1], values: { x: 9 } },
    ]);
  });

  it('preserves contribution order when merging (last token-sharing write wins)', () => {
    const targets: Target[] = [{ id: 1, rk: 'a' }];
    const contributions: Contribution<{ rk: string }, Vals>[] = [
      { key: { rk: 'a' }, values: { x: 1 } },
      { key: { rk: 'a' }, values: { x: 2 } },
    ];

    const result = mergeContributions(
      targets,
      contributions,
      (t) => [t.rk],
      (k) => [k.rk],
      (acc, next) => ({ ...acc, ...next }),
      () => ({})
    );

    expect(result[0].values).toEqual({ x: 2 });
  });

  it('merges a contribution that shares multiple tokens with a target exactly once', () => {
    // The merge fn is additive so a double-merge would be observable as x: 2.
    const targets = [{ id: 1, a: 'p', b: 'q' }];
    const contributions: Contribution<{ a?: string; b?: string }, Vals>[] = [
      { key: { a: 'p', b: 'q' }, values: { x: 1 } },
    ];

    const result = mergeContributions(
      targets,
      contributions,
      (t) => [`a:${t.a}`, `b:${t.b}`],
      (k) =>
        [k.a !== undefined ? `a:${k.a}` : null, k.b !== undefined ? `b:${k.b}` : null].filter(
          (x): x is string => x !== null
        ),
      (acc, next) => ({ x: (acc.x ?? 0) + (next.x ?? 0) }),
      (): Vals => ({})
    );

    expect(result[0].values).toEqual({ x: 1 });
  });

  it('does not cross-match values from different namespaced dimensions', () => {
    // target keyed on dimension "a" with value 5; contribution keyed on dimension "b"
    // with the same raw value 5 must NOT match once tokens are namespaced.
    const targets = [{ id: 1, a: '5' }];
    const contributions: Contribution<{ b?: string }, Vals>[] = [
      { key: { b: '5' }, values: { x: 1 } },
    ];

    const result = mergeContributions(
      targets,
      contributions,
      (t) => [`a:${t.a}`],
      (k) => (k.b !== undefined ? [`b:${k.b}`] : []),
      (acc, next) => ({ ...acc, ...next }),
      () => ({})
    );

    expect(result[0].values).toEqual({});
  });

  it('indexes contributions once instead of scanning them per target', () => {
    // Linearity guard: in a scan-per-target merge the key predicate runs N×M times.
    // With an index, each contribution's tokens are read once (M) and each target's
    // once (N) — never the cross product.
    const targets: Target[] = Array.from({ length: 50 }, (_, i) => ({ id: i, rk: `t${i}` }));
    const contributions: Contribution<{ rk: string }, Vals>[] = Array.from(
      { length: 40 },
      (_, i) => ({ key: { rk: `t${i}` }, values: { x: i } })
    );

    const keyTokens = vi.fn((k: { rk: string }) => [k.rk]);
    const targetTokens = vi.fn((t: Target) => [t.rk]);

    mergeContributions(
      targets,
      contributions,
      targetTokens,
      keyTokens,
      (acc, next) => ({ ...acc, ...next }),
      () => ({})
    );

    expect(keyTokens).toHaveBeenCalledTimes(contributions.length); // 40, not 50×40
    expect(targetTokens).toHaveBeenCalledTimes(targets.length); // 50, not 50×40
  });
});
