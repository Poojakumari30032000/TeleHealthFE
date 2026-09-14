import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from 'app/shared/Auth/auth.service';
import { GeneralService } from 'app/shared/services/general.service';
import { TitleService } from 'app/shared/services/title.service';
import { getUnifiedStatusBadgeClass } from 'app/shared/utils/status-badge.util';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzNotificationService } from 'ng-zorro-antd/notification';

interface ApiResponse<T = any> {
  status: number;
  success?: boolean | null;
  message?: string | null;
  count?: number | null;
  data: T;
}

interface ManualClinicInvoiceLineItem {
  invoiceLineItemId: number;
  productLineItemName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

interface ManualClinicInvoiceDetail {
  invoiceId: number;
  invoiceNumber: string;
  customerName: string | null;
  amount: number;
  status: string;
  invoiceType: string;
  isActive: boolean;
  createdBy: number;
  createdDate: string;
  email: string | null;
  pdfS3Url: string | null;
  facilityPhone: string | null;
  facilityAddress: string | null;
  lineItems: ManualClinicInvoiceLineItem[];
}

@Component({
  selector: 'app-clinic-manual-invoice-view',
  templateUrl: './clinic-manual-invoice-view.component.html',
  styleUrl: './clinic-manual-invoice-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicManualInvoiceViewComponent implements OnInit, OnChanges {
  @Input() invoiceIdInput: number | null = null;
  @Input() embeddedInTabs = false;

  loading = false;
  paymentLoading = false;
  errorMsg: string | null = null;

  invoiceId = 0;
  data: ManualClinicInvoiceDetail | null = null;

  lineItems: ManualClinicInvoiceLineItem[] = [];
  totalQty = 0;
  subtotalAmount = 0;
  totalAmount = 0;

  userRole: string | null = null;
  docLabel: 'Invoice' | 'Bill' = 'Invoice';
  docLabelLower = 'invoice';

  constructor(
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private title: TitleService,
    private gs: GeneralService,
    private authService: AuthService,
    private modal: NzModalService,
    private notification: NzNotificationService,
  ) {}

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole();
    if (this.userRole === 'Clinic Admin') {
      this.docLabel = 'Bill';
      this.docLabelLower = 'bill';
    } else {
      this.docLabel = 'Invoice';
      this.docLabelLower = 'invoice';
    }

    this.resolveAndLoadInvoice();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['invoiceIdInput'] && !changes['invoiceIdInput'].firstChange) {
      this.resolveAndLoadInvoice();
    }
  }

  private resolveAndLoadInvoice(): void {
    const inputId = Number(this.invoiceIdInput || 0);
    const routeParam =
      this.route.snapshot.paramMap.get('invoiceId') ??
      this.route.snapshot.paramMap.get('id');
    const routeId = Number(routeParam || 0);
    const resolvedId = inputId > 0 ? inputId : routeId;

    if (!resolvedId) {
      this.invoiceId = 0;
      this.errorMsg = 'Invalid invoice id.';
      this.data = null;
      this.lineItems = [];
      this.totalQty = 0;
      this.subtotalAmount = 0;
      this.totalAmount = 0;
      this.cdr.markForCheck();
      return;
    }

    if (this.invoiceId !== resolvedId) {
      this.invoiceId = resolvedId;
      this.errorMsg = null;
      this.data = null;
      this.lineItems = [];
      this.totalQty = 0;
      this.subtotalAmount = 0;
      this.totalAmount = 0;
      this.updatePageTitle();
      this.fetchDetail();
      return;
    }

    if (!this.data && !this.loading) {
      this.updatePageTitle();
      this.fetchDetail();
    }
  }

  private updatePageTitle(): void {
    if (this.embeddedInTabs || !this.invoiceId) return;

    const detailTitle = this.docLabel === 'Bill'
      ? 'Manual Clinic Bill Detail'
      : 'Manual Clinic Invoice Detail';
    const listLabel = this.docLabel === 'Bill' ? 'Bills' : 'Invoices';

    this.title.updateTitle(detailTitle, [
      { label: listLabel, path: '/billing/clinicBills' },
      {
        label: this.invoiceId.toString(),
        path: `/billing/clinicBills/manual/${this.invoiceId}`,
      },
    ]);
  }

  private fetchDetail(): void {
    this.loading = true;
    this.errorMsg = null;

    this.gs
      .getInvoiceById(this.invoiceId)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res: ApiResponse<ManualClinicInvoiceDetail>) => {
          this.data = res?.data || null;
          this.prepareItems();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.errorMsg =
            err?.error?.message ||
            `Failed to load ${this.docLabelLower}. Please try again later.`;
          this.cdr.markForCheck();
        },
      });
  }

  private prepareItems(): void {
    const items = Array.isArray(this.data?.lineItems) ? this.data?.lineItems : [];

    this.lineItems = items.map((item) => ({
      ...item,
      qty: Math.max(0, Number(item.qty || 0)),
      unitPrice: Math.max(0, Number(item.unitPrice || 0)),
      lineTotal: Math.max(0, Number(item.lineTotal || 0)),
    }));

    this.totalQty = this.lineItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    this.subtotalAmount = this.lineItems.reduce(
      (sum, item) => sum + (Number(item.lineTotal) || 0),
      0
    );
    this.totalAmount = Math.max(0, Number(this.data?.amount || 0));
  }

  getInvoiceTypeDisplayLabel(invoiceType?: string | null): string {
    if (invoiceType === 'GAToClinic') return 'Manually Created';
    if (invoiceType === 'ClinicToGlobal') return 'System Generated';
    return invoiceType || '--';
  }

  statusPillClasses(status: string | null | undefined): string {
    return getUnifiedStatusBadgeClass(status);
  }

  openPayBillConfirm(): void {
    if (this.userRole !== 'Clinic Admin') return;
    if (String(this.data?.status || '').toLowerCase() !== 'pending') return;

    this.modal.confirm({
      nzTitle: 'Confirm',
      nzContent: 'Are you sure, you want to pay this bill?',
      nzIconType: 'question-circle',
      nzOnOk: () => this.payInvoice(),
    });
  }

  payInvoice(): void {
    if (this.userRole !== 'Clinic Admin') return;
    const invoiceId = String(this.data?.invoiceId || '');
    if (!invoiceId) return;

    this.paymentLoading = true;
    this.cdr.markForCheck();

    this.gs.payInvoice(invoiceId).subscribe({
      next: (res) => {
        if (res?.status !== 400) {
          this.notification.success('Success', res?.message || 'Invoice paid successfully');
        } else {
          this.notification.error('Error', res?.message || 'Failed to pay invoice');
        }
        this.paymentLoading = false;
        this.fetchDetail();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error paying invoice:', err);
        this.notification.error('Error', err?.error?.message || 'Failed to pay invoice');
        this.paymentLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  trackByLineItemId = (_: number, item: ManualClinicInvoiceLineItem) => item.invoiceLineItemId;
}
