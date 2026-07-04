export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePagination(query: {
  page?: unknown;
  limit?: unknown;
}): PaginationParams {
  const page = Math.max(1, Number(query.page) || 1);
  const rawLimit = Number(query.limit) || DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));
  return { page, limit, offset: (page - 1) * limit };
}

export function paginate<T>(
  items: T[],
  total: number,
  { page, limit }: PaginationParams
): Paginated<T> {
  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
