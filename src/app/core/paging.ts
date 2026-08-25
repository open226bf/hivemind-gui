import { EMPTY, Observable, expand, map, reduce } from 'rxjs';

/** Shape every paginated list endpoint returns. */
export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

/**
 * Largest page size the API honours. The server clamps `size` to this value
 * (pkg/pagination.MaxLimit), so asking for more silently truncates the result —
 * which is exactly the bug `collectAll` exists to avoid.
 */
export const MAX_PAGE_SIZE = 100;

/**
 * Walks every page of a paginated endpoint and emits the concatenated items
 * once, so a screen that wants "all of them" is not capped at the server's
 * maximum page size.
 *
 * Pages are fetched sequentially rather than in parallel: the catalogs this is
 * used for hold a handful of pages at most, and one request at a time keeps the
 * load predictable for a control plane talking to a remote cluster.
 *
 * @param fetchPage called with a 1-based page number and the page size.
 * @param pageSize  page size to request (defaults to the server maximum).
 */
export function collectAll<T>(
  fetchPage: (page: number, size: number) => Observable<PagedResponse<T>>,
  pageSize = MAX_PAGE_SIZE,
): Observable<T[]> {
  const size = Math.min(pageSize, MAX_PAGE_SIZE);
  return fetchPage(1, size).pipe(
    expand((res) => {
      // Stop on the last page — and never loop when the server answers with a
      // page number or size we cannot advance from.
      if (res.size < 1 || res.page < 1) return EMPTY;
      if (res.items.length < res.size || res.page * res.size >= res.total) return EMPTY;
      return fetchPage(res.page + 1, size);
    }),
    map((res) => res.items),
    reduce((all: T[], items: T[]) => all.concat(items), []),
  );
}
