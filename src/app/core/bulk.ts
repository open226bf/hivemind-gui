import { Observable, catchError, forkJoin, map, of } from 'rxjs';

/** Outcome of a bulk action: what went through and what did not. */
export interface BulkResult<T> {
  succeeded: T[];
  failed: { item: T; error: unknown }[];
}

/**
 * Runs one request per item and always completes, reporting successes and
 * failures separately.
 *
 * A plain `forkJoin` fails fast: the first error hides how many items were in
 * fact processed, which leaves the caller unable to tell the user what happened
 * — and unable to know it must refresh. Settling every request keeps the report
 * accurate.
 */
export function settleAll<T, R>(
  items: T[],
  run: (item: T) => Observable<R>,
): Observable<BulkResult<T>> {
  if (!items.length) {
    return of({ succeeded: [], failed: [] });
  }
  return forkJoin(
    items.map((item) =>
      run(item).pipe(
        map(() => ({ item, error: undefined as unknown })),
        catchError((error: unknown) => of({ item, error })),
      ),
    ),
  ).pipe(
    map((results) => ({
      succeeded: results.filter((r) => r.error === undefined).map((r) => r.item),
      failed: results
        .filter((r) => r.error !== undefined)
        .map((r) => ({ item: r.item, error: r.error })),
    })),
  );
}

/** First server-side message of a failed bulk run, for the error toast. */
export function firstErrorMessage(failed: { error: unknown }[], fallback: string): string {
  const err = failed[0]?.error as { error?: { message?: string } } | undefined;
  return err?.error?.message ?? fallback;
}
