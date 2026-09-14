import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { debounceTime, Subject, takeUntil } from 'rxjs';

import { GeneralService } from 'app/shared/services/general.service';
import { AuthService } from 'app/shared/Auth/auth.service';
import { getUnifiedStatusBadgeClass } from 'app/shared/utils/status-badge.util';

interface PrescriptionRow {
  patientPrescriptionId: number;
  patientName: string;
  date: string | null;
  prescriptionStatus: string | null;
  expirationDate: string | null;
  sendAt: string | null;
  facilityName?: string;
  orderStatus?: string;
}

interface Facility {
  facilityId: string | number;
  titlelong: string;
}

@Component({
  selector: 'app-prescription-list-view',
  templateUrl: './prescription-list-view.component.html',
  styleUrl: './prescription-list-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrescriptionListViewComponent implements OnInit, OnDestroy {
  showFilters = true;
  appliedFilters: any[] = [];

  private destroy$ = new Subject<void>();
  private searchTerms = new Subject<void>();

  searchQuery = '';
  selectedFacility: string | number | null = '';
  selectedOrderStatus: string | null = null;

  readonly orgId = Number(localStorage.getItem('OFL'));
  selectedProvider = 0;
  selectedPatient = 0;

  userRole = this.auth.getUserRole() || '';

  facilitiesLoading = false;
  facilities: Facility[] = [];

  loading = false;
  prescriptions: PrescriptionRow[] = [];
  total = 0;
  pageIndex = 1;
  pageSize = 100;

  orderStatusOptions = ['Uploaded', 'Pending', 'Created', 'Received', 'Completed', 'Processing'];

  constructor(
    private route: Router,
    private cdr: ChangeDetectorRef,
    private generalService: GeneralService,
    private auth: AuthService
  ) {
    const userId = this.auth.getUserId() || 0;
    if (this.userRole === 'Provider') {
      this.selectedProvider = userId;
    } else if (this.userRole === 'Patient') {
      this.selectedPatient = this.auth.getPatientId() || 0;
    }

    if (!['Global Admin', 'Provider'].includes(this.userRole)) {
      this.selectedFacility = localStorage.getItem('FOS') || '';
    }

    this.searchTerms
      .pipe(debounceTime(700), takeUntil(this.destroy$))
      .subscribe(() => this.applyFilter(true));
  }

  ngOnInit(): void {
    if (this.userRole === 'Global Admin' || this.userRole === 'Provider') {
      this.getClinics();
    }

    this.applyFilter(true);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchTerms.complete();
  }

  searchTermChanged(): void {
    this.searchTerms.next();
  }

  applyFilter(resetPage = true): void {
    if (!this.selectedFacility && !['Global Admin', 'Provider'].includes(this.userRole)) {
      this.generalService.showError('Clinic Not Found');
      return;
    }

    if (resetPage) {
      this.pageIndex = 1;
    }

    this.appliedFilters = [
      ...(this.selectedFacility ? [{ name: 'facilityId', value: this.selectedFacility }] : []),
      { name: 'Title', value: this.searchQuery },
      { name: 'ProviderId', value: this.selectedProvider },
      { name: 'PatientId', value: this.selectedPatient },
      { name: 'Status', value: this.selectedOrderStatus },
    ].filter((f) => f.value !== null && f.value !== undefined && f.value !== '' && f.value !== 0);

    this.fetchPrescriptions();
  }

  get visibleFiltersCount(): number {
    return this.appliedFilters.filter((f) => !this.shouldHideAppliedFilter(f.name)).length;
  }

  shouldHideAppliedFilter(filterName: string): boolean {
    if (!filterName) return false;
    if (filterName === 'facilityId') {
      return !['Global Admin', 'Provider'].includes(this.userRole);
    }
    return filterName === 'ProviderId' || filterName === 'PatientId';
  }

  getFilterDisplayName(filterName: string): string {
    switch (filterName) {
      case 'facilityId':
        return 'Clinic';
      case 'Status':
        return 'Status';
      default:
        return filterName;
    }
  }

  getFilterDisplayValue(filter: any): string {
    switch (filter.name) {
      case 'facilityId': {
        const optionFacility = this.facilities.find(
          (opt) => opt.facilityId.toString() === filter.value?.toString()
        );
        return optionFacility ? optionFacility.titlelong : filter.value;
      }
      default:
        return filter.value;
    }
  }

  trackByFilterName(_index: number, filter: any): string {
    return filter.name;
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedOrderStatus = null;

    this.selectedFacility = ['Global Admin', 'Provider'].includes(this.userRole)
      ? ''
      : (localStorage.getItem('FOS') || '');

    this.selectedProvider = this.userRole === 'Provider' ? this.auth.getUserId() || 0 : 0;
    this.selectedPatient = this.userRole === 'Patient' ? this.auth.getPatientId() || 0 : 0;

    this.applyFilter(true);
  }

  removeFilter(filterName: string): void {
    switch (filterName) {
      case 'facilityId':
        if (['Global Admin', 'Provider'].includes(this.userRole)) {
          this.selectedFacility = '';
        } else {
          this.generalService.showInfo(`This Filter Can't Be Removed`);
          return;
        }
        break;
      case 'Title':
        this.searchQuery = '';
        break;
      case 'Status':
        this.selectedOrderStatus = null;
        break;
    }

    this.applyFilter(true);
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;

    const pageChanged = pageIndex !== this.pageIndex;
    const sizeChanged = pageSize !== this.pageSize;

    this.pageIndex = pageIndex;
    this.pageSize = pageSize;

    if (pageChanged || sizeChanged) {
      this.fetchPrescriptions();
    }
  }

  private buildQueryString(): string {
    const parts: string[] = [];

    parts.push(`PageNumber=${encodeURIComponent(String(this.pageIndex))}`);
    parts.push(`PageSize=${encodeURIComponent(String(this.pageSize))}`);

    for (const f of this.appliedFilters) {
      parts.push(`${encodeURIComponent(f.name)}=${encodeURIComponent(String(f.value))}`);
    }

    return parts.join('&');
  }

  private fetchPrescriptions(): void {
    this.loading = true;
    this.cdr.markForCheck();

    const query = this.buildQueryString();

    this.generalService
      .commonGet(`PatientPrescriptions/getAllPatientPrescriptions?${query}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response?.status === 1) {
            this.prescriptions = Array.isArray(response?.data) ? response.data : [];
            this.total = Number(response?.totalEntityCount ?? 0);
          } else {
            this.prescriptions = [];
            this.total = 0;
          }

          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to fetch prescriptions:', err);
          this.prescriptions = [];
          this.total = 0;
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  getClinics(): void {
    this.facilitiesLoading = true;
    this.facilities = [];

    const request$ =
      this.userRole === 'Provider'
        ? this.generalService.commonGet(
            `DropDowns/GetAllFacilitiesbyProviderId?Id=${this.auth.getUserId() || 0}`
          )
        : this.generalService.commonGet(`DropDowns/getAllFacilities?OrganizationId=${this.orgId}`);

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response?.status === 1 && response?.data) {
          this.facilities = response?.data || [];
        } else {
          this.facilities = [];
        }

        this.facilitiesLoading = false;
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Failed to fetch facilities:', err);
        this.facilities = [];
        this.facilitiesLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  trackByPrescriptionId(_index: number, row: PrescriptionRow): number {
    return row.patientPrescriptionId;
  }

  navigateToDetail = (data: PrescriptionRow): void => {
    const id = data.patientPrescriptionId || 0;
    if (!id) {
      this.generalService.showError('Unable to Continue Prescription Id Not Found');
      return;
    }
    this.route.navigate(['prescription/detail', id]);
  };

  addEditPrescription = (data?: PrescriptionRow): void => {
    const id = data ? data.patientPrescriptionId : 0;
    if (id) {
      this.route.navigate(['prescription/update', id]);
      return;
    }
    this.route.navigate(['prescription/add']);
  };

  getStatusBadgeClass(status: string | null | undefined): string {
    return getUnifiedStatusBadgeClass(status);
  }
}
