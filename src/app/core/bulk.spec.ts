import { Observable, of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { BulkResult, firstErrorMessage, settleAll } from './bulk';

const run = <T>(items: T[], fn: (item: T) => Observable<unknown>) =>
  new Promise<BulkResult<T>>((resolve) => settleAll(items, fn).subscribe(resolve));

describe('settleAll', () => {
  it('reports every item when all succeed', async () => {
    const res = await run(['a', 'b'], () => of(undefined));

    expect(res.succeeded).toEqual(['a', 'b']);
    expect(res.failed).toEqual([]);
  });

  it('completes with both sides when some items fail', async () => {
    const boom = new Error('in use');
    const res = await run(['ok', 'bad'], (id) =>
      id === 'bad' ? throwError(() => boom) : of(undefined),
    );

    expect(res.succeeded).toEqual(['ok']);
    expect(res.failed).toEqual([{ item: 'bad', error: boom }]);
  });

  it('completes on an empty selection without firing a request', async () => {
    const res = await run<string>([], () => {
      throw new Error('should not run');
    });

    expect(res).toEqual({ succeeded: [], failed: [] });
  });
});

describe('firstErrorMessage', () => {
  it('prefers the server-side message', () => {
    const failed = [{ error: { error: { message: 'config attachée' } } }];

    expect(firstErrorMessage(failed, 'fallback')).toBe('config attachée');
  });

  it('falls back when the error carries no message', () => {
    expect(firstErrorMessage([{ error: new Error('boom') }], 'fallback')).toBe('fallback');
    expect(firstErrorMessage([], 'fallback')).toBe('fallback');
  });
});
