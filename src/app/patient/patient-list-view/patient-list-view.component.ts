import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { debounceTime, Subject, takeUntil } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { GeneralService } from 'app/shared/services/general.service';
import { AuthService } from 'app/shared/Auth/auth.service';
import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';
import { getUnifiedStatusBadgeClass } from 'app/shared/utils/status-badge.util';
import { TreatmentDetailViewComponent } from 'app/treatment/treatment-detail-view/treatment-detail-view.component';
import { TreatmentModule } from 'app/treatment/treatment.module';
import { ClinicPatientInvoiceDetailComponent } from 'app/billing/clinic-patient-invoice-detail/clinic-patient-invoice-detail.component';
import { BillingModule } from 'app/billing/billing.module';
import * as XLSX from 'xlsx';

interface PatientData {
  guid: string;
  patientId: number;
  facilityId: number;
  name: string;
  startDate: string;
  mrn: string;
  subscription: number;
  productId: number;
  productName: string;
  email: string;
  phone: string;
  orderCount: number;
  status: string;
  lastOrder: string;
  nextRefill: string;
  followUp: string;
  archievedBy: number;
  archievedAt: string;
  unreadChat: number;
  digitalProductStatus: string;
  digitalProductPrice: number;
  dob: string;
  address: string;
  street: string;
  cityId: number;
  cityName: string;
  stateId: number;
  stateName: string;
  zipcode: string;
  refillStatus: string;
  clinicName: string;

  facilityName?: string;
  treatmentCount?: number;
  prescriptionCount?: number;
}

interface Facility {
  facilityId: number;
  titlelong: string;
}

type BulkRowStatus = 'valid' | 'invalid' | 'duplicate';

interface ParsedPatientRow {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  phoneDisplay: string;
  status: BulkRowStatus;
  errors: string[];
}

interface BulkPatientImportResult {
  importSucceeded?: boolean;
  rowsReceived?: number;
  patientsCreated?: number;
  patientsSucceeded?: Array<{ patientId: number; email: string; firstName: string; lastName: string }>;
  patientsSkipped?: Array<{ email?: string; firstName?: string; lastName?: string; message: string }>;
}

interface PatientDetailTab {
  key: string;
  type: 'patient' | 'treatment' | 'invoice';
  title: string;
  patientId?: number;
  treatmentId?: number;
  invoiceId?: number;
}

type EmbeddedPatientTabNavigationRequest = {
  type: 'treatment' | 'invoice' | 'patientMain';
  id?: number;
  data?: any;
};

