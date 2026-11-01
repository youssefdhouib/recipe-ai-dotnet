import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// UI guards only improve navigation: the real security is [Authorize] in the API.
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAdmin() ? true : inject(Router).createUrlTree(['/']);
};
