import { HttpInterceptorFn } from '@angular/common/http';
import { from, switchMap, of } from 'rxjs';

let _token: string | null = null;
let _tokenPromise: Promise<string> | null = null;

function fetchToken(): Promise<string> {
  if (_token) return Promise.resolve(_token);
  if (_tokenPromise) return _tokenPromise;

  _tokenPromise = fetch('/api/token')
    .then(r => r.json())
    .then(data => {
      _token = data.token || '';
      return _token;
    })
    .catch(() => {
      _token = '';
      return '';
    });

  return _tokenPromise;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip for public endpoints
  if (req.url.includes('/api/token') || req.url.includes('/api/health') || req.url.includes('/api/version')) {
    return next(req);
  }

  // If token already cached, attach immediately
  if (_token) {
    return next(req.clone({
      setHeaders: { Authorization: `Bearer ${_token}` },
    }));
  }

  // Otherwise fetch token first, then proceed
  return from(fetchToken()).pipe(
    switchMap(token => {
      if (token) {
        return next(req.clone({
          setHeaders: { Authorization: `Bearer ${token}` },
        }));
      }
      return next(req);
    })
  );
};
