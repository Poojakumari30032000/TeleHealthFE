import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy
} from '@angular/core';
import { Router } from '@angular/router';
import { debounceTime, finalize, Subject, takeUntil } from 'rxjs';
import { GeneralService } from 'app/shared/services/general.service';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from 'app/shared/Auth/auth.service';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { getUnifiedStatusBadgeClass } from 'app/shared/utils/status-badge.util';

interface ApiResponse {
  status: number;
  message: string;
  count: number;
  data: any;
  totalEntityCount: number;
  totalPages: number;
  success?: boolean | null;
}

interface BundleRow {
  bundleId: number;
  name: string;
  description: string;
  price: number;
  clinicPrice?: number;

  status: 'Active' | 'Archived' | string;

  categoryId?: number | null;
  categoryName?: string | null;

  facilityId?: number | null;
  facilityName?: string | null;
  assignedFacilities?: string | null;
  facilityIds?: number[] | null;

  visits?: number | null;
  comparePrice?: number | null;
  regularImageUrl?: string | null;

  isActive?: boolean;
  isRecurring?: boolean;
  duration?: number | null;
}

interface Category {
  categoryId: number;
  categoryName: string;
}

interface Facility {
  facilityId: number;
  titlelong: string;
  titleshort: string;
  guid: string;
  organizationId: number;
  organizationName: string;
}

