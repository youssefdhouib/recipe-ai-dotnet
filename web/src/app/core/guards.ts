import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// UI guards only improve navigation: the real security is [Authorize] in the API.
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isAdmin()) return true;
  // Not logged in: log in first, then come back. Logged in but not admin: home page.
  return auth.isLoggedIn()
    ? inject(Router).createUrlTree(['/'])
    : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
