import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { AuthService } from 'app/shared/Auth/auth.service';
import { GeneralService } from 'app/shared/services/general.service';
import { TitleService } from 'app/shared/services/title.service';

interface ApiResponse<T = any> {
  status: number;
  success?: boolean;
  message?: string;
  count?: number;
  data: T;
  totalEntityCount?: number | null;
  totalPages?: number | null;
}

interface PaymentRow {
  paymentId: number;
  invoiceId: number;
  invoiceNumber: string | null;
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
  cardLast4: string | null;
  cardBrand: string | null;
  cardHolderName: string | null;
  paymentNotes: string | null;
  isRefunded: boolean | null;
  refundAmount: number | null;
  refundDate: string | null;
  refundReason: string | null;
  refundTransactionId: string | null;
  cardId: number | null;
}

interface PaymentsEnvelope {
  payments: PaymentRow[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

@Component({
  selector: 'app-ga-clinic-payment-list',
  templateUrl: './ga-clinic-payment-list.component.html',
  styleUrl: './ga-clinic-payment-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush

})
export class GaClinicPaymentListComponent implements OnInit {

  userRole: string | null = null;
  facilityId: number | null = null;

  showFilters = true;
  dateRange: Date[] = [];
  startDateLabel: string | null = null;
  endDateLabel: string | null = null;
  appliedFilters: { name: string; value: any }[] = [];

  payments: PaymentRow[] = [];
  loading = false;
  total = 0;
  pageIndex = 1;
  pageSize = 100;

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router,
    private notification: NzNotificationService,
    private auth: AuthService,
    private generalService: GeneralService,
    private titleService: TitleService
  ) {}

  ngOnInit(): void {
    this.userRole = this.auth.getUserRole();
    const fid = this.auth.getUserFacilityId();
    this.facilityId = fid !== null ? Number(fid) : null;

    this.titleService.updateTitle('Payments', []);

    this.updateAppliedFilters();
    this.fetchPayments();
  }

  private toYYYYMMDD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private localStartOfDayIso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}T00:00:00`;
  }

  private localEndOfDayIso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}T23:59:59`;
  }

  onDateRangeChange(dates: Date[] | null): void {
    this.dateRange = Array.isArray(dates) ? dates : [];
    if (this.dateRange.length === 2 && this.dateRange[0] && this.dateRange[1]) {
      this.startDateLabel = this.toYYYYMMDD(this.dateRange[0]);
      this.endDateLabel = this.toYYYYMMDD(this.dateRange[1]);
    } else {
      this.startDateLabel = null;
      this.endDateLabel = null;
      this.dateRange = [];
    }
  }

  applyFilters(): void {

    this.pageIndex = 1;
    this.updateAppliedFilters();
    this.fetchPayments();
  }

  clearFilters(): void {
    this.dateRange = [];
    this.startDateLabel = null;
    this.endDateLabel = null;
    this.updateAppliedFilters();
    this.pageIndex = 1;
    this.fetchPayments();
  }

  removeFilter(name: string): void {
    if (name === 'StartDate' || name === 'EndDate') {
      this.dateRange = [];
      this.startDateLabel = null;
      this.endDateLabel = null;
      this.applyFilters();
      return;
    }
  }

  updateAppliedFilters(): void {
    const chips: { name: string; value: any }[] = [];
    if (this.startDateLabel) chips.push({ name: 'StartDate', value: this.startDateLabel });
    if (this.endDateLabel) chips.push({ name: 'EndDate', value: this.endDateLabel });
    this.appliedFilters = chips;
  }

  private buildRequestBody() {
    const body: any = {
      facilityId: this.userRole === 'Global Admin' ? null : this.facilityId,
      pageNumber: this.pageIndex,
      pageSize: this.pageSize,
      clientTimezoneOffsetMinutes: -new Date().getTimezoneOffset()
    };

    if (this.dateRange.length === 2 && this.dateRange[0] && this.dateRange[1]) {
      body.startDate = this.localStartOfDayIso(this.dateRange[0]);
      body.endDate = this.localEndOfDayIso(this.dateRange[1]);
    }
    return body;
  }

  fetchPayments(): void {
    this.loading = true;
    const payload = this.buildRequestBody();

    this.generalService.getPayments(payload).subscribe({
      next: (res: ApiResponse<PaymentsEnvelope>) => {
        const env = res?.data;
        this.payments = env?.payments ?? [];
        this.total = env?.totalCount ?? this.payments.length;

        if (env?.pageNumber) this.pageIndex = env.pageNumber;
        if (env?.pageSize) this.pageSize = env.pageSize;

        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading payments:', err);
        this.notification.error('Failed', 'Could not load payments.');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onQueryParamsChange(params: { pageIndex?: number; pageSize?: number }): void {
    const changedPage = params.pageIndex && params.pageIndex !== this.pageIndex;
    const changedSize = params.pageSize && params.pageSize !== this.pageSize;

    if (changedPage) this.pageIndex = params.pageIndex!;
    if (changedSize) {
      this.pageSize = params.pageSize!;
      this.pageIndex = 1;
    }
    if (changedPage || changedSize) this.fetchPayments();
  }

  getPaymentStatusTagClass(status?: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'completed' || s === 'paid') {
      return 'ui-status-badge--success';
    }
    if (s === 'pending' || s === 'processing') {
      return 'ui-status-badge--pending';
    }
    if (s === 'refunded') {
      return 'ui-status-badge--info';
    }
    if (s === 'failed' || s === 'declined') {
      return 'ui-status-badge--danger';
    }
    return 'ui-status-badge--neutral';
  }

  viewPayment(row: PaymentRow): void {
    if (!row?.paymentId) return;

    this.router.navigate(['billing/clinicPayments/detail', row.paymentId]);
  }
}
