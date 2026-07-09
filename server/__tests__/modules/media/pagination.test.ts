import { paginateItems } from '@server/modules/media/media.pagination';
import { describe, expect, it } from 'vitest';

const ITEMS = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, title: `Item ${i + 1}` }));

describe('paginateItems', () => {
  it('returns the first page slice', () => {
    const result = paginateItems(ITEMS, { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
    expect(result.items[0]).toEqual({ id: 1, title: 'Item 1' });
    expect(result.items[9]).toEqual({ id: 10, title: 'Item 10' });
  });

  it('returns the correct second page slice', () => {
    const result = paginateItems(ITEMS, { page: 2, pageSize: 10 });
    expect(result.items).toHaveLength(10);
    expect(result.items[0]).toEqual({ id: 11, title: 'Item 11' });
  });

  it('returns the partial last page', () => {
    const result = paginateItems(ITEMS, { page: 7, pageSize: 15 });
    expect(result.items).toHaveLength(10); // 100 - 6*15 = 10
    expect(result.items[0]).toEqual({ id: 91, title: 'Item 91' });
  });

  it('returns empty items for an out-of-range page', () => {
    const result = paginateItems(ITEMS, { page: 20, pageSize: 10 });
    expect(result.items).toHaveLength(0);
  });

  it('totalCount always reflects the full list length', () => {
    const result = paginateItems(ITEMS, { page: 3, pageSize: 20 });
    expect(result.totalCount).toBe(100);
  });

  it('echoes back page and pageSize', () => {
    const result = paginateItems(ITEMS, { page: 4, pageSize: 25 });
    expect(result.page).toBe(4);
    expect(result.pageSize).toBe(25);
  });

  it('accepts no filters field — the signature is { page, pageSize } only', () => {
    const params: { page: number; pageSize: number } = { page: 1, pageSize: 5 };
    const result = paginateItems(ITEMS, params);
    expect(result.items).toHaveLength(5);
  });
});
