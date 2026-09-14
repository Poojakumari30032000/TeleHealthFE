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
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';
import { GeneralService } from 'app/shared/services/general.service';
import { AuthService } from 'app/shared/Auth/auth.service';
import { getUnifiedStatusBadgeClass } from 'app/shared/utils/status-badge.util';
import { environment } from 'environments/environment';

interface Clinic {
  guid: string;
  facilityId: number;
  titleLong: string;
  titleShort: string;
  email: string;
  phone: string;
  fax: string;
  isBillable?: boolean;
  billingAddressType: string;
  address: string;
  cityId: number;
  cityName: string;
  stateId: number;
  stateName: string;
  zipCode: string;
  otherAddress: string;
  otherCityId: number;
  otherStateId: number;
  otherZipCode: string;
  federalTaxId: string;
  npi: string;
  status: string;
  facilityContactName: string;
  facilityContactEmail: string;
  facilityContactPhone: string;
  facilityAdminCount?: number;
  customerSupportCount?: number;
}

interface FacilityDetailTab {
  key: string;
  facilityId: number;
  title: string;
  type: 'edit' | 'pending';
}

interface BulkImportIssueRow {
  sheet: string;
  row: number;
  facilityImportKey?: string | null;
  message: string;
}

interface BulkImportApiData {
  importSucceeded?: boolean;
  processingCompleted?: boolean;
  facilityRowsRead?: number;
  adminRowsRead?: number;
  facilitiesCreated?: number;
  adminsCreated?: number;
  parseAndValidationErrors?: BulkImportIssueRow[];
  facilitiesSucceeded?: {
    facilityImportKey: string;
    facilityId: number;
    titleLong?: string | null;
    adminsCreated: number;
  }[];
  facilitiesFailed?: {
    facilityImportKey: string;
    titleLong?: string | null;
    message: string;
  }[];
  adminsSucceeded?: {
    facilityImportKey: string;
    facilityId: number;
    userId: number;
    email: string;
  }[];
  adminsFailed?: {
    facilityImportKey: string;
    facilityId?: number | null;
    email: string;
    message: string;
  }[];
}

