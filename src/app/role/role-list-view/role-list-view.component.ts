import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

import { GeneralService } from '../../shared/services/general.service';
import { RoleListItem, RoleService } from '../../shared/services/role.service';

/**
 * The role grid: every role, how many permissions it grants and how many users hold it.
 *
 * Equivalent of the reference project's `role-list` screen. Two differences worth
 * knowing, both deliberate:
 *
 *  - Delete is hidden for system roles AND for roles still assigned to a user. In the
 *    reference this was an `*ngIf="!element.isDefault"` and nothing else, so the rule
 *    was trivially bypassed by calling the endpoint. Here the same rules are enforced
 *    server-side in RolesRepo.DeleteRoleAsync; the hiding is only courtesy.
 *  - No `subDomain` or `createdByGUID` is sent. The server takes the acting user from
 *    the signed token.
 */
@Component({
  selector: 'app-role-list-view',
  templateUrl: './role-list-view.component.html',
  styleUrl: './role-list-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleListViewComponent implements OnInit, OnDestroy {

  roles: RoleListItem[] = [];
  totalCount = 0;
  pageNumber = 1;
  pageSize = 25;
  searchText = '';
  includeInactive = false;
  loading = true;

  readonly searchTerms = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private roleService: RoleService,
    private generalService: GeneralService,
    private cdr: ChangeDetectorRef
  ) {
    this.searchTerms
      .pipe(debounceTime(500), takeUntil(this.destroy$))
      .subscribe(() => {
        this.pageNumber = 1;
        this.fetchRoles();
      });
  }

  ngOnInit(): void {
    this.fetchRoles();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  searchTermChanged(): void {
    this.searchTerms.next();
  }

  onPageChange(pageNumber: number): void {
    this.pageNumber = pageNumber;
    this.fetchRoles();
  }

  onIncludeInactiveChange(): void {
    this.pageNumber = 1;
    this.fetchRoles();
  }

  fetchRoles(): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.roleService.getRoleList({
      pageNumber: this.pageNumber,
      pageSize: this.pageSize,
      searchText: this.searchText,
      includeInactive: this.includeInactive
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.loading = false;

          if (res?.status === 1) {
            this.roles = res.data ?? [];
            this.totalCount = res.totalEntityCount ?? this.roles.length;
          } else {
            this.generalService.showError(res?.message || 'Unable to load roles.');
          }

          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          // Surfaced rather than swallowed: an empty grid with no message is
          // indistinguishable from "there are no roles".
          this.generalService.showError('Unable to load roles.');
          this.cdr.markForCheck();
        }
      });
  }

  addRole(): void {
    this.router.navigate(['role/detail', 0]);
  }

  editRole(role: RoleListItem): void {
    this.router.navigate(['role/detail', role.roleId]);
  }

  /**
   * Whether the delete button should be offered at all. Mirrors the server's rules so
   * the user is not invited to do something that will be refused.
   */
  canDelete(role: RoleListItem): boolean {
    return !role.isSystemRole && role.assignedUserCount === 0;
  }

  deleteTooltip(role: RoleListItem): string {
    if (role.isSystemRole) {
      return 'Built-in roles cannot be deleted. You can still change their permissions.';
    }

    if (role.assignedUserCount > 0) {
      return `${role.assignedUserCount} user(s) still hold this role. Reassign them first.`;
    }

    return 'Delete role';
  }

  deleteRole(role: RoleListItem): void {
    this.generalService
      .commonConfirm('Delete role', `Are you sure you want to delete the role "${role.roleName}"?`)
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed: boolean) => {
        if (!confirmed) {
          return;
        }

        this.roleService.deleteRole(role.roleId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (res: any) => {
              if (res?.status === 1) {
                this.generalService.showSuccess('Role deleted successfully.');
                this.fetchRoles();
              } else {
                this.generalService.showError(res?.message || 'Unable to delete the role.');
              }
            },
            error: () => this.generalService.showError('Unable to delete the role.')
          });
      });
  }

  /** Super Admin's permission count is meaningless - its grant is implicit. */
  permissionLabel(role: RoleListItem): string {
    return role.hasAllPermissions ? 'All' : String(role.permissionCount);
  }
}
