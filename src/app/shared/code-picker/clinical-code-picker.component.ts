import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  forwardRef,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { PermissionsService } from 'app/shared/permission/permissions.service';
import {
  ClinicalCodeSearchItem,
  ClinicalCodeSearchResult,
  ClinicalCodeSystem,
  ClinicalCodesService,
} from 'app/shared/services/clinical-codes.service';

/**
 * One code the user picked. This is the component's value.
 *
 * `codeSetVersionId` is kept so whatever stores the selection can resolve the code
 * against the release that was in force when it was picked (TEL-19 versioning).
 */
export interface SelectedClinicalCode {
  codeSystem: ClinicalCodeSystem;
  codeId: number;
  codeSetVersionId: number;
  code: string;
  displayCode: string;
  description: string;
  isBillable: boolean;
}

interface SearchState {
  loading: boolean;
  items: ClinicalCodeSearchItem[];
  totalCount: number;
  error: string | null;
}

/** The permission codes TEL-21's search endpoint requires (any-of). */
export const CLINICAL_CODE_PICKER_PERMISSIONS = ['treatment_patient_edit', 'treatment_update'];

const MIN_QUERY_LENGTH = 2;
const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

/**
 * TEL-22 - reusable ICD-10-CM / CPT code picker. Used on the treatment SOAP
 * note screen (soap-notes.component), which loads and saves the note's codes.
 *
 * Type-ahead search against `api/ClinicalCodes/searchCodes` (TEL-21), code and
 * description shown together, any number of selections. Works as a form control
 * (`formControlName` / `ngModel`, value `SelectedClinicalCode[]`) or with
 * `[selected]` / `(selectedChange)`.
 *
 * It does not save anything itself; the host screen does, so the picker can be
 * reused wherever codes are attached.
 *
 * The search box is gated on the same permissions the search API enforces, so a
 * user who would get a 403 sees a notice instead of a search box that always
 * fails. The selected codes are shown either way.
 */
@Component({
  selector: 'app-clinical-code-picker',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzSelectModule,
    NzRadioModule,
    NzTagModule,
    NzButtonModule,
    NzIconModule,
    NzEmptyModule,
    NzToolTipModule,
  ],
  templateUrl: './clinical-code-picker.component.html',
  styleUrl: './clinical-code-picker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ClinicalCodePickerComponent),
      multi: true,
    },
  ],
})
export class ClinicalCodePickerComponent implements OnInit, OnDestroy, ControlValueAccessor {
  /** Which code systems the user can switch between. The first is selected initially. */
  @Input() codeSystems: ClinicalCodeSystem[] = ['ICD10CM', 'CPT'];

  /**
   * The date of service (yyyy-MM-dd or a Date). Only codes in force on that date
   * are offered. Defaults to today on the server.
   */
  @Input() serviceDate: string | Date | null = null;

  /**
   * Leave out ICD-10-CM header codes, which cannot go on a claim. On by default;
   * turn it off for browsing the classification.
   */
  @Input() billableOnly = true;

  /** 0 for no limit. */
  @Input() maxSelections = 0;

  /**
   * Show the selected codes only: no search box, no remove buttons. For a user
   * who may view the record but not change it.
   */
  @Input() readOnly = false;

  @Input() placeholder = 'Search by code or description, e.g. E11.65 or type 2 diabetes';

  @Input() set disabled(value: boolean) {
    this.isDisabled = !!value;
  }

  @Input() set selected(value: SelectedClinicalCode[] | null | undefined) {
    this.selection = Array.isArray(value) ? [...value] : [];
  }

  @Output() selectedChange = new EventEmitter<SelectedClinicalCode[]>();

  activeSystem: ClinicalCodeSystem = 'ICD10CM';
  selection: SelectedClinicalCode[] = [];
  isDisabled = false;

  /** Bound to the search select; always reset to null after a pick. */
  pickValue: string | null = null;
  query = '';
  state: SearchState = { loading: false, items: [], totalCount: 0, error: null };

  readonly minQueryLength = MIN_QUERY_LENGTH;

  private readonly search$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private onChange: (value: SelectedClinicalCode[]) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(
    private clinicalCodes: ClinicalCodesService,
    private permissions: PermissionsService,
    private cdr: ChangeDetectorRef,
  ) {}

  /** Mirrors `[RequiresPermission]` on the search endpoint. */
  get canSearch(): boolean {
    if (this.readOnly) return false;
    return this.permissions.hasAnyPermission(CLINICAL_CODE_PICKER_PERMISSIONS);
  }

  get atLimit(): boolean {
    return this.maxSelections > 0 && this.selection.length >= this.maxSelections;
  }