@Component({
  selector: 'app-product-list-view',
  templateUrl: './product-list-view.component.html',
  styleUrl: './product-list-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductListViewComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  searchQuery = '';
  selectedStatus: string | null = null;
  selectedType = 'Bundle';
  showFilters = true;
  appliedFilters: Array<{ name: string; value: any }> = [];
  searchTerms = new Subject<void>();

  selectedFacilityFilterId: number | null = null;
  allFacilities: Facility[] = [];
  allFacilitiesLoading = false;

  selectedCategoryFilterId: number | null = null;

  userRole: string = this.auth.getUserRole() || '';
  facilityID: number = Number(this.auth.getUserFacilityId() ?? localStorage.getItem('FOS') ?? 0);
  userID: any = this.auth.getUserId();

  productStatusOptions: string[] = ['Active', 'Archived'];

  bundles: BundleRow[] = [];
  loading = false;
  total = 0;
  pageIndex = 1;
  pageSize = 100;

  bundleModalVisible = false;
  editing = false;
  saving = false;
  bundleForm: FormGroup;

  categories: Category[] = [];
  catLoading = false;

  facilities: Facility[] = [];
  facilitiesLoading = false;

  isClinicPricingModalVisible: boolean = false;
  clinicSalePrice: number | null = null;
  CSPBundleID: number | null = null;
  clinicIsRecurring: boolean | null = null;

  assignedFacilitiesDialogVisible = false;
  assignedFacilitiesDialogPackageName = '';
  assignedFacilitiesDialogList: string[] = [];

  constructor(
    private route: Router,
    private generalService: GeneralService,
    private notification: NzNotificationService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder
  ) {
    this.bundleForm = this.fb.group({
      bundleId: [0],
      name: ['', [Validators.required, Validators.maxLength(200), this.noWhitespace()]],
      visits: [null, [Validators.required, Validators.min(0), Validators.max(99)]],
      price: [null, [Validators.required, Validators.min(0)]],
      description: ['', [Validators.required, Validators.maxLength(2000), this.noWhitespace()]],
      categoryId: [null, [Validators.required]],

      facilityId: [null],

      facilityIds: [null as number[] | null]
    });

    this.searchTerms.pipe(debounceTime(1000), takeUntil(this.destroy$)).subscribe(() => {
      this.applyFilter();
    });

    this.bundleForm
      .get('categoryId')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((categoryId) => {
        this.bundleForm.get('facilityId')?.setValue(null, { emitEvent: false });
        this.bundleForm.get('facilityIds')?.setValue(null, { emitEvent: false });

        if (this.userRole !== 'Global Admin') {
          this.facilities = [];
          this.cdr.markForCheck();
          return;
        }

        if (!categoryId) {
          this.facilities = [];
          this.cdr.markForCheck();
          return;
        }

        this.fetchFacilitiesByCategoryId(Number(categoryId));
      });

    if (this.userRole === 'Global Admin') {
      this.fetchAllFacilities();
    }

    this.fetchCategories();

    this.applyFilter();
  }

  noWhitespace(): ValidatorFn {
    return (ctrl: AbstractControl): ValidationErrors | null => {
      const v = ctrl.value;
      if (typeof v === 'string' && v.trim().length === 0) return { whitespace: true };
      return null;
    };
  }

  onBlurTrim(evt: Event, updateValidity = false): void {
    const input = evt.target as HTMLInputElement | HTMLTextAreaElement;
    if (!input || input.form === null) return;

    const ctrlName = this.resolveControlName(input);
    if (!ctrlName) return;

    const ctrl = this.bundleForm.get(ctrlName);
    if (!ctrl) return;

    if (typeof ctrl.value === 'string') {
      const trimmed = ctrl.value.trim();
      if (trimmed !== ctrl.value) {
        ctrl.setValue(trimmed);
        if (updateValidity) ctrl.updateValueAndValidity();
      }
    }
  }

  private resolveControlName(el: HTMLInputElement | HTMLTextAreaElement): string | null {
    const candidates = ['name', 'formcontrolname', 'ng-reflect-name', 'ng-reflect-form-control-name'];
    for (const attr of candidates) {
      const val = (el.getAttribute && el.getAttribute(attr)) || (el as any)[attr];
      if (val) return String(val);
    }
    return null;
  }

  durationLabel(d?: number | null): string {
    if (d === null || d === undefined) return '--';
    const n = Number(d);
    if (Number.isNaN(n)) return '--';
    return `${n} month${n === 1 ? '' : 's'}`;
  }

  searchTermChanged(): void {
    this.searchTerms.next();
  }

  applyFilter(): void {
    if (this.userRole === 'Clinic Admin') {
      this.appliedFilters = [
        { name: 'Title', value: this.searchQuery },
        { name: 'Status', value: this.selectedStatus ?? '' },
        { name: 'CategoryId', value: this.selectedCategoryFilterId ?? null }
      ].filter((f) => f.value !== null && f.value !== undefined && f.value !== '');
    } else if (this.userRole === 'Global Admin') {
      this.appliedFilters = [
        { name: 'Title', value: this.searchQuery },
        { name: 'Status', value: this.selectedStatus ?? '' },
        { name: 'FacilityId', value: this.selectedFacilityFilterId ?? null },
        { name: 'CategoryId', value: this.selectedCategoryFilterId ?? null }
      ].filter((f) => f.value !== null && f.value !== undefined && f.value !== '');
    } else {
      this.appliedFilters = [
        { name: 'Title', value: this.searchQuery },
        { name: 'Status', value: this.selectedStatus ?? '' },
        { name: 'CategoryId', value: this.selectedCategoryFilterId ?? null }
      ].filter((f) => f.value !== null && f.value !== undefined && f.value !== '');
    }

    this.pageIndex = 1;
    this.fetchBundles();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedStatus = null;

    this.selectedFacilityFilterId = null;
    this.selectedCategoryFilterId = null;
    this.showFilters = true;
    this.applyFilter();
  }

  removeFilter(filterName: string): void {
    switch (filterName) {
      case 'Title':
        this.searchQuery = '';
        break;
      case 'Status':
        this.selectedStatus = null;
        break;
      case 'ProductType':
        this.selectedType = '';
        break;

      case 'FacilityId':
        this.selectedFacilityFilterId = null;
        break;
      case 'CategoryId':
        this.selectedCategoryFilterId = null;
        break;
    }
    this.applyFilter();
  }

  onCategoryFilterChange(value: number | null): void {
    this.selectedCategoryFilterId = value ?? null;
    this.applyFilter();
  }

  getCategoryFilterLabel(value: any): string {
    if (value == null || value === '') return '';
    const c = this.categories.find((x) => Number(x.categoryId) === Number(value));
    return c ? (c.categoryName ?? String(value)) : String(value);
  }

  navigateToBundleCategories(row: BundleRow): void {
    const id = row?.bundleId;
    if (!id) return;
    this.route.navigate(['product', 'bundle', id, 'categories']);
  }

  trackByBundleId(_index: number, row: BundleRow): number {
    return row.bundleId;
  }

  onRowActivate(row: BundleRow): void {
    if (this.userRole !== 'Global Admin') return;
    this.openEditModal(row);
  }

  getStatusBadgeClass(status: string | null | undefined): string {
    return getUnifiedStatusBadgeClass(status);
  }

  getRecurringBadgeClass(value: boolean | null | undefined): string {
    if (value === true) return 'ui-status-badge--info';
    if (value === false) return 'ui-status-badge--neutral';
    return 'ui-status-badge--neutral';
  }

  openAssignedFacilitiesDialog(row: BundleRow): void {
    const raw = row?.assignedFacilities ?? (row?.facilityId && row?.facilityName ? row.facilityName : null) ?? '';
    this.assignedFacilitiesDialogPackageName = row?.name ?? 'Package';
    this.assignedFacilitiesDialogList = raw
      ? String(raw)
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];
    this.assignedFacilitiesDialogVisible = true;
    this.cdr.markForCheck();
  }

  closeAssignedFacilitiesDialog(): void {
    this.assignedFacilitiesDialogVisible = false;
    this.assignedFacilitiesDialogList = [];
    this.cdr.markForCheck();
  }

  onGlobalFacilityFilterChange(value: number | null): void {
    this.selectedFacilityFilterId = value ?? null;
    this.applyFilter();
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;
    if (pageIndex !== this.pageIndex || pageSize !== this.pageSize) {
      this.pageIndex = pageIndex;
      this.pageSize = pageSize;
      this.fetchBundles();
    }
  }

  private buildQueryString(): string {
    const params: Record<string, string> = {};
    for (const f of this.appliedFilters) {
      if (f?.name && f?.value !== undefined && f?.value !== null && f?.value !== '') {
        params[f.name] = String(f.value);
      }
    }
    if (this.userRole === 'Clinic Admin' && this.facilityID) {
      params['FacilityId'] = String(this.facilityID);
    }
    params['PageNumber'] = String(this.pageIndex);
    params['PageSize'] = String(this.pageSize);
    params['ProductType'] = 'Bundle';

    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => usp.set(k, v));
    return usp.toString();
  }

  private fetchBundles(): void {
    const endpoint =
      this.userRole === 'Clinic Admin'
        ? 'Products/getAllBundlesByFacilities'
        : 'Products/GetAllBundles';

    const qs = this.buildQueryString();
    const url = qs ? `${endpoint}?${qs}` : endpoint;

    this.loading = true;
    this.generalService
      .commonGet(url)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: ApiResponse) => {
          const raw =
            (Array.isArray(res?.data) && res.data) ||
            res?.data?.items ||
            res?.data?.list ||
            res?.data?.data ||
            [];

          this.bundles = (raw as any[]).map((r) => ({
            ...r,
            categoryName: r?.categoryName ?? null,
            facilityId: r?.facilityId ?? null,
            facilityName: r?.facilityName ?? null,
            assignedFacilities: r?.assignedFacilities ?? null,
            facilityIds: Array.isArray(r?.facilityIds) ? r.facilityIds : (r?.facilityIds != null ? [r.facilityIds] : null),
            isActive: (r?.status || '').toLowerCase() === 'active' || r?.isActive === true,
            isRecurring: r?.isRecurring === true
          }));

          this.total =
            (typeof res?.totalEntityCount === 'number' && res.totalEntityCount) ||
            (typeof res?.count === 'number' && res.count) ||
            (typeof res?.data?.total === 'number' && res.data.total) ||
            this.bundles.length;
        },
        error: (err: HttpErrorResponse) => {
          console.error('Fetch bundles failed:', err);
          this.generalService.showError(err?.message || 'Failed to load data.');
        }
      });
  }

  refreshList(): void {
    this.fetchBundles();
  }

  private fetchCategories(): void {
    this.catLoading = true;

    const url = `DropDowns/getAllCategories`;
    this.generalService
      .commonGet(url)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.catLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: ApiResponse) => {
          const list =
            (Array.isArray(res?.data) && res.data) ||
            res?.data?.items ||
            res?.data?.list ||
            res?.data?.data ||
            [];
          this.categories = (list as any[]).map((x: any) => ({
            categoryId: x?.categoryId,
            categoryName: x?.categoryName
          }));
        },
        error: () => {
          this.generalService.showError('Failed to load categories.');
        }
      });
  }

  private fetchAllFacilities(): void {
    this.allFacilitiesLoading = true;

    const url = `DropDowns/getAllFacilities`;
    this.generalService
      .commonGet(url)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.allFacilitiesLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: ApiResponse) => {
          const list =
            (Array.isArray(res?.data) && res.data) ||
            res?.data?.items ||
            res?.data?.list ||
            res?.data?.data ||
            [];

          this.allFacilities = (list as any[]).map((x: any) => ({
            facilityId: Number(x?.facilityId ?? 0),
            titlelong: String(x?.titlelong ?? ''),
            titleshort: String(x?.titleshort ?? ''),
            guid: String(x?.guid ?? ''),
            organizationId: Number(x?.organizationId ?? 0),
            organizationName: String(x?.organizationName ?? '')
          }));
        },
        error: () => {
          this.allFacilities = [];
          this.generalService.showError('Failed to load facilities.');
        }
      });
  }

  private fetchFacilitiesByCategoryId(categoryId: number): void {
    if (!categoryId) {
      this.facilities = [];
      return;
    }

    this.facilitiesLoading = true;

    const url = `DropDowns/getActiveFacilitiesByCategoryId?categoryId=${categoryId}`;
    this.generalService
      .commonGet(url)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.facilitiesLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: ApiResponse) => {
          const list =
            (Array.isArray(res?.data) && res.data) ||
            res?.data?.items ||
            res?.data?.list ||
            res?.data?.data ||
            [];

          this.facilities = (list as any[]).map((x: any) => ({
            facilityId: Number(x?.facilityId ?? 0),
            titlelong: String(x?.titlelong ?? ''),
            titleshort: String(x?.titleshort ?? ''),
            guid: String(x?.guid ?? ''),
            organizationId: Number(x?.organizationId ?? 0),
            organizationName: String(x?.organizationName ?? '')
          }));
        },
        error: () => {
          this.facilities = [];
          this.generalService.showError('Failed to load facilities.');
        }
      });
  }

  openModal(): void {
    this.editing = false;
    this.facilities = [];

    this.bundleForm.reset({
      bundleId: 0,
      name: '',
      visits: null,
      price: null,
      description: '',
      categoryId: null,
      facilityId: null,
      facilityIds: null
    });

    this.bundleForm.get('visits')?.enable({ emitEvent: false });

    this.fetchCategories();
    this.bundleModalVisible = true;
    this.cdr.markForCheck();
  }

  openEditModal(row: BundleRow): void {
    if (!row?.bundleId) {
      this.generalService.showError('Bundle Id not found.');
      return;
    }

    this.editing = true;
    this.facilities = [];

    this.bundleForm.reset({
      bundleId: row.bundleId,
      name: row.name ?? '',
      visits: row.visits ?? null,
      price: row.price ?? null,
      description: row.description ?? '',
      categoryId: row.categoryId ?? null,
      facilityId: row.facilityId ?? null,
      facilityIds: row.facilityIds ?? null
    });

    this.bundleForm.get('visits')?.disable({ emitEvent: false });

    this.fetchCategories();
    if (this.userRole === 'Global Admin' && row.categoryId) {
      this.fetchFacilitiesByCategoryId(Number(row.categoryId));
    }
    this.bundleModalVisible = true;
    this.cdr.markForCheck();

    if (Array.isArray(row.facilityIds) && row.facilityIds.length) {
      setTimeout(() => this.bundleForm.patchValue({ facilityIds: row.facilityIds }), 0);
    }
  }

  closeBundleModal(): void {
    this.bundleModalVisible = false;
    this.bundleForm.markAsPristine();
    this.bundleForm.markAsUntouched();
  }

  submitBundle(): void {
    const formValue = this.bundleForm.getRawValue();

    if (this.bundleForm.invalid) {
      this.bundleForm.markAllAsTouched();
      return;
    }

    const selectedFacilityId = formValue.facilityId ? Number(formValue.facilityId) : null;
    const selectedFacilityIds = Array.isArray(formValue.facilityIds) && formValue.facilityIds.length
      ? formValue.facilityIds.map((id: any) => Number(id)).filter((id: number) => id > 0)
      : null;

    const payload: any = {
      bundleId: Number(formValue.bundleId || 0),
      name: String(formValue.name || ''),
      description: String(formValue.description || ''),
      drugId: 0,
      drugVarientsInBundle: [] as any[],
      price: Number(formValue.price || 0),
      comparePrice: 0,
      regularImageURL: '',
      categoryId: Number(formValue.categoryId || 0),
      visits: Number(formValue.visits || 0)
    };
    if (selectedFacilityIds && selectedFacilityIds.length > 0) {
      payload.facilityIds = selectedFacilityIds;
      payload.facilityId = null;
    } else {
      payload.facilityIds = null;
      payload.facilityId = this.userRole === 'Clinic Admin' ? Number(this.facilityID || 0) : selectedFacilityId;
    }

    this.saving = true;
    this.generalService
      .createEditNewBundle(payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: ApiResponse) => {
          if (res?.status === 1) {
            this.generalService.showSuccess(res?.message || (this.editing ? 'Bundle updated' : 'Bundle created'));
            this.closeBundleModal();
            this.refreshList();
          } else {
            this.generalService.showError(res?.message || 'Operation failed.');
          }
        },
        error: (err: HttpErrorResponse) => {
          this.generalService.showError(err?.message || 'Failed to save bundle.');
        }
      });
  }

  toggleStatus(row: BundleRow): void {
    if (!row) return;

    const newStatus = row.isActive ? 'Archived' : 'Active';
    const apiUrl = 'Products/UpdateBundle';
    const title = 'Confirmation';
    const content = `Are you sure you want to update the status to ${newStatus}?`;
    const body = { bundleId: row.bundleId, status: newStatus };

    this.generalService
      .commonConfirm(title, content)
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed: boolean) => {
        if (!confirmed) return;

        this.generalService
          .commonPost(apiUrl, body)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (response: ApiResponse) => {
              if (response?.status === 1 && response?.data !== undefined) {
                this.generalService.showSuccess(response?.message || 'Status updated');
                this.refreshList();
              } else {
                this.generalService.showError(response?.message || 'Failed to update status');
              }
            },
            error: (error: HttpErrorResponse) => {
              this.generalService.showError(error?.message || 'Failed to update status');
            }
          });
      });
  }

  editClinicSalePrice(data: any): void {
    this.isClinicPricingModalVisible = true;
    this.CSPBundleID = data.bundleId;
    this.clinicSalePrice = data.clinicPrice;
    this.clinicIsRecurring = data?.isRecurring === true;
    this.cdr.markForCheck();
  }

  closeClinicSalePriceModal(): void {
    this.isClinicPricingModalVisible = false;
    this.CSPBundleID = null;
    this.clinicSalePrice = null;
    this.clinicIsRecurring = false;
    this.cdr.markForCheck();
  }

  navigateToProductDetail = (data: any) => {
    const ID: number = data?.bundleId || 0;
    if (!ID) {
      this.generalService.showError('Unable to continue. Product Id not found.');
      return;
    }
    const url: string[] = ['product/bundle', ID.toString()];
    this.route.navigate(url);
  };

  submitEditClinicSalePrice(): void {
    this.saving = true;

    const payload = {
      bundleId: this.CSPBundleID,
      facilityId: this.facilityID,
      clinicPrice: this.clinicSalePrice,
      userId: this.userID,
      isRecurring: this.clinicIsRecurring
    };

    this.generalService.editClinicBundlePrice(payload).subscribe({
      next: () => {
        this.saving = false;
        this.notification.success('Success', 'Price updated successfully.');
        this.cdr.markForCheck();
        this.closeClinicSalePriceModal();
        this.applyFilter();
      },
      error: () => {
        this.saving = false;
        this.notification.error('Error', 'Operation was not completed.');
        this.cdr.markForCheck();
      }
    });
  }

  clampVisits(event: Event): void {
    const input = event.target as HTMLInputElement;
    const ctrl = this.bundleForm.get('visits');
    if (!ctrl) return;

    const raw = input.value;

    if (raw === '' || raw == null) {
      ctrl.setValue(null);
      return;
    }

    const n = Number(raw);
    if (Number.isNaN(n)) {
      input.value = '';
      ctrl.setValue(null);
      return;
    }

    const clamped = Math.min(99, Math.max(0, Math.trunc(n)));

    if (String(clamped) !== raw) {
      input.value = String(clamped);
    }

    ctrl.setValue(clamped);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
