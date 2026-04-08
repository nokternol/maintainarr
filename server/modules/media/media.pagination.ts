export interface MediaFilters {
  // Extensible — add filter fields here as needed
  [key: string]: string | number | boolean | undefined;
}

export interface MediaQueryParams {
  page: number;
  pageSize: number;
  filters?: MediaFilters;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export function paginateItems<T>(items: T[], params: MediaQueryParams): PaginatedResult<T> {
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