  ngOnInit(): void {
    this.activeSystem = this.codeSystems[0] ?? 'ICD10CM';

    this.search$
      .pipe(
        // Keyed on the code system too, so switching system re-runs a query.
        map(term => ({ term: term.trim(), system: this.activeSystem })),
        debounceTime(DEBOUNCE_MS),
        distinctUntilChanged((a, b) => a.term === b.term && a.system === b.system),
        tap(({ term }) => {
          this.query = term;
          this.state = {
            loading: term.length >= MIN_QUERY_LENGTH,
            items: [],
            totalCount: 0,
            error: null,
          };
          this.cdr.markForCheck();
        }),
        // switchMap drops the response to a query the user has already typed past.
        switchMap(({ term, system }) => {
          if (term.length < MIN_QUERY_LENGTH) return of(null);
          return this.clinicalCodes
            .searchCodes({
              query: term,
              codeSystem: system,
              onDate: this.formatDate(this.serviceDate),
              billableOnly: this.billableOnly,
              pageSize: PAGE_SIZE,
            })
            .pipe(catchError(err => of({ status: 0, message: this.errorMessage(err) })));
        }),
        takeUntil(this.destroy$),
      )
      .subscribe(res => {
        if (res === null) {
          this.state = { loading: false, items: [], totalCount: 0, error: null };
        } else if (res?.status === 1 && res?.data) {
          const data = res.data as ClinicalCodeSearchResult;
          this.state = {
            loading: false,
            items: data.items ?? [],
            totalCount: data.totalCount ?? 0,
            error: data.codeSetVersionId == null ? this.noReleaseMessage() : null,
          };
        } else {
          this.state = {
            loading: false,
            items: [],
            totalCount: 0,
            error: res?.message || 'Code search failed.',
          };
        }
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---- template events

  onSearch(term: string): void {
    this.search$.next(term ?? '');
  }

  onSystemChange(system: ClinicalCodeSystem): void {
    this.activeSystem = system;
    // Results from the other system are meaningless now; start the search afresh.
    this.query = '';
    this.state = { loading: false, items: [], totalCount: 0, error: null };
    this.search$.next('');
    this.cdr.markForCheck();
  }

  onPick(key: string | null): void {
    const item = this.state.items.find(i => this.keyOf(i) === key);

    // Clear the search box after the pick. Setting null straight back would not
    // register as a change (it was already null), so let the pick land first.
    this.pickValue = key;
    setTimeout(() => {
      this.pickValue = null;
      this.cdr.markForCheck();
    });

    if (!item || this.isDisabled || this.atLimit || this.isSelected(item)) {
      this.cdr.markForCheck();
      return;
    }

    this.selection = [
      ...this.selection,
      {
        codeSystem: this.activeSystem,
        codeId: item.codeId,
        codeSetVersionId: item.codeSetVersionId,
        code: item.code,
        displayCode: item.displayCode,
        description: item.longDescription,
        isBillable: item.isBillable,
      },
    ];
    this.emit();
  }

  remove(code: SelectedClinicalCode): void {
    if (this.isDisabled || this.readOnly) return;
    this.selection = this.selection.filter(
      c => !(c.codeSystem === code.codeSystem && c.code === code.code),
    );
    this.emit();
  }

  onBlur(): void {
    this.onTouched();
  }

  isSelected(item: ClinicalCodeSearchItem): boolean {
    return this.selection.some(c => c.codeSystem === this.activeSystem && c.code === item.code);
  }

  keyOf(item: ClinicalCodeSearchItem): string {
    return `${this.activeSystem}:${item.code}`;
  }

  systemLabel(system: ClinicalCodeSystem): string {
    return system === 'CPT' ? 'CPT' : 'ICD-10-CM';
  }

  trackByKey = (_: number, item: ClinicalCodeSearchItem) => item.code;
  trackBySelected = (_: number, c: SelectedClinicalCode) => `${c.codeSystem}:${c.code}`;

  // ---- ControlValueAccessor

  writeValue(value: SelectedClinicalCode[] | null): void {
    this.selection = Array.isArray(value) ? [...value] : [];
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: SelectedClinicalCode[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    this.cdr.markForCheck();
  }

  // ---- helpers

  private emit(): void {
    const value = [...this.selection];
    this.onChange(value);
    this.onTouched();
    this.selectedChange.emit(value);
    this.cdr.markForCheck();
  }

  private noReleaseMessage(): string {
    return this.activeSystem === 'CPT'
      ? 'No CPT code set is loaded. CPT is AMA-licensed and is loaded once a license is confirmed.'
      : 'No ICD-10-CM code set is in force for this date.';
  }

  private errorMessage(err: any): string {
    if (err?.status === 403) return 'You do not have permission to search codes.';
    return err?.error?.message || err?.message || 'Code search failed.';
  }

  private formatDate(value: string | Date | null): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value.substring(0, 10);
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
