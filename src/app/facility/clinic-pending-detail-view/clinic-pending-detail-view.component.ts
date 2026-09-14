import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { forkJoin, of, Subject, takeUntil } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { GeneralService } from 'app/shared/services/general.service';

@Component({
  selector: 'app-clinic-pending-detail-view',
  templateUrl: './clinic-pending-detail-view.component.html',
  styleUrls: ['./clinic-pending-detail-view.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicPendingDetailViewComponent implements OnInit, OnDestroy {
  @Input() facilityIdInput: number | null = null;
  @Input() embeddedInTabs = false;
  @Output() approved = new EventEmitter<number>();

  loading = false;
  data: any = null;
  adminUser: any = null;
  errorMessage: string | null = null;

  showApproveModal = false;
  approveCanViewChannels = false;
  approveSendMessages = false;
  approveCanViewPharmacyName = false;
  approveIsBillable: boolean = false;
  approvePaymentModeId: number | null = null;
  approving = false;

  private destroy$ = new Subject<void>();

  constructor(
    private gs: GeneralService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadFacility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadFacility(): void {
    if (!this.facilityIdInput) return;
    this.loading = true;
    this.errorMessage = null;
    this.cdr.markForCheck();

    const facilityId = this.facilityIdInput;
    const facility$ = this.gs
      .commonGet(`Facilities/getFacilityById?Id=${facilityId}`)
      .pipe(catchError(() => of(null)));

    const admin$ = this.gs
      .commonGet(
        `Users/getAllUsers?RoleId=3&facilityId=${facilityId}&PageNumber=1&PageSize=10`
      )
      .pipe(catchError(() => of(null)));

    forkJoin([facility$, admin$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([facilityRes, adminRes]: any[]) => {
        this.data = facilityRes?.data || null;
        const list = Array.isArray(adminRes?.data) ? adminRes.data : [];
        this.adminUser = list.length > 0 ? list[0] : null;

        if (!this.data) {
          this.errorMessage =
            'Failed to load clinic details. Please refresh and try again.';
        }
        this.loading = false;
        this.cdr.markForCheck();
      });
  }

  openApproveModal(): void {
    this.approveCanViewChannels = false;
    this.approveSendMessages = false;
    this.approveCanViewPharmacyName = false;
    this.approveIsBillable = false;
    this.approvePaymentModeId = null;
    this.showApproveModal = true;
    this.cdr.markForCheck();
  }

  closeApproveModal(): void {
    if (this.approving) return;
    this.showApproveModal = false;
    this.cdr.markForCheck();
  }

  selectPaymentMode(modeId: number): void {
    if (this.approving) return;
    this.approvePaymentModeId = modeId;
    this.cdr.markForCheck();
  }

  confirmApprove(): void {
    if (!this.facilityIdInput) return;

    if (!this.approvePaymentModeId) {
      this.gs.showError('Please select a payment mode before approving.');
      return;
    }

    this.approving = true;
    this.cdr.markForCheck();

    const payload = {
      facilityId: this.facilityIdInput,
      canViewChannels: !!this.approveCanViewChannels,

      canSendMessages: !!this.approveCanViewChannels && !!this.approveSendMessages,
      canViewPharmacyName: !!this.approveCanViewPharmacyName,
      isBillable: !!this.approveIsBillable,
      paymentModeId: this.approvePaymentModeId,
    };

    this.gs
      .commonPost('Users/approveClinic', payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.approving = false;
          if (res?.status === 1 && (res?.data === true || res?.success === true)) {
            this.showApproveModal = false;
            this.gs.showSuccess(res?.message || 'Clinic approved successfully.');
            this.approved.emit(this.facilityIdInput!);
          } else {
            this.gs.showError(res?.message || 'Failed to approve clinic.');
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.approving = false;
          this.gs.showError('Failed to approve clinic. Please try again.');
          this.cdr.markForCheck();
        },
      });
  }

  get hasOtherBilling(): boolean {
    return this.data?.billingAddressType === 'Other Address';
  }

  get adminFullName(): string {
    if (this.adminUser?.userName) return this.adminUser.userName;
    const f = (this.data?.clinicAdminFirstName || '').trim();
    const l = (this.data?.clinicAdminLastName || '').trim();
    const combined = [f, l].filter(Boolean).join(' ');
    return combined || (this.data?.facilityContactName || '—');
  }

  get adminEmail(): string {
    return (
      this.adminUser?.email ||
      this.data?.facilityContactEmail ||
      this.data?.email ||
      '—'
    );
  }

  get adminPhone(): string {
    return (
      this.adminUser?.phone ||
      this.data?.facilityContactPhone ||
      this.data?.phone ||
      '—'
    );
  }

  get adminStatus(): string {
    return this.adminUser?.status || '—';
  }
}
