import { type Contribution, mergeContributions } from '@server/utils/contributions';
import { describe, expect, it } from 'vitest';

interface Target {
  id: number;
  rk: string;
}
type Vals = Record<string, number>;

describe('mergeContributions', () => {
  it('folds every contribution whose key matches a target into that target', () => {
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
      (t, k) => t.rk === k.rk,
      (acc, next) => ({ ...acc, ...next }),
      () => ({})
    );

    expect(result).toEqual([
      { target: targets[0], values: { x: 1, y: 2 } },
      { target: targets[1], values: { x: 9 } },
    ]);
  });
});
