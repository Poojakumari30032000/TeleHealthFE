import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TitleService } from 'app/shared/services/title.service';
import { GeneralService } from 'app/shared/services/general.service';
import { finalize } from 'rxjs/operators';
import { AuthService } from 'app/shared/Auth/auth.service';

interface ApiResponse<T = any> {
  status: number;
  success?: boolean | null;
  message?: string | null;
  count?: number | null;
  data: T;
}

interface AppointmentLine {
  appointmentId: number;
  patientId: number;
  patientName: string;
  appointmentDate: string;
  appointmentStatus: string;
  appointmentAmount: number;
  productName: string;
}

interface ProviderInvoiceDetail {
  providerId: number;
  providerName: string;
  providerEmail: string;
  appointmentCount: number;
  totalAppointmentAmount: number;
  appointments: AppointmentLine[];
}

interface MedicationOrder {
  orderId: number;
  patientId: number;
  patientName: string;
  orderDate: string;
  orderAmount: number | null;
  orderStatus: string;
}

interface MedicationInvoiceDetail {
  productId: number;
  productName: string;
  productType: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  bundleId: number | null;
  bundleName: string | null;
  orders: MedicationOrder[];
}

interface InvoiceSummary {
  totalAppointments: number;
  totalOrders: number;
  totalProviders: number;
  totalProducts: number;
  subTotal: number;
  tax: number | null;
  total: number;
}

export interface DetailedFacilityInvoice {
  invoiceId: number;
  invoiceNumber: string;
  facilityId: number;
  facilityName: string;
  facilityEmail: string;
  facilityAddress: string;
  totalAmount: number;
  providerBillTotal: number;
  pharmacyBillTotal: number;
  status: 'Paid' | 'Pending' | 'Overdue' | string;
  invoiceDate: string;
  dueDate: string;
  invoiceType: string;
  providerInvoiceDetails: ProviderInvoiceDetail[];
  medicationInvoiceDetails: MedicationInvoiceDetail[];
  summary: InvoiceSummary;
}

interface PaymentItem {
  paymentId: number;
  invoiceId: number;
  invoiceNumber: string;
  paymentAmount: number;
  paymentMethod: string;
  transactionId: string | null;
  squarePaymentId: string | null;
  paymentStatus: string;
  paymentDate: string;
  paidByName: string | null;
  paidByEmail: string | null;
  paidByUserId: number | null;
  paidByPatientId: number | null;
  patientName: string | null;
  paidByFacilityId: number | null;
  facilityName: string | null;
  cardLast4?: string | null;
  cardBrand?: string | null;
  cardHolderName?: string | null;
  paymentNotes?: string | null;
  isRefunded?: boolean;
  refundAmount?: number | null;
  refundDate?: string | null;
  refundReason?: string | null;
  refundTransactionId?: string | null;
  cardId?: number | null;
}

interface InvoicePaymentSummary {
  invoiceId: number;
  invoiceNumber: string;
  invoiceAmount: number;
  totalPaidAmount: number;
  remainingAmount: number;
  invoiceStatus: string;
  invoiceType: string;
  invoiceDate: string;
  dueDate: string;
  isFullyPaid: boolean;
  isPartiallyPaid: boolean;
  isOverpaid: boolean;
  paymentCount: number;
  payments: PaymentItem[];
}

