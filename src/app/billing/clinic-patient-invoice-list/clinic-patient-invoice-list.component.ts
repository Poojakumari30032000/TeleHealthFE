import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { AuthService } from 'app/shared/Auth/auth.service';
import { GeneralService } from 'app/shared/services/general.service';
import { TitleService } from 'app/shared/services/title.service';
import { getUnifiedStatusBadgeClass } from 'app/shared/utils/status-badge.util';

interface ClinicPatientInvoiceRow {
  invoiceId: number;
  invoiceNumber: string;
  customerName: string | null;
  amount: string;
  status: string;
  invoiceType: string;
  isActive: boolean;
  createdBy: number;
  createdDate: string;
  subscriptionId?: number | null;
  cardId?: number | null;
}

interface FacilityDropdownItem {
  facilityId: number;
  titlelong: string;
  titleshort: string;
  guid?: string;
  organizationId?: number;
  organizationName?: string;
}

interface InvoiceDetailTab {
  key: string;
  type: 'detail' | 'create';
  invoiceId?: number;
  title: string;
}

@Component({
  selector: 'app-clinic-patient-invoice-list',
  templateUrl: './clinic-patient-invoice-list.component.html',
  styleUrl: './clinic-patient-invoice-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClinicPatientInvoiceListComponent implements OnInit, OnDestroy {
  readonly invoiceListTabKey = 'clinic-patient-invoice-list';
  activeTabKey = this.invoiceListTabKey;
  detailTabs: InvoiceDetailTab[] = [];

  userRole: string | null = null;
  listTabTitle = 'Invoice List';
  showFilters = true;

  isClinicAdmin = false;
  isPatient = false;
  isGlobalAdmin = false;

  facilityId: number | null = null;
  patientId: number | null = null;

  facilities: FacilityDropdownItem[] = [];
  selectedFacilityId: number | null = null;
  facilityDropdownLoading = false;

  selectedStatus: string | null = null;
  readonly statusOptions = ['Pending', 'Paid', 'Cancelled'];

  searchInvoiceId: string = '';

  searchPatientName: string = '';

  private invoiceIdSearch$ = new Subject<string>();
  private patientNameSearch$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  loading = false;
  notAllowed = false;

  invoices: ClinicPatientInvoiceRow[] = [];

  pageIndex = 1;
  pageSize = 100;
  total = 0;

  constructor(
    private cdr: ChangeDetectorRef,
    private notification: NzNotificationService,
    private auth: AuthService,
    private generalService: GeneralService,
    private titleService: TitleService
  ) {}

  ngOnInit(): void {

    this.invoiceIdSearch$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe((value) => {
      this.searchInvoiceId = value;
      this.pageIndex = 1;
      if (this.isClinicAdmin && this.facilityId != null) {
        this.fetchInvoicesForClinic();
      } else if (this.isPatient) {
        this.fetchInvoicesForPatient();
      }
      this.cdr.markForCheck();
    });

    this.patientNameSearch$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe((value) => {
      this.searchPatientName = value;
      this.pageIndex = 1;
      if (this.facilityId != null) {
        this.fetchInvoicesForClinic();
      }
      this.cdr.markForCheck();
    });

    this.userRole = this.auth.getUserRole();

    this.isGlobalAdmin = this.userRole === 'Global Admin';
    this.isClinicAdmin = this.userRole === 'Clinic Admin' || this.isGlobalAdmin;
    this.isPatient = this.userRole === 'Patient';

    if (!this.isClinicAdmin && !this.isPatient) {
      this.notAllowed = true;
      this.cdr.markForCheck();
      return;
    }

    const listTitle = this.isClinicAdmin ? 'Invoices' : 'Bills';
    this.listTabTitle = this.isClinicAdmin ? 'Invoice List' : 'Bill List';
    this.titleService.updateTitle(listTitle, []);

    this.pageIndex = 1;
    this.pageSize = 100;

    if (this.isGlobalAdmin) {
      this.loadFacilitiesDropdown();
      this.cdr.markForCheck();
      return;
    }

    if (this.isClinicAdmin) {
      const fid = this.auth.getUserFacilityId();
      this.facilityId = fid !== null && fid !== undefined ? Number(fid) : null;

      if (this.facilityId == null || Number.isNaN(this.facilityId)) {
        this.notification.error('Missing Facility', 'Unable to determine your facility. Please re-login.');
        this.notAllowed = true;
        this.cdr.markForCheck();
        return;
      }
      this.fetchInvoicesForClinic();
    } else if (this.isPatient) {
      const pid = this.auth.getPatientId?.() ?? null;
      this.patientId = pid !== null && pid !== undefined ? Number(pid) : null;

      if (this.patientId == null || Number.isNaN(this.patientId)) {
        this.notification.error('Missing Patient', 'Unable to determine your patient account. Please re-login.');
        this.notAllowed = true;
        this.cdr.markForCheck();
        return;
      }
      this.fetchInvoicesForPatient();
    }
  }

  private loadFacilitiesDropdown(): void {
    this.facilityDropdownLoading = true;
    this.cdr.markForCheck();

    this.generalService.getAllFacilitiesDropdown().subscribe({
      next: (res) => {
        const rows: FacilityDropdownItem[] = Array.isArray(res?.data) ? res.data : [];
        this.facilities = rows ?? [];
        this.facilityDropdownLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading facilities dropdown:', err);
        this.notification.error('Failed', 'Could not load facilities.');
        this.facilityDropdownLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFacilitySelected(facilityId: number | null): void {
    const fid = facilityId !== null && facilityId !== undefined ? Number(facilityId) : null;

    if (fid == null || Number.isNaN(fid)) {
      this.facilityId = null;
      this.invoices = [];
      this.total = 0;
      this.cdr.markForCheck();
      return;
    }

    this.facilityId = fid;

    this.pageIndex = 1;
    this.pageSize = 100;

    this.fetchInvoicesForClinic();
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;

    this.pageIndex = pageIndex;
    this.pageSize = pageSize;

    if (this.isPatient) return;

    if (this.isClinicAdmin) {
      this.fetchInvoicesForClinic();
    }
  }

  private fetchInvoicesForClinic(): void {
    if (this.facilityId == null) return;

    this.loading = true;
    this.cdr.markForCheck();

    const invoiceIdFilter = this.searchInvoiceId ? Number(this.searchInvoiceId) : null;
    this.generalService.getInvoicesByFacilityIds(this.facilityId, this.pageIndex, this.pageSize, this.selectedStatus, invoiceIdFilter, this.searchPatientName || null).subscribe({
      next: (res) => {
        const rows: ClinicPatientInvoiceRow[] = Array.isArray(res)
          ? res
          : Array.isArray(res?.invoices)
            ? res.invoices
            : [];

        this.invoices = rows ?? [];

        this.total = typeof res?.totalCount === 'number' ? res.totalCount : this.invoices.length;

        if (typeof res?.pageNumber === 'number') {
          this.pageIndex = res.pageNumber;
        }
        if (typeof res?.pageSize === 'number') {
          this.pageSize = res.pageSize;
        }

        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching clinic invoices:', err);
        this.notification.error('Failed', 'Could not load invoices.');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private fetchInvoicesForPatient(): void {
    if (this.patientId == null) return;

    this.loading = true;
    this.cdr.markForCheck();

    const invoiceIdFilter = this.searchInvoiceId ? Number(this.searchInvoiceId) : null;
    this.generalService.getInvoicesByPatientId(this.patientId, invoiceIdFilter, this.selectedStatus).subscribe({
      next: (res) => {
        const rows: ClinicPatientInvoiceRow[] = Array.isArray(res)
          ? res
          : Array.isArray(res?.invoices)
            ? res.invoices
            : Array.isArray(res?.data)
              ? res.data
              : [];

        this.invoices = rows ?? [];

        this.total = typeof res?.totalCount === 'number' ? res.totalCount : this.invoices.length;

        if (typeof res?.pageNumber === 'number') {
          this.pageIndex = res.pageNumber;
        }
        if (typeof res?.pageSize === 'number') {
          this.pageSize = res.pageSize;
        }

        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching patient bills:', err);
        this.notification.error('Failed', 'Could not load bills.');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  openInvoiceDetailTab(row: ClinicPatientInvoiceRow): void {
    this.openInvoiceDetailTabById(Number(row?.invoiceId || 0));
  }

  openInvoiceDetailTabById(invoiceId: number): void {
    const safeInvoiceId = Number(invoiceId || 0);
    if (!safeInvoiceId) return;

    const existingTab = this.detailTabs.find((tab) => tab.invoiceId === safeInvoiceId);
    if (existingTab) {
      existingTab.title = this.isPatient ? `Bill #${safeInvoiceId}` : `Invoice #${safeInvoiceId}`;
      this.activeTabKey = existingTab.key;
      this.cdr.markForCheck();
      return;
    }

    const tab: InvoiceDetailTab = {
      key: `invoice-${safeInvoiceId}`,
      type: 'detail',
      invoiceId: safeInvoiceId,
      title: this.isPatient ? `Bill #${safeInvoiceId}` : `Invoice #${safeInvoiceId}`,
    };

    this.detailTabs = [...this.detailTabs, tab];
    this.activeTabKey = tab.key;
    this.cdr.markForCheck();
  }

  viewInvoice(row: ClinicPatientInvoiceRow): void {
    this.openInvoiceDetailTab(row);
  }

  createInvoice(): void {
    this.openCreateInvoiceTab();
  }

  openCreateInvoiceTab(): void {
    const existingTab = this.detailTabs.find((tab) => tab.type === 'create');
    if (existingTab) {
      this.activeTabKey = existingTab.key;
      this.cdr.markForCheck();
      return;
    }

    const tab: InvoiceDetailTab = {
      key: 'invoice-create',
      type: 'create',
      title: 'Create Invoice',
    };

    this.detailTabs = [...this.detailTabs, tab];
    this.activeTabKey = tab.key;
    this.cdr.markForCheck();
  }

  onCreatedInvoiceFromManual = (invoiceId: number): void => {
    this.openInvoiceDetailTabById(invoiceId);

    if (this.isClinicAdmin) {
      this.fetchInvoicesForClinic();
    } else if (this.isPatient) {
      this.fetchInvoicesForPatient();
    }
  };

  onStatusChange(status: string | null): void {
    this.selectedStatus = status;
    this.pageIndex = 1;
    if (this.isClinicAdmin && this.facilityId != null) {
      this.fetchInvoicesForClinic();
    } else if (this.isPatient) {
      this.fetchInvoicesForPatient();
    }
    this.cdr.markForCheck();
  }

  onInvoiceIdSearch(value: string): void {
    this.invoiceIdSearch$.next(value ?? '');
  }

  onPatientNameSearch(value: string): void {
    this.patientNameSearch$.next(value ?? '');
  }

  get visibleFiltersCount(): number {
    let count = 0;
    if (this.isGlobalAdmin && this.selectedFacilityId) count++;
    if (this.selectedStatus) count++;
    if (this.searchInvoiceId) count++;
    if (this.isClinicAdmin && this.searchPatientName) count++;
    return count;
  }

  resetListFilters(): void {
    this.selectedStatus = null;
    this.searchInvoiceId = '';
    this.searchPatientName = '';
    this.pageIndex = 1;
    if (this.isGlobalAdmin) {
      this.selectedFacilityId = null;
      this.onFacilitySelected(null);
    } else if (this.isClinicAdmin) {
      this.fetchInvoicesForClinic();
    } else if (this.isPatient) {
      this.fetchInvoicesForPatient();
    }
  }

  closeInvoiceDetailTab(tabKey: string): void {
    const closingIndex = this.detailTabs.findIndex((tab) => tab.key === tabKey);
    if (closingIndex < 0) return;

    const wasActive = this.activeTabKey === tabKey;
    this.detailTabs = this.detailTabs.filter((tab) => tab.key !== tabKey);

    if (wasActive) {
      const fallback =
        this.detailTabs[closingIndex - 1] ?? this.detailTabs[closingIndex] ?? null;
      this.activeTabKey = fallback?.key ?? this.invoiceListTabKey;
    }

    this.cdr.markForCheck();
  }

  get selectedTabIndex(): number {
    if (this.activeTabKey === this.invoiceListTabKey) return 0;
    const detailTabIndex = this.detailTabs.findIndex((tab) => tab.key === this.activeTabKey);
    return detailTabIndex >= 0 ? detailTabIndex + 1 : 0;
  }

  onTabIndexChange(index: number): void {
    if (index <= 0) {
      this.activeTabKey = this.invoiceListTabKey;
      return;
    }

    const selectedTab = this.detailTabs[index - 1];
    this.activeTabKey = selectedTab?.key ?? this.invoiceListTabKey;
  }

  onTabClose(event: { index: number } | number): void {
    const closedIndex =
      typeof event === 'number' ? Number(event) : Number(event?.index ?? -1);
    if (closedIndex <= 0) return;

    const tab = this.detailTabs[closedIndex - 1];
    if (!tab) return;
    this.closeInvoiceDetailTab(tab.key);
  }

  trackByTabKey(_index: number, tab: InvoiceDetailTab): string {
    return tab.key;
  }

  getStatusTagClass(status?: string): string {
    return getUnifiedStatusBadgeClass(status);
  }
}
