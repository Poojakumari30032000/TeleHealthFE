import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { GeneralService } from 'app/shared/services/general.service';
import { AuthService } from 'app/shared/Auth/auth.service';
import { Subject, takeUntil } from 'rxjs';
import {Router} from "@angular/router";

interface Tile {
  index: number;
  tileName: string;
  value: string;
}

interface ApiResponse {
  status: number;
  message: string;
  data: any;
}

interface MedicationHistoryItem {
  packageName: string;
  duration: string;
  patientTreatmentId: number;
  price: number;
  status: string;
}

interface PaymentHistoryItem {
  invoiceId?: number | null;
  invoiceNo: string;
  date: string | Date;
  amount: number;
  status: string;
}

@Component({
  selector: 'app-patient-dashboard',
  templateUrl: './patient-dashboard.component.html',
  styleUrls: ['./patient-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientDashboardComponent implements OnInit, OnDestroy {
  userId: number = this.auth.getUserId() || 0;
  userRoleId: number = this.auth.getUserRoleId() || 0;
  selectedFacilityId: number = Number(localStorage.getItem('FOS'));

  tiles: { [key: string]: string | number } = {};
  tilesLoading = true;

  private destroy$ = new Subject<void>();

  medicationHistory: MedicationHistoryItem[] = [];
  medicationHistoryLoading = false;

  paymentHistory: PaymentHistoryItem[] = [];
  paymentHistoryLoading = false;

  constructor(
    private generalService: GeneralService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.fetchSummary();
    this.fetchMedicationHistory();
    this.fetchPaymentHistory();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  fetchSummary(): void {
    this.tilesLoading = true;
    this.generalService
      .commonGet(
        `Dashboards/getDashBoardTiles?UserId=${this.userId}&RoleId=${this.userRoleId}&FacilityId=${this.selectedFacilityId}`
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ApiResponse) => {
          if (response.status === 1 && response.data) {
            const data = response.data as Tile[];
            data.forEach((tile: Tile) => {
              this.tiles[tile.tileName] = tile.value;
            });
          } else {
            console.error('Failed to fetch summary:', response.message);
          }
          this.tilesLoading = false;
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Error fetching summary:', err);
          this.tilesLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  fetchMedicationHistory(): void {
    this.medicationHistoryLoading = true;

    this.generalService
      .commonGet(
        `Dashboards/getMedicationHistory?UserId=${this.userId}&RoleId=${this.userRoleId}&FacilityId=${this.selectedFacilityId}`
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ApiResponse) => {
          if (response.status === 1 && Array.isArray(response.data)) {
            this.medicationHistory = response.data as MedicationHistoryItem[];
          } else {
            this.medicationHistory = [];
            console.error('Failed to fetch medication history:', response.message);
          }
          this.medicationHistoryLoading = false;
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Error fetching medication history:', err);
          this.medicationHistory = [];
          this.medicationHistoryLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  fetchPaymentHistory(): void {
    this.paymentHistoryLoading = true;

    this.generalService
      .commonGet(
        `Dashboards/getPaymentHistory?UserId=${this.userId}&RoleId=${this.userRoleId}&FacilityId=${this.selectedFacilityId}`
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ApiResponse) => {
          if (response.status === 1 && Array.isArray(response.data)) {
            this.paymentHistory = response.data as PaymentHistoryItem[];
          } else {
            this.paymentHistory = [];
            console.error('Failed to fetch payment history:', response.message);
          }
          this.paymentHistoryLoading = false;
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Error fetching payment history:', err);
          this.paymentHistory = [];
          this.paymentHistoryLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  openTreatment(med:any){
    console.log(med);
    this.router.navigate(['/treatment/detail/'+med.patientTreatmentId]);
  }

  get activeTreatments(): number {
    return Number(this.tiles['Active Treatments']) || 0;
  }

  get upcomingAppointment(): string | Date | null {
    const value = this.tiles['Upcoming Appointment'];
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return String(value);
    return value as string | Date;
  }

  get nextShippingDate(): string | Date | null {
    const value = this.tiles['Next Shipping Date'];
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return String(value);
    return value as string | Date;
  }

  get nextRefill(): string {
    return String(this.tiles['Next Refill'] || 'N/A');
  }

  openTreatments(): void {
    this.router.navigate(['/treatment/view']);
  }

  openAppointments(): void {
    this.router.navigate(['/schedule/calendar']);
  }

  openOrders(): void {
    this.router.navigate(['/order/view']);
  }

  openPrescriptions(): void {
    this.router.navigate(['/prescription/view']);
  }

  openBilling(): void {
    this.router.navigate(['/billing/patientBills']);
  }

  openPayment(payment: PaymentHistoryItem): void {
    const directInvoiceId = Number(payment?.invoiceId || 0);
    if (Number.isFinite(directInvoiceId) && directInvoiceId > 0) {
      this.router.navigate(['/billing/clinicInvoices/detail', directInvoiceId]);
      return;
    }

    const rawInvoiceNo = String(payment?.invoiceNo || '').trim();
    const parsedInvoiceId = Number(rawInvoiceNo.replace(/\D/g, ''));

    if (Number.isFinite(parsedInvoiceId) && parsedInvoiceId > 0) {
      this.router.navigate(['/billing/clinicInvoices/detail', parsedInvoiceId]);
      return;
    }

    this.generalService.showError('Invoice details could not be opened for this payment.');
  }
}
