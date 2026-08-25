import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { MAX_PAGE_SIZE, PagedResponse, collectAll } from './paging';

/** Serves `total` numbered items out of an in-memory list, page by page. */
function pager(total: number) {
  const all = Array.from({ length: total }, (_, i) => i + 1);
  return vi.fn((page: number, size: number) => {
    const start = (page - 1) * size;
    return of<PagedResponse<number>>({
      items: all.slice(start, start + size),
      total,
      page,
      size,
    });
  });
}

describe('collectAll', () => {
  it('returns a single page as-is', async () => {
    const fetch = pager(3);
    const items = await new Promise((resolve) => collectAll(fetch).subscribe(resolve));

    expect(items).toEqual([1, 2, 3]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('walks every page when the catalog exceeds one page', async () => {
    const fetch = pager(250);
    const items = (await new Promise((resolve) =>
      collectAll(fetch).subscribe(resolve),
    )) as number[];

    expect(items).toHaveLength(250);
    expect(items[0]).toBe(1);
    expect(items[249]).toBe(250);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenCalledWith(1, MAX_PAGE_SIZE);
    expect(fetch).toHaveBeenLastCalledWith(3, MAX_PAGE_SIZE);
  });

  it('never asks for more than the server maximum', async () => {
    const fetch = pager(10);
    await new Promise((resolve) => collectAll(fetch, 1000).subscribe(resolve));

    expect(fetch).toHaveBeenCalledWith(1, MAX_PAGE_SIZE);
  });

  it('stops on a full last page that exhausts the total', async () => {
    const fetch = pager(MAX_PAGE_SIZE);
    const items = (await new Promise((resolve) =>
      collectAll(fetch).subscribe(resolve),
    )) as number[];

    expect(items).toHaveLength(MAX_PAGE_SIZE);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('emits nothing and errors when the first page fails', async () => {
    const boom = new Error('nope');
    const err = await new Promise((resolve) =>
      collectAll(() => throwError(() => boom)).subscribe({ error: resolve }),
    );

    expect(err).toBe(boom);
  });
});
