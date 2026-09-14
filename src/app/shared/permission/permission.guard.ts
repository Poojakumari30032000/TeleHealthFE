import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { PermissionsService } from './permissions.service';
import { Location } from '@angular/common';
import { NzNotificationService } from 'ng-zorro-antd/notification';

@Injectable({ providedIn: 'root' })
export class PermissionGuard implements CanActivate {
  constructor(
    private permissions: PermissionsService,
    private router: Router,
    private location: Location,
    private notification: NzNotificationService
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const requiredPermissions = route.data['permissions'] as string[];
    if (!requiredPermissions || requiredPermissions.length === 0) return true;
    const hasAccess = this.permissions.hasAnyPermission(requiredPermissions);

    if (!hasAccess) {
      this.notification.error('You do not have permission to access this page.', '');
      setTimeout(() => {
        if (this.router.navigated) {
          this.location.back();
        } else {
          this.router.navigate(['/login']);
        }
      }, 1000);

      return false;
    }
    return true;
  }
}
