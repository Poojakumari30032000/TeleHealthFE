import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Subject, of } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { PermissionsService } from 'app/shared/permission/permissions.service';
import { SelectedClinicalCode } from 'app/shared/code-picker/clinical-code-picker.component';
import { ClinicalCodeSystem } from 'app/shared/services/clinical-codes.service';
import {
  ClinicalCodeMapping,
  ClinicalCodeMappingsService,
  ClinicalCodeRef,
  CodeMappingTarget,
  CodeMappingTargetType,
} from 'app/shared/services/clinical-code-mappings.service';

/** The permissions the read endpoints require (any-of). */
export const CODE_MAPPING_VIEW_PERMISSIONS = ['product_view', 'product_category_view'];

/** The permissions `saveMappings` and `refreshReviewFlags` require (any-of). */
export const CODE_MAPPING_EDIT_PERMISSIONS = ['product_edit', 'product_category_edit'];

interface TargetTypeOption {
  value: CodeMappingTargetType;
  label: string;
  /** What the option maps to, shown as help text. */
  hint: string;
}

/**
 * TEL-22 criterion 3 - the administration screen for Category / Service / Package
 * to ICD-10-CM / CPT code mappings, over TEL-20's `api/ClinicalCodeMappings`.
 *
 * The screen has two halves:
 *
 * 1. **One target's codes.** Pick a Category, Service or Package and edit its codes
 *    with the shared `<app-clinical-code-picker>` (the same component the SOAP note
 *    screen uses). Saving sends the whole list, because the endpoint is a replace,
 *    not a merge - so what the administrator is looking at is what gets stored.
 *
 * 2. **The review queue.** A code release can terminate a code that is already
 *    mapped. The import flags those; this lists them across every target and can
 *    rebuild the queue on demand.
 *
 * Read and write are gated separately, matching the API. Nothing here is a security
 * boundary - the server enforces the same permissions.
 */
