import { HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, finalize, shareReplay, timeout, retry } from 'rxjs/operators';

const pendingRequests = new Map<string, Observable<HttpEvent<any>>>();
const REQUEST_TIMEOUT = 300000;
const MAX_RETRIES = 0;

export function PerformanceInterceptor(request: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> {

  if (request.method !== 'GET' || shouldSkipDeduplication(request)) {
    return handleRequest(request, next);
  }

  const cacheKey = generateCacheKey(request);
  const existingRequest = pendingRequests.get(cacheKey);

  if (existingRequest) {
    return existingRequest;
  }

  const requestObservable = handleRequest(request, next).pipe(
    shareReplay(1),
    finalize(() => {
      pendingRequests.delete(cacheKey);
    })
  );

  pendingRequests.set(cacheKey, requestObservable);
  return requestObservable;
}

function handleRequest(request: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> {
  const startTime = performance.now();

  return next(request).pipe(
    timeout(REQUEST_TIMEOUT),
    retry({
      count: MAX_RETRIES,
      delay: (_error, retryCount) => {
        console.warn(`Request failed, retrying (${retryCount}/${MAX_RETRIES}):`, request.url);
        return of(null).pipe(

          timeout(Math.pow(2, retryCount) * 1000)
        );
      }
    }),
    catchError((error) => {
      const duration = performance.now() - startTime;
      console.error(`Request failed after ${duration.toFixed(2)}ms:`, {
        url: request.url,
        method: request.method,
        error: error.message
      });

      logPerformanceMetrics(request, duration, error);

      return throwError(() => error);
    }),
    finalize(() => {
      const duration = performance.now() - startTime;
      logPerformanceMetrics(request, duration);
    })
  );
}

function shouldSkipDeduplication(request: HttpRequest<any>): boolean {

  const url = request.url.toLowerCase();
  const cacheControl = request.headers.get('Cache-Control');
  return url.includes('cache=') ||
         url.includes('timestamp=') ||
         url.includes('random=') ||
         (request.headers.has('Cache-Control') &&
         cacheControl?.includes('no-cache') === true);
}

function generateCacheKey(request: HttpRequest<any>): string {

  const headers = Array.from(request.headers.keys())
    .filter(key => !['authorization', 'cache-control'].includes(key.toLowerCase()))
    .sort()
    .map(key => `${key}:${request.headers.get(key)}`)
    .join('|');

  return `${request.method}:${request.url}:${headers}`;
}

function logPerformanceMetrics(request: HttpRequest<any>, duration: number, error?: any): void {
  const metrics = {
    url: request.url,
    method: request.method,
    duration: Math.round(duration),
    timestamp: new Date().toISOString(),
    success: !error
  };

  const metricsKey = 'http_performance_metrics';
  const existingMetrics = JSON.parse(localStorage.getItem(metricsKey) || '[]');
  existingMetrics.push(metrics);

  if (existingMetrics.length > 100) {
    existingMetrics.splice(0, existingMetrics.length - 100);
  }

  localStorage.setItem(metricsKey, JSON.stringify(existingMetrics));

  if (duration > 5000) {
    console.warn(`Slow request detected: ${request.url} took ${duration.toFixed(2)}ms`);
  }
}
