import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  category: 'memory' | 'network' | 'rendering' | 'user-interaction';
}

export interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

@Injectable({
  providedIn: 'root'
})
export class PerformanceService {
  private metrics$ = new BehaviorSubject<PerformanceMetric[]>([]);
  private memoryThreshold = 50 * 1024 * 1024;
  private performanceObserver: PerformanceObserver | null = null;

  constructor() {
    this.initializePerformanceMonitoring();
  }

  private initializePerformanceMonitoring(): void {

    this.startMemoryMonitoring();

    this.startLongTaskMonitoring();

    this.startLayoutShiftMonitoring();

    this.startFirstInputDelayMonitoring();
  }

  private startMemoryMonitoring(): void {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory as MemoryInfo;
        if (memory) {
          const usedMB = memory.usedJSHeapSize / (1024 * 1024);
          const totalMB = memory.totalJSHeapSize / (1024 * 1024);

          this.addMetric({
            name: 'Memory Usage',
            value: usedMB,
            unit: 'MB',
            timestamp: new Date(),
            category: 'memory'
          });

          if (memory.usedJSHeapSize > this.memoryThreshold) {
            console.warn(`High memory usage detected: ${usedMB.toFixed(2)}MB`);
          }
        }
      }, 10000);
    }
  }

  private startLongTaskMonitoring(): void {
    if ('PerformanceObserver' in window) {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              this.addMetric({
                name: 'Long Task',
                value: entry.duration,
                unit: 'ms',
                timestamp: new Date(),
                category: 'rendering'
              });

              console.warn(`Long task detected: ${entry.duration.toFixed(2)}ms`);
            }
          }
        });

        this.performanceObserver.observe({ entryTypes: ['longtask'] });
      } catch (error) {
        console.warn('Long task monitoring not supported');
      }
    }
  }

  private startLayoutShiftMonitoring(): void {
    if ('PerformanceObserver' in window) {
      try {
        const layoutObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const layoutShiftEntry = entry as any;
            if (layoutShiftEntry.value > 0.1) {
              this.addMetric({
                name: 'Layout Shift',
                value: layoutShiftEntry.value,
                unit: 'score',
                timestamp: new Date(),
                category: 'rendering'
              });
            }
          }
        });

        layoutObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (error) {
        console.warn('Layout shift monitoring not supported');
      }
    }
  }

  private startFirstInputDelayMonitoring(): void {
    if ('PerformanceObserver' in window) {
      try {
        const inputObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const inputEntry = entry as any;
            this.addMetric({
              name: 'First Input Delay',
              value: inputEntry.processingStart - inputEntry.startTime,
              unit: 'ms',
              timestamp: new Date(),
              category: 'user-interaction'
            });
          }
        });

        inputObserver.observe({ entryTypes: ['first-input'] });
      } catch (error) {
        console.warn('First input delay monitoring not supported');
      }
    }
  }

  private addMetric(metric: PerformanceMetric): void {
    const currentMetrics = this.metrics$.value;
    currentMetrics.push(metric);

    if (currentMetrics.length > 100) {
      currentMetrics.splice(0, currentMetrics.length - 100);
    }

    this.metrics$.next(currentMetrics);
  }

  getMetrics(): Observable<PerformanceMetric[]> {
    return this.metrics$.asObservable();
  }

  getMetricsByCategory(category: PerformanceMetric['category']): PerformanceMetric[] {
    return this.metrics$.value.filter(metric => metric.category === category);
  }

  getLatestMetrics(count: number = 10): PerformanceMetric[] {
    const metrics = this.metrics$.value;
    return metrics.slice(-count);
  }

  clearMetrics(): void {
    this.metrics$.next([]);
  }

  getMemoryInfo(): MemoryInfo | null {
    if ('memory' in performance) {
      return (performance as any).memory;
    }
    return null;
  }

  measureFunction<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    this.addMetric({
      name: `Function: ${name}`,
      value: duration,
      unit: 'ms',
      timestamp: new Date(),
      category: 'user-interaction'
    });

    return result;
  }

  async measureAsyncFunction<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    this.addMetric({
      name: `Async Function: ${name}`,
      value: duration,
      unit: 'ms',
      timestamp: new Date(),
      category: 'user-interaction'
    });

    return result;
  }

  getPerformanceReport(): any {
    const metrics = this.metrics$.value;
    const categories = ['memory', 'network', 'rendering', 'user-interaction'];

    const report: any = {};

    categories.forEach(category => {
      const categoryMetrics = metrics.filter(m => m.category === category);
      if (categoryMetrics.length > 0) {
        const values = categoryMetrics.map(m => m.value);
        report[category] = {
          count: categoryMetrics.length,
          average: values.reduce((a, b) => a + b, 0) / values.length,
          max: Math.max(...values),
          min: Math.min(...values),
          latest: categoryMetrics[categoryMetrics.length - 1]
        };
      }
    });

    return report;
  }

  destroy(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    this.metrics$.complete();
  }
}