@Component({
  selector: 'app-clinical-code-mappings',
  templateUrl: './clinical-code-mappings.component.html',
  styleUrl: './clinical-code-mappings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicalCodeMappingsComponent implements OnInit, OnDestroy {
  readonly targetTypes: TargetTypeOption[] = [
    { value: 'Category', label: 'Category', hint: 'Product categories' },
    { value: 'Service', label: 'Service', hint: 'Products and drugs' },
    { value: 'Package', label: 'Package', hint: 'Bundles' },
  ];

  /** Both systems, so CPT can be mapped once a licensed release is loaded. */
  readonly codeSystems: ClinicalCodeSystem[] = ['ICD10CM', 'CPT'];

  targetType: CodeMappingTargetType = 'Category';
  targetId: number | null = null;

  /** The date codes are resolved against, and must be in force on to be saved. */
  effectiveOn: Date = new Date();

  /**
   * Off by default. Mapping a header code such as E11 is allowed - the server does
   * not refuse it here, unlike on a SOAP note - but it is not valid on a claim, so
   * the default keeps them out of the picker.
   */
  billableOnly = true;

  targets: CodeMappingTarget[] = [];
  targetsLoading = false;
  targetsTruncated = false;
  targetsError: string | null = null;

  /** What is stored right now, as the server last reported it. */
  saved: ClinicalCodeMapping[] = [];

  /** What the administrator is editing. Sent whole on save. */
  selection: SelectedClinicalCode[] = [];

  mappingsLoading = false;
  mappingsError: string | null = null;

  saving = false;
  saveError: string | null = null;
  /** The server's per-code refusals. Nothing was written when this is non-empty. */
  rejected: string[] = [];
  saveMessage: string | null = null;

  review: ClinicalCodeMapping[] = [];
  reviewLoading = false;
  reviewError: string | null = null;
  reviewMessage: string | null = null;
  refreshing = false;

  canEdit = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private mappings: ClinicalCodeMappingsService,
    private permissions: PermissionsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.canEdit = this.permissions.hasAnyPermission(CODE_MAPPING_EDIT_PERMISSIONS);
    this.loadTargets();
    if (this.canEdit) {
      this.loadReviewQueue();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---- derived state

  get selectedTarget(): CodeMappingTarget | null {
    return this.targets.find(t => t.id === this.targetId) ?? null;
  }

  /** Saved mappings whose code is not in force on the date, or is flagged. */
  get attention(): ClinicalCodeMapping[] {
    return this.saved.filter(m => !m.isInForce || m.needsReview);
  }

  /** True once the editor differs from what is stored, so Save has something to do. */
  get isDirty(): boolean {
    if (this.selection.length !== this.saved.length) return true;
    const stored = new Set(this.saved.map(m => `${m.codeSystem}:${m.code}`));
    return this.selection.some(c => !stored.has(`${c.codeSystem}:${c.code}`));
  }

  get effectiveOnIso(): string {
    return this.formatDate(this.effectiveOn);
  }

  // ---- target type and target

  onTargetTypeChange(type: CodeMappingTargetType): void {
    if (type === this.targetType) return;
    this.targetType = type;
    this.targetId = null;
    this.clearTargetState();
    this.loadTargets();
  }

  onTargetChange(id: number | null): void {
    this.targetId = id;
    this.clearTargetState();
    if (id != null) {
      this.loadMappings();
    }
    this.cdr.markForCheck();
  }

  onDateChange(date: Date | null): void {
    this.effectiveOn = date ?? new Date();
    // The date decides which release codes resolve against, so both halves move.
    if (this.targetId != null) {
      this.loadMappings();
    }
    if (this.canEdit) {
      this.loadReviewQueue();
    }
  }

  onSelectionChange(codes: SelectedClinicalCode[]): void {
    this.selection = codes;
    // A previous refusal describes a list the user has now changed.
    this.rejected = [];
    this.saveError = null;
    this.saveMessage = null;
    this.cdr.markForCheck();
  }

  /** Filters the target select by name, since the lists are loaded whole. */
  filterTarget = (input: string, option: { nzLabel: string | number | null }): boolean => {
    const label = String(option.nzLabel ?? '').toLowerCase();
    return label.includes((input ?? '').toLowerCase());
  };

  // ---- loading

  private loadTargets(): void {
    this.targetsLoading = true;
    this.targetsError = null;
    this.targetsTruncated = false;
    this.targets = [];
    this.cdr.markForCheck();

    const type = this.targetType;
    const request$ =
      type === 'Category'
        ? this.mappings.getCategories()
        : type === 'Service'
          ? this.mappings.getServices()
          : this.mappings.getPackages();

    request$
      .pipe(
        catchError(err => of({ status: 0, message: this.errorMessage(err) })),
        finalize(() => {
          this.targetsLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe(res => {
        // The type may have changed while this was in flight.
        if (type !== this.targetType) return;

        if (res?.status !== 1) {
          this.targetsError = res?.message || `Could not load the list of ${type.toLowerCase()}s.`;
          return;
        }

        const rows: any[] = Array.isArray(res.data) ? res.data : [];
        this.targets = rows.map(row => this.toTarget(type, row)).filter(t => t.id > 0);

        const total = Number(res.totalEntityCount ?? 0);
        this.targetsTruncated = total > 0 && this.targets.length < total;
        this.cdr.markForCheck();
      });
  }

  private toTarget(type: CodeMappingTargetType, row: any): CodeMappingTarget {
    if (type === 'Category') {
      return { id: Number(row?.categoryId ?? 0), name: row?.categoryName || `Category ${row?.categoryId}` };
    }
    if (type === 'Service') {
      return {
        id: Number(row?.productId ?? 0),
        name: row?.productName || `Service ${row?.productId}`,
        hint: row?.categoryName ?? null,
      };
    }
    return {
      id: Number(row?.bundleId ?? 0),
      name: row?.name || `Package ${row?.bundleId}`,
      hint: row?.categoryName ?? null,
    };
  }

  private loadMappings(): void {
    const type = this.targetType;
    const id = this.targetId;
    if (id == null) return;

    this.mappingsLoading = true;
    this.mappingsError = null;
    this.cdr.markForCheck();

    this.mappings
      .getMappings(type, id, this.effectiveOnIso)
      .pipe(
        catchError(err => of({ status: 0, message: this.errorMessage(err) })),
        finalize(() => {
          this.mappingsLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe(res => {
        // Drop a response for a target the user has already moved off.
        if (type !== this.targetType || id !== this.targetId) return;

        if (res?.status !== 1) {
          this.saved = [];
          this.selection = [];
          this.mappingsError = res?.message || 'Could not load the mapped codes.';
          return;
        }

        this.saved = Array.isArray(res.data) ? res.data : [];
        this.selection = this.saved.map(m => this.toSelected(m));
        this.cdr.markForCheck();
      });
  }

  private loadReviewQueue(): void {
    this.reviewLoading = true;
    this.reviewError = null;
    this.cdr.markForCheck();

    this.mappings
      .getMappingsNeedingReview(this.effectiveOnIso)
      .pipe(
        catchError(err => of({ status: 0, message: this.errorMessage(err) })),
        finalize(() => {
          this.reviewLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe(res => {
        if (res?.status !== 1) {
          this.review = [];
          this.reviewError = res?.message || 'Could not load the review queue.';
          return;
        }
        this.review = Array.isArray(res.data) ? res.data : [];
        this.cdr.markForCheck();
      });
  }

  // ---- saving

  save(): void {
    const type = this.targetType;
    const id = this.targetId;
    if (id == null || !this.canEdit || this.saving) return;

    this.saving = true;
    this.saveError = null;
    this.saveMessage = null;
    this.rejected = [];
    this.cdr.markForCheck();

    const codes: ClinicalCodeRef[] = this.selection.map(c => ({
      codeSystem: c.codeSystem,
      code: c.code,
    }));

    this.mappings
      .saveMappings(type, id, codes, this.effectiveOnIso)
      .pipe(
        catchError(err => of({ status: 0, message: this.errorMessage(err), data: err?.error?.data })),
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe(res => {
        const result = res?.data;

        if (res?.status !== 1) {
          // All-or-nothing: nothing was written, so the editor keeps the user's list
          // for them to correct rather than snapping back to what is stored.
          this.rejected = Array.isArray(result?.rejected) ? result.rejected : [];
          this.saveError = res?.message || result?.message || 'The codes were not saved.';
          this.cdr.markForCheck();
          return;
        }

        this.saveMessage = this.savedSummary(result);
        // Re-read rather than trusting the editor: the server resolves each code
        // against the release, which fills in descriptions and review flags.
        this.loadMappings();
        if (this.canEdit) {
          this.loadReviewQueue();
        }
      });
  }

  /** Throws away the edits and goes back to what is stored. */
  revert(): void {
    this.selection = this.saved.map(m => this.toSelected(m));
    this.rejected = [];
    this.saveError = null;
    this.saveMessage = null;
    this.cdr.markForCheck();
  }

  refreshReviewFlags(): void {
    if (!this.canEdit || this.refreshing) return;

    this.refreshing = true;
    this.reviewMessage = null;
    this.reviewError = null;
    this.cdr.markForCheck();

    this.mappings
      .refreshReviewFlags(this.effectiveOnIso)
      .pipe(
        catchError(err => of({ status: 0, message: this.errorMessage(err) })),
        finalize(() => {
          this.refreshing = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe(res => {
        if (res?.status !== 1) {
          this.reviewError = res?.message || 'Could not re-check the mappings.';
          this.cdr.markForCheck();
          return;
        }
        const flagged = Number(res.data?.flagged ?? 0);
        const cleared = Number(res.data?.cleared ?? 0);
        this.reviewMessage = `${flagged} flagged, ${cleared} cleared.`;
        this.loadReviewQueue();
        if (this.targetId != null) {
          this.loadMappings();
        }
      });
  }

  /** Jumps the editor to the target a review row belongs to. */
  openFromReview(row: ClinicalCodeMapping): void {
    if (row.targetType !== this.targetType) {
      this.targetType = row.targetType;
      this.targetId = null;
      this.clearTargetState();
      this.loadTargets();
    }
    this.targetId = row.targetId;
    this.clearTargetState();
    this.loadMappings();
  }

  // ---- display helpers

  targetTypeLabel(type: CodeMappingTargetType): string {
    return this.targetTypes.find(t => t.value === type)?.label ?? type;
  }

  systemLabel(system: ClinicalCodeSystem): string {
    return system === 'CPT' ? 'CPT' : 'ICD-10-CM';
  }

  statusOf(mapping: ClinicalCodeMapping): string {
    if (!mapping.isInForce) {
      return mapping.reviewReason || 'Not in force on this date';
    }
    if (mapping.needsReview) {
      return mapping.reviewReason || 'Flagged for review';
    }
    return 'In force';
  }

  trackByMappingId = (_: number, m: ClinicalCodeMapping) => m.clinicalCodeMappingId;
  trackByTargetId = (_: number, t: CodeMappingTarget) => t.id;
  trackByRejection = (index: number, reason: string) => `${index}:${reason}`;

  // ---- internals

  private clearTargetState(): void {
    this.saved = [];
    this.selection = [];
    this.mappingsError = null;
    this.saveError = null;
    this.saveMessage = null;
    this.rejected = [];
  }

  /**
   * A stored mapping as the picker's value.
   *
   * `codeId` and `codeSetVersionId` are 0: the mapping is keyed on the code string,
   * not on a row in one release, and `saveMappings` reads only the system and the
   * code. A code picked in this session carries its real ids; both save the same.
   */
  private toSelected(m: ClinicalCodeMapping): SelectedClinicalCode {
    return {
      codeSystem: m.codeSystem,
      codeId: 0,
      codeSetVersionId: 0,
      code: m.code,
      displayCode: m.displayCode || m.code,
      description: m.longDescription || m.shortDescription || '(not in force on this date)',
      isBillable: m.isBillable !== false,
    };
  }

  private savedSummary(result: any): string {
    const added = Number(result?.added ?? 0);
    const removed = Number(result?.removed ?? 0);
    const unchanged = Number(result?.unchanged ?? 0);
    return `Saved: ${added} added, ${removed} removed, ${unchanged} unchanged.`;
  }

  private errorMessage(err: any): string {
    if (err?.status === 403) return 'You do not have permission to manage code mappings.';
    return err?.error?.message || err?.message || 'The request failed.';
  }

  private formatDate(value: Date): string {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
