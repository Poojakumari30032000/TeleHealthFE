import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzModalService } from 'ng-zorro-antd/modal';
import { debounceTime, distinctUntilChanged, finalize, Subject, takeUntil } from 'rxjs';
import { GeneralService } from 'app/shared/services/general.service';
import {AuthService} from "../../shared/Auth/auth.service";

interface ApiResponse<T> {
  status: number;
  success: boolean;
  message: string;
  count: number;
  data: T;
  totalEntityCount: number;
  totalPages: number;
}

type DiscountType = 0 | 1;

type CouponIsActiveString = 'true' | 'false' | 'expired';

interface CouponDTO {
  coupanCodeId: number;
  facilityId: number;
  couponCode: string;

  discount?: number;
  discountType?: DiscountType;
  discountPercentage?: number;
  appliesToRecurring?: boolean;
  isActive: CouponIsActiveString;
  isExpired: boolean;
  createdBy: number;
  createdDate: string;
  expiryDate?: string | null;
  bundleIds: number[];
  bundles: any[];
  facilityName: string;
}

type CouponRow = CouponDTO;

interface CreateCouponPayload {
  facilityId: number;
  couponCode: string;
  discount: number;
  discountType: DiscountType;
  createdBy: number;
  bundleIds: number[];
  appliesToRecurring: boolean;
  ExpiryDate: string | null;
}

interface UpdateCouponPayload {
  coupanCodeId: number;
  couponCode: string;
  discount: number;
  discountType: DiscountType;
  modifiedBy: number;
  bundleIds: number[];
  appliesToRecurring?: boolean;
  ExpiryDate: string | null;
}

interface CouponsByFacilityPayload {
  facilityId: number;
  clientTimezoneOffsetMinutes: number;

  status?: CouponIsActiveString;
  pageNumber: number;
  pageSize: number;
  searchTerm: string;
}

interface FacilityDropdownItem {
  facilityId: number;
  titlelong: string;
  titleshort: string;
}

