import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { GeneralService } from '../../shared/services/general.service';
import { PermissionModuleNode, RolePermissionTree, RoleService } from '../../shared/services/role.service';

/**
 * The role editor: name, description and the permission checkbox tree.
 *
 * Equivalent of the reference project's `manage-roles` screen, with the tree cascade
 * written out rather than delegated to `ngx-treeview` - the catalog here is two levels
 * (module -> permission) instead of four, so a dependency for it would be overkill, and
 * this keeps the check/indeterminate rules explicit and inspectable.
 *
 * Route param 0 means "new role": the server returns the blank catalog, matching how
 * the reference project's single endpoint behaved for `Id = 0`.
 */
@Component({
  selector: 'app-role-detail-view',
  templateUrl: './role-detail-view.component.html',
  styleUrl: './role-detail-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleDetailViewComponent implements OnInit, OnDestroy {

  roleId = 0;
  roleName = '';
  roleDescription = '';
  isActive = true;

  isSystemRole = false;
  hasAllPermissions = false;

  modules: PermissionModuleNode[] = [];
  loading = true;
  saving = false;

  /** Server-side validation feedback, shown inline next to the name field. */
  nameError = '';

  private readonly destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private roleService: RoleService,
    private generalService: GeneralService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.roleId = Number(this.route.snapshot.paramMap.get('id')) || 0;
    this.loadTree();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isNew(): boolean {
    return this.roleId === 0;
  }

  get pageTitle(): string {
    if (this.isNew) return 'Add Role';
    return this.roleName ? `Edit Role — ${this.roleName}` : 'Edit Role';
  }

  /** Super Admin's grant is implicit, so its tree is shown read-only. */
  get isReadOnly(): boolean {
    return this.hasAllPermissions;
  }

  get selectedCount(): number {
    return this.modules.reduce(
      (total, module) => total + module.permissions.filter(p => p.checked).length, 0);
  }

  private loadTree(): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.roleService.getRolePermissionTree(this.roleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.loading = false;

          if (res?.status !== 1 || !res?.data) {
            this.generalService.showError(res?.message || 'Unable to load permissions.');
            this.cdr.markForCheck();
            return;
          }

          const tree = res.data as RolePermissionTree;

          this.roleName = tree.roleName ?? '';
          this.isSystemRole = tree.isSystemRole;
          this.hasAllPermissions = tree.hasAllPermissions;
          this.modules = tree.modules ?? [];

          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.generalService.showError('Unable to load permissions.');
          this.cdr.markForCheck();
        }
      });
  }

  // -----------------------------------------------------------------------
  //  Tree cascade
  //
  //  Only leaves are ever submitted. A module's checkbox is pure UI: its state
  //  is recomputed from its children, never stored, which is why the server can
  //  never disagree with what is shown here.
  // -----------------------------------------------------------------------

  onModuleToggle(module: PermissionModuleNode, checked: boolean): void {
    if (this.isReadOnly) return;

    module.permissions.forEach(permission => (permission.checked = checked));
    this.refreshModuleState(module);
    this.cdr.markForCheck();
  }

  onPermissionToggle(module: PermissionModuleNode): void {
    if (this.isReadOnly) return;

    this.refreshModuleState(module);
    this.cdr.markForCheck();
  }

  private refreshModuleState(module: PermissionModuleNode): void {
    const total = module.permissions.length;
    const checked = module.permissions.filter(p => p.checked).length;

    module.checked = total > 0 && checked === total;
    module.indeterminate = checked > 0 && checked < total;
  }

  selectAll(): void {
    if (this.isReadOnly) return;

    this.modules.forEach(module => {
      module.permissions.forEach(p => (p.checked = true));
      this.refreshModuleState(module);
    });
    this.cdr.markForCheck();
  }

  clearAll(): void {
    if (this.isReadOnly) return;

    this.modules.forEach(module => {
      module.permissions.forEach(p => (p.checked = false));
      this.refreshModuleState(module);
    });
    this.cdr.markForCheck();
  }

  // -----------------------------------------------------------------------
  //  Save
  // -----------------------------------------------------------------------

  save(): void {
    this.nameError = '';

    const name = this.roleName.trim();
    if (!name) {
      this.nameError = 'A role name is required.';
      this.cdr.markForCheck();
      return;
    }

    // Flatten to leaf ids. The server replaces the role's whole grant set with this
    // list, so an unchecked box is a revocation - the same semantic as the reference
    // project's table-valued parameter.
    const permissionIds = this.modules
      .flatMap(module => module.permissions)
      .filter(permission => permission.checked)
      .map(permission => permission.permissionId);

    this.saving = true;
    this.cdr.markForCheck();

    this.roleService.saveRole({
      roleId: this.isNew ? null : this.roleId,
      roleName: name,
      roleDescription: this.roleDescription?.trim() || null,
      isActive: this.isActive,
      permissionIds
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.saving = false;

          if (res?.status === 1) {
            this.generalService.showSuccess(res.message || 'Role saved successfully.');
            this.router.navigate(['role/view']);
            return;
          }

          // Duplicate name and rename-not-allowed belong beside the field.
          const code = res?.data?.errorCode;
          if (code === 'ROLE_NAME_DUPLICATE' || code === 'ROLE_RENAME_NOT_ALLOWED') {
            this.nameError = res?.message || 'That role name cannot be used.';
          } else {
            this.generalService.showError(res?.message || 'Unable to save the role.');
          }

          this.cdr.markForCheck();
        },
        error: (err: any) => {
          this.saving = false;

          // 403 here means the caller lacks user_management. It should not be
          // reachable - the button is gated on the same permission - but if the UI
          // and the server ever disagree, the server wins and the user is told why.
          if (err?.status === 403) {
            this.generalService.showError('You do not have permission to manage roles.');
          } else {
            this.generalService.showError('Unable to save the role.');
          }

          this.cdr.markForCheck();
        }
      });
  }

  cancel(): void {
    this.router.navigate(['role/view']);
  }
}
