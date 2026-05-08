import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ErrorService } from '../services/error.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const errorService = inject(ErrorService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let message = 'Something went wrong';

      if (error.status === 0) {
        message = 'Cannot reach API server';
      } else if (error.status === 404) {
        message = `Not found: ${req.url.split('/api/')[1] || req.url}`;
      } else if (error.status === 500) {
        message = error.error?.detail || 'Internal server error';
      } else if (error.status === 504) {
        message = 'Request timed out — cluster may be slow';
      }

      errorService.show(message, error.status);
      return throwError(() => error);
    })
  );
};
