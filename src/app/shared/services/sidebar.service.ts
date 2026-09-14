import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SidebarService {
  private sidebarCollapsed = new BehaviorSubject<boolean>(false);

  collapsed$ = this.sidebarCollapsed.asObservable();

  toggleSidebar(): void {
    this.sidebarCollapsed.next(this.sidebarCollapsed.value);
  }

  openSidebar(): void {
    this.sidebarCollapsed.next(false);
  }

  closeSidebar(): void {
    this.sidebarCollapsed.next(true);
  }
}
