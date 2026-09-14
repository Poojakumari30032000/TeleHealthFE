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
import { TitleService } from 'app/shared/services/title.service';
import { GeneralService } from 'app/shared/services/general.service';
import { AuthService } from 'app/shared/Auth/auth.service';
import {NzModalService} from "ng-zorro-antd/modal";
import {NzNotificationService} from "ng-zorro-antd/notification";
import { getUnifiedStatusBadgeClass } from 'app/shared/utils/status-badge.util';

interface ApiResponse<T = any> {
  status: number;
  success?: boolean | null;
  message?: string | null;
  count?: number | null;
  data: T;
}

interface PatientInvoiceItem {
  orderId: number | null;
  productId: number;
  productName: string;
  productType: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number | null;
  couponCode: string | null;
  discount: number | null;
  orderDate: string;

  lineTotal?: number;
  displayUnitPrice?: number;
  discountPerUnit?: number;
  lineSubtotal?: number;
  lineDiscountTotal?: number;
}

interface PatientInvoicePayment {
  paymentId: number;
  paymentDate: string;
  paymentStatus: string;
  paymentMethod: string;
  transactionId: string;
}

interface PatientInvoiceDetail {
  invoiceId: number;
  invoiceNumber: string;
  patientId: number;
  patientName: string;
  patientEmail: string;
  patientAddress: string | null;
  facilityId: number;
  facilityName: string;
  providerId: number | null;
  providerName: string | null;

  totalAmount: number;
  discountAmount: number;
  payableAmount: number;

  couponCode: string | null;
  status: string;
  invoiceDate: string;
  dueDate: string;
  invoiceType: string;

  items: PatientInvoiceItem[];
  payment: PatientInvoicePayment | null;
}

