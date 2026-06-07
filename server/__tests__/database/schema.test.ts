import { describe, expect, it } from 'vitest';

describe('savedQueries schema', () => {
  it('has contentType column (not mediaType, not filters)', async () => {
    const schema = await import('../../database/schema');
    const cols = Object.keys(schema.savedQueries);
    expect(cols).toContain('contentType');
    expect(cols).not.toContain('mediaType');
    expect(cols).not.toContain('filters');
  });
});

describe('savedQueryFilterValues schema', () => {
  it('is exported and has savedQueryId, filterKey, value columns', async () => {
    const schema = await import('../../database/schema');
    expect((schema as Record<string, unknown>).savedQueryFilterValues).toBeDefined();
    const cols = Object.keys((schema as Record<string, unknown>).savedQueryFilterValues as object);
    expect(cols).toContain('savedQueryId');
    expect(cols).toContain('filterKey');
    expect(cols).toContain('value');
  });
});
