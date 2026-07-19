import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';

import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    if (!auth.user()) {
      return auth.loadMe().pipe(
        map(() => true),
        catchError(() => {
          auth.logout();
          return of(router.createUrlTree(['/login']));
        }),
      );
    }
    return true;
  }
  return router.createUrlTree(['/login']);
};

/** Restricts a route to Admin users (F-V1-01). Redirects others to /hives. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const allow = () => (auth.isAdmin() ? true : router.createUrlTree(['/hives']));

  if (auth.isAuthenticated() && !auth.user()) {
    return auth.loadMe().pipe(
      map(allow),
      catchError(() => of(router.createUrlTree(['/login']))),
    );
  }
  return allow();
};
