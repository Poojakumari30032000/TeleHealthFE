import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { HttpErrorResponse } from '@angular/common/http';
import { debounceTime, finalize, Subject, takeUntil } from 'rxjs';

import { GeneralService } from 'app/shared/services/general.service';
import { AuthService } from 'app/shared/Auth/auth.service';
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

interface Facility {
  facilityId: number;
  titlelong: string;
  titleshort: string;
  guid: string;
  organizationId: number;
  organizationName: string;
}

interface BundleRow {
  bundleId: number;
  name: string;
  description: string;
  price: number;
  clinicPrice?: number;
  status?: string;

  categoryName?: string | null;

  isActive?: boolean;
  isRecurring?: boolean;

  duration?: number | null;
  visits?: number | null;

  durationMonths?: number | null;
}

@Component({
  selector: 'app-clinic-package-gaview',
  templateUrl: './clinic-package-gaview.component.html',
  styleUrl: './clinic-package-gaview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClinicPackageGAViewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  facilities: Facility[] = [];
  facilitiesLoading = false;
  selectedFacilityId: number | null = null;

  searchQuery = '';
  selectedStatus: string | null = null;
  showFilters = false;
  productStatusOptions: string[] = ['Active', 'Archived'];

  appliedFilters: Array<{ name: string; value: any }> = [];
  private searchTerms = new Subject<void>();

  bundles: BundleRow[] = [];
  loading = false;
  total = 0;
  pageIndex = 1;
  pageSize = 100;

  isClinicPricingModalVisible = false;
  saving = false;

  clinicSalePrice: number | null = null;
  CSPBundleID: number | null = null;
  clinicIsRecurring: boolean = false;

  userID: any = this.auth.getUserId();

  constructor(
    private generalService: GeneralService,
    private notification: NzNotificationService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {

    this.searchTerms.pipe(debounceTime(700), takeUntil(this.destroy$)).subscribe(() => {
      this.applyFilter();
    });

    this.fetchAllFacilities();
  }

  private fetchAllFacilities(): void {
    this.facilitiesLoading = true;

    this.generalService
      .commonGet('DropDowns/getAllFacilities')
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

  onFacilityChange(value: number | null): void {
    this.selectedFacilityId = value ?? null;

    this.pageIndex = 1;
    this.bundles = [];
    this.total = 0;

    this.applyFilter();
  }

  durationLabel(months?: number | null): string {
    if (months === null || months === undefined) return '--';
    const n = Number(months);
    if (Number.isNaN(n)) return '--';
    return `${n} month${n === 1 ? '' : 's'}`;
  }

  trackByBundleId(_index: number, row: BundleRow): number {
    return row?.bundleId ?? _index;
  }

  onRowActivate(row: BundleRow): void {
    if (!this.selectedFacilityId) return;
    this.editClinicSalePrice(row);
  }

  getStatusBadgeClass(status: string | null | undefined): string {
    return getUnifiedStatusBadgeClass(status);
  }

  getRecurringBadgeClass(value: boolean | null | undefined): string {
    if (value === true) return 'ui-status-badge--info';
    if (value === false) return 'ui-status-badge--neutral';
    return 'ui-status-badge--neutral';
  }

  searchTermChanged(): void {
    this.searchTerms.next();
  }

  applyFilter(): void {

    if (!this.selectedFacilityId) {
      this.appliedFilters = [];
      this.bundles = [];
      this.total = 0;
      this.cdr.markForCheck();
      return;
    }

    this.appliedFilters = [
      { name: 'FacilityId', value: String(this.selectedFacilityId) },
      { name: 'Title', value: this.searchQuery },
      { name: 'Status', value: this.selectedStatus ?? '' }
    ].filter((f) => f.value !== null && f.value !== undefined && f.value !== '');

    this.fetchBundles();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedStatus = null;
    this.showFilters = false;
    this.pageIndex = 1;
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
      default:
        break;
    }
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

    params['PageNumber'] = String(this.pageIndex);
    params['PageSize'] = String(this.pageSize);
    params['ProductType'] = 'Bundle';

    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => usp.set(k, v));
    return usp.toString();
  }

  private fetchBundles(): void {
    if (!this.selectedFacilityId) return;

    const endpoint = 'Products/getAllBundlesByFacilities';
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

          this.bundles = (raw as any[]).map((r) => {
            const isActive = (r?.status || '').toLowerCase() === 'active' || r?.isActive === true;
            const isRecurring = r?.isRecurring === true;

            const durationMonths =
              r?.duration ?? r?.visits ?? r?.Duration ?? r?.Visits ?? null;

            return {
              ...r,
              categoryName: r?.categoryName ?? null,
              clinicPrice: r?.clinicPrice ?? r?.ClinicPrice ?? null,
              isActive,
              isRecurring,
              durationMonths
            } as BundleRow;
          });

          this.total =
            (typeof res?.totalEntityCount === 'number' && res.totalEntityCount) ||
            (typeof res?.count === 'number' && res.count) ||
            (typeof res?.data?.total === 'number' && res.data.total) ||
            this.bundles.length;
        },
        error: (err: HttpErrorResponse) => {
          console.error('Fetch bundles by facility failed:', err);
          this.generalService.showError(err?.message || 'Failed to load bundles.');
        }
      });
  }

  refreshList(): void {
    this.fetchBundles();
  }

  editClinicSalePrice(row: BundleRow): void {
    if (!row?.bundleId) {
      this.generalService.showError('Bundle Id not found.');
      return;
    }
    if (!this.selectedFacilityId) {
      this.generalService.showError('Please select a facility first.');
      return;
    }

    this.isClinicPricingModalVisible = true;
    this.CSPBundleID = row.bundleId;
    this.clinicSalePrice = (row as any)?.clinicPrice ?? null;
    this.clinicIsRecurring = row?.isRecurring === true;
    this.cdr.markForCheck();
  }

  closeClinicSalePriceModal(): void {
    this.isClinicPricingModalVisible = false;
    this.CSPBundleID = null;
    this.clinicSalePrice = null;
    this.clinicIsRecurring = false;
    this.cdr.markForCheck();
  }

  submitEditClinicSalePrice(): void {
    if (!this.selectedFacilityId) {
      this.generalService.showError('Please select a facility first.');
      return;
    }
    if (!this.CSPBundleID) {
      this.generalService.showError('Bundle Id not found.');
      return;
    }

    this.saving = true;

    const payload = {
      bundleId: this.CSPBundleID,
      facilityId: this.selectedFacilityId,
      clinicPrice: this.clinicSalePrice,
      userId: this.userID,
      isRecurring: this.clinicIsRecurring
    };

    this.generalService.editClinicBundlePrice(payload).subscribe({
      next: (res: any) => {
        console.log('Clinic bundle price updated:', res);
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
