import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OutletReloadService {
  private _show = new BehaviorSubject(true);
  show$ = this._show.asObservable();

}