@Component({
  selector: 'app-ga-clinic-invoice-bill-details',
  templateUrl: './ga-clinic-invoice-bill-details.component.html',
  styleUrl: './ga-clinic-invoice-bill-details.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GaClinicInvoiceBillDetailsComponent implements OnInit {
  loading = false;
  errorMsg: string | null = null;

  invoiceId = 0;
  data!: DetailedFacilityInvoice;

  userRole: string | null = null;

  docLabel: 'Invoice' | 'Bill' = 'Invoice';
  docLabelLower = 'invoice';

  providerLineItems: Array<
    AppointmentLine & {
    providerId: number;
    providerName: string;
    providerEmail: string;
  }
  > = [];

  medicationProductLines: Array<{
    productId: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }> = [];

  medicationOrderLines: Array<
    MedicationOrder & {
    productId: number;
    productName: string;
    unitPrice: number;
  }
  > = [];

  providerTotalAmount = 0;
  medicationProductsTotalQty = 0;
  medicationProductsTotalAmount = 0;
  medicationOrdersCount = 0;
  medicationOrdersTotalUnitValue = 0;

  paymentSummary?: InvoicePaymentSummary;
  payments: PaymentItem[] = [];

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private titleService: TitleService,
    private generalService: GeneralService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {

    const paramVal =
      this.activatedRoute.snapshot.paramMap.get('invoiceId') ??
      this.activatedRoute.snapshot.paramMap.get('id');

    this.invoiceId = Number(paramVal || 0);

    this.userRole = this.authService.getUserRole();
    this.setTitleAndLabelsByRole();

    this.fetchInvoice();
    this.fetchPaymentSummary();
  }

  private setTitleAndLabelsByRole(): void {
    if (this.userRole === 'Clinic Admin') {
      this.docLabel = 'Bill';
      this.docLabelLower = 'bill';
      this.titleService.updateTitle('Bill Detail', [
        { label: 'Bills', path: '/billing/clinicBills' },
        { label: 'Bill Detail', path: `/billing/clinicBills/detail/` + this.invoiceId },
      ]);
    } else if (this.userRole === 'Global Admin') {
      this.docLabel = 'Invoice';
      this.docLabelLower = 'invoice';
      this.titleService.updateTitle('Invoice Detail', [
        { label: 'Invoice', path: '/billing/clinicBills' },
        { label: 'Invoice Detail', path: `/billing/clinicBills/detail/` + this.invoiceId },
      ]);
    } else {

      this.docLabel = 'Invoice';
      this.docLabelLower = 'invoice';
      this.titleService.updateTitle('Invoice Detail', [
        { label: 'Bills', path: '/billing/clinicBills' },
      ]);
    }
  }

  private fetchInvoice(): void {
    if (!this.invoiceId) {
      this.errorMsg = 'Invalid invoice id.';
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMsg = null;

    this.generalService
      .getDetailedFacilityInvoice(this.invoiceId)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res: ApiResponse<DetailedFacilityInvoice>) => {
          this.data = res.data;
          this.buildLineItems();
          this.buildTotals();
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

  private fetchPaymentSummary(): void {
    if (!this.invoiceId) return;

    this.generalService
      .getInvoicePaymentSummary(this.invoiceId)
      .subscribe({
        next: (res: ApiResponse<InvoicePaymentSummary>) => {
          this.paymentSummary = res.data;
          this.payments = res.data?.payments || [];
          this.cdr.markForCheck();
        },
        error: () => {

          this.cdr.markForCheck();
        },
      });
  }

  private buildLineItems(): void {

    this.providerLineItems =
      this.data?.providerInvoiceDetails?.flatMap((p) =>
        (p.appointments || []).map((a) => ({
          ...a,
          providerId: p.providerId,
          providerName: p.providerName,
          providerEmail: p.providerEmail,
        }))
      ) || [];

    this.medicationProductLines =
      this.data?.medicationInvoiceDetails?.map((m) => ({
        productId: m.productId,
        productName: m.productName,
        quantity: m.quantity,
        unitPrice: m.unitPrice,
        lineTotal: (m.quantity || 0) * (m.unitPrice || 0),
      })) || [];

    this.medicationOrderLines =
      this.data?.medicationInvoiceDetails?.flatMap((m) =>
        (m.orders || []).map((o) => ({
          ...o,
          productId: m.productId,
          productName: m.productName,
          unitPrice: m.unitPrice,
        }))
      ) || [];
  }

  private buildTotals(): void {

    this.providerTotalAmount = this.providerLineItems.reduce(
      (sum, r) => sum + (Number(r.appointmentAmount) || 0),
      0
    );

    this.medicationProductsTotalQty = this.medicationProductLines.reduce(
      (sum, r) => sum + (Number(r.quantity) || 0),
      0
    );
    this.medicationProductsTotalAmount = this.medicationProductLines.reduce(
      (sum, r) => sum + (Number(r.lineTotal) || 0),
      0
    );

    this.medicationOrdersCount = this.medicationOrderLines.length;
    this.medicationOrdersTotalUnitValue = this.medicationOrderLines.reduce(
      (sum, r) => sum + (Number(r.unitPrice) || 0),
      0
    );
  }

  statusPillClasses(status: string) {
    const s = (status || '').toLowerCase();
    return {

      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300':
        s === 'paid' || s === 'completed',

      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300': s === 'pending',

      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300': s === 'start',

      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300':
        s === 'refunded' || s === 'overdue' || s === 'unpaid' || s === 'cancelled',

      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200':
        !['paid', 'completed', 'pending', 'start', 'overdue', 'unpaid', 'cancelled', 'refunded'].includes(s),
    };
  }

  trackByIdx = (_: number, __: any) => _;

  viewInvoice(row: PaymentItem) {

    this.router.navigate(['/billing/payments/detail', row.paymentId]);
  }
}
