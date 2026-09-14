import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';
import { PermissionsService } from './permissions.service';

@Directive({ selector: '[appHasAnyPermission]' })
export class HasPermissionDirective {
  @Input() set appHasAnyPermission(permissions: string[]) {
    if(permissions.length === 0) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    }else if (this.permissions.hasAnyPermission(permissions)) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    } else {
      this.viewContainer.clear();
    }
  }

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissions: PermissionsService
  ) {}
}
