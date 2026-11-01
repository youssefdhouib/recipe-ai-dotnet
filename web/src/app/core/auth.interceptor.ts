import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

// Adds "Authorization: Bearer <token>" to every API call, and logs out when the API says 401.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const isApiCall = req.url.startsWith(environment.apiUrl);
  const token = auth.token;

  const request = isApiCall && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      const isLoginCall = req.url.includes('/auth/login');
      if (error instanceof HttpErrorResponse && error.status === 401 && token && !isLoginCall) {
        auth.logout(); // token expired or invalid
      }
      return throwError(() => error);
    }),
  );
};
