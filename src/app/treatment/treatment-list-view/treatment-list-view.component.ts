import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { debounceTime, Subject, takeUntil } from 'rxjs';

import { GeneralService } from '../../shared/services/general.service';
import { AuthService } from 'app/shared/Auth/auth.service';
import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';
import { getUnifiedStatusBadgeClass } from 'app/shared/utils/status-badge.util';

interface TreatmentData {
  patientTreatmentId: number;
  patientId: number;
  patientName: string;
  treatmentStartDate: string;
  patientMRN: string;
  email: string;
  phoneNumber: string;
  orderCount: number;
  location?: string;
  facilityName?: string;
  treatmentStatus: string;
  visitStatus: string;
  lastOrder: string;
  nextShippingDate: string;
  refill?: boolean | null;
}

interface Facility {
  facilityId: string | number;
  titlelong: string;
}

interface PatientOption {
  patientId: number;
  patientName: string;
}

interface TreatmentDetailTab {
  key: string;
  treatmentId: number;
  title: string;
}

@Component({
  selector: 'app-treatment-list-view',
  templateUrl: './treatment-list-view.component.html',
  styleUrl: './treatment-list-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreatmentListViewComponent implements OnInit, OnDestroy {
  @ViewChild(CommanFormModalComponent)
  commanModel!: CommanFormModalComponent;

  readonly treatmentListTabKey = 'treatment-list';
  activeTabKey = this.treatmentListTabKey;
  detailTabs: TreatmentDetailTab[] = [];

  treatmentStatusOptions = ['Active', 'Paused', 'Cancelled', 'Completed'];
  visitStatusOptions = ['Pending', 'Completed', 'Cancelled', 'NotRequired'];

  private destroy$ = new Subject<void>();
  private searchTerms = new Subject<void>();

  searchQuery = '';
  showFilters = true;
  appliedFilters: any[] = [];

  selectedFacility: string | number | null = '';
  selectedTreatmentStatus = '';
  selectedVisitStatus = '';
  selectedDateRange: Date[] | null = null;
  selectedRefillStatus: boolean | null = null;

  readonly orgId = Number(localStorage.getItem('OFL'));
  providerId = 0;
  patientId = 0;

  loadingPatient = false;
  facilitiesLoading = false;
  loading = false;

  patientData: PatientOption[] = [];
  facilities: Facility[] = [];
  userRole = '';

  refillStatusOptions = [
    { label: 'Refill Requested', value: true },
    { label: 'Not Required', value: false },
  ];

  treatments: TreatmentData[] = [];
  total = 0;
  pageIndex = 1;
  pageSize = 100;

  modalApiUrl: { save?: string; get?: string } = {
    save: 'Patients/updateStatus',
    get: 'Patients/getStatus?Type=Treatment&Id=',
  };

  constructor(
    private cdr: ChangeDetectorRef,
    private generalService: GeneralService,
    private auth: AuthService
  ) {
    this.userRole = this.auth.getUserRole() || '';

    const userId = this.auth.getUserId() || 0;
    if (this.userRole === 'Provider') {
      this.providerId = userId;
    } else if (this.userRole === 'Patient') {
      this.patientId = this.auth.getPatientId() || 0;
    }

    if (!['Global Admin', 'Provider'].includes(this.userRole)) {
      this.selectedFacility = localStorage.getItem('FOS') || '';
    }

    this.searchTerms
      .pipe(debounceTime(700), takeUntil(this.destroy$))
      .subscribe(() => this.applyFilter(undefined, true));
  }

  ngOnInit(): void {
    this.getAllPatient();
    if (this.userRole === 'Global Admin' || this.userRole === 'Provider') {
      this.getClinics();
    }

    this.applyFilter(undefined, true);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchTerms.complete();
  }

  searchTermChanged(): void {
    this.searchTerms.next();
  }

  formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }

  applyFilter(type?: string, resetPage = true): void {
    if (!this.selectedFacility && !['Global Admin', 'Provider'].includes(this.userRole)) {
      this.generalService.showError('Clinic Not Found');
      return;
    }

    if (type === 'Clinic') {
      this.patientId = 0;
      this.getAllPatient();
    }

    if (resetPage) {
      this.pageIndex = 1;
    }

    this.appliedFilters = [
      ...(this.selectedFacility ? [{ name: 'FacilityId', value: this.selectedFacility }] : []),
      { name: 'Title', value: this.searchQuery },
      { name: 'TreatmentStatus', value: this.selectedTreatmentStatus },
      { name: 'VisitStatus', value: this.selectedVisitStatus },
      { name: 'Refill', value: this.selectedRefillStatus },
      { name: 'ProviderId', value: this.providerId },
      { name: 'PatientId', value: this.patientId },
      { name: 'ClientTimezoneOffsetMinutes', value: -new Date().getTimezoneOffset() },
    ];

    if (this.selectedDateRange && this.selectedDateRange.length === 2) {
      const startDate = this.formatDateLocal(this.selectedDateRange[0]!);
      const endDate = this.formatDateLocal(this.selectedDateRange[1]!);
      this.appliedFilters.push({ name: 'StartDate', value: startDate });
      this.appliedFilters.push({ name: 'EndDate', value: endDate });
    }

    this.appliedFilters = this.appliedFilters.filter((f) =>
      f.name === 'ClientTimezoneOffsetMinutes' ||
      (f.value !== null && f.value !== undefined && f.value !== '' && f.value !== 0)
    );

    this.fetchTreatments();
  }

  get visibleFiltersCount(): number {
    return this.appliedFilters.filter((f) => !this.shouldHideAppliedFilter(f.name)).length;
  }

  shouldHideAppliedFilter(filterName: string): boolean {
    if (!filterName) return false;
    if (filterName === 'ClientTimezoneOffsetMinutes') return true;
    if (filterName === 'ProviderId') return true;

    if (filterName === 'FacilityId') {
      return !['Global Admin', 'Provider'].includes(this.userRole);
    }

    if (this.userRole === 'Patient') {
      return filterName === 'PatientId';
    }

    return false;
  }

  getFilterDisplayName(filterName: string): string {
    switch (filterName) {
      case 'FacilityId':
        return 'Clinic';
      case 'ProviderId':
        return 'Provider';
      case 'PatientId':
        return 'Patient';
      case 'VisitStatus':
        return 'Visit Status';
      case 'TreatmentStatus':
        return 'Treatment Status';
      case 'Refill':
        return 'Refill Status';
      default:
        return filterName;
    }
  }

  getFilterDisplayValue(filter: any): string {
    switch (filter.name) {
      case 'FacilityId': {
        const optionFacility = this.facilities.find(
          (opt) => opt.facilityId.toString() === filter.value?.toString()
        );
        return optionFacility ? optionFacility.titlelong : filter.value;
      }
      case 'PatientId': {
        const optionPatient = this.patientData.find(
          (opt) => opt.patientId.toString() === filter.value?.toString()
        );
        return optionPatient ? optionPatient.patientName : filter.value;
      }
      case 'Refill': {
        return filter.value === true
          ? 'Refill Requested'
          : filter.value === false
            ? 'Not Required'
            : '';
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
    this.selectedVisitStatus = '';
    this.selectedTreatmentStatus = '';
    this.selectedDateRange = null;
    this.selectedRefillStatus = null;

    this.providerId = this.userRole === 'Provider' ? this.auth.getUserId() || 0 : 0;
    this.patientId = this.userRole === 'Patient' ? this.auth.getPatientId() || 0 : 0;

    this.selectedFacility = ['Global Admin', 'Provider'].includes(this.userRole)
      ? ''
      : (localStorage.getItem('FOS') || '');

    this.applyFilter(undefined, true);
  }

  removeFilter(filterName: string): void {
    switch (filterName) {
      case 'FacilityId':
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
      case 'VisitStatus':
        this.selectedVisitStatus = '';
        break;
      case 'TreatmentStatus':
        this.selectedTreatmentStatus = '';
        break;
      case 'Refill':
        this.selectedRefillStatus = null;
        break;
      case 'ProviderId':
        this.providerId = 0;
        break;
      case 'PatientId':
        this.patientId = 0;
        break;
      case 'StartDate':
      case 'EndDate':
        this.selectedDateRange = null;
        break;
    }

    this.applyFilter(undefined, true);
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;

    const pageChanged = pageIndex !== this.pageIndex;
    const sizeChanged = pageSize !== this.pageSize;

    this.pageIndex = pageIndex;
    this.pageSize = pageSize;

    if (pageChanged || sizeChanged) {
      this.fetchTreatments();
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

  private fetchTreatments(): void {
    this.loading = true;
    this.cdr.markForCheck();

    const query = this.buildQueryString();

    this.generalService
      .commonGet(`PatientTreatments/getAllPatientTreatments?${query}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response?.status === 1) {
            this.treatments = Array.isArray(response?.data) ? response.data : [];
            this.total = Number(response?.totalEntityCount ?? 0);
          } else {
            this.treatments = [];
            this.total = 0;
          }

          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to fetch treatments:', err);
          this.treatments = [];
          this.total = 0;
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private getAllPatient(): void {
    this.loadingPatient = true;

    let url = 'DropDowns/getAllPatients';
    if (['Global Admin', 'Provider'].includes(this.userRole)) {
      if (this.selectedFacility && String(this.selectedFacility).trim() !== '') {
        url += `?FacilityId=${this.selectedFacility}`;
      }
    } else {
      const stored = (localStorage.getItem('FOS') || '').trim();
      if (stored !== '') url += `?FacilityId=${stored}`;
    }

    this.generalService
      .commonGet(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.status === 1 && response.data) {
            this.patientData = response.data;
          } else {
            this.patientData = [];
          }
          this.loadingPatient = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error(err);
          this.patientData = [];
          this.loadingPatient = false;
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
        : this.generalService.commonGet(`DropDowns/getAllFacilities`);

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

  trackByPatientId(_index: number, data: PatientOption): number {
    return data.patientId;
  }

  trackByTreatmentId(_index: number, row: TreatmentData): number {
    return row.patientTreatmentId;
  }

  navigateToViewTreatment = (data: TreatmentData): void => {
    const id = data.patientTreatmentId;
    if (!id || id === 0) {
      this.generalService.showError('Unable to Continue Treatment Id Not Found');
      return;
    }
    this.openTreatmentDetailTab(data);
  };

  openTreatmentDetailTab(data: TreatmentData): void {
    const treatmentId = Number(data?.patientTreatmentId || 0);
    if (!treatmentId) return;

    const existingTab = this.detailTabs.find((tab) => tab.treatmentId === treatmentId);
    if (existingTab) {
      existingTab.title = `Treatment #${treatmentId}`;
      this.activeTabKey = existingTab.key;
      this.cdr.markForCheck();
      return;
    }

    const tab: TreatmentDetailTab = {
      key: `treatment-${treatmentId}`,
      treatmentId,
      title: `Treatment #${treatmentId}`,
    };

    this.detailTabs = [...this.detailTabs, tab];
    this.activeTabKey = tab.key;
    this.cdr.markForCheck();
  }

  closeTreatmentDetailTab(tabKey: string): void {
    const closingIndex = this.detailTabs.findIndex((tab) => tab.key === tabKey);
    if (closingIndex < 0) return;

    const wasActive = this.activeTabKey === tabKey;
    this.detailTabs = this.detailTabs.filter((tab) => tab.key !== tabKey);

    if (wasActive) {
      const fallbackTab =
        this.detailTabs[closingIndex - 1] ?? this.detailTabs[closingIndex] ?? null;
      this.activeTabKey = fallbackTab?.key ?? this.treatmentListTabKey;
    }

    this.cdr.markForCheck();
  }

  activateTreatmentListTab(): void {
    this.activeTabKey = this.treatmentListTabKey;
    this.cdr.markForCheck();
  }

  get selectedTabIndex(): number {
    if (this.activeTabKey === this.treatmentListTabKey) {
      return 0;
    }

    const detailTabIndex = this.detailTabs.findIndex(
      (tab) => tab.key === this.activeTabKey
    );
    return detailTabIndex >= 0 ? detailTabIndex + 1 : 0;
  }

  onTabIndexChange(index: number): void {
    if (index <= 0) {
      this.activeTabKey = this.treatmentListTabKey;
      return;
    }

    const selectedTab = this.detailTabs[index - 1];
    this.activeTabKey = selectedTab?.key ?? this.treatmentListTabKey;
  }

  onTabClose(event: { index: number } | number): void {
    const closedIndex =
      typeof event === 'number' ? Number(event) : Number(event?.index ?? -1);
    if (closedIndex <= 0) return;

    const tab = this.detailTabs[closedIndex - 1];
    if (!tab) return;
    this.closeTreatmentDetailTab(tab.key);
  }

  trackByTabKey(_index: number, tab: TreatmentDetailTab): string {
    return tab.key;
  }

  updateTreatmentStatus = (data: TreatmentData): void => {
    const title = 'Update Treatment Status';
    const id = data.patientTreatmentId || 0;
    const formPath = 'statusUpdates/update-treatment-status-form.json';
    this.commanModel.showModal(title, 'form', formPath, id);
  };

  refreshAfterModal(): void {
    this.fetchTreatments();
  }

  getStatusBadgeClass(status: string | null | undefined): string {
    return getUnifiedStatusBadgeClass(status);
  }

  getRefillBadgeClass(value: boolean | null | undefined): string {
    if (value === true) return 'ui-status-badge--pending';
    if (value === false) return 'ui-status-badge--success';
    return 'ui-status-badge--neutral';
  }

  getRefillLabel(value: boolean | null | undefined): string {
    if (value === true) return 'Refill Requested';
    if (value === false) return 'Not Required';
    return '--';
  }
}