@Component({
  selector: 'app-patient-list-view',
  templateUrl: './patient-list-view.component.html',
  styleUrl: './patient-list-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientListViewComponent implements OnInit, OnDestroy {
  @ViewChild('commanModel', { static: false })
  commanModel!: CommanFormModalComponent;

  readonly patientListTabKey = 'patient-list';
  activeTabKey = this.patientListTabKey;
  detailTabs: PatientDetailTab[] = [];

  modalApiUrl: { save?: string; get?: string } = {
    save: 'Patients/savePatient',
    get: 'Patients/getPatientById?Id=',
  };

  userRole = this.auth.getUserRole() || '';

  showFilters = true;
  appliedFilters: any[] = [];

  searchQuery = '';
  selectedFacility: number | string | null = null;
  selectedStatus: string | null = null;
  selectedDateRange: Date[] | null = null;
  selectedRefillStatus: string | null = null;

  patientStatusOptions = ['Active','Inactive'];
  refillStatusOptions = ['Not Required', 'Refill requested'];

  facilities: Facility[] = [];
  facilitiesLoading = false;

  providerId = 0;

  loading = false;
  patients: PatientData[] = [];

  total = 0;
  totalPages = 0;

  pageIndex = 1;
  pageSize = 100;

  private destroy$ = new Subject<void>();
  private searchTerms$ = new Subject<void>();
  private dupCheckCancel$ = new Subject<void>();

  readonly orgId = Number(localStorage.getItem('OFL'));

  addPatientModalVisible = false;
  isSubmittingManualPatient = false;
  addPatientForm!: FormGroup;
  emailDuplicateCheck = false;
  private readonly strictEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  bulkImportVisible = false;
  bulkImportStep: 'upload' | 'preview' | 'result' = 'upload';
  bulkImportFile: File | null = null;
  bulkImportDragOver = false;
  bulkImportParsing = false;
  bulkImportSubmitting = false;
  bulkImportFacilityId: number | null = null;
  bulkParsedRows: ParsedPatientRow[] = [];
  bulkImportResult: BulkPatientImportResult | null = null;
  bulkDupCheckPending = false;

  constructor(
    private generalService: GeneralService,
    private cdr: ChangeDetectorRef,
    private auth: AuthService,
    private fb: FormBuilder,
    private route: ActivatedRoute
  ) {}

  private get clinicAdminFacilityId(): number {
    return Number(this.auth.getUserFacilityId() ?? 0);
  }

  ngOnInit(): void {
    this.userRole = this.auth.getUserRole() || '';

    if (this.userRole === 'Global Admin' || this.userRole === 'Provider') {
      this.getClinics();
      this.selectedFacility = '0';
    } else if (this.userRole === 'Clinic Admin') {

      this.selectedFacility = this.clinicAdminFacilityId;
    } else {
      this.selectedFacility = this.auth.getUserFacilityId() || '';
    }

    const userId = this.auth.getUserId() || 0;
    if (this.userRole === 'Provider') {
      this.providerId = userId;
    }

    this.buildAddPatientForm();

    const qp = this.route.snapshot.queryParamMap;
    const refillStatusParam = qp.get('refillStatus');
    if (refillStatusParam && this.refillStatusOptions.includes(refillStatusParam)) {
      this.selectedRefillStatus = refillStatusParam;
    }

    this.searchTerms$
      .pipe(debounceTime(1000), takeUntil(this.destroy$))
      .subscribe(() => this.applyFilter(true));

    this.applyFilter(true);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchTerms$.complete();
    this.dupCheckCancel$.complete();
  }

  private buildAddPatientForm(): void {
    const selectedFacilityValue = this.selectedFacility ? Number(this.selectedFacility) : 0;
    let initialFacility = 0;

    if (this.userRole === 'Clinic Admin') {
      initialFacility = this.clinicAdminFacilityId;
    } else if (
      this.userRole === 'Provider' ||
      this.userRole === 'Global Admin'
    ) {
      initialFacility = selectedFacilityValue;
    }

    this.addPatientForm = this.fb.group({
      facilityId: [
        initialFacility || null,
        [Validators.required, Validators.min(1)],
      ],
      firstName: ['', [Validators.required, this.noWhitespaceValidator]],
      lastName: ['', [Validators.required, this.noWhitespaceValidator]],
      email: [
        '',
        [
          Validators.required,
          this.noWhitespaceValidator,
          Validators.email,
          Validators.pattern(this.strictEmailPattern),
        ],
      ],
      phone: ['', [Validators.required]],
    });
  }

  openAddPatientModal(): void {
    if (this.userRole !== 'Global Admin' && this.userRole !== 'Clinic Admin') return;

    if (!this.facilities.length && !this.facilitiesLoading) {
      this.getClinics();
    }

    const selectedFacilityValue = this.selectedFacility ? Number(this.selectedFacility) : 0;
    const defaultFacility = selectedFacilityValue || null;

    this.addPatientForm.reset({
      facilityId: defaultFacility || null,
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
    });
    this.emailDuplicateCheck = false;

    this.addPatientModalVisible = true;
    this.cdr.markForCheck();
  }

  closeAddPatientModal(): void {
    this.addPatientModalVisible = false;
    this.isSubmittingManualPatient = false;
    this.addPatientForm.reset();
    this.cdr.markForCheck();
  }

  onAddPatientSubmit(): void {
    if (this.userRole !== 'Global Admin' && this.userRole !== 'Clinic Admin') return;

    if (this.addPatientForm.invalid) {
      this.addPatientForm.markAllAsTouched();
      return;
    }

    const facilityId =
      this.userRole === 'Clinic Admin'
        ? this.clinicAdminFacilityId
        : Number(this.addPatientForm.get('facilityId')?.value);

    const payload = {
      facilityId: facilityId,
      firstName: String(this.addPatientForm.value.firstName || '').trim(),
      lastName: String(this.addPatientForm.value.lastName || '').trim(),
      email: String(this.addPatientForm.value.email || '').trim(),
      phone: String(this.addPatientForm.value.phone || '').replace(/\D/g, '').trim(),
    };

    if (!payload.facilityId || payload.facilityId <= 0) return;

    this.isSubmittingManualPatient = true;
    this.cdr.markForCheck();

    this.generalService
      .commonPost('Patients/saveManualPatient', payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response?.status === 1) {
            this.addPatientModalVisible = false;
            this.addPatientForm.reset();
            this.fetchPatients();
          }
          this.isSubmittingManualPatient = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isSubmittingManualPatient = false;
          this.cdr.markForCheck();
        },
          });
  }

  trimAddPatientControl(controlName: 'firstName' | 'lastName' | 'email'): void {
    const control = this.addPatientForm.get(controlName);
    if (!control) return;

    const trimmed = String(control.value || '').trim();
    const normalized = controlName === 'email' ? trimmed.toLowerCase() : trimmed;

    control.setValue(normalized, { emitEvent: false });
    control.updateValueAndValidity({ emitEvent: false });
  }

  onBlurEmailCheck(): void {
    const control = this.addPatientForm.get('email');
    const email = String(control?.value || '').trim();

    if (!email || !control?.valid) return;

    this.emailDuplicateCheck = true;
    this.cdr.markForCheck();

    this.generalService
      .checkDuplicateEmail(email)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.emailDuplicateCheck = false;
          if (response?.activeUserExists) {
            control?.setErrors({ ...(control.errors || {}), duplicate: true });
            this.generalService.showError('Email already exists. Please use a different email.');
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.emailDuplicateCheck = false;
          this.cdr.markForCheck();
        },
      });
  }

  onAddPatientPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = this.normalizeUsPhoneDigits(input.value || '');
    const formatted = this.formatUsPhone(digits);

    input.value = formatted;
    this.addPatientForm.get('phone')?.setValue(formatted, { emitEvent: false });
  }

  onAddPatientPhonePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const input = event.target as HTMLInputElement;
    const pastedText = event.clipboardData?.getData('text') || '';
    const digits = this.normalizeUsPhoneDigits(pastedText);
    const formatted = this.formatUsPhone(digits);

    input.value = formatted;
    this.addPatientForm.get('phone')?.setValue(formatted, { emitEvent: false });
  }

  private normalizeUsPhoneDigits(value: string): string {
    let digits = String(value || '').replace(/\D/g, '');

    if (digits.length === 11 && digits.startsWith('1')) {
      digits = digits.slice(1);
    }

    return digits.slice(0, 10);
  }

  private formatUsPhone(digits: string): string {
    if (!digits) return '';
    if (digits.length > 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length > 3) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }
    return `(${digits}`;
  }

  private noWhitespaceValidator(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value ?? '');
    return value.trim().length > 0 ? null : { whitespace: true };
  }

  searchTermChanged(): void {
    this.searchTerms$.next();
  }

  formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }

  applyFilter(resetPage: boolean): void {
    if (resetPage) this.pageIndex = 1;

    const facilityValue =
      this.userRole === 'Clinic Admin'
        ? this.clinicAdminFacilityId
        : this.selectedFacility;

    this.appliedFilters = [
      { name: 'FacilityId', value: facilityValue },
      { name: 'Title', value: this.searchQuery },
      { name: 'Status', value: this.selectedStatus },
      { name: 'ProviderId', value: this.providerId },
    ];

    if (this.selectedDateRange && this.selectedDateRange.length === 2) {
      const startDate = this.formatDateLocal(this.selectedDateRange[0]!);
      const endDate = this.formatDateLocal(this.selectedDateRange[1]!);
      this.appliedFilters.push({ name: 'StartDate', value: startDate });
      this.appliedFilters.push({ name: 'EndDate', value: endDate });
    }

    if (this.selectedRefillStatus) {
      this.appliedFilters.push({ name: 'RefillStatus', value: this.selectedRefillStatus });
    }

    this.appliedFilters = this.appliedFilters.filter((filter) => {
      if (filter.name === 'FacilityId' && this.userRole === 'Clinic Admin') {
        return this.clinicAdminFacilityId > 0;
      }

      return (
        filter.value !== null &&
        filter.value !== undefined &&
        filter.value !== '' &&
        filter.value !== 0 &&
        filter.value !== '0'
      );
    });

    this.fetchPatients();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedStatus = null;
    this.selectedDateRange = null;
    this.selectedRefillStatus = null;

    if (this.userRole === 'Global Admin' || this.userRole === 'Provider') {
      this.selectedFacility = '0';
    } else if (this.userRole === 'Clinic Admin') {
      this.selectedFacility = this.clinicAdminFacilityId;
    }

    this.applyFilter(true);
  }

  removeFilter(filterName: string): void {
    switch (filterName) {
      case 'FacilityId':
        if (this.userRole === 'Clinic Admin') {
          this.selectedFacility = this.clinicAdminFacilityId;
        } else {
          this.selectedFacility = '0';
        }
        break;
      case 'Title':
        this.searchQuery = '';
        break;
      case 'Status':
        this.selectedStatus = null;
        break;
      case 'StartDate':
      case 'EndDate':
        this.selectedDateRange = null;
        break;
      case 'RefillStatus':
        this.selectedRefillStatus = null;
        break;
    }
    this.applyFilter(true);
  }

  get visibleFiltersCount(): number {
    return this.appliedFilters.filter(
      (f) => !this.shouldHideAppliedFilter(f.name)
    ).length;
  }

  shouldHideAppliedFilter(filterName: string): boolean {
    return (
      filterName === 'ProviderId' ||
      (filterName === 'FacilityId' &&
        this.userRole !== 'Global Admin' &&
        this.userRole !== 'Provider')
    );
  }

  getFilterDisplayName(filterName: string): string {
    switch (filterName) {
      case 'FacilityId':
        return 'Clinic';
      case 'RefillStatus':
        return 'Refill Status';
      default:
        return filterName;
    }
  }

  getFilterDisplayValue(filter: any): string {
    switch (filter.name) {
      case 'FacilityId': {
        const option = this.facilities.find(
          (opt) => opt.facilityId.toString() === filter.value?.toString()
        );
        return option ? option.titlelong : filter.value;
      }
      default:
        return filter.value;
    }
  }

  trackByFilterName(_index: number, filter: any): string {
    return filter.name;
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;

    const pageChanged = pageIndex !== this.pageIndex;
    const sizeChanged = pageSize !== this.pageSize;

    this.pageIndex = pageIndex;
    this.pageSize = pageSize;

    if (pageChanged || sizeChanged) {
      this.fetchPatients();
    }
  }

  private buildQueryString(): string {
    const parts: string[] = [];

    parts.push(`PageNumber=${encodeURIComponent(String(this.pageIndex))}`);
    parts.push(`PageSize=${encodeURIComponent(String(this.pageSize))}`);

    for (const f of this.appliedFilters) {
      parts.push(
        `${encodeURIComponent(f.name)}=${encodeURIComponent(String(f.value))}`
      );
    }

    return parts.join('&');
  }

  private fetchPatients(): void {
    this.loading = true;
    this.cdr.markForCheck();

    const qs = this.buildQueryString();
    const url = `Patients/getAllPatients?${qs}`;

    this.generalService
      .commonGet(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response?.status === 1) {
            this.patients = Array.isArray(response?.data) ? response.data : [];

            this.total = Number(response?.totalEntityCount ?? 0);

            this.totalPages = Number(response?.totalPages ?? 0);

          } else {
            this.patients = [];
            this.total = 0;
            this.totalPages = 0;
          }

          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to fetch patients:', err);
          this.patients = [];
          this.total = 0;
          this.totalPages = 0;
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  getClinics(): void {
    this.facilitiesLoading = true;
    this.facilities = [];

    const req$ =
      this.userRole === 'Provider'
        ? this.generalService.commonGet(
          `DropDowns/GetAllFacilitiesbyProviderId?Id=${this.auth.getUserId() || 0}`
        )
        : this.generalService.commonGet(
          `DropDowns/getAllFacilities?OrganizationId=${this.orgId}`
        );

    req$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => {
        if (response?.status === 1 && response?.data) {
          this.facilities = response.data || [];
        } else {
          this.facilities = [];
        }
        this.facilitiesLoading = false;
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Failed to fetch clinics:', err);
        this.facilities = [];
        this.facilitiesLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  navigateToViewPatient = (data: PatientData) => {
    this.openPatientDetailTab(data);
  };

  openPatientDetailTab(data: PatientData): void {
    const patientId = Number(data.patientId);
    if (!patientId) return;

    const existingTab = this.detailTabs.find(
      (tab) => tab.type === 'patient' && tab.patientId === patientId
    );
    if (existingTab) {
      existingTab.title = data.name || existingTab.title;
      this.activeTabKey = existingTab.key;
      this.cdr.markForCheck();
      return;
    }

    const tab: PatientDetailTab = {
      key: `patient-${patientId}`,
      type: 'patient',
      title: data.name || `Patient #${patientId}`,
      patientId,
    };

    this.detailTabs = [...this.detailTabs, tab];
    this.activeTabKey = tab.key;
    this.cdr.markForCheck();
  }

  openTreatmentDetailTab(data: { patientTreatmentId?: number; treatmentId?: number }): void {
    const treatmentId = Number(data?.patientTreatmentId || data?.treatmentId || 0);
    if (!treatmentId) return;

    const existingTab = this.detailTabs.find(
      (tab) => tab.type === 'treatment' && tab.treatmentId === treatmentId
    );
    if (existingTab) {
      existingTab.title = `Treatment #${treatmentId}`;
      this.activeTabKey = existingTab.key;
      this.cdr.markForCheck();
      return;
    }

    const tab: PatientDetailTab = {
      key: `treatment-${treatmentId}`,
      type: 'treatment',
      treatmentId,
      title: `Treatment #${treatmentId}`,
    };

    this.detailTabs = [...this.detailTabs, tab];
    this.activeTabKey = tab.key;
    this.cdr.markForCheck();
  }

  openInvoiceDetailTab(data: {
    paymentId?: number;
    invoiceId?: number;
    id?: number | string | null;
  }): void {
    const invoiceId = Number(data?.invoiceId || data?.id || data?.paymentId || 0);
    if (!invoiceId) return;

    const existingTab = this.detailTabs.find(
      (tab) => tab.type === 'invoice' && tab.invoiceId === invoiceId
    );
    if (existingTab) {
      existingTab.title = `Invoice #${invoiceId}`;
      this.activeTabKey = existingTab.key;
      this.cdr.markForCheck();
      return;
    }

    const tab: PatientDetailTab = {
      key: `invoice-${invoiceId}`,
      type: 'invoice',
      invoiceId,
      title: `Invoice #${invoiceId}`,
    };

    this.detailTabs = [...this.detailTabs, tab];
    this.activeTabKey = tab.key;
    this.cdr.markForCheck();
  }

  onEmbeddedTabNavigate = (request: EmbeddedPatientTabNavigationRequest): void => {
    if (!request?.type) return;

    if (request.type === 'patientMain') {
      this.activatePatientListTab();
      return;
    }

    if (request.type === 'treatment') {
      const treatmentId = Number(request.id || request.data?.patientTreatmentId || 0);
      if (!treatmentId) return;
      this.openTreatmentDetailTab(request.data || { patientTreatmentId: treatmentId });
      return;
    }

    if (request.type === 'invoice') {
      const invoiceId = Number(
        request.id ||
          request.data?.invoiceId ||
          request.data?.id ||
          request.data?.paymentId ||
          0
      );
      if (!invoiceId) return;
      this.openInvoiceDetailTab(
        request.data || { invoiceId, paymentId: invoiceId }
      );
    }
  };

  getTabComponent(tab: PatientDetailTab): any {
    if (tab.type === 'treatment') {
      return TreatmentDetailViewComponent;
    }
    if (tab.type === 'invoice') {
      return ClinicPatientInvoiceDetailComponent;
    }
    return null;
  }

  getTabComponentModule(tab: PatientDetailTab): any {
    if (tab.type === 'treatment') {
      return TreatmentModule;
    }
    if (tab.type === 'invoice') {
      return BillingModule;
    }
    return null;
  }

  getTabComponentInputs(tab: PatientDetailTab): Record<string, any> {
    if (tab.type === 'treatment') {
      return {
        treatmentIdInput: Number(tab.treatmentId || 0),
        embeddedInTabs: true,
      };
    }
    if (tab.type === 'invoice') {
      return {
        invoiceIdInput: Number(tab.invoiceId || 0),
        embeddedInTabs: true,
      };
    }
    return {};
  }

  closePatientDetailTab(tabKey: string): void {
    const closingIndex = this.detailTabs.findIndex((tab) => tab.key === tabKey);
    if (closingIndex < 0) return;

    const wasActive = this.activeTabKey === tabKey;
    this.detailTabs = this.detailTabs.filter((tab) => tab.key !== tabKey);

    if (wasActive) {
      const fallbackTab =
        this.detailTabs[closingIndex - 1] ?? this.detailTabs[closingIndex] ?? null;
      this.activeTabKey = fallbackTab?.key ?? this.patientListTabKey;
    }

    this.cdr.markForCheck();
  }

  activatePatientListTab(): void {
    this.activeTabKey = this.patientListTabKey;
    this.cdr.markForCheck();
  }

  get selectedTabIndex(): number {
    if (this.activeTabKey === this.patientListTabKey) {
      return 0;
    }

    const detailTabIndex = this.detailTabs.findIndex(
      (tab) => tab.key === this.activeTabKey
    );
    return detailTabIndex >= 0 ? detailTabIndex + 1 : 0;
  }

  onTabIndexChange(index: number): void {
    if (index <= 0) {
      this.activeTabKey = this.patientListTabKey;
      return;
    }

    const selectedTab = this.detailTabs[index - 1];
    this.activeTabKey = selectedTab?.key ?? this.patientListTabKey;
  }

  onTabClose(event: { index: number } | number): void {
    const closedIndex =
      typeof event === 'number' ? Number(event) : Number(event?.index ?? -1);
    if (closedIndex <= 0) return;

    const tab = this.detailTabs[closedIndex - 1];
    if (!tab) return;
    this.closePatientDetailTab(tab.key);
  }

  trackByTabKey(_index: number, tab: PatientDetailTab): string {
    return tab.key;
  }

  AddEditPatient = (data?: PatientData) => {
    let title: string = 'Add Patient';
    const ID = data?.patientId || 0;
    const selectedFacilityId = data?.facilityId;
    const formPath = 'patient/add-edit-patient-form.json';
    if (data) title = 'Update Patient';

    this.commanModel.showModal(
      title,
      'form',
      formPath,
      ID,
      Number(selectedFacilityId)
    );

  };

  refreshAfterModal(): void {
    this.fetchPatients();
  }

  getStatusBadgeClass(status: string | null | undefined): string {
    return getUnifiedStatusBadgeClass(status);
  }

  openBulkImportModal(): void {
    if (this.userRole !== 'Global Admin' && this.userRole !== 'Clinic Admin') return;

    if (this.userRole === 'Global Admin' && !this.facilities.length && !this.facilitiesLoading) {
      this.getClinics();
    }

    this.resetBulkImport();

    if (this.userRole === 'Global Admin') {
      const sel = this.selectedFacility ? Number(this.selectedFacility) : 0;
      this.bulkImportFacilityId = sel > 0 ? sel : null;
    }

    this.bulkImportVisible = true;
    this.cdr.markForCheck();
  }

  closeBulkImportModal(): void {
    if (this.bulkImportSubmitting || this.bulkImportParsing) return;
    this.bulkImportVisible = false;
    this.resetBulkImport();
    this.cdr.markForCheck();
  }

  private resetBulkImport(): void {
    this.dupCheckCancel$.next();
    this.bulkImportStep = 'upload';
    this.bulkImportFile = null;
    this.bulkImportDragOver = false;
    this.bulkImportParsing = false;
    this.bulkImportSubmitting = false;
    this.bulkParsedRows = [];
    this.bulkImportResult = null;
    this.bulkImportFacilityId = null;
    this.bulkDupCheckPending = false;
  }

  downloadBulkTemplate(): void {
    this.generalService
      .downloadPatientBulkImportTemplate()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Patient_Bulk_Import_Template.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.generalService.showError('Could not download the template. Please try again.');
      },
    });
  }

  onBulkFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.setBulkImportFile(file);
    input.value = '';
  }

  setBulkImportFile(file: File | null): void {
    if (!file) {
      this.bulkImportFile = null;
      this.cdr.markForCheck();
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx') {
      this.bulkImportFile = null;
      this.generalService.showError('Please choose an Excel .xlsx file.');
      this.cdr.markForCheck();
      return;
    }
    this.bulkImportFile = file;
    this.cdr.markForCheck();
  }

  onBulkDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.bulkImportDragOver = false;
    const file = event.dataTransfer?.files?.[0] ?? null;
    this.setBulkImportFile(file);
  }

  onBulkDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.bulkImportDragOver = true;
  }

  onBulkDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.bulkImportDragOver = false;
  }

  get canStartBulkParse(): boolean {
    return (
      !!this.bulkImportFile &&
      !this.bulkImportParsing &&
      (this.userRole !== 'Global Admin' || !!this.bulkImportFacilityId)
    );
  }

  async parseAndPreview(): Promise<void> {
    if (!this.bulkImportFile) return;
    if (this.userRole === 'Global Admin' && !this.bulkImportFacilityId) {
      this.generalService.showError('Please select a clinic first.');
      return;
    }

    this.bulkImportParsing = true;
    this.cdr.markForCheck();

    try {
      const buffer = await this.bulkImportFile.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
      const sheetName =
        wb.SheetNames.find((n) => n.toLowerCase() === 'patients') ?? wb.SheetNames[0];
      const ws = sheetName ? wb.Sheets[sheetName] : undefined;
      const json: any[] = ws
        ? XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })
        : [];

      this.bulkParsedRows = this.validateParsedRows(json);

      if (this.bulkParsedRows.length === 0) {
        this.generalService.showError('No patient rows were found in the file.');
        return;
      }

      this.preflagExistingEmails();
      this.bulkImportStep = 'preview';
    } catch (e) {
      console.error('Bulk import parse failed:', e instanceof Error ? e.message : String(e));
      this.generalService.showError('Could not read the Excel file. Make sure it is a valid .xlsx file.');
    } finally {
      this.bulkImportParsing = false;
      this.cdr.markForCheck();
    }
  }

  private validateParsedRows(json: any[]): ParsedPatientRow[] {
    const rows: ParsedPatientRow[] = [];
    const seenEmails = new Set<string>();
    let rowNumber = 1;

    for (const raw of json) {
      rowNumber++;

      const firstName = this.pickField(raw, ['FirstName', 'First Name']);
      const lastName = this.pickField(raw, ['LastName', 'Last Name']);
      const email = this.pickField(raw, ['Email', 'Email Address']).toLowerCase();
      const rawPhone = this.pickField(raw, ['MobilePhone', 'Mobile Phone', 'Phone', 'Mobile']);

      if (!firstName && !lastName && !email && !rawPhone) continue;

      const phoneDigits = this.normalizeUsPhoneDigits(rawPhone);
      const errors: string[] = [];

      if (!firstName) errors.push('First name is required');
      if (!lastName) errors.push('Last name is required');
      if (!email) errors.push('Email is required');
      else if (!this.strictEmailPattern.test(email)) errors.push('Email is not valid');
      if (phoneDigits.length !== 10) errors.push('Phone must be 10 digits');

      let status: BulkRowStatus = errors.length ? 'invalid' : 'valid';

      if (status === 'valid' && email) {
        if (seenEmails.has(email)) {
          status = 'invalid';
          errors.push('Duplicate email in file');
        } else {
          seenEmails.add(email);
        }
      }

      rows.push({
        rowNumber,
        firstName,
        lastName,
        email,
        phone: phoneDigits,
        phoneDisplay: this.formatUsPhone(phoneDigits) || rawPhone,
        status,
        errors,
      });
    }

    return rows;
  }

  private pickField(row: any, aliases: string[]): string {
    if (!row) return '';
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const keys = Object.keys(row);
    for (const alias of aliases) {
      const target = norm(alias);
      const key = keys.find((k) => norm(k) === target);
      if (key != null) return String(row[key] ?? '').trim();
    }
    return '';
  }

  private preflagExistingEmails(): void {

    this.dupCheckCancel$.next();

    const emails = this.bulkParsedRows
      .filter((r) => r.status === 'valid')
      .map((r) => r.email);
    if (!emails.length) {
      this.bulkDupCheckPending = false;
      return;
    }

    this.bulkDupCheckPending = true;

    this.generalService
      .checkActiveUsersExist(emails)
      .pipe(takeUntil(this.dupCheckCancel$), takeUntil(this.destroy$))
      .subscribe({

        next: (res: any) => {
          const taken: string[] = Array.isArray(res?.data)
            ? res.data.map((e: string) => String(e).toLowerCase())
            : [];
          if (taken.length) {
            const takenSet = new Set(taken);
            this.bulkParsedRows = this.bulkParsedRows.map((r) =>
              r.status === 'valid' && takenSet.has(r.email)
                ? { ...r, status: 'duplicate' as BulkRowStatus, errors: [...r.errors, 'Already registered — will be skipped'] }
                : r
            );
          }
          this.bulkDupCheckPending = false;
          this.cdr.markForCheck();
        },
      });
  }

  goBackToBulkUpload(): void {
    this.dupCheckCancel$.next();
    this.bulkImportStep = 'upload';
    this.bulkParsedRows = [];
    this.bulkDupCheckPending = false;
    this.cdr.markForCheck();
  }

  get bulkValidCount(): number {
    return this.bulkParsedRows.filter((r) => r.status === 'valid').length;
  }
  get bulkInvalidCount(): number {
    return this.bulkParsedRows.filter((r) => r.status === 'invalid').length;
  }
  get bulkDuplicateCount(): number {
    return this.bulkParsedRows.filter((r) => r.status === 'duplicate').length;
  }

  get canConfirmBulkImport(): boolean {
    return (
      this.bulkValidCount > 0 &&
      !this.bulkImportSubmitting &&
      !this.bulkDupCheckPending &&
      (this.userRole !== 'Global Admin' || !!this.bulkImportFacilityId)
    );
  }

  runBulkImport(): void {
    if (!this.canConfirmBulkImport) return;

    const valid = this.bulkParsedRows.filter((r) => r.status === 'valid');
    if (!valid.length) return;

    const payload: {
      facilityId?: number;
      patients: Array<{ firstName: string; lastName: string; email: string; phone: string }>;
    } = {
      patients: valid.map((r) => ({
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        phone: r.phone,
      })),
    };

    if (this.userRole === 'Global Admin' && this.bulkImportFacilityId) {
      payload.facilityId = Number(this.bulkImportFacilityId);
    }

    this.bulkImportSubmitting = true;
    this.cdr.markForCheck();

    this.generalService
      .bulkImportPatients(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.bulkImportSubmitting = false;
          this.bulkImportResult = (res?.data ?? null) as BulkPatientImportResult | null;
          this.bulkImportStep = 'result';

          const created = this.bulkImportResult?.patientsCreated ?? 0;
          const skipped = this.bulkImportResult?.patientsSkipped?.length ?? 0;

          const importSucceeded =
            res?.status === 1 &&
            (this.bulkImportResult?.importSucceeded === true || created > 0);

          if (importSucceeded) {
            if (created > 0) this.fetchPatients();
            if (skipped > 0) {
              this.generalService.showInfo(res?.message || 'Import finished with some skipped rows.');
            } else {
              this.generalService.showSuccess(res?.message || 'Import completed.');
            }
          } else {
            this.generalService.showError(res?.message || 'No patients were imported.');
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.bulkImportSubmitting = false;
          this.generalService.showError('Import request failed.');
          this.cdr.markForCheck();
        },
      });
  }

  bulkRowStatusLabel(row: ParsedPatientRow): string {
    if (row.status === 'valid') return 'Ready';
    if (row.status === 'duplicate') return 'Already registered';
    return 'Invalid';
  }

  trackByBulkRow(_index: number, row: ParsedPatientRow): string {
    return `${row.rowNumber}-${row.email}`;
  }

  trackByBulkSkip(index: number, row: { email?: string }): string {
    return `${index}-${row?.email ?? ''}`;
  }
}
