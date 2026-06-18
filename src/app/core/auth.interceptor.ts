import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth.service';

// Requests that must never trigger a refresh attempt (they are the auth flow
// itself; refreshing on their 401 would loop).
const AUTH_PATHS = ['/auth/login', '/auth/refresh'];

function isAuthFlow(req: HttpRequest<unknown>): boolean {
  return AUTH_PATHS.some((p) => req.url.endsWith(p));
}

function withBearer(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Attaches the bearer token. On a 401 it tries a single refresh and replays the
 * original request with the new token; only if the refresh fails does it clear
 * the session and bounce to login. This keeps a session alive past the ~15 min
 * access-token TTL instead of logging the user out mid-task.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.token();
  const authed = token ? withBearer(req, token) : req;

  return next(authed).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || isAuthFlow(req)) {
        return throwError(() => err);
      }
      return auth.refresh().pipe(
        switchMap((res) => next(withBearer(req, res.access_token))),
        catchError((refreshErr) => {
          auth.logout();
          router.navigate(['/login']);
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
