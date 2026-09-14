import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

@Injectable()
export class CacheInterceptor implements HttpInterceptor {
  private cache = new Map<string, CacheEntry>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000;

  private cacheableUrls = [
    'Dropdowns/getAllUSCities',
    'Dropdowns/getUSStatesByCityId',
    'Dropdowns/getAllFacilities',
    'Dropdowns/getAllPatients',
    'Dropdowns/getAllProviders',
    'Dropdowns/getAllProducts',
    'Dropdowns/getAllInTakeFormProducts'
  ];

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    if (request.method !== 'GET') {
      return next.handle(request);
    }

    const shouldCache = this.cacheableUrls.some(url => request.url.includes(url));
    if (!shouldCache) {
      return next.handle(request);
    }

    const cacheKey = this.generateCacheKey(request);
    const cachedResponse = this.getCachedResponse(cacheKey);

    if (cachedResponse) {
      return of(new HttpResponse({
        body: cachedResponse,
        status: 200,
        statusText: 'OK'
      }));
    }

    return next.handle(request).pipe(
      tap((event) => {
        if (event instanceof HttpResponse) {
          this.cacheResponse(cacheKey, event.body);
        }
      }),
      catchError((error) => {

        this.cache.delete(cacheKey);
        throw error;
      })
    );
  }

  private generateCacheKey(request: HttpRequest<any>): string {
    return `${request.method}:${request.url}:${JSON.stringify(request.params)}`;
  }

  private getCachedResponse(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private cacheResponse(key: string, data: any): void {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: this.DEFAULT_TTL
    };
    this.cache.set(key, entry);

    this.cleanupCache();
  }

  private cleanupCache(): void {
    const now = Date.now();
    const maxSize = 100;

    if (this.cache.size > maxSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toRemove = entries.slice(0, this.cache.size - maxSize);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearCacheByPattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}
