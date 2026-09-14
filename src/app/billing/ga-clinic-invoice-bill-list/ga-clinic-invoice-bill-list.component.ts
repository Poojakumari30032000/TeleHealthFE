import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';

import { NzNotificationService } from 'ng-zorro-antd/notification';
import { AuthService } from 'app/shared/Auth/auth.service';
import { GeneralService } from 'app/shared/services/general.service';
import { TitleService } from 'app/shared/services/title.service';
import {NzModalService} from "ng-zorro-antd/modal";
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { getUnifiedStatusBadgeClass } from 'app/shared/utils/status-badge.util';

interface InvoiceRow {
  invoiceId: number;
  invoiceNumber: string;
  facilityId?: number | null;
  facilityName?: string;
  amount: number;
  status: string;
  invoiceType?: string;
  invoiceDate: string;
  dueDate: string;
  providerBillTotal?: number;
  pharmacyBillTotal?: number;
  isMonthlyInvoiceGenerated?: boolean;
}

interface FacilityDropdownItem {
  facilityId: number;
  titlelong: string;
  titleshort: string;
  guid?: string;
  organizationId?: number;
  organizationName?: string;
}

interface InvoicePdfTab {
  key: string;
  type: 'pdf' | 'manual-detail' | 'create';
  invoiceId: number;
  title: string;
  pdfUrl?: string;
  safeUrl?: SafeResourceUrl;
}

