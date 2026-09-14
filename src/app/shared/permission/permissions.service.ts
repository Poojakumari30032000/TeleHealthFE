import { Injectable } from '@angular/core';
import { AuthService } from '../Auth/auth.service';
import { HttpService } from '../services/http.service';

/**
 * Decides what the signed-in user may see and do.
 *
 * WHERE PERMISSIONS COME FROM
 * ---------------------------
 * The server is authoritative. `GET api/Roles/myPermissions` returns the codes the
 * caller's role currently grants, resolved from the database, and those replace the
 * hardcoded `rolePermissions` map below as soon as they arrive.
 *
 * The hardcoded map is kept ONLY as a first-paint fallback for the moment between the
 * app starting and that call returning. Without it every gated button and route would
 * be denied for a few hundred milliseconds after login - the flicker-then-appear bug
 * the reference project has, where a failed fetch also leaves the user permanently
 * locked out of their own screens with no message.
 *
 * IMPORTANT: none of this is a security boundary. It decides what to RENDER. Every
 * protected operation is independently enforced by `[RequiresPermission]` on the API,
 * so hiding a button and blocking the request are separate mechanisms and the second
 * one is the one that matters. A user who calls the endpoint directly still gets 403.
 */
@Injectable({ providedIn: 'root' })
export class PermissionsService {

  private rolePermissions: { [roleId: number]: string[] } = {

    2: [
      'dashboard_admin',
      'facility_view', 'facility_add', 'facility_edit', 'facility_delete',
      'calendar_view', 'appointment_view', 'appointment_delete', 'appointment_edit', 'avilability_view', 'avilability_add', 'avilability_edit', 'avilability_delete', 'avilability_slot_view', 'avilability_slot_edit', 'avilability_slot_delete',
      'patient_view', 'patient_add', 'patient_edit', 'patient_delete',
      'user_view', 'user_add', 'user_edit', 'user_delete',
      'product_category_view', 'product_category_add', 'product_category_edit', 'product_category_delete',
      'product_view', 'product_add', 'product_edit', 'product_delete',
      'pharmacy_view', 'pharmacy_add', 'pharmacy_edit', 'pharmacy_delete',
      'questionnaier_view', 'questionnaier_add', 'questionnaier_edit', 'questionnaier_delete', 'questionnaier_list_edit',
      'supportTicket_view', 'supportTicket_edit', 'supportTicket_delete',
      'subscription_plan_view', 'subscription_plan_add', 'subscription_plan_edit', 'subscription_plan_delete',

      'treatment_view', 'treatment_update', 'treatment_patient_view', 'treatment_patient_edit', 'treatment_more_button',
      'prescription_view','prescription_edit','prescription_refill_button',
      'order_view', 'order_edit','product_category_view',
      'user_management',
    ],

    3: [
      'f_view', 'f_edit',
      'dashboard_clinic',
      'calendar_view', 'appointment_view', 'appointment_delete', 'appointment_edit', 'avilability_view', 'avilability_add', 'avilability_edit', 'avilability_delete', 'avilability_slot_view', 'avilability_slot_edit', 'avilability_slot_delete',
      'patient_view', 'patient_add', 'patient_edit', 'patient_delete',
      'user_view', 'user_add', 'user_edit', 'user_delete',
      'treatment_view', 'treatment_update', 'treatment_patient_view', 'treatment_patient_edit', 'treatment_more_button',
      'order_view', 'order_edit','product_category_view',
      'payment_view','payment_update',
      'prescription_view','prescription_edit','prescription_refill_button',
      'product_view',
      'questionnaier_view', 'questionnaier_add', 'questionnaier_edit',
      'supportTicket_view', 'supportTicket_add', 'supportTicket_edit', 'supportTicket_delete',
      'branding-view'
    ],

    4: [
        'dashboard_provider',
        'calendar_view', 'appointment_view', 'appointment_delete', 'appointment_edit', 'avilability_view', 'avilability_add', 'avilability_edit', 'avilability_delete', 'avilability_slot_view', 'avilability_slot_edit', 'avilability_slot_delete',
        'patient_view', 'patient_add', 'patient_edit', 'patient_delete',
        'treatment_view', 'treatment_update', 'treatment_patient_view', 'treatment_patient_edit', 'treatment_more_button',
        'order_view', 'order_edit',
        'payment_view',
        'prescription_view','prescription_edit','prescription_refill_button', 'prescription_timeLine_comment',
        'product_view',
        'supportTicket_view', 'supportTicket_add', 'supportTicket_edit', 'supportTicket_delete'
      ],

    5: [
      'dashboard_customer'
    ],

    6: [
      'dashboard_patient',
      'pt_view',
      'calendar_view', 'appointment_view',
      'treatment_view',
      'order_view',
      'payment_view',
      'prescription_view',
    ],

    7:[
      'supportTicket_view', 'supportTicket_edit', 'supportTicket_delete',
    ]
  };

