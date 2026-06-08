export type ItemId = number | string;

export interface QueryResult {
  role: 'include' | 'exclude';
  items: ItemId[];
}

export function evaluateCombination(results: QueryResult[]): ItemId[] {
  const includes = results.filter((r) => r.role === 'include').flatMap((r) => r.items);
  const excludes = new Set(results.filter((r) => r.role === 'exclude').flatMap((r) => r.items));
  return [...new Set(includes)].filter((id) => !excludes.has(id));
}