@Component({
  selector: 'app-ga-clinic-invoice-bill-list',
  templateUrl: './ga-clinic-invoice-bill-list.component.html',
  styleUrl: './ga-clinic-invoice-bill-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GaClinicInvoiceBillListComponent implements OnInit {
  readonly invoiceListTabKey = 'ga-invoice-list';
  activeTabKey = this.invoiceListTabKey;
  detailTabs: InvoicePdfTab[] = [];

  userRole: string | null = null;
  titleText = 'Bill';
  facilityId: number | null = null;

  showFilters = true;
  startDate: string | null = null;
  endDate: string | null = null;
  dateRange: Date[] = [];
  statusFilter: 'all' | 'paid' | 'pending' = 'all';
  appliedFilters: { name: string; value: any }[] = [];

  facilityDropdownLoading = false;
  selectedFacilityId: number | null = null;
  facilities: FacilityDropdownItem[] = [];

  loading = false;
  invoices: InvoiceRow[] = [];
  total = 0;
  pageIndex = 1;
  pageSize = 100;

  selectedRowForPayment: any = null;
  showPayBillModal: boolean = false;

  constructor(
    private cdr: ChangeDetectorRef,

    private notification: NzNotificationService,
    private auth: AuthService,
    private generalService: GeneralService,
    private titleService: TitleService,
    private modal: NzModalService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.userRole = this.auth.getUserRole();
    const fid = this.auth.getUserFacilityId();
    this.facilityId = fid !== null ? Number(fid) : null;

    if (this.userRole === 'Global Admin') {
      this.titleText = 'Invoice';
      this.titleService.updateTitle('Invoices', []);
    } else if (this.userRole === 'Clinic Admin') {
      this.titleText = 'Bill';
      this.titleService.updateTitle('Bills', []);
    }

    this.updateAppliedFilters();
    this.fetchInvoices();
    if(this.userRole === 'Global Admin'){
      this.loadFacilitiesDropdown();
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

  private formatDateOnly(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  onStatusChange(_val: 'all' | 'paid' | 'pending'): void {}

  updateAppliedFilters(): void {
    const parts: { name: string; value: any }[] = [];
    if (this.startDate) parts.push({ name: 'StartDate', value: this.startDate });
    if (this.endDate) parts.push({ name: 'EndDate', value: this.endDate });
    if (this.statusFilter !== 'all') {
      parts.push({
        name: 'Status',
        value: this.statusFilter === 'paid' ? 'Paid' : 'Pending'
      });
    }
    if (this.selectedFacilityId != null) {
      parts.push({ name: 'Clinic', value: this.getFacilityNameById(this.selectedFacilityId) });
    }
    this.appliedFilters = parts;
  }

  clearFilters(): void {
    this.startDate = null;
    this.endDate = null;
    this.dateRange = [];
    this.statusFilter = 'all';
    this.pageIndex = 1;
    this.selectedFacilityId = null;
    this.updateAppliedFilters();
    this.fetchInvoices();
  }

  applyFilters(): void {
    this.pageIndex = 1;
    this.updateAppliedFilters();
    this.fetchInvoices();
  }

  onDateRangeChange(dates: Date[] | null): void {
    this.dateRange = Array.isArray(dates) ? dates : [];
    const [start, end] = this.dateRange;

    if (start && end) {
      this.startDate = this.formatDateOnly(start);
      this.endDate = this.formatDateOnly(end);
    } else {
      this.startDate = null;
      this.endDate = null;
      this.dateRange = [];
    }
  }

  private buildRequestBody() {
    const includePaid = this.statusFilter !== 'pending';
    const includePending = this.statusFilter !== 'paid';

    let facilityId = this.userRole === 'Global Admin' ? null : this.facilityId;

    if (this.userRole === 'Global Admin' && this.selectedFacilityId != null) {
      facilityId = this.selectedFacilityId;
    }

    const start = this.startDate ?? null;
    const end = this.endDate ?? null;

    const clientTimezoneOffsetMinutes = -new Date().getTimezoneOffset();

    return {
      facilityId,
      startDate: start,
      endDate: end,
      clientTimezoneOffsetMinutes,
      includePaid,
      includePending,
      pageNumber: this.pageIndex,
      pageSize: this.pageSize
    };
  }

  fetchInvoices(): void {
    this.loading = true;
    const body = this.buildRequestBody();

    this.generalService.getFacilityInvoicesForGlobalAdmin(body).subscribe({
      next: (res) => {
        const data = res?.data || {};
        const rows: InvoiceRow[] = Array.isArray(data?.invoices) ? data.invoices : [];
        this.invoices = rows;
        this.total = Number(data?.totalCount ?? rows.length ?? 0);

        if (data?.pageNumber) this.pageIndex = data.pageNumber;
        if (data?.pageSize) this.pageSize = data.pageSize;

        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching invoices:', err);
        this.loading = false;
        this.notification.error('Failed', 'Could not load invoices.');
        this.cdr.markForCheck();
      }
    });
  }

  viewInvoice(row: InvoiceRow): void {
    if (row?.invoiceType === 'GAToClinic') {
      this.openManualInvoiceDetailTabById(
        Number(row?.invoiceId || 0)
      );
      return;
    }

    this.openInvoicePdfTabById(Number(row?.invoiceId || 0), row?.invoiceNumber || null);
  }

  createInvoice(): void {
    if (this.userRole !== 'Global Admin') return;
    this.openCreateInvoiceTab();
  }

  openCreateInvoiceTab(): void {
    if (this.userRole !== 'Global Admin') return;
    const existingTab = this.detailTabs.find((tab) => tab.type === 'create');
    if (existingTab) {
      this.activeTabKey = existingTab.key;
      this.cdr.markForCheck();
      return;
    }

    const tab: InvoicePdfTab = {
      key: 'ga-invoice-create',
      type: 'create',
      invoiceId: 0,
      title: 'Create Invoice',
    };

    this.detailTabs = [...this.detailTabs, tab];
    this.activeTabKey = tab.key;
    this.cdr.markForCheck();
  }

  private openInvoicePdfTabById(invoiceId: number, invoiceNumber?: string | null): void {
    if (!invoiceId) return;

    this.loading = true;
    this.cdr.markForCheck();

    this.generalService.getInvoicePdfUrl(invoiceId).subscribe({
      next: (res) => {
        const pdfUrl = typeof res?.data === 'string' ? res.data.trim() : '';
        if (pdfUrl && pdfUrl !== 'undefined' && pdfUrl !== 'null') {
          this.openInvoicePdfTab({
            invoiceId,
            invoiceNumber: invoiceNumber || '',
          }, pdfUrl);
        } else {
          this.generalService.showError("The invoice doesn't exist");
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching invoice:', err);
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onCreatedInvoiceFromManual = (invoiceId: number): void => {
    const createTab = this.detailTabs.find((tab) => tab.type === 'create');
    if (createTab) {
      this.closeInvoiceTab(createTab.key);
    }
    this.fetchInvoices();
    this.openManualInvoiceDetailTabById(invoiceId);
  };

  handleInvoiceCancel(){
    this.selectedRowForPayment = null;
    this.showPayBillModal = false;
    this.cdr.markForCheck()
  }

  payInvoice(): void {
    if (this.userRole !== 'Clinic Admin') return;
    const invoiceId = String(this.selectedRowForPayment?.invoiceId || '');
    if (!invoiceId) return;
    this.loading = true;
    this.cdr.markForCheck()

    this.generalService.payInvoice(invoiceId).subscribe({
      next: (res : any) => {
        if (res.status === 400) {
          this.notification.error('Error', res.message);
          this.loading = false
          this.fetchInvoices();
          this.cdr.markForCheck()
          return;
        }
        else {
          this.notification.success('Success', res.message);
          this.loading = false
          this.fetchInvoices();
          this.cdr.markForCheck()
        }
      },
      error: (err) => {
        console.error('Error paying invoice:', err);
        this.notification.error('Error', 'Failed to pay invoice');
        this.loading = false
        this.fetchInvoices();
        this.cdr.markForCheck()
      }
    });
  }

  onQueryParamsChange(params: any): void {
    const prevIndex = this.pageIndex;
    const prevSize = this.pageSize;

    if (params?.pageIndex) this.pageIndex = params.pageIndex;
    if (params?.pageSize) this.pageSize = params.pageSize;

    if (this.pageIndex !== prevIndex || this.pageSize !== prevSize) {
      this.fetchInvoices();
    } else {
      this.cdr.markForCheck();
    }
  }

  removeFilter(name: string): void {
    if (name === 'Status') this.statusFilter = 'all';
    if (name === 'Clinic') this.selectedFacilityId = null;
    if (name === 'StartDate' || name === 'EndDate') {
      this.startDate = null;
      this.endDate = null;
      this.dateRange = [];
    }
    this.applyFilters();
  }

  getStatusTagClass(status?: string): string {
    return getUnifiedStatusBadgeClass(status);
  }

  openPayBillConfirm(row:any): void {
    this.selectedRowForPayment = row;
    this.modal.confirm({
      nzTitle: 'Confirm',
      nzContent: 'Are you sure, you want to pay this bill?',
      nzIconType: 'question-circle',
      nzOnOk: () => this.payInvoice(),
      nzOnCancel: () => this.handleInvoiceCancel()
    });
  }

  private getFacilityNameById(facilityId: number): string {
    return this.facilities.find((item) => item.facilityId === facilityId)?.titlelong || `Clinic #${facilityId}`;
  }

  private openInvoicePdfTab(
    row: Pick<InvoiceRow, 'invoiceId' | 'invoiceNumber'>,
    pdfUrl: string
  ): void {
    const invoiceId = Number(row?.invoiceId || 0);
    if (!invoiceId) return;

    const existing = this.detailTabs.find(
      (tab) => tab.type === 'pdf' && tab.invoiceId === invoiceId
    );
    if (existing) {
      existing.pdfUrl = pdfUrl;
      existing.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(pdfUrl);
      existing.title = this.buildInvoiceTabTitle(invoiceId);
      this.activeTabKey = existing.key;
      this.cdr.markForCheck();
      return;
    }

    const tab: InvoicePdfTab = {
      key: `invoice-pdf-${invoiceId}`,
      type: 'pdf',
      invoiceId,
      title: this.buildInvoiceTabTitle(invoiceId),
      pdfUrl,
      safeUrl: this.sanitizer.bypassSecurityTrustResourceUrl(pdfUrl)
    };

    this.detailTabs = [...this.detailTabs, tab];
    this.activeTabKey = tab.key;
    this.cdr.markForCheck();
  }

  private openManualInvoiceDetailTabById(invoiceId: number): void {
    const safeInvoiceId = Number(invoiceId || 0);
    if (!safeInvoiceId) return;

    const existingTab = this.detailTabs.find(
      (tab) => tab.type === 'manual-detail' && tab.invoiceId === safeInvoiceId
    );
    if (existingTab) {
      existingTab.title = this.buildInvoiceTabTitle(safeInvoiceId);
      this.activeTabKey = existingTab.key;
      this.cdr.markForCheck();
      return;
    }

    const tab: InvoicePdfTab = {
      key: `manual-invoice-${safeInvoiceId}`,
      type: 'manual-detail',
      invoiceId: safeInvoiceId,
      title: this.buildInvoiceTabTitle(safeInvoiceId),
    };

    this.detailTabs = [...this.detailTabs, tab];
    this.activeTabKey = tab.key;
    this.cdr.markForCheck();
  }

  closeInvoiceTab(tabKey: string): void {
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
    const idx = this.detailTabs.findIndex((tab) => tab.key === this.activeTabKey);
    return idx >= 0 ? idx + 1 : 0;
  }

  onTabIndexChange(index: number): void {
    if (index <= 0) {
      this.activeTabKey = this.invoiceListTabKey;
      return;
    }

    const tab = this.detailTabs[index - 1];
    this.activeTabKey = tab?.key ?? this.invoiceListTabKey;
  }

  onTabClose(event: { index: number } | number): void {
    const closedIndex =
      typeof event === 'number' ? Number(event) : Number(event?.index ?? -1);
    if (closedIndex <= 0) return;

    const tab = this.detailTabs[closedIndex - 1];
    if (!tab) return;
    this.closeInvoiceTab(tab.key);
  }

  trackByTabKey(_index: number, tab: InvoicePdfTab): string {
    return tab.key;
  }

  activateInvoiceListTab(): void {
    this.activeTabKey = this.invoiceListTabKey;
    this.cdr.markForCheck();
  }

  getInvoiceTypeLabel(invoiceType?: string): string {
    if (invoiceType === 'ClinicToGlobal') return 'System Generated';
    if (invoiceType === 'GAToClinic') return 'Manually Created';
    return invoiceType || '--';
  }

  private buildInvoiceTabTitle(invoiceId: number): string {
    const label = this.userRole === 'Clinic Admin' ? 'Bill' : 'Invoice';
    return `${label} #${invoiceId}`;
  }

}
