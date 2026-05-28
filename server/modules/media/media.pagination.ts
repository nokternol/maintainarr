export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export function paginateItems<T>(
  items: T[],
  params: { page: number; pageSize: number }
): PaginatedResult<T> {
  const { page, pageSize } = params;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: items.slice(start, end),
    totalCount: items.length,
    page,
    pageSize,
  };
}
