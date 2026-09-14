import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TitleService {
  private titleSource = new BehaviorSubject<{
    title: string,
    breadcrumbs: Array<{ label: string, path: string }>
  }>({ title: '', breadcrumbs: [] });

  currentTitle = this.titleSource.asObservable();

  updateTitle(title: string, breadcrumbs: Array<{ label: string, path: string }> = []) {
    this.titleSource.next({ title, breadcrumbs });
  }
}
