import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { NzModalService } from 'ng-zorro-antd/modal';

export interface CanComponentDeactivate {
  canDeactivate: () => boolean | Promise<boolean>;
}

export const canDeactivateGuard: CanDeactivateFn<CanComponentDeactivate> = (component) => {
  if (component.canDeactivate) {
    const canLeave = component.canDeactivate();
    if (typeof canLeave === 'boolean' && !canLeave) {
      return new Promise<boolean>((resolve) => {
        const modal = inject(NzModalService);
        modal.confirm({
          nzTitle: 'Discard Changes?',
          nzContent: 'You have unsaved changes. Are you sure you want to discard them and leave this page?',
          nzOkText: 'Yes, Discard',
          nzCancelText: 'No, Stay',
          nzCentered: true,
          nzOnOk: () => resolve(true),
          nzOnCancel: () => resolve(false),
        });
      });
    }
    return canLeave;
  }
  return true;
};