  /**
   * Codes granted by the server. `null` means "not loaded yet" - which is what makes
   * the fallback above possible, and is deliberately distinct from an empty set
   * (a real role that grants nothing).
   */
  private serverPermissions: Set<string> | null = null;

  /** True for Super Admin, whose grant is implicit rather than enumerated. */
  private hasAllPermissions = false;

  /** Retained for backwards compatibility with `setApiPermissions()`. */
  private apiPermissions: { [key: string]: boolean } = {};

  private loading = false;

  constructor(private auth: AuthService, private http: HttpService) {

    this.auth.logout$.subscribe(() => this.reset());

    // Reload whenever the signed-in user changes, so switching accounts cannot leave
    // the previous user's permissions applied.
    this.auth.userChanged$.subscribe(() => this.loadFromServer());

    // The service is created lazily by DI - typically by the first PermissionGuard -
    // which can happen after AuthService has already restored a session and emitted
    // userChanged$. Load once on construction so that emission is not missed.
    if (this.auth.isAuthenticated()) {
      this.loadFromServer();
    }
  }

  /**
   * Fetches the caller's permissions and makes them authoritative.
   *
   * Failure is non-fatal and leaves the fallback in place: a transient network error
   * should not lock a user out of their own application. The server still enforces
   * every operation regardless of what this decides to render.
   */
  loadFromServer(): void {
    if (this.loading || !this.auth.isAuthenticated()) {
      return;
    }

    this.loading = true;

    this.http.get('Roles/myPermissions').subscribe({
      next: (res: any) => {
        this.loading = false;

        if (res?.status !== 1 || !res?.data) {
          return;
        }

        this.hasAllPermissions = res.data.hasAllPermissions === true;
        this.serverPermissions = new Set<string>(res.data.permissions ?? []);
      },
      error: () => {
        this.loading = false;
        // Keep the fallback. Do not clear serverPermissions: if a previous load
        // succeeded, those codes are still more accurate than the hardcoded map.
      }
    });
  }

  /**
   * Whether the user holds AT LEAST ONE of these codes - any-of, matching the
   * `[RequiresPermission]` filter on the server so the UI and the API agree.
   *
   * Resolution order:
   *   1. Super Admin holds everything.
   *   2. Server permissions, once loaded, are authoritative - including revocations.
   *      This is why they replace the fallback rather than being OR-ed with it: an
   *      admin removing a permission from a role has to actually remove it.
   *   3. Only until then, the hardcoded map.
   */
  hasAnyPermission(permissions: string[]): boolean {
    if (!permissions || permissions.length === 0) {
      return false;
    }

    if (this.hasAllPermissions) {
      return true;
    }

    // Explicit grants pushed in via setApiPermissions() still win, for any caller
    // relying on that older hook.
    if (permissions.some(p => this.apiPermissions[p] === true)) {
      return true;
    }

    if (this.serverPermissions) {
      return permissions.some(p => this.serverPermissions!.has(p));
    }

    // --- fallback, pre-load only ---
    const userRoleId = this.auth.getUserRoleId();
    if (!userRoleId) return false;

    // Super Admin (RoleId 1) has no entry in the map below, so without this it would
    // be denied everything until the server responded.
    if (userRoleId === 1) return true;

    return permissions.some(p =>
      this.rolePermissions[userRoleId]?.includes(p)
    );
  }

  /** Whether the user holds a single code. */
  hasPermission(permission: string): boolean {
    return this.hasAnyPermission([permission]);
  }

  /** True once the server's answer has arrived, so a screen can defer rendering if it wants to. */
  get isLoaded(): boolean {
    return this.serverPermissions !== null || this.hasAllPermissions;
  }

  /**
   * Pre-existing hook, kept working. Prefer `loadFromServer()`.
   */
  setApiPermissions(permissions: { [key: string]: boolean }): void {
    this.apiPermissions = permissions ?? {};
  }

  /** Clears everything. Called on logout so nothing survives into the next session. */
  reset(): void {
    this.apiPermissions = {};
    this.serverPermissions = null;
    this.hasAllPermissions = false;
    this.loading = false;
  }
}
