import { HttpInterceptorFn } from '@angular/common/http';
import { from, switchMap } from 'rxjs';

let _token: string | null = null;
let _tokenPromise: Promise<string> | null = null;

function fetchToken(): Promise<string> {
  if (_token) return Promise.resolve(_token);
  if (_tokenPromise) return _tokenPromise;

  _tokenPromise = fetch('/api/token')
    .then(r => r.json())
    .then(data => {
      _token = data.token || '';
      return _token!;
    })
    .catch(() => {
      _token = '';
      _tokenPromise = null; // Allow retry on failure
      return '';
    });

  return _tokenPromise;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip for public endpoints
  if (req.url.includes('/api/token') || req.url.includes('/api/health') || req.url.includes('/api/version')) {
    return next(req);
  }

  return from(fetchToken()).pipe(
    switchMap(token => {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const context = sessionStorage.getItem('kubsome_context');
      const namespace = sessionStorage.getItem('kubsome_namespace');
      if (context) headers['X-Kubsome-Context'] = context;
      if (namespace) headers['X-Kubsome-Namespace'] = namespace;

      return next(Object.keys(headers).length
        ? req.clone({ setHeaders: headers })
        : req);
    })
  );
};
