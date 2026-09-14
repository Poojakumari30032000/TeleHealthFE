import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { debounceTime, Subject, takeUntil } from 'rxjs';

import { AuthService } from 'app/shared/Auth/auth.service';
import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';
import { GeneralService } from 'app/shared/services/general.service';
import { getUnifiedStatusBadgeClass } from 'app/shared/utils/status-badge.util';

interface OrderRow {
  patientOrderId: number;
  orderDate: string | null;
  patientName: string;
  mrn: string;
  patientEmail: string;
  sendToPharmacy: string | null;
  shippedDate: string | null;
  orderStatus: string | null;
}

interface PatientOption {
  patientId: number;
  patientName: string;
}

interface Facility {
  facilityId: string | number;
  titlelong: string;
}

@Component({
  selector: 'app-order-list-view',
  templateUrl: './order-list-view.component.html',
  styleUrl: './order-list-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderListViewComponent implements OnInit, OnDestroy {
  @ViewChild(CommanFormModalComponent) commanModel!: CommanFormModalComponent;

  paymentStatusOptions = ['Pending', 'Paid'];
  orderStatusOptions = [
    'Created',
    'Pending',
    'Processing',
    'Out for Delivery',
    'Completed',
    'Failed',
    'Returned',
    'Cancelled'
  ];
  visitStatusOptions = ['Pending', 'Completed', 'Canceled'];

  selectedFacility: string | number | null = '';
  readonly orgId = Number(localStorage.getItem('OFL'));

  showFilters = true;
  appliedFilters: any[] = [];
  private destroy$ = new Subject<void>();
  private searchTerms = new Subject<void>();

  searchQuery = '';
  selectedPaymentStatus: string | null = null;
  selectedVisitStatus: string | null = null;
  selectedOrderStatus: string | null = null;
  selectedProductId = 0;
  selectedDateRange: Date[] | null = null;
  providerId = 0;
  patientId = 0;

  facilitiesLoading = false;
  loadingPatient = false;
  patientData: PatientOption[] = [];
  facilities: Facility[] = [];

  userRole = '';

  loading = false;
  orders: OrderRow[] = [];
  total = 0;
  pageIndex = 1;
  pageSize = 100;

  modalApiUrl: { save?: string; get?: string } = {
    save: 'Patients/updateStatus',
    get: 'Patients/getStatus?Type=Order&Id=',
  };

  constructor(
    private route: Router,
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
    if (this.userRole === 'Global Admin' || this.userRole === 'Provider') {
      this.getClinics();
    }

    this.getAllPatient();
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
      ...(this.selectedFacility ? [{ name: 'facilityId', value: this.selectedFacility }] : []),
      { name: 'Title', value: this.searchQuery },
      { name: 'PaymentStatus', value: this.selectedPaymentStatus },
      { name: 'VisitStatus', value: this.selectedVisitStatus },
      { name: 'OrderStatus', value: this.selectedOrderStatus },
      { name: 'ProductId', value: this.selectedProductId },
      { name: 'ProviderId', value: this.providerId },
      { name: 'PatientId', value: this.patientId },
    ];

    if (this.selectedDateRange && this.selectedDateRange.length === 2) {
      const startDate = this.formatDateLocal(this.selectedDateRange[0]!);
      const endDate = this.formatDateLocal(this.selectedDateRange[1]!);
      this.appliedFilters.push({ name: 'StartTime', value: startDate });
      this.appliedFilters.push({ name: 'EndTime', value: endDate });
    }

    this.appliedFilters = this.appliedFilters.filter(
      (f) => f.value !== null && f.value !== undefined && f.value !== '' && f.value !== 0
    );

    this.fetchOrders();
  }

  get visibleFiltersCount(): number {
    return this.appliedFilters.filter((f) => !this.shouldHideAppliedFilter(f.name)).length;
  }

  shouldHideAppliedFilter(filterName: string): boolean {
    if (!filterName) return false;
    if (filterName === 'ProviderId') return true;

    if (filterName === 'facilityId') {
      return !['Global Admin', 'Provider'].includes(this.userRole);
    }

    if (this.userRole === 'Patient') {
      return filterName === 'PatientId';
    }

    return false;
  }

  getFilterDisplayName(filterName: string): string {
    switch (filterName) {
      case 'facilityId':
        return 'Clinic';
      case 'ProviderId':
        return 'Provider';
      case 'PatientId':
        return 'Patient';
      case 'ProductId':
        return 'Product';
      case 'PaymentStatus':
        return 'Payment Status';
      case 'VisitStatus':
        return 'Visit Status';
      case 'OrderStatus':
        return 'Order Status';
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
      case 'PatientId': {
        const optionPatient = this.patientData.find(
          (opt) => opt.patientId.toString() === filter.value?.toString()
        );
        return optionPatient ? optionPatient.patientName : filter.value;
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
    this.selectedVisitStatus = null;
    this.selectedPaymentStatus = null;
    this.selectedOrderStatus = null;
    this.selectedProductId = 0;
    this.selectedDateRange = null;

    this.providerId = this.userRole === 'Provider' ? this.auth.getUserId() || 0 : 0;
    this.patientId = this.userRole === 'Patient' ? this.auth.getPatientId() || 0 : 0;

    this.selectedFacility = ['Global Admin', 'Provider'].includes(this.userRole)
      ? ''
      : (localStorage.getItem('FOS') || '');

    this.getAllPatient();
    this.applyFilter(undefined, true);
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
      case 'VisitStatus':
        this.selectedVisitStatus = null;
        break;
      case 'PaymentStatus':
        this.selectedPaymentStatus = null;
        break;
      case 'OrderStatus':
        this.selectedOrderStatus = null;
        break;
      case 'ProductId':
        this.selectedProductId = 0;
        break;
      case 'ProviderId':
        this.providerId = 0;
        break;
      case 'PatientId':
        this.patientId = 0;
        break;
      case 'StartDate':
      case 'EndDate':
      case 'StartTime':
      case 'EndTime':
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
      this.fetchOrders();
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

  private fetchOrders(): void {
    this.loading = true;
    this.cdr.markForCheck();

    const query = this.buildQueryString();

    this.generalService
      .commonGet(`PatientOrders/getAllPatientOrders?${query}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response?.status === 1) {
            this.orders = Array.isArray(response?.data) ? response.data : [];
            this.total = Number(response?.totalEntityCount ?? 0);
          } else {
            this.orders = [];
            this.total = 0;
          }

          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to fetch orders:', err);
          this.orders = [];
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
      if (stored !== '') {
        url += `?FacilityId=${stored}`;
      }
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

  trackByPatientId(_index: number, data: PatientOption): number {
    return data.patientId;
  }

  trackByOrderId(_index: number, row: OrderRow): number {
    return row.patientOrderId;
  }

  navigateToViewOrder = (data: OrderRow): void => {
    const id = data.patientOrderId || 0;
    if (!id) {
      this.generalService.showError('Unable to Continue Order Id Not Found');
      return;
    }
    this.route.navigate(['order/detail', id]);
  };

  updateOrderStatus = (data: OrderRow): void => {
    const title = 'Update Order Status';
    const id = data?.patientOrderId || 0;
    const formPath = 'statusUpdates/update-order-status-form.json';
    this.commanModel.showModal(title, 'form', formPath, id);
  };

  refreshAfterModal(): void {
    this.fetchOrders();
  }

  getStatusBadgeClass(status: string | null | undefined): string {
    return getUnifiedStatusBadgeClass(status);
  }
}
