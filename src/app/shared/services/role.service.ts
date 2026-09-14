import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpService } from './http.service';

/** One row of the role grid. Mirrors RoleListItemResponseDTO. */
export interface RoleListItem {
  roleId: number;
  roleName: string;
  roleDescription: string | null;
  isSystemRole: boolean;
  isDefault: boolean;
  isActive: boolean;
  permissionCount: number;
  hasAllPermissions: boolean;
  assignedUserCount: number;
}

/** A single permission leaf - the only level that is actually granted. */
export interface PermissionNode {
  permissionId: number;
  permissionCode: string;
  actionName: string;
  description: string | null;
  checked: boolean;
}

/** A module grouping. `checked` / `indeterminate` are rollups computed by the server. */
export interface PermissionModuleNode {
  moduleKey: string;
  moduleName: string;
  checked: boolean;
  indeterminate: boolean;
  permissions: PermissionNode[];
}

/** The permission catalog with one role's grants marked. Mirrors RolePermissionTreeResponseDTO. */
export interface RolePermissionTree {
  roleId: number | null;
  roleName: string | null;
  isSystemRole: boolean;
  hasAllPermissions: boolean;
  modules: PermissionModuleNode[];
}

/**
 * Role and permission management API.
 *
 * Every method here is a privileged operation and the server enforces that
 * independently - Super Admin or Global Admin, plus the `user_management` permission.
 * Nothing in this file is a security boundary; it only shapes requests.
 *
 * Note what is NOT sent: no role id, no user id, no tenant identifier taken from
 * `localStorage`. The reference project passed `CreatedByGUID` and `SubDomain` up from
 * the client on every role call, which made audit attribution and tenant selection
 * client-controlled. Here the server reads the acting user from the signed token.
 */
@Injectable({ providedIn: 'root' })
export class RoleService {
  constructor(private http: HttpService) {}

  /** Paged role grid. */
  getRoleList(request: {
    pageNumber?: number;
    pageSize?: number;
    searchText?: string;
    sortColumn?: string;
    sortOrder?: string;
    includeInactive?: boolean;
  }): Observable<any> {
    return this.http.post('Roles/getRoleList', request);
  }

  /**
   * The permission catalog as a tree, with this role's grants marked.
   * Pass 0 for the blank catalog used when creating a role.
   */
  getRolePermissionTree(roleId: number): Observable<any> {
    return this.http.get(`Roles/getRolePermissionTree?roleId=${roleId || 0}`);
  }

  /**
   * Creates a role when `roleId` is falsy, otherwise updates it.
   *
   * `permissionIds` must be the COMPLETE set the role should end up with - the server
   * replaces the existing grants with exactly this list, so an omitted id is a
   * revocation.
   */
  saveRole(request: {
    roleId?: number | null;
    roleName: string;
    roleDescription?: string | null;
    isActive?: boolean;
    permissionIds: number[];
  }): Observable<any> {
    return this.http.post('Roles/saveRole', request);
  }

  /** Soft-deletes a custom role. Refused server-side for system roles and roles in use. */
  deleteRole(roleId: number): Observable<any> {
    return this.http.post('Roles/deleteRole', { roleId });
  }

  /** Changes which role a user holds. Takes effect on that user's next request. */
  assignUserRole(userId: number, roleId: number): Observable<any> {
    return this.http.post('Roles/assignUserRole', { userId, roleId });
  }

  /**
   * The caller's own effective permissions.
   *
   * `PermissionsService` calls this itself on sign-in; use that service for permission
   * checks rather than calling this directly.
   */
  getMyPermissions(): Observable<any> {
    return this.http.get('Roles/myPermissions');
  }
}