@Component({
  selector: 'app-coupon-list-view',
  templateUrl: './coupon-list-view.component.html',
  styleUrl: './coupon-list-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CouponListViewComponent implements OnInit, OnDestroy {
  showFilters = true;

  loading: boolean = false;
  tableData: CouponRow[] = [];
  total: number = 0;
  pageIndex: number = 1;
  pageSize: number = 100;
  readonly pageSizeOptions: number[] = [25, 50, 100, 200];

  searchTerm: string = '';
  private searchTerm$ = new Subject<string>();

  bundlesLoading: boolean = false;
  bundleOptions: any[] = [];
  private bundleNameById = new Map<number, string>();

  isModalVisible: boolean = false;
  isSaving: boolean = false;
  isEditMode: boolean = false;
  editingId: number | null = null;
  form!: FormGroup;

  filterStatus: CouponIsActiveString | null = null;
  appliedFilters: Array<{ name: string; value: any }> = [];

  userRole: string = '';
  isGlobalAdmin = false;
  selectedFacilityId: number | null = null;
  facilities: FacilityDropdownItem[] = [];
  facilityDropdownLoading = false;

  readonly ALL_SENTINEL = '__ALL__';
  private patchingPackages = false;

  lockedBundleIds: number[] = [];

  disabledExpiryDate = (current: Date): boolean => {
    return current <= new Date(new Date().setHours(0, 0, 0, 0));
  };

  private destroy$ = new Subject<void>();

  constructor(
    private gs: GeneralService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private modal: NzModalService,
    private auth: AuthService,
  ) {}

  private get clinicFacilityId(): number {
    const n = Number(this.auth.getUserFacilityId());
    return Number.isFinite(n) ? n : 0;
  }

  private get activeFacilityId(): number | null {
    if (this.isGlobalAdmin) {
      if (this.selectedFacilityId == null) return null;
      const n = Number(this.selectedFacilityId);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return this.clinicFacilityId > 0 ? this.clinicFacilityId : null;
  }
  private get currentUserId(): number {
    const n = Number(this.gs.userID);
    return Number.isFinite(n) ? n : 0;
  }

  private normalizeCouponRow(r: any): CouponRow {
    const exp = Boolean(r?.isExpired);
    const a = r?.isActive;
    let isActive: CouponIsActiveString;
    if (exp || a === 'expired' || a === 'Expired') {
      isActive = 'expired';
    } else if (a === true || a === 'true' || a === 'True') {
      isActive = 'true';
    } else {
      isActive = 'false';
    }
    const appliesToRecurring = r?.appliesToRecurring !== false;
    return { ...r, isActive, isExpired: exp, appliesToRecurring };
  }

  ngOnInit(): void {
    this.userRole = this.auth.getUserRole() || '';
    this.isGlobalAdmin = this.userRole === 'Global Admin';

    this.initForm();

    this.form.get('packages')!
      .valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(vals => this.onPackagesChanged(vals));

    this.form.get('discountType')!
      .valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((dt: DiscountType) => this.applyDiscountValidators(dt));

    this.searchTerm$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((term) => {
        this.searchTerm = term;
        this.pageIndex = 1;
        this.loadCoupons();
      });

    if (this.isGlobalAdmin) {
      this.loadFacilitiesDropdown();
      this.syncAppliedFilters();
    } else {
      this.loadBundles();
      this.loadCoupons();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.form = this.fb.group({
      couponCode: [
        '',
        [Validators.required]
      ],
      discountType: [1 as DiscountType, [Validators.required]],
      discount: [null, [Validators.required, Validators.min(0), Validators.max(9999)]],
      packages: [<number[]>[], [Validators.required]],
      appliesToRecurring: [true],
      expiryDate: [null as Date | null, [Validators.required]]
    });

    this.applyDiscountValidators(this.form.value.discountType as DiscountType);
  }

  private applyDiscountValidators(dt: DiscountType): void {
    const ctrl = this.form.get('discount');
    if (!ctrl) return;
    if (dt === 1) {

      ctrl.setValidators([Validators.required, Validators.min(0), Validators.max(100)]);
    } else {

      ctrl.setValidators([Validators.required, Validators.min(0)]);
    }
    ctrl.updateValueAndValidity({ emitEvent: false });
    this.cdr.markForCheck();
  }

  private resetForm(): void {
    this.form.get('couponCode')?.enable();
    this.form.get('discountType')?.enable();
    this.form.get('discount')?.enable();
    this.lockedBundleIds = [];
    this.form.reset({
      couponCode: '',
      discountType: 1 as DiscountType,
      discount: null,
      packages: [],
      appliesToRecurring: true,
      expiryDate: null
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  openAddModal(): void {
    if (this.isGlobalAdmin && !this.activeFacilityId) {
      this.gs.showInfo('Please select a clinic first.');
      return;
    }

    this.form.get('couponCode')?.enable();
    this.form.get('discountType')?.enable();
    this.form.get('discount')?.enable();
    this.lockedBundleIds = [];

    this.isEditMode = false;
    this.editingId = null;
    this.form.reset({
      couponCode: '',
      discountType: 1 as DiscountType,
      discount: null,
      packages: [],
      appliesToRecurring: true,
      expiryDate: null
    });
    this.applyDiscountValidators(1);
    this.isModalVisible = true;
  }

  openEditModal(row: CouponRow): void {
    if (row.isExpired) {
      this.gs.showInfo('Expired coupons cannot be edited.');
      return;
    }
    this.isEditMode = true;
    this.editingId = row.coupanCodeId;
    this.lockedBundleIds = [...(row.bundleIds || [])];

    const dt: DiscountType = (row.discountType ?? (row.discountPercentage != null ? 1 : 1)) as DiscountType;
    const disc = row.discount != null
      ? row.discount
      : (row.discountPercentage != null ? row.discountPercentage : 0);

    this.form.reset({
      couponCode: row.couponCode,
      discountType: dt,
      discount: disc,
      packages: [...(row.bundleIds || [])],
      appliesToRecurring: row.appliesToRecurring !== false,
      expiryDate: row.expiryDate ? new Date(row.expiryDate) : null
    });

    this.form.get('couponCode')?.disable();
    this.form.get('discountType')?.disable();
    this.form.get('discount')?.disable();

    this.applyDiscountValidators(dt);
    this.isModalVisible = true;
  }

  closeModal(): void {
    this.isModalVisible = false;
  }

  loadBundles(): void {
    const facilityID = this.activeFacilityId;
    if (!facilityID) {
      this.bundleOptions = [];
      this.bundleNameById.clear();
      this.cdr.markForCheck();
      return;
    }

    this.bundlesLoading = true;
    this.gs
      .GetAllBundlesNewForDropdown(facilityID)
      .pipe(
        finalize(() => {
          this.bundlesLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: ApiResponse<any[]>) => {
          this.bundleOptions = res?.data || [];
          this.bundleNameById.clear();
          for (const b of this.bundleOptions) {
            this.bundleNameById.set(b.bundleId, b.name);
          }
        },
        error: () => this.gs.showError('Failed to load packages.')
      });
  }

  loadCoupons(): void {
    const facilityID = this.activeFacilityId;
    if (!facilityID) {
      this.loading = false;
      this.tableData = [];
      this.total = 0;
      this.syncAppliedFilters();
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    const payload: CouponsByFacilityPayload = {
      facilityId: facilityID,
      clientTimezoneOffsetMinutes: -new Date().getTimezoneOffset(),
      pageNumber: this.pageIndex,
      pageSize: this.pageSize,
      searchTerm: (this.searchTerm || '').trim(),
      ...(this.filterStatus !== null ? { status: this.filterStatus } : {})
    };

    this.gs
      .getAllCouponByFacilityID(payload)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: ApiResponse<CouponRow[]>) => {
          const raw = res?.data || [];
          this.tableData = raw.map((r: any) => this.normalizeCouponRow(r));

          this.total = Number(res?.totalEntityCount ?? res?.count ?? this.tableData.length);
          this.syncAppliedFilters();
          this.cdr.markForCheck();
        },
        error: () => this.gs.showError('Failed to load coupons.')
      });
  }

  onPageIndexChange(pi: number): void {
    if (pi === this.pageIndex) return;
    this.pageIndex = pi;
    this.loadCoupons();
  }

  onPageSizeChange(ps: number): void {
    if (ps === this.pageSize) return;
    this.pageSize = ps;
    this.pageIndex = 1;
    this.loadCoupons();
  }

  onSearchTermChanged(value: string): void {
    this.searchTerm$.next(value ?? '');
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.pageIndex = 1;
    this.loadCoupons();
  }

  submit(): void {
    const facilityID = this.activeFacilityId;
    if (!facilityID) {
      this.gs.showInfo('Please select a clinic first.');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const couponCode = String(raw.couponCode || '').trim();
    const discountType = Number(raw.discountType) as DiscountType;
    const discount = Number(raw.discount);
    const bundleIds = (raw.packages as number[]) || [];
    const appliesToRecurring = raw.appliesToRecurring !== false;
    const expiryDateRaw = raw.expiryDate as Date | null;

    const expiryLocalEndOfDay = expiryDateRaw
      ? new Date(
          expiryDateRaw.getFullYear(),
          expiryDateRaw.getMonth(),
          expiryDateRaw.getDate(),
          23, 59, 59, 999
        )
      : null;
    const ExpiryDate = expiryLocalEndOfDay ? expiryLocalEndOfDay.toISOString() : null;

    let invalidRows=0;

    if (discountType == 0){
    bundleIds.forEach((bundleId) => {
      this.bundleOptions.forEach((bundleOption) => {
        if(bundleId == bundleOption.bundleId && discount > bundleOption.price ){
          this.gs.showError('The Discount Price cannot exceed or be equal to the ' + bundleOption.name + ' package price of $'+ bundleOption.price);
          invalidRows++;
        }
      })
    })
    }

    if(invalidRows <= 0){
    this.isSaving = true;

    if (this.isEditMode && this.editingId !== null) {
      const payload: UpdateCouponPayload = {
        coupanCodeId: this.editingId,
        couponCode,
        discount,
        discountType,
        modifiedBy: this.currentUserId,
        bundleIds,
        appliesToRecurring,
        ExpiryDate
      };

      this.gs
        .updateCoupon(payload)
        .pipe(
          finalize(() => {
            this.isSaving = false;
            this.isModalVisible = false;
            this.resetForm();
            this.loadCoupons();
            this.cdr.markForCheck();
          }),
          takeUntil(this.destroy$)
        )
        .subscribe({
          next: (res: any) => {
            console.log(res);
            if (res?.message === "Coupon code updated successfully.") {
              this.gs.showSuccess(res?.message || 'Coupon updated.');
            } else {
              this.gs.showInfo(res?.message || 'Update failed.');
            }
          },
          error: (err: unknown) => {
            this.gs.showError('Failed to update coupon.');
            console.error(err);
          }
        });
    } else {
      const payload: CreateCouponPayload = {
        facilityId: facilityID,
        couponCode,
        discount,
        discountType,
        createdBy: this.currentUserId,
        bundleIds,
        appliesToRecurring,
        ExpiryDate
      };

      this.gs
        .createCoupon(payload)
        .pipe(
          finalize(() => {
            this.isSaving = false;
            this.isModalVisible = false;
            this.resetForm();
            this.loadCoupons();
            this.cdr.markForCheck();
          }),
          takeUntil(this.destroy$)
        )
        .subscribe({
          next: (res: any) => {
            if (res?.message === "Coupon code created successfully.") {
              this.gs.showSuccess(res?.message || 'Coupon created.');
            } else {
              this.gs.showInfo(res?.message || 'Create failed.');
            }
          },
          error: (err: unknown) => {
            this.gs.showError('Failed to create coupon.');
            console.error(err);
          }
        });
    }
    }
  }

  toggleStatus(row: CouponRow): void {
    if (row.isActive === 'expired' || row.isExpired) {
      this.gs.showInfo('Expired coupons cannot be activated or deactivated.');
      return;
    }
    const toActivate = row.isActive !== 'true';

    this.modal.confirm({
      nzTitle: toActivate ? 'Activate coupon?' : 'Deactivate coupon?',
      nzContent: `Are you sure you want to ${toActivate ? 'activate' : 'deactivate'} coupon ${row.couponCode}?`,
      nzCentered: true,
      nzOnOk: () =>
        new Promise<void>((resolve) => {
          this.gs
            .toggleCouponStatus(row.coupanCodeId)
            .pipe(
              finalize(() => {
                this.loadCoupons();
                resolve();
              }),
              takeUntil(this.destroy$)
            )
            .subscribe({
              next: (res: ApiResponse<unknown>) => {
                if (res?.success) {
                  this.gs.showSuccess('Status updated.');
                } else {
                  this.gs.showInfo(res?.message || 'Failed to update status.');
                }
              },
              error: () => {
                this.gs.showError('Failed to update status.');
              }
            });
        })
    });
  }

  packageNamesFromIds(ids: number[], bundles?: any[]): string[] {
    if (bundles && bundles.length) {
      return bundles.map((b) => b.name);
    }
    const names: string[] = [];
    for (const id of ids || []) {
      const n = this.bundleNameById.get(id);
      if (n) names.push(n);
    }
    return names;
  }

  readonly PACKAGES_VISIBLE_LIMIT = 2;

  visiblePackages(names: string[]): string[] {
    return names.slice(0, this.PACKAGES_VISIBLE_LIMIT);
  }

  hiddenPackages(names: string[]): string[] {
    return names.slice(this.PACKAGES_VISIBLE_LIMIT);
  }

  statusBadgeClass(isActive: boolean): string {
    return isActive ? 'ui-status-badge--success' : 'ui-status-badge--danger';
  }

  expiryStatusBadgeClass(isExpired: boolean): string {
    return isExpired ? 'ui-status-badge--danger' : 'ui-status-badge--success';
  }

  get visibleFiltersCount(): number {
    return this.appliedFilters.length;
  }

  onFacilitySelected(facilityId: number | null): void {
    if (!this.isGlobalAdmin) return;

    const fid = facilityId !== null && facilityId !== undefined ? Number(facilityId) : null;
    this.selectedFacilityId = fid != null && !Number.isNaN(fid) && fid > 0 ? fid : null;
    this.pageIndex = 1;
    this.loadBundles();
    this.loadCoupons();
  }

  onStatusFilterChanged(value: CouponIsActiveString | null): void {
    this.filterStatus = value;
    this.pageIndex = 1;
    this.loadCoupons();
  }

  clearFilters(): void {
    this.filterStatus = null;
    this.searchTerm = '';
    if (this.isGlobalAdmin) {
      this.selectedFacilityId = null;
      this.loadBundles();
    }
    this.pageIndex = 1;
    this.loadCoupons();
  }

  removeFilter(name: string): void {
    if (name === 'Status') {
      this.filterStatus = null;
      this.pageIndex = 1;
      this.loadCoupons();
      return;
    }

    if (name === 'Search') {
      this.searchTerm = '';
      this.pageIndex = 1;
      this.loadCoupons();
      return;
    }

    if (name === 'Clinic') {
      this.selectedFacilityId = null;
      this.pageIndex = 1;
      this.loadBundles();
      this.loadCoupons();
    }
  }

  private syncAppliedFilters(): void {
    this.appliedFilters = [];
    if (this.isGlobalAdmin && this.selectedFacilityId) {
      const selectedFacility = this.facilities.find((f) => Number(f.facilityId) === Number(this.selectedFacilityId));
      this.appliedFilters.push({
        name: 'Clinic',
        value: selectedFacility?.titlelong || selectedFacility?.titleshort || String(this.selectedFacilityId)
      });
    }
    if (this.filterStatus === 'true') {
      this.appliedFilters.push({ name: 'Status', value: 'Active' });
    } else if (this.filterStatus === 'false') {
      this.appliedFilters.push({ name: 'Status', value: 'Inactive' });
    } else if (this.filterStatus === 'expired') {
      this.appliedFilters.push({ name: 'Status', value: 'Expired' });
    }

    const trimmedSearch = (this.searchTerm || '').trim();
    if (trimmedSearch) {
      this.appliedFilters.push({ name: 'Search', value: trimmedSearch });
    }
  }

  private loadFacilitiesDropdown(): void {
    this.facilityDropdownLoading = true;
    this.cdr.markForCheck();

    this.gs
      .getAllFacilitiesDropdown()
      .pipe(
        finalize(() => {
          this.facilityDropdownLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: ApiResponse<FacilityDropdownItem[]>) => {
          this.facilities = Array.isArray(res?.data) ? res.data : [];
          this.syncAppliedFilters();
          this.cdr.markForCheck();
        },
        error: () => {
          this.facilities = [];
          this.gs.showError('Failed to load clinics.');
        }
      });
  }

  private allBundleIds(): number[] {
    return (this.bundleOptions || []).map(b => b.bundleId);
  }

  private isAllSelectedNow(values: number[]): boolean {
    const allIds = this.allBundleIds();
    return allIds.length > 0 && values.length === allIds.length;
  }

  private onPackagesChanged(values: any): void {
    if (this.patchingPackages) { return; }
    if (!Array.isArray(values)) { return; }

    if (values.includes(this.ALL_SENTINEL)) {
      const cleaned = values.filter((v: any) => v !== this.ALL_SENTINEL);
      const allIds = this.allBundleIds();

      this.patchingPackages = true;

      const next = this.isAllSelectedNow(cleaned)
        ? [...this.lockedBundleIds]
        : allIds;
      this.form.get('packages')!.setValue(next, { emitEvent: false });
      this.patchingPackages = false;
      this.cdr.markForCheck();
      return;
    }

    if (values.some((v: any) => v === this.ALL_SENTINEL)) {
      this.patchingPackages = true;
      this.form.get('packages')!.setValue(
        values.filter((v: any) => v !== this.ALL_SENTINEL),
        { emitEvent: false }
      );
      this.patchingPackages = false;
      this.cdr.markForCheck();
      return;
    }

    if (this.isEditMode && this.lockedBundleIds.length > 0) {
      const missing = this.lockedBundleIds.filter(id => !values.includes(id));
      if (missing.length > 0) {
        this.patchingPackages = true;
        this.form.get('packages')!.setValue([...values, ...missing], { emitEvent: false });
        this.patchingPackages = false;
        this.cdr.markForCheck();
      }
    }
  }
}