@Component({
  selector: 'app-clinic-patient-invoice-detail',
  templateUrl: './clinic-patient-invoice-detail.component.html',
  styleUrl: './clinic-patient-invoice-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicPatientInvoiceDetailComponent implements OnInit, OnChanges {
  @Input() invoiceIdInput: number | null = null;
  @Input() embeddedInTabs = false;

  loading = false;
  paymentLoading: boolean = false;
  sendingReminder: boolean = false;
  cancellingInvoice = false;
  errorMsg: string | null = null;

  get isPending(): boolean {
    return this.data?.status === 'Pending';
  }

  invoiceId = 0;
  data: PatientInvoiceDetail | null = null;

  lineItems: PatientInvoiceItem[] = [];

  totalQty = 0;

  subtotalAmount = 0;
  discountTotal = 0;
  netTotal = 0;

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
    if (this.userRole === 'Patient') {
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
      this.cdr.markForCheck();
      return;
    }

    if (this.invoiceId !== resolvedId) {
      this.invoiceId = resolvedId;
      this.errorMsg = null;
      this.data = null;
      this.lineItems = [];
      this.subtotalAmount = 0;
      this.discountTotal = 0;
      this.netTotal = 0;
      this.totalQty = 0;
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

    const detailTitle =
      this.docLabel === 'Bill'
        ? 'Patient Bill Detail'
        : 'Patient Invoice Detail';
    const listLabel =
      this.docLabel === 'Bill' ? 'Patient Bills' : 'Patient Invoices';

    this.title.updateTitle(detailTitle, [
      { label: listLabel, path: '/billing/clinicInvoices' },
      {
        label: this.invoiceId.toString(),
        path: `/billing/clinicInvoices/detail/${this.invoiceId}`,
      },
    ]);
  }

  private fetchDetail(): void {
    this.loading = true;
    this.errorMsg = null;

    this.gs
      .getPatientInvoiceDetailById(this.invoiceId)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res: ApiResponse<PatientInvoiceDetail>) => {
          this.data = res.data;
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
    const items = this.data?.items || [];

    this.lineItems = items.map((it) => {
      const qty = Number(it.quantity || 0);

      const netUnit = Number(it.unitPrice || 0);
      const discountPerUnit = it.discount != null ? Number(it.discount) : 0;

      const displayUnitPrice =
        discountPerUnit ? netUnit + discountPerUnit : netUnit;

      const lineSubtotal = displayUnitPrice * qty;

      const lineDiscountTotal = discountPerUnit * qty;

      const lineTotal =
        it.totalPrice != null ? Number(it.totalPrice) : netUnit * qty;

      return {
        ...it,
        discountPerUnit,
        displayUnitPrice,
        lineSubtotal,
        lineDiscountTotal,
        lineTotal,
      };
    });

    this.totalQty = this.lineItems.reduce(
      (s, r) => s + (Number(r.quantity) || 0),
      0
    );

    this.subtotalAmount = this.lineItems.reduce(
      (s, r) => s + (Number(r.lineSubtotal) || 0),
      0
    );

    this.discountTotal = this.lineItems.reduce(
      (s, r) => s + (Number(r.lineDiscountTotal) || 0),
      0
    );

    this.netTotal = Number(this.data?.payableAmount || 0);
  }

  statusPillClasses(status: string | null | undefined): string {
    return getUnifiedStatusBadgeClass(status);
  }

  openPayBillConfirm(): void {
    this.modal.confirm({
      nzTitle: 'Confirm',
      nzContent: 'Are you sure, you want to pay this bill?',
      nzIconType: 'question-circle',
      nzOnOk: () => this.payInvoice(),
      nzOnCancel: () => this.handleInvoiceCancel()
    });
  }

  payInvoice(): void {
    if (this.userRole !== 'Patient') return;
    const invoiceId = String(this.data?.invoiceId  || '');
    if (!invoiceId) return;
    this.paymentLoading = true;
    this.cdr.markForCheck()

    this.gs.payManualInvoice(invoiceId).subscribe({
      next: (res) => {
        if(res.status != 400){
          this.notification.success('Success', res.message || 'Invoice paid successfully');
          this.paymentLoading = false
          this.fetchDetail();
          this.cdr.markForCheck()
        }
        else{
          this.notification.error('Error', res.message || 'Failed to pay invoice');
          this.paymentLoading = false
          this.fetchDetail();
          this.cdr.markForCheck()
        }

      },
      error: (err) => {
        console.error('Error paying invoice:', err);
        this.notification.error('Error', 'Failed to pay invoice');
        this.paymentLoading = false
        this.cdr.markForCheck()
      }
    });
  }

  handleInvoiceCancel(){

  }

  sendInvoiceReminder(): void {
    const invoiceId = Number(this.data?.invoiceId || 0);
    if (!invoiceId) return;

    this.modal.confirm({
      nzTitle: 'Confirm',
      nzContent: 'Are you sure you want to send a payment reminder for this invoice?',
      nzIconType: 'question-circle',
      nzOnOk: () => {
        this.sendingReminder = true;
        this.cdr.markForCheck();

        this.gs
          .sendInvoiceReminder(invoiceId)
          .pipe(finalize(() => {
            this.sendingReminder = false;
            this.cdr.markForCheck();
          }))
          .subscribe({
            next: (res: any) => {
              if (res?.success === true || res?.status === 1) {
                this.notification.success('Success', res?.message || 'Payment reminder sent successfully.');
              } else {
                this.notification.error('Error', res?.message || 'Failed to send payment reminder.');
              }
            },
            error: () => {
              this.notification.error('Error', 'Failed to send payment reminder.');
            },
          });
      },
    });
  }

  cancelInvoice(): void {
    const invoiceId = this.data?.invoiceId;
    if (!invoiceId) return;

    this.modal.confirm({
      nzTitle: 'Cancel Invoice',
      nzContent: 'Are you sure you want to cancel this invoice? This action cannot be undone.',
      nzIconType: 'exclamation-circle',
      nzOkText: 'Yes, Cancel Invoice',
      nzOkDanger: true,
      nzCancelText: 'Go Back',
      nzOnOk: () => {
        this.cancellingInvoice = true;
        this.cdr.markForCheck();

        this.gs
          .cancelInvoice(invoiceId)
          .pipe(finalize(() => { this.cancellingInvoice = false; this.cdr.markForCheck(); }))
          .subscribe({
            next: (res: any) => {
              this.notification.success('Success', res?.message || 'Invoice cancelled successfully.');
              this.fetchDetail();
            },
            error: (err: any) => {
              this.notification.error('Error', err?.error?.message || 'Failed to cancel invoice.');
            },
          });
      },
    });
  }

  trackByIdx = (i: number) => i;
}
