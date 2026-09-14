import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

export interface MemoryLeakInfo {
  componentName: string;
  subscriptionCount: number;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high';
}

export interface ComponentMemoryInfo {
  name: string;
  instanceCount: number;
  subscriptionCount: number;
  lastSeen: Date;
}

@Injectable({
  providedIn: 'root'
})
export class MemoryLeakDetectorService implements OnDestroy {
  private componentInstances = new Map<string, ComponentMemoryInfo>();
  private leakAlerts$ = new BehaviorSubject<MemoryLeakInfo[]>([]);
  private destroy$ = new Subject<void>();
  private readonly MAX_INSTANCES = 10;
  private readonly MAX_SUBSCRIPTIONS = 20;

  constructor() {
    this.startMemoryLeakDetection();
  }

  private startMemoryLeakDetection(): void {

    setInterval(() => {
      this.detectMemoryLeaks();
    }, 30000);

    setInterval(() => {
      this.checkMemoryUsage();
    }, 10000);
  }

  registerComponent(componentName: string): void {
    const existing = this.componentInstances.get(componentName);
    if (existing) {
      existing.instanceCount++;
      existing.lastSeen = new Date();
    } else {
      this.componentInstances.set(componentName, {
        name: componentName,
        instanceCount: 1,
        subscriptionCount: 0,
        lastSeen: new Date()
      });
    }
  }

  unregisterComponent(componentName: string): void {
    const existing = this.componentInstances.get(componentName);
    if (existing) {
      existing.instanceCount = Math.max(0, existing.instanceCount - 1);
      if (existing.instanceCount === 0) {
        this.componentInstances.delete(componentName);
      }
    }
  }

  trackSubscription(componentName: string): void {
    const existing = this.componentInstances.get(componentName);
    if (existing) {
      existing.subscriptionCount++;
      existing.lastSeen = new Date();
    }
  }

  untrackSubscription(componentName: string): void {
    const existing = this.componentInstances.get(componentName);
    if (existing) {
      existing.subscriptionCount = Math.max(0, existing.subscriptionCount - 1);
    }
  }

  private detectMemoryLeaks(): void {
    const alerts: MemoryLeakInfo[] = [];

    for (const [componentName, info] of this.componentInstances.entries()) {
      let severity: 'low' | 'medium' | 'high' = 'low';

      if (info.instanceCount > this.MAX_INSTANCES) {
        severity = info.instanceCount > this.MAX_INSTANCES * 2 ? 'high' : 'medium';
        alerts.push({
          componentName,
          subscriptionCount: info.subscriptionCount,
          timestamp: new Date(),
          severity
        });
      }

      if (info.subscriptionCount > this.MAX_SUBSCRIPTIONS) {
        severity = info.subscriptionCount > this.MAX_SUBSCRIPTIONS * 2 ? 'high' : 'medium';
        alerts.push({
          componentName,
          subscriptionCount: info.subscriptionCount,
          timestamp: new Date(),
          severity
        });
      }

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (info.lastSeen < fiveMinutesAgo && info.instanceCount > 0) {
        alerts.push({
          componentName,
          subscriptionCount: info.subscriptionCount,
          timestamp: new Date(),
          severity: 'medium'
        });
      }
    }

    if (alerts.length > 0) {
      this.leakAlerts$.next([...this.leakAlerts$.value, ...alerts]);

      alerts.filter(alert => alert.severity === 'high').forEach(alert => {
        console.error(`Memory leak detected in ${alert.componentName}:`, alert);
      });
    }
  }

  private checkMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usedMB = memory.usedJSHeapSize / (1024 * 1024);
      const totalMB = memory.totalJSHeapSize / (1024 * 1024);
      const limitMB = memory.jsHeapSizeLimit / (1024 * 1024);

      if (usedMB > limitMB * 0.8) {
        console.warn(`High memory usage: ${usedMB.toFixed(2)}MB / ${limitMB.toFixed(2)}MB`);
        this.suggestMemoryCleanup();
      }
    }
  }

  private suggestMemoryCleanup(): void {
    console.warn('Memory cleanup suggestions:');
    console.warn('1. Check for unsubscribed observables');
    console.warn('2. Clear unused component instances');
    console.warn('3. Review large data structures');
    console.warn('4. Check for event listeners not removed');
  }

  getLeakAlerts(): Observable<MemoryLeakInfo[]> {
    return this.leakAlerts$.asObservable();
  }

  getComponentMemoryInfo(): ComponentMemoryInfo[] {
    return Array.from(this.componentInstances.values());
  }

  getMemoryLeakReport(): any {
    const components = this.getComponentMemoryInfo();
    const alerts = this.leakAlerts$.value;

    return {
      totalComponents: components.length,
      totalInstances: components.reduce((sum, comp) => sum + comp.instanceCount, 0),
      totalSubscriptions: components.reduce((sum, comp) => sum + comp.subscriptionCount, 0),
      highRiskComponents: components.filter(comp =>
        comp.instanceCount > this.MAX_INSTANCES ||
        comp.subscriptionCount > this.MAX_SUBSCRIPTIONS
      ),
      recentAlerts: alerts.slice(-10),
      alertCount: alerts.length
    };
  }

  clearAlerts(): void {
    this.leakAlerts$.next([]);
  }

  forceGarbageCollection(): void {
    if ('gc' in window) {
      (window as any).gc();
      console.log('Garbage collection triggered');
    } else {
      console.warn('Garbage collection not available. Run with --expose-gc flag');
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.leakAlerts$.complete();
  }
}
