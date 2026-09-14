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

interface CatalogItem {
  catalogId: number;
  catalogName: string;
  isActive?: boolean;
}

@Component({
  selector: 'app-clinic-drug-gaview',
  templateUrl: './clinic-drug-gaview.component.html',
  styleUrl: './clinic-drug-gaview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClinicDrugGAViewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  facilities: Facility[] = [];
  facilitiesLoading = false;
  selectedFacilityId: number | null = null;

  catalogOptions: CatalogItem[] = [];
  catalogsLoading = false;
  selectedCatalogId: number | null = null;

  searchQuery = '';
  selectedStatus: string | null = null;
  showFilters = false;
  productStatusOptions: string[] = ['Active', 'Archived'];

  appliedFilters: Array<{ name: string; value: any }> = [];
  private searchTerms = new Subject<void>();

  drugs: any[] = [];
  loading = false;
  total = 0;
  pageIndex = 1;
  pageSize = 100;

  isClinicPricingModalVisible = false;
  isSaving = false;
  CSPdrugID: number | null = null;
  CSPselectedgAtoClinicId: number | null = null;
  clinicSalePrice: number | null = null;

  constructor(
    private generalService: GeneralService,
    private notification: NzNotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.searchTerms.pipe(debounceTime(700), takeUntil(this.destroy$)).subscribe(() => {
      this.applyFilter();
    });

    this.fetchAllFacilities();
  }

  get showPharmacyName(): boolean {
    return Array.isArray(this.drugs) && this.drugs.some((r) => !!r?.pharmacyName);
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

    this.selectedCatalogId = null;
    this.catalogOptions = [];
    this.pageIndex = 1;
    this.drugs = [];
    this.total = 0;
    this.appliedFilters = [];
    this.cdr.markForCheck();

    if (this.selectedFacilityId) {
      this.loadCatalogsForFacility();
    }
  }

  private loadCatalogsForFacility(): void {
    if (!this.selectedFacilityId) return;

    this.catalogsLoading = true;
    this.cdr.markForCheck();

    this.generalService
      .commonGet(`DropDowns/getAllCatalogsDropDown?FacilityId=${this.selectedFacilityId}`)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.catalogsLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: ApiResponse) => {
          const list = Array.isArray(res?.data) ? res.data : [];
          this.catalogOptions = (list as any[])
            .filter((c: any) => c?.isActive !== false)
            .map((c: any) => ({
              catalogId: Number(c?.catalogId ?? 0),
              catalogName: String(c?.catalogName ?? ''),
              isActive: c?.isActive
            }));
        },
        error: () => {
          this.catalogOptions = [];
          this.generalService.showError('Failed to load catalogs for this clinic.');
        }
      });
  }

  onCatalogChange(): void {
    this.pageIndex = 1;
    this.applyFilter();
  }

  trackByDrugId(_index: number, row: any): number {
    return row?.drugId ?? _index;
  }

  onRowActivate(row: any): void {
    if (!this.selectedFacilityId || !this.selectedCatalogId) return;
    this.editClinicSalePrice(row);
  }

  getStatusBadgeClass(status: string | null | undefined): string {
    return getUnifiedStatusBadgeClass(status);
  }

  searchTermChanged(): void {
    this.searchTerms.next();
  }

  applyFilter(): void {

    if (!this.selectedFacilityId || !this.selectedCatalogId) {
      this.appliedFilters = [];
      this.drugs = [];
      this.total = 0;
      this.cdr.markForCheck();
      return;
    }

    this.appliedFilters = [
      { name: 'Title', value: this.searchQuery },
      { name: 'Status', value: this.selectedStatus ?? '' }
    ].filter((f) => f.value !== null && f.value !== undefined && f.value !== '');

    this.fetchDrugs();
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
      this.fetchDrugs();
    }
  }

  private buildQueryString(): string {
    const params: Record<string, string> = {};

    params['FacilityId'] = String(this.selectedFacilityId);
    params['CatalogId'] = String(this.selectedCatalogId);
    params['PageNumber'] = String(this.pageIndex);
    params['PageSize'] = String(this.pageSize);
    if (this.searchQuery) params['Title'] = this.searchQuery;
    if (this.selectedStatus) params['Status'] = this.selectedStatus;

    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => usp.set(k, v));
    return usp.toString();
  }

  private fetchDrugs(): void {
    if (!this.selectedFacilityId || !this.selectedCatalogId) return;

    const url = `Products/GetAllDrugsForClinicByFacilityId?${this.buildQueryString()}`;

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
          this.drugs =
            (Array.isArray(res?.data) && res.data) ||
            res?.data?.items ||
            res?.data?.list ||
            res?.data?.data ||
            [];

          this.total =
            (typeof res?.totalEntityCount === 'number' && res.totalEntityCount) ||
            (typeof res?.count === 'number' && res.count) ||
            this.drugs.length;
        },
        error: (err: HttpErrorResponse) => {
          this.drugs = [];
          this.total = 0;
          this.generalService.showError(err?.message || 'Failed to load drugs.');
        }
      });
  }

  refreshList(): void {
    this.fetchDrugs();
  }

  editClinicSalePrice(data: any): void {
    if (!data?.drugId) {
      this.generalService.showError('Drug Id not found.');
      return;
    }
    if (!this.selectedFacilityId) {
      this.generalService.showError('Please select a clinic first.');
      return;
    }

    this.isClinicPricingModalVisible = true;
    this.CSPdrugID = data.drugId;
    this.CSPselectedgAtoClinicId = data.gAtoClinicId ?? null;
    this.clinicSalePrice = data.clinicSuggestedRetailPrice ?? null;
    this.cdr.markForCheck();
  }

  closeClinicSalePriceModal(): void {
    this.isClinicPricingModalVisible = false;
    this.CSPdrugID = null;
    this.CSPselectedgAtoClinicId = null;
    this.clinicSalePrice = null;
    this.cdr.markForCheck();
  }

  submitEditClinicSalePrice(): void {
    if (!this.selectedFacilityId) {
      this.generalService.showError('Please select a clinic first.');
      return;
    }
    if (!this.CSPdrugID) {
      this.generalService.showError('Drug Id not found.');
      return;
    }

    this.isSaving = true;

    const payload = {
      drugId: this.CSPdrugID,
      gAtoClinicId: this.CSPselectedgAtoClinicId,
      facilityId: this.selectedFacilityId,
      clinicSuggestedRetailPrice: this.clinicSalePrice,
      isActive: true
    };

    this.generalService.editClinicSalePrice(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.notification.success('Success', 'Price updated successfully.');
        this.closeClinicSalePriceModal();
        this.applyFilter();
        this.cdr.markForCheck();
      },
      error: () => {
        this.isSaving = false;
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