@Component({
  selector: 'app-facility-list-view',
  templateUrl: './facility-list-view.component.html',
  styleUrls: ['./facility-list-view.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FacilityListViewComponent implements OnInit, OnDestroy {
  @ViewChild('commanModel', { static: false })
  commanModel!: CommanFormModalComponent;

  readonly facilityListTabKey = 'facility-list';
  readonly pendingListTabKey = 'pending-list';
  activeTabKey = this.facilityListTabKey;
  detailTabs: FacilityDetailTab[] = [];

  pendingClinics: Clinic[] = [];
  pendingTotal = 0;
  pendingPageIndex = 1;
  pendingPageSize = 10;
  pendingLoading = false;

  globalPlan: { subscriptionId?: number; monthlyPrice: number; planName?: string } | null = null;
  loadingGlobalPlan = false;
  showEditPlanModal = false;
  editPlanPrice: number | null = null;
  savingPlan = false;

  showToggleBillingModal = false;
  toggleBillingTarget: Clinic | null = null;
  togglingBilling = false;

  modalApiUrl: { save?: string; get?: string } = {
    save: 'Facilities/saveFacility',
    get: 'Facilities/getFacilityById?Id=',
  };

  showFilters = true;
  appliedFilters: any[] = [];
  facilityTitle = '';
  selectedStatus = '';

  private destroy$ = new Subject<void>();
  private searchTerms = new Subject<void>();

  clinics: Clinic[] = [];
  loading = false;
  total = 0;
  pageIndex = 1;
  pageSize = 100;

  bulkImportVisible = false;
  bulkImportSubmitting = false;
  bulkImportFile: File | null = null;
  bulkImportDragOver = false;
  bulkImportResult: BulkImportApiData | null = null;
  bulkImportLastMessage = '';

  readonly clinicStages = [
    { label: 'Onboarding Clinic',   icon: 'fa-hospital'      },
    { label: 'Updating Categories', icon: 'fa-layer-group'   },
    { label: 'Adding Drugs',        icon: 'fa-pills'         },
    { label: 'Updating Catalogs',   icon: 'fa-book-medical'  },
    { label: 'Finalizing Setup',    icon: 'fa-circle-check'  },
  ];
  readonly updateStages = [
    { label: 'Saving Clinic Info',  icon: 'fa-floppy-disk'   },
    { label: 'Updating Records',    icon: 'fa-rotate'        },
    { label: 'Finalizing',          icon: 'fa-circle-check'  },
  ];

  savingLoaderVisible = false;
  savingStages: { label: string; icon: string }[] = [];
  savingStageIndex = 0;
  savingComplete = false;
  private stageTimers: any[] = [];
  currentSaveTitle = '';

  userRole: string = '';

  constructor(
    private cdr: ChangeDetectorRef,
    private generalService: GeneralService,
    private authService: AuthService
  ) {
    this.userRole = this.authService.getUserRole() || '';
    this.searchTerms.pipe(debounceTime(700), takeUntil(this.destroy$)).subscribe(() => {
      this.applyFilter(true);
    });
  }

  ngOnInit(): void {
    this.applyFilter(true);
    this.loadPendingClinics();
    if (this.userRole === 'Global Admin') {
      this.loadGlobalPlan();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchTerms.complete();
    this.clearStageTimers();
  }

  searchTermChanged(): void {
    this.searchTerms.next();
  }

  applyFilter(resetPage = true): void {
    if (resetPage) {
      this.pageIndex = 1;
    }

    this.appliedFilters = [
      { name: 'Title', value: this.facilityTitle },
      { name: 'Status', value: this.selectedStatus },
    ].filter((filter) => filter.value !== null && filter.value !== undefined && filter.value !== '');

    this.fetchFacilities();
  }

  clearFilters(): void {
    this.facilityTitle = '';
    this.selectedStatus = '';
    this.applyFilter(true);
  }

  removeFilter(filterName: string): void {
    switch (filterName) {
      case 'Title':
        this.facilityTitle = '';
        break;
      case 'Status':
        this.selectedStatus = '';
        break;
    }

    this.applyFilter(true);
  }

  get visibleFiltersCount(): number {
    return this.appliedFilters.length;
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
      this.fetchFacilities();
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

  private fetchFacilities(): void {
    this.loading = true;
    this.cdr.markForCheck();

    const query = this.buildQueryString();
    this.generalService
      .commonGet(`Facilities/getAllFacilities?${query}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response?.status === 1) {
            this.clinics = Array.isArray(response?.data) ? response.data : [];
            this.total = Number(response?.totalEntityCount ?? 0);
          } else {
            this.clinics = [];
            this.total = 0;
          }

          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to fetch facilities:', err);
          this.clinics = [];
          this.total = 0;
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  refreshTable(title?: string): void {
    if (this.savingLoaderVisible) {
      this.completeSavingLoader(() => {
        this.fetchFacilities();
        if (title === 'Add Clinic') {
          this.generalService.sendData({ type: 'NewFacilityAdded' });
        }
      });
    } else {
      this.fetchFacilities();
      if (title && title === 'Add Clinic') {
        this.generalService.sendData({ type: 'NewFacilityAdded' });
      }
    }
  }

  AddEditFacility = (data?: Clinic): void => {
    const title = data ? 'Update Clinic' : 'Add Clinic';
    const id = data?.facilityId || 0;
    const formPath = 'facility/add-edit-facility-form.json';
    this.currentSaveTitle = title;
    this.commanModel.showModal(title, 'form', formPath, id);
  };

  copySignupEmbedSnippet(): void {

    const fePath = (environment as any)?.FE_PATH || '';
    const base = fePath
      ? (fePath.startsWith('http') ? fePath : `https://${fePath}`)
      : (typeof window !== 'undefined' && window.location?.origin)
        ? window.location.origin
        : '';
    const trimmedBase = base.replace(/\/+$/, '');
    const url = `${trimmedBase}/clinic-signup`;
    const snippet =
`<!-- ImpactHealth — External Clinic Signup -->
<iframe
  src="${url}"
  title="TeleHealthUS Clinic Signup"
  width="100%"
  height="1100"
  style="border:0; display:block; max-width:1000px; margin:0 auto; border-radius:16px; box-shadow:0 12px 40px rgba(15,23,42,0.08);"
  loading="lazy"
  allow="clipboard-write"
></iframe>`;

    const onSuccess = () =>
      this.generalService.showSuccess('Embed snippet copied to clipboard.');
    const onFail = () =>
      this.generalService.showError('Could not copy snippet. Please try again.');

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(snippet).then(onSuccess).catch(() => {

        this.legacyCopy(snippet) ? onSuccess() : onFail();
      });
    } else {
      this.legacyCopy(snippet) ? onSuccess() : onFail();
    }
  }

  private legacyCopy(text: string): boolean {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }

  onClinicSaveStarted(): void {
    const isAdd = this.currentSaveTitle === 'Add Clinic';
    this.savingStages = isAdd ? [...this.clinicStages] : [...this.updateStages];
    this.savingStageIndex = 0;
    this.savingComplete = false;
    this.savingLoaderVisible = true;
    this.cdr.markForCheck();

    const delays = isAdd
      ? [6000, 7000, 9000, 10000]
      : [4000, 5000];
    this.scheduleStageAdvancement(delays);
  }

  private scheduleStageAdvancement(delays: number[]): void {
    this.clearStageTimers();
    let accumulated = 0;
    for (let i = 0; i < delays.length; i++) {
      accumulated += delays[i]!;
      const targetStage = i + 1;
      const timer = setTimeout(() => {
        if (this.savingLoaderVisible && !this.savingComplete) {
          this.savingStageIndex = targetStage;
          this.cdr.markForCheck();
        }
      }, accumulated);
      this.stageTimers.push(timer);
    }
  }

  private clearStageTimers(): void {
    this.stageTimers.forEach(t => clearTimeout(t));
    this.stageTimers = [];
  }

  private completeSavingLoader(callback: () => void): void {
    this.clearStageTimers();
    this.savingStageIndex = this.savingStages.length - 1;
    this.savingComplete = true;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.savingLoaderVisible = false;
      this.savingComplete = false;
      this.savingStageIndex = 0;
      this.cdr.markForCheck();
      callback();
    }, 1500);
  }

  onClinicSaveValidationFailed(): void {
    this.clearStageTimers();
    this.savingLoaderVisible = false;
    this.savingComplete = false;
    this.savingStageIndex = 0;
    this.cdr.markForCheck();
  }

  get savingProgressPercent(): number {
    if (!this.savingStages.length) return 0;
    if (this.savingComplete) return 100;
    return Math.round((this.savingStageIndex / this.savingStages.length) * 100);
  }

  updateStatus = (data: Clinic): void => {
    const apiUrl = 'Facilities/updateFacilityStatus';
    const title = 'Confirmation';
    const status = data.status === 'Active' ? 'InActive' : 'Active';
    const content = `Are you sure you want to update the facility status to ${status}?`;
    const body = {
      facilityId: data.facilityId,
      status,
    };

    this.generalService
      .commonConfirm(title, content)
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        if (!result) return;

        this.generalService
          .commonPost(apiUrl, body)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (res) => {
              if (res.status === 1) {
                this.generalService.showSuccess(`Status updated to ${status} successfully!`);
                this.fetchFacilities();
                this.generalService.sendData({
                  type: 'facilityStatusUpdated',
                  value: data.facilityId,
                });
              } else {
                this.generalService.showError(res.message || 'Failed to update status');
              }
            },
            error: (err) => {
              console.error('Error updating status:', err);
              this.generalService.showError('Failed to update facility status.');
            },
          });
      });
  };

  onDelete = (data: Clinic): void => {
    const apiUrl = 'Facilities/deleteFacility';
    const title = 'Clinic';
    const body = {
      id: data.facilityId,
    };

    this.generalService
      .commonDelete(apiUrl, title, body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.fetchFacilities();
          this.generalService.sendData({
            type: 'facilityDeleted',
            value: data.facilityId,
          });
        },
        error: (err) => {
          console.error('Delete failed:', err);
        },
      });
  };

  onView = (data: Clinic): void => {
    this.openFacilityDetailTab(data);
  };

  openFacilityDetailTab(data: Clinic): void {
    const facilityId = Number(data.facilityId);
    if (!facilityId) {
      this.generalService.showError('Unable to Continue Clinic Id Not Found');
      return;
    }

    const existingTab = this.detailTabs.find((tab) => tab.facilityId === facilityId);
    if (existingTab) {
      existingTab.title = data.titleLong || existingTab.title;
      this.activeTabKey = existingTab.key;
      this.cdr.markForCheck();
      return;
    }

    const tab: FacilityDetailTab = {
      key: `facility-${facilityId}`,
      facilityId,
      title: data.titleLong || `Clinic #${facilityId}`,
      type: 'edit',
    };

    this.detailTabs = [...this.detailTabs, tab];
    this.activeTabKey = tab.key;
    this.cdr.markForCheck();
  }

  loadPendingClinics(): void {
    this.pendingLoading = true;
    this.cdr.markForCheck();

    this.generalService
      .commonGet(
        `Facilities/getPendingExternalClinics?pageNumber=${this.pendingPageIndex}&pageSize=${this.pendingPageSize}`
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.pendingClinics = Array.isArray(res?.data) ? res.data : [];
          this.pendingTotal = Number(res?.totalEntityCount ?? res?.count ?? 0);
          this.pendingLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.pendingClinics = [];
          this.pendingTotal = 0;
          this.pendingLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  onPendingPageIndexChange(pi: number): void {
    if (pi === this.pendingPageIndex) return;
    this.pendingPageIndex = pi;
    this.loadPendingClinics();
  }

  onPendingPageSizeChange(ps: number): void {
    if (ps === this.pendingPageSize) return;
    this.pendingPageSize = ps;
    this.pendingPageIndex = 1;
    this.loadPendingClinics();
  }

  loadGlobalPlan(): void {
    this.loadingGlobalPlan = true;
    this.cdr.markForCheck();
    this.generalService
      .commonGet('Subscriptions/getGlobalSubscription')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.globalPlan = res?.data || null;
          this.loadingGlobalPlan = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.globalPlan = null;
          this.loadingGlobalPlan = false;
          this.cdr.markForCheck();
        },
      });
  }

  openEditPlanModal(): void {
    this.editPlanPrice = this.globalPlan?.monthlyPrice ?? 0;
    this.showEditPlanModal = true;
    this.cdr.markForCheck();
  }

  closeEditPlanModal(): void {
    if (this.savingPlan) return;
    this.showEditPlanModal = false;
    this.cdr.markForCheck();
  }

  confirmEditPlan(): void {
    if (this.editPlanPrice == null || this.editPlanPrice < 0) return;
    this.savingPlan = true;
    this.cdr.markForCheck();
    this.generalService
      .commonPost('Subscriptions/updateGlobalSubscription', {
        monthlyPrice: Number(this.editPlanPrice),
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.savingPlan = false;
          if (res?.status === 1 || res?.data === true || res?.success === true) {
            this.generalService.showSuccess(res?.message || 'Plan price updated.');
            this.showEditPlanModal = false;
            this.loadGlobalPlan();
          } else {
            this.generalService.showError(res?.message || 'Failed to update plan price.');
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.savingPlan = false;
          this.generalService.showError('Network error. Try again.');
          this.cdr.markForCheck();
        },
      });
  }

  openToggleBillingModal(row: Clinic, event?: Event): void {
    if (this.userRole !== 'Global Admin') return;
    event?.stopPropagation();
    this.toggleBillingTarget = row;
    this.showToggleBillingModal = true;
    this.cdr.markForCheck();
  }

  closeToggleBillingModal(): void {
    if (this.togglingBilling) return;
    this.showToggleBillingModal = false;
    this.toggleBillingTarget = null;
    this.cdr.markForCheck();
  }

  confirmToggleBilling(): void {
    const target = this.toggleBillingTarget;
    if (!target) return;
    const newValue = !target.isBillable;
    this.togglingBilling = true;
    this.cdr.markForCheck();
    this.generalService
      .commonPost('Facilities/updateFacilityBillingByFacilityID', {
        facilityId: target.facilityId,
        isBillable: newValue,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.togglingBilling = false;
          if (res?.status === 1 || res?.data === true || res?.success === true) {
            this.generalService.showSuccess(
              newValue
                ? `Clinic is now billable.`
                : `Clinic is now free.`
            );
            this.showToggleBillingModal = false;
            this.toggleBillingTarget = null;
            this.applyFilter(false);
          } else {
            this.generalService.showError(res?.message || 'Failed to update billing.');
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.togglingBilling = false;
          this.generalService.showError('Network error. Try again.');
          this.cdr.markForCheck();
        },
      });
  }

  openPendingDetailTab(row: any): void {
    const facilityId = Number(row?.facilityId || 0);
    if (!facilityId) {
      this.generalService.showError('Unable to open clinic — invalid ID.');
      return;
    }

    const key = `pending-${facilityId}`;
    const existing = this.detailTabs.find((t) => t.key === key);
    if (existing) {
      this.activeTabKey = key;
      this.cdr.markForCheck();
      return;
    }

    const tab: FacilityDetailTab = {
      key,
      facilityId,
      type: 'pending',
      title: `Review: ${row?.titleShort || row?.titleLong || `Clinic #${facilityId}`}`,
    };
    this.detailTabs = [...this.detailTabs, tab];
    this.activeTabKey = key;
    this.cdr.markForCheck();
  }

  onClinicApproved(facilityId: number): void {
    const tabKey = `pending-${facilityId}`;
    this.detailTabs = this.detailTabs.filter((t) => t.key !== tabKey);

    this.activeTabKey = this.pendingListTabKey;
    this.loadPendingClinics();
    this.applyFilter(false);
    this.cdr.markForCheck();
  }

  get pendingCount(): number {
    return this.pendingTotal;
  }

  closeFacilityDetailTab(tabKey: string): void {
    const closingIndex = this.detailTabs.findIndex((tab) => tab.key === tabKey);
    if (closingIndex < 0) return;

    const wasActive = this.activeTabKey === tabKey;
    this.detailTabs = this.detailTabs.filter((tab) => tab.key !== tabKey);

    if (wasActive) {
      const fallbackTab =
        this.detailTabs[closingIndex - 1] ?? this.detailTabs[closingIndex] ?? null;
      this.activeTabKey = fallbackTab?.key ?? this.facilityListTabKey;
    }

    this.cdr.markForCheck();
  }

  activateFacilityListTab(): void {
    this.activeTabKey = this.facilityListTabKey;
    this.cdr.markForCheck();
  }

  get selectedTabIndex(): number {
    if (this.activeTabKey === this.facilityListTabKey) return 0;
    if (this.activeTabKey === this.pendingListTabKey) return 1;

    const detailTabIndex = this.detailTabs.findIndex((tab) => tab.key === this.activeTabKey);
    return detailTabIndex >= 0 ? detailTabIndex + 2 : 0;
  }

  onTabIndexChange(index: number): void {
    if (index === 0) {
      this.activeTabKey = this.facilityListTabKey;
      return;
    }
    if (index === 1) {
      this.activeTabKey = this.pendingListTabKey;
      return;
    }

    const selectedTab = this.detailTabs[index - 2];
    this.activeTabKey = selectedTab?.key ?? this.facilityListTabKey;
  }

  onTabClose(event: { index: number } | number): void {
    const closedIndex =
      typeof event === 'number' ? Number(event) : Number(event?.index ?? -1);

    if (closedIndex < 2) return;

    const tab = this.detailTabs[closedIndex - 2];
    if (!tab) return;

    this.closeFacilityDetailTab(tab.key);
  }

  trackByFacilityId(_index: number, row: Clinic): number {
    return row.facilityId;
  }

  trackByTabKey(_index: number, tab: FacilityDetailTab): string {
    return tab.key;
  }

  getStatusBadgeClass(status: string | null | undefined): string {
    return getUnifiedStatusBadgeClass(status);
  }

  openBulkImportModal(): void {
    this.resetBulkImportState();
    this.bulkImportVisible = true;
    this.cdr.markForCheck();
  }

  closeBulkImportModal(): void {
    if (this.bulkImportSubmitting) {
      return;
    }
    this.bulkImportVisible = false;
    this.resetBulkImportState();
    this.cdr.markForCheck();
  }

  resetBulkImportState(): void {
    this.bulkImportFile = null;
    this.bulkImportDragOver = false;
    this.bulkImportResult = null;
    this.bulkImportLastMessage = '';
  }

  downloadBulkImportTemplate(): void {
    this.generalService.downloadFacilityBulkImportTemplate().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Facility_Bulk_Import_Template.xlsx';
        a.click();
        URL.revokeObjectURL(url);
        this.generalService.showSuccess('Template download started.');
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
    this.bulkImportResult = null;
    this.bulkImportLastMessage = '';
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

  runBulkImport(): void {
    if (!this.bulkImportFile || this.bulkImportSubmitting) {
      return;
    }
    this.bulkImportSubmitting = true;
    this.bulkImportResult = null;
    this.bulkImportLastMessage = '';
    this.cdr.markForCheck();

    this.generalService
      .bulkImportFacilitiesExcel(this.bulkImportFile)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.bulkImportSubmitting = false;
          this.bulkImportLastMessage = res?.message ?? '';
          this.bulkImportResult = (res?.data ?? null) as BulkImportApiData | null;

          const d = this.bulkImportResult;
          const anyCreated = (d?.facilitiesCreated ?? 0) > 0 || (d?.adminsCreated ?? 0) > 0;
          if (res?.status === 1 && anyCreated) {
            this.fetchFacilities();
            this.generalService.sendData({ type: 'NewFacilityAdded' });
          }
          if (res?.status === 1 && d?.importSucceeded && this.hasBulkImportFailures(d)) {
            this.generalService.showError(
              'Import finished with some failures. Review the tables below, fix your spreadsheet, and re-import only the corrected rows.'
            );
          } else if (res?.status === 1 && d?.importSucceeded) {
            this.generalService.showSuccess(this.bulkImportLastMessage || 'Import completed.');
          } else if (res?.status === 0) {
            this.generalService.showError(this.bulkImportLastMessage || 'Import failed.');
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

  trackByBulkIssue(_i: number, row: BulkImportIssueRow): string {
    return `${row.sheet}-${row.row}-${row.message}`;
  }

  hasBulkImportFailures(d: BulkImportApiData | null): boolean {
    if (!d) {
      return false;
    }
    return (
      (d.parseAndValidationErrors?.length ?? 0) > 0 ||
      (d.facilitiesFailed?.length ?? 0) > 0 ||
      (d.adminsFailed?.length ?? 0) > 0
    );
  }
}
