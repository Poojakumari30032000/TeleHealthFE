import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { finalize, Subject, takeUntil } from 'rxjs';
import { GeneralService } from 'app/shared/services/general.service';
import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';
import { TitleService } from 'app/shared/services/title.service';
import { AuthService } from 'app/shared/Auth/auth.service';
import { FormControl, Validators } from '@angular/forms';
import {NzModalService} from "ng-zorro-antd/modal";
import { AppointmentDetailViewComponent } from 'app/schedule/appointment-detail-view/appointment-detail-view.component';
import { PrescriptionDetailViewComponent } from 'app/prescription/prescription-detail-view/prescription-detail-view.component';
import { OrderDetailViewComponent } from 'app/order/order-detail-view/order-detail-view.component';
import { SOAPNotesComponent } from 'app/prescription/soap-notes/soap-notes.component';
import { ScheduleModule } from 'app/schedule/schedule.module';
import { PrescriptionModule } from 'app/prescription/prescription.module';
import { OrderModule } from 'app/order/order.module';
import { getUnifiedStatusBadgeClass } from 'app/shared/utils/status-badge.util';
import { ChatService } from 'app/chat/chat.service';

interface AppliedCoupon {
  couponCodeId: number;
  couponCode: string;
  discountValue: number;
  discountType: 'Amount' | 'Percentage';
  appliesToRecurring: boolean;
  couponApplicationType: 'RecurringAllowed' | 'OneTimeOnly' | string | null;
  isActive: boolean;
  isExpired: boolean;
  isAssignedToBundle: boolean;
  isValid: boolean;
  invalidReason: string | null;
  expiryDate: string | null;
}

interface TreatmentDetails {
  channelId?: number | null;
  patientTreatmentGuid: string;
  patientId: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  address: string;
  gender: string;
  dob: string;
  pharmacyName: string | null;
  mrn: string;
  prescriptionId: number;
  treatmentType: string;
  questionnaire: string | null;
  dateStarted: string;
  datePrescribed: string;
  lastOrderId: number;
  lastOrderDate: string;
  totalSpentToDate: number;
  averageOrderValue: number;
  orderStatus: string;
  membershipPlan: string | null;
  membershipPrice: number | null;
  visitStatus: string;
  visitTime: string;
  waitTime?: string | null;
  visitDate: string;
  nextShippingDate: string | null;
  subscriptionStatus: string | null;
  emailMarketing: string | null;
  smsMarketing: string | null;
  coupon: string | null;
  appliedCoupon?: AppliedCoupon | null;
  isRecurring?: boolean;
  recurringAmountAfterCoupon?: number | null;
  recurringDurationMonths?: number | null;
  recurringDurationDays?: number | null;
  nextRecurringPaymentDate?: string | null;
  createdAt: string;
  createdByName: string;
  lastEditedDate: string | null;
}

type IntakeItem = {
  question: string;
  answer: string | null;
  consentHtml: string | null;
  otherText: string | null;
  type: string | null;
};

type FullscriptPatientPayload = {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  dateOfBirth?: string;
  biologicalSex?: 'male' | 'female' | 'prefer not to say';
  mobileNumber?: string;
  discount?: number;
};

type RelatedEntityType = 'appointment' | 'prescription' | 'order' | 'document' | 'soapNote';

type EmbeddedTabNavigationRequest = {
  type: RelatedEntityType | 'treatmentMain';
  id?: number;
  data?: any;
};

interface RelatedEntityTab {
  key: string;
  type: RelatedEntityType;
  title: string;
  data: any;
  safeUrl?: SafeResourceUrl;
}

@Component({
  selector: 'app-treatment-detail-view',
  templateUrl: './treatment-detail-view.component.html',
  styleUrl: './treatment-detail-view.component.css',
  providers: [ChatService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TreatmentDetailViewComponent {
  @Input() treatmentIdInput: number | null = null;
  @Input() embeddedInTabs = false;

  @ViewChild('commanModel', { static: false }) commanModel!: CommanFormModalComponent;

  activeTab: string = 'Treatment Products';
  modalApiUrl: { save?: string; get?: string } = { save: 'PatientTreatments/createTreatmentDocument', get: '' };
  readonly treatmentMainTabKey = 'treatment-main';
  activeRelatedTabKey = this.treatmentMainTabKey;
  relatedTabs: RelatedEntityTab[] = [];

  readonly selectedOrgId: number = Number(localStorage.getItem('OFL'));
  treatmentId: number = 0;

  treatmentData: any | null = null;
  hasError = false;
  isLoading = false;

  toggleLoading: boolean = false;
  refillRequestLoading : boolean = false;
  sendingIntakeFormReminder: boolean = false;

  slots: any[] = [];
  prescriptions: any[] = [];
  orders: any[] = [];
  soapNotes: any[] = [];
  documents: any[] = [];

  intakeModalVisible = false;
  intakeForms: IntakeItem[] = [];
  expandedConsentSet = new Set<number>();

  isFormSubmitting = false;

  userRole: string = this.auth.getUserRole() || '';

  statusModalVisible = false;
  isUpdatingStatus = false;
  statusOptions: string[] = ['Active', 'Paused', 'Cancelled', 'Completed'];
  statusControl = new FormControl<string | null>(null, { nonNullable: false, validators: [Validators.required] });

  private destroy$ = new Subject<void>();

  isFollowUpApptVisible = false;
  isSubmittingFollowUp = false;

  followUpPatientAppointmentSlotId: number | null = null;
  followUpProviderId: number | null = null;

  followUpSelectedDate: Date | null = null;
  followUpFormattedDate: string | null = null;

  followUpAvailableSlots: Array<{
    providerScheduledSlotId: number;
    slotDate: string;
    startTime: string;
    endTime: string;
    duration: number;
    providerId: number;
    facilityId: number | null;
    providerName: string;
  }> = [];

  followUpLoadingSlots = false;
  followUpSlotsError: string | null = null;

  followUpSelectedProviderScheduledSlotId: number | null = null;

  isFullscriptModalVisible = false;

  disablePastDates = (current: Date): boolean => {
    if (!current) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const date = new Date(current);
    date.setHours(0, 0, 0, 0);

    return date < today;
  };

  constructor(
    private route: Router,
    private cdr: ChangeDetectorRef,
    private _location: Location,
    private generalService: GeneralService,
    private router: ActivatedRoute,
    private titleService: TitleService,
    private auth: AuthService,
    private modal: NzModalService,
    private sanitizer: DomSanitizer,

  ) {
  }

  ngOnInit(): void {
    this.resolveAndLoadTreatment();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['treatmentIdInput'] && !changes['treatmentIdInput'].firstChange) {
      this.resolveAndLoadTreatment();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private resolveAndLoadTreatment(): void {
    const inputId = Number(this.treatmentIdInput || 0);
    const routeId = Number(this.router.snapshot.paramMap.get('id') || 0);
    const resolvedId = inputId > 0 ? inputId : routeId;

    if (!resolvedId) {
      this.treatmentData = null;
      this.isLoading = false;
      this.cdr.markForCheck();
      return;
    }

    if (this.treatmentId !== resolvedId) {
      this.treatmentId = resolvedId;
      this.relatedTabs = [];
      this.activeRelatedTabKey = this.treatmentMainTabKey;
      this.getTreatmentDetails();
      return;
    }

    if (!this.treatmentData && !this.isLoading) {
      this.getTreatmentDetails();
    }
  }

  getTreatmentDetails(silent = false): void {
    if (!this.treatmentId) return;

    if (!silent) {
      this.isLoading = true;
      this.hasError = false;
    }

    this.generalService
      .commonGet(`PatientTreatments/getPatientTreatmentInfo?Id=${this.treatmentId}&ClientTimezoneOffsetMinutes=${-new Date().getTimezoneOffset()}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const isSuccess = response?.status === 1 || response?.success === true;
          if (isSuccess && response?.data) {
            this.treatmentData = response.data;
            this.slots = response.data.appointments || [];
            this.prescriptions = response.data.prescriptions || [];
            this.orders = response.data.orders || [];
            this.soapNotes = response.data.soapNotes || [];
            this.documents = response.data.documents || [];

            if (!this.embeddedInTabs) {
              this.titleService.updateTitle(
                `${response.data.firstName} ${response.data.lastName}`,
                [
                  { label: 'Treatments', path: '/treatment/view' },
                  { label: 'Treatment Detail', path: `/treatment/detail/${this.treatmentId}` }
                ]
              );
            }
          } else {
            if (!silent) this.hasError = true;
          }
          if (!silent) this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (_err) => {
          if (!silent) {
            this.isLoading = false;
            this.hasError = true;
          }
          this.cdr.markForCheck();
        }
      });
  }

  get hasIntakeForms(): boolean {
    const forms = this.treatmentData?.treatmentIntakeForms;
    return Array.isArray(forms) && forms.length > 0;
  }

  openIntakeAnswers(): void {
    const forms: IntakeItem[] = this.treatmentData?.treatmentIntakeForms || [];
    this.intakeForms = forms.filter(f => f && (f.answer != null || (f.type === 'consent' && f.consentHtml != null)));
    this.expandedConsentSet.clear();
    this.intakeModalVisible = true;
    this.cdr.markForCheck();
  }

  handleIntakeCancel(): void {
    this.intakeModalVisible = false;
    this.expandedConsentSet.clear();
    this.cdr.markForCheck();
  }

  toggleConsentHtml(index: number): void {
    if (this.expandedConsentSet.has(index)) {
      this.expandedConsentSet.delete(index);
    } else {
      this.expandedConsentSet.add(index);
    }
    this.cdr.markForCheck();
  }

  sanitizeConsentHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  isSignatureUrl(value: string): boolean {
    const v = value.trim();
    return /^https?:\/\/.+/i.test(v) &&
      (/\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(v) || v.includes('/signatures/'));
  }

  parseConsentParts(answer: string): { key: string; value: string; isImage: boolean }[] {
    return answer.split('|').map(part => {
      const colonIdx = part.indexOf(':');
      if (colonIdx === -1) return { key: '', value: part.trim(), isImage: false };
      const key = part.slice(0, colonIdx).trim();
      const value = part.slice(colonIdx + 1).trim();
      return { key, value, isImage: this.isSignatureUrl(value) };
    }).filter(p => p.key || p.value);
  }

  formatAnswer(v: unknown): string {
    if (v === null || v === undefined) return '—';
    return String(v).split('|').map(s => s.trim()).join('\n');
  }

  formatTime12(time: string | null | undefined): string {
    if (!time) return '';
    const m = /^(\d{1,2}):(\d{2})/.exec(time);
    if (!m) return time;
    let hour = parseInt(m[1] ?? '0', 10);
    const minute = m[2] ?? '00';
    const ampm = hour < 12 ? 'AM' : 'PM';
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  }

  trackByIntakeIndex = (i: number, _item: IntakeItem) => i;

  onTabChange(event: any): void {
    this.activeTab = event.tab.nzTitle;
    this.cdr.markForCheck();
  }

  updatePrescription(): void {
    if (!this.treatmentData) return;
    const title = 'Resend Prescription';
    const ID = 0;
    const formPath = 'treatment/update-prescription-form.json';
    this.commanModel.showModal(title, 'form', formPath, ID);
  }

  updateDates(): void {
    if (!this.treatmentData) return;
    const title = 'Semaglutide - Month 5+';
    const ID = 0;
    const formPath = 'treatment/update-dates-form.json';
    this.commanModel.showModal(title, 'form', formPath, ID);
  }

  AddEditPatient(): void {
    if (!this.treatmentData) return;
    const title = 'Update Patient';
    const ID = this.treatmentData.patientId || 0;
    const formPath = 'patient/add-edit-patient-form.json';
    const selectedFacility = Number(localStorage.getItem('FOS') || 0);
    this.modalApiUrl = { save: 'Patients/savePatient', get: 'Patients/getPatientById?Id=' };
    this.commanModel.showModal(title, 'form', formPath, ID, selectedFacility);
  }

  moveBack(): void {
    this._location.back();
  }

  navigate(route: string, key: keyof TreatmentDetails): void {
    if (!this.treatmentData) return;
    const ID: number = Number(this.treatmentData[key]) || 0;
    if (!ID) {
      this.generalService.showError(`Unable to Continue - ${key} Not Found`);
      return;
    }
    this.route.navigate([route, ID]);
  }

  navigateToOrder = (data: { ordeId: number }) => {
    const ID = data.ordeId || 0;
    if (!ID) {
      this.generalService.showError('Unable to Continue Order Id Not Found');
      return;
    }
    this.route.navigate(['order/detail', ID]);
  };

  onRefund = (data: { id: number }): void => {
    const ID = data.id || 0;
    if (!ID) {
      this.generalService.showError('Unable to Continue Payment Id Not Found');
      return;
    }
    this.route.navigate(['payment', ID, 'refund']);
  };

  statusClass(status: string): string {
    return getUnifiedStatusBadgeClass(status);
  }

  private readonly MIN_DATE_PREFIX = '0001-01-01';

  isPlaceholderSlot(s: any): boolean {
    const d = s?.startDate;
    if (!d) return true;
    if (typeof d === 'string') {
      return d.startsWith(this.MIN_DATE_PREFIX);
    }
    const dt = new Date(d);
    return isNaN(dt.getTime()) || dt.getFullYear() <= 1;
  }

  trackBySlotId = (_: number, row: any) => row?.patientAppointmentSlotId;

  onSelectSlot(s: any): void {
    if (this.isPlaceholderSlot(s)) return;
    this.openRelatedEntityTab('appointment', s);
  }

  statusClassPrescription(status: string): string {
    return getUnifiedStatusBadgeClass(status);
  }

  activeClass(isActive: boolean): string {
    return isActive
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
      : 'bg-gray-100 text-gray-700 dark:bg-gray-600/30 dark:text-gray-200';
  }

  trackByPrescriptionId = (_: number, row: any) => row.patientPrescriptionId;

  onViewPrescription(row: any): void {
    const ID = row.patientPrescriptionId || 0;
    if (!ID) {
      this.generalService.showError('Unable to Continue Prescription Id Not Found');
      return;
    }
    this.openRelatedEntityTab('prescription', row);
  }

  trackByOrderId = (_: number, row: any) => row.patientOrderId;

  statusClassOrder(status: string): string {
    return getUnifiedStatusBadgeClass(status);
  }

  getStatusBadgeClass(status: string | null | undefined): string {
    return getUnifiedStatusBadgeClass(status);
  }

  onViewOrder(row: any): void {
    const id = row?.patientOrderId || 0;
    if (!id) {
      this.generalService.showError('Unable to Continue — Order Id Not Found');
      return;
    }
    this.openRelatedEntityTab('order', row);
  }

  trackBySoapNoteId = (_: number, row: any) => row?.soapNoteId;

  onViewSoapNote(row: any): void {
    const fallbackTreatmentId = Number(row?.patientTreatmentId || this.treatmentId || 0);
    this.openRelatedEntityTab('soapNote', {
      ...row,
      patientTreatmentId: fallbackTreatmentId,
      patientName: this.getTreatmentPatientName()
    });
  }

  createTreatmentSoapNote(): void {
    if (!this.treatmentId) return;
    this.openRelatedEntityTab('soapNote', {
      soapNoteId: 0,
      patientTreatmentId: this.treatmentId,
      patientName: this.getTreatmentPatientName(),
      isNew: true
    });
  }

  addNewPrescription(): void {
    if (!this.treatmentId) return;
    if (this.treatmentData.treatmentStatus != 'Active' && this.treatmentData.treatmentStatus !== 'active'){
      this.generalService.showInfo('Cannot create prescription while treatment is not active.');
    }
    else {
      this.isFormSubmitting = true;
      const payload = {
        patientTreamentId: this.treatmentId,
        providerId: this.slots[0].providerId,
      };

      this.generalService.createNewPrescription(payload).subscribe((response) => {
        if (response?.status === 1) {
          this.generalService.showSuccess('Prescription created successfully');
          this.getTreatmentDetails();
        } else {
          this.generalService.showError('Failed to create prescription');
        }
        this.isFormSubmitting = false;
        this.cdr.markForCheck();
      });
    }
  }

  openUpdateStatus(): void {

    const cur = (this.treatmentData?.treatmentStatus || '').toLowerCase();
    const normalized =
      cur === 'Canceled' ? 'canceled' :
      cur === 'Cancelled' ? 'Cancelled' :
      cur === 'paused' ? 'Paused' :
      cur === 'active' ? 'Active' :
      cur === 'inactive' ? 'Inactive' :
      cur === 'completed' ? 'Completed' : null;

    this.statusControl.setValue(normalized);
    this.statusModalVisible = true;
    this.cdr.markForCheck();
  }

  handleStatusCancel(): void {
    this.statusModalVisible = false;
    this.statusControl.reset(null);
    this.cdr.markForCheck();
  }

  confirmUpdateStatus(): void {
    if (this.statusControl.invalid || !this.treatmentId) return;

    const userId = this.auth.getUserId() || 0;

    const payload = {
      patientTreatmentId: this.treatmentId,
      treatmentStatus: this.statusControl.value!,
      userId
    };

    this.isUpdatingStatus = true;

    this.generalService
      .updateTreatmentStatus(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res?.status === 1) {
            this.generalService.showSuccess?.('Treatment status updated successfully');
            this.statusModalVisible = false;
            this.getTreatmentDetails();
          } else {
            this.generalService.showError?.(res?.message || 'Failed to update status');
          }
          this.isUpdatingStatus = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.generalService.showError?.(err?.error?.message || err?.message || 'Failed to update status');
          this.isUpdatingStatus = false;
          this.cdr.markForCheck();
        }
      });
  }

  checkAppointmentEligibility(slot:any):boolean{

    if(this.slots[slot].status == "Pending" || this.slots[slot].status == "Pending - Rescheduled for Followup") {
      if (this.slots[slot].providerScheduledSlotId == null) {
        if (this.slots[slot - 1] != undefined || this.slots[slot - 1] != null) {
          if (this.slots[slot - 1].status == "Completed") {
            let date: Date = new Date();
            let checkDate: Date = new Date(this.slots[slot - 1].startDate);
            checkDate.setDate(checkDate.getDate() + 30)
            if (date > checkDate) {
              return false;
            } else {
              return true;
            }
          } else {
            return true;
          }
        } else {
          return true;
        }
      }
      else{
        return true;
      }
    }
      else {
        return true;
      }
    }

  isFollowUpAvailableForRow(slot: any, index: number): boolean {
    if (!slot) return false;
    if (!slot?.patientAppointmentSlotId || !slot?.providerId) return false;
    return !this.checkAppointmentEligibility(index);
  }

  get hasFollowUpSchedulingAvailable(): boolean {
    return this.slots.some((slot, index) => this.isFollowUpAvailableForRow(slot, index));
  }

  toggleRecurring(){
    this.treatmentData.isRecurring = !this.treatmentData.isRecurring;
    this.toggleLoading=true;
    this.cdr.markForCheck();

    this.generalService.toggleRecurringPayment(this.treatmentId).subscribe({
      next: (res : any) => {
        if(res.status == 1){
          this.generalService.showInfo(res.message);
        }
        this.getTreatmentDetails();
        this.toggleLoading=false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.generalService.showError(err?.error?.message || err?.message || 'Failed to toggle recurring payment.');
        this.getTreatmentDetails();
        this.toggleLoading=false;
        this.cdr.markForCheck();
      }
    })
  }

  openRefillRequest(): void {

    if(this.treatmentData.treatmentStatus != 'Active' && this.treatmentData.treatmentStatus !== 'active'){
      this.generalService.showInfo('Cannot proceed while treatment is not active.');
      return;
    }
    else {
      if (this.userRole == "Global Admin") {
        this.modal.confirm({
          nzTitle: 'Confirm',
          nzContent: 'Are you sure, you want to mark the refill as fulfilled?',
          nzIconType: 'question-circle',
          nzOnOk: () => this.requestRefill(),
        });
      } else if (this.userRole == 'Patient') {
        this.modal.confirm({
          nzTitle: 'Confirm',
          nzContent: 'Are you sure, you want to request a refill?',
          nzIconType: 'question-circle',
          nzOnOk: () => this.requestRefill(),
        });
      }
    }
  }

  requestRefill(){
    this.refillRequestLoading = true;
    this.cdr.markForCheck();

    this.generalService.RequestRefill(this.treatmentId).subscribe({
      next: (res) => {
        this.getTreatmentDetails();
        this.refillRequestLoading=false;
        this.generalService.showSuccess(res?.message);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.getTreatmentDetails();
        this.refillRequestLoading=false;
        this.generalService.showError(err.error.message);
        this.cdr.markForCheck();
      }
    })
  }

  sendIntakeForm(): void {
    this.modal.confirm({
      nzTitle: 'Confirm',
      nzContent: 'Are you sure you want to resend the intake form for this treatment?',
      nzIconType: 'question-circle',
      nzOnOk: () => {
        this.sendingIntakeFormReminder = true;
        this.cdr.markForCheck();

        this.generalService
          .sendTreatmentQuestionnaireReminder(this.treatmentId)
          .pipe(
            finalize(() => {
              this.sendingIntakeFormReminder = false;
              this.cdr.markForCheck();
            }),
            takeUntil(this.destroy$)
          )
          .subscribe({
            next: (res: any) => {
              if (res?.success === true || res?.status === 1) {
                this.generalService.showSuccess(res?.message || 'Intake form reminder sent successfully.');
              } else {
                this.generalService.showError(res?.message || 'Failed to send intake form reminder.');
              }
            },
            error: () => {
              this.generalService.showError('Failed to send intake form reminder.');
            },
          });
      },
    });
  }

  viewDocument(doc: any): void {
    this.openRelatedEntityTab('document', doc);
  }

  onEmbeddedTabNavigate = (request: EmbeddedTabNavigationRequest): void => {
    if (!request?.type) return;

    const shouldRefreshTreatment = !!request?.data?.refreshTreatmentDetails;
    const keepCurrentTab = !!request?.data?.keepCurrentTab;
    if (shouldRefreshTreatment) {
      this.getTreatmentDetails(keepCurrentTab);
      if (keepCurrentTab) return;
    }

    if (request.type === 'treatmentMain') {
      this.activeRelatedTabKey = this.treatmentMainTabKey;
      this.cdr.markForCheck();
      return;
    }

    const entityId = Number(request.id || 0);
    if (!entityId && request.type !== 'document' && !request.data) return;

    const tabData = request.data || this.buildFallbackRelatedTabData(request.type, entityId);
    this.openRelatedEntityTab(request.type, tabData);
  };

  private buildFallbackRelatedTabData(type: RelatedEntityType, entityId: number): any {
    switch (type) {
      case 'appointment':
        return (
          this.slots.find((s) => Number(s?.patientAppointmentSlotId || 0) === entityId) || {
            patientAppointmentSlotId: entityId
          }
        );
      case 'prescription':
        return (
          this.prescriptions.find((p) => Number(p?.patientPrescriptionId || 0) === entityId) || {
            patientPrescriptionId: entityId
          }
        );
      case 'order':
        return (
          this.orders.find((o) => Number(o?.patientOrderId || 0) === entityId) || {
            patientOrderId: entityId
          }
        );
      case 'soapNote':
        return (
          this.soapNotes.find((sn) => Number(sn?.soapNoteId || 0) === entityId) || {
            soapNoteId: 0,
            patientTreatmentId: entityId || this.treatmentId,
            patientName: this.getTreatmentPatientName(),
            isNew: true
          }
        );
      case 'document':
      default:
        return {};
    }
  }

  private getRelatedEntityId(type: RelatedEntityType, data: any): number | string {
    switch (type) {
      case 'appointment':
        return Number(data?.patientAppointmentSlotId || 0);
      case 'prescription':
        return Number(data?.patientPrescriptionId || 0);
      case 'order':
        return Number(data?.patientOrderId || 0);
      case 'soapNote': {
        const soapNoteId = Number(data?.soapNoteId || 0);
        if (soapNoteId > 0) return soapNoteId;
        const patientTreatmentId = Number(data?.patientTreatmentId || this.treatmentId || 0);
        return patientTreatmentId > 0 ? `new-${patientTreatmentId}` : '';
      }
      case 'document':
        return Number(data?.patientTreatmentDocumentId || 0) || String(data?.documentUrl || '');
      default:
        return '';
    }
  }

  private buildRelatedTabTitle(type: RelatedEntityType, data: any): string {
    switch (type) {
      case 'appointment':
        return `Appointment #${data?.patientAppointmentSlotId || '-'}`;
      case 'prescription':
        return `Prescription #${data?.patientPrescriptionId || '-'}`;
      case 'order':
        return `Order #${data?.patientOrderId || '-'}`;
      case 'soapNote':
        return Number(data?.soapNoteId || 0) > 0
          ? `SOAP Note #${data?.soapNoteId}`
          : 'New SOAP Note';
      case 'document':
        return data?.documentName || `Document #${data?.patientTreatmentDocumentId || '-'}`;
      default:
        return 'Detail';
    }
  }

  private openRelatedEntityTab(type: RelatedEntityType, data: any): void {
    const entityId = this.getRelatedEntityId(type, data);
    if (!entityId) return;

    const key = `${type}-${entityId}`;
    const existingTab = this.relatedTabs.find((tab) => tab.key === key);
    if (existingTab) {
      existingTab.data = data;
      existingTab.title = this.buildRelatedTabTitle(type, data);
      this.activeRelatedTabKey = existingTab.key;
      this.cdr.markForCheck();
      return;
    }

    if (type === 'soapNote' && Number(data?.soapNoteId || 0) > 0) {
      const treatmentId = Number(data?.patientTreatmentId || this.treatmentId || 0);
      const pendingKey = `soapNote-new-${treatmentId}`;
      const pendingTab = this.relatedTabs.find((tab) => tab.key === pendingKey);
      if (pendingTab) {
        pendingTab.key = key;
        pendingTab.data = data;
        pendingTab.title = this.buildRelatedTabTitle(type, data);
        this.relatedTabs = [...this.relatedTabs];
        this.activeRelatedTabKey = key;
        this.cdr.markForCheck();
        return;
      }
    }

    const tab: RelatedEntityTab = {
      key,
      type,
      title: this.buildRelatedTabTitle(type, data),
      data
    };

    if (type === 'document' && data?.documentUrl) {
      tab.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(data.documentUrl);
    }

    this.relatedTabs = [...this.relatedTabs, tab];
    this.activeRelatedTabKey = tab.key;
    this.cdr.markForCheck();
  }

  get selectedRelatedTabIndex(): number {
    if (this.activeRelatedTabKey === this.treatmentMainTabKey) return 0;
    const detailTabIndex = this.relatedTabs.findIndex(
      (tab) => tab.key === this.activeRelatedTabKey
    );
    return detailTabIndex >= 0 ? detailTabIndex + 1 : 0;
  }

  onRelatedTabIndexChange(index: number): void {
    if (index <= 0) {
      this.activeRelatedTabKey = this.treatmentMainTabKey;
      return;
    }

    const selectedTab = this.relatedTabs[index - 1];
    this.activeRelatedTabKey = selectedTab?.key ?? this.treatmentMainTabKey;
  }

  onRelatedTabClose(event: { index: number } | number): void {
    const closedIndex =
      typeof event === 'number' ? Number(event) : Number(event?.index ?? -1);
    if (closedIndex <= 0) return;

    const tab = this.relatedTabs[closedIndex - 1];
    if (!tab) return;
    this.closeRelatedTab(tab.key);
  }

  closeRelatedTab(tabKey: string): void {
    const closingIndex = this.relatedTabs.findIndex((tab) => tab.key === tabKey);
    if (closingIndex < 0) return;

    const wasActive = this.activeRelatedTabKey === tabKey;
    this.relatedTabs = this.relatedTabs.filter((tab) => tab.key !== tabKey);

    if (wasActive) {
      const fallbackTab =
        this.relatedTabs[closingIndex - 1] ?? this.relatedTabs[closingIndex] ?? null;
      this.activeRelatedTabKey = fallbackTab?.key ?? this.treatmentMainTabKey;
    }

    this.cdr.markForCheck();
  }

  getTabComponent(tab: RelatedEntityTab): any {
    switch (tab.type) {
      case 'appointment':
        return AppointmentDetailViewComponent;
      case 'prescription':
        return PrescriptionDetailViewComponent;
      case 'order':
        return OrderDetailViewComponent;
      case 'soapNote':
        return SOAPNotesComponent;
      default:
        return null;
    }
  }

  getTabComponentModule(tab: RelatedEntityTab): any {
    switch (tab.type) {
      case 'appointment':
        return ScheduleModule;
      case 'prescription':
        return PrescriptionModule;
      case 'order':
        return OrderModule;
      case 'soapNote':
        return PrescriptionModule;
      default:
        return null;
    }
  }

  getTabComponentInputs(tab: RelatedEntityTab): Record<string, any> {
    switch (tab.type) {
      case 'appointment':
        return {
          appointmentIdInput: Number(tab.data?.patientAppointmentSlotId || 0),
          embeddedInTabs: true,
          openInTreatmentTabs: this.onEmbeddedTabNavigate
        };
      case 'prescription':
        return {
          prescriptionIdInput: Number(tab.data?.patientPrescriptionId || 0),
          embeddedInTabs: true,
          openInTreatmentTabs: this.onEmbeddedTabNavigate
        };
      case 'order':
        return {
          orderIdInput: Number(tab.data?.patientOrderId || 0),
          embeddedInTabs: true,
          openInTreatmentTabs: this.onEmbeddedTabNavigate
        };
      case 'soapNote':
        return {
          patientTreatmentIdInput: Number(tab.data?.patientTreatmentId || this.treatmentId || 0),
          patientNameInput: String(tab.data?.patientName || this.getTreatmentPatientName() || '').trim(),
          soapNoteInput: tab.data || null,
          embeddedInTabs: true,
          openInTreatmentTabs: this.onEmbeddedTabNavigate
        };
      default:
        return {};
    }
  }

  isImageDocument(url: string | null | undefined): boolean {
    if (!url) return false;
    const cleanUrl = (url.split('?')[0] ?? '').toLowerCase();
    return (
      cleanUrl.endsWith('.png') ||
      cleanUrl.endsWith('.jpg') ||
      cleanUrl.endsWith('.jpeg') ||
      cleanUrl.endsWith('.gif') ||
      cleanUrl.endsWith('.webp') ||
      cleanUrl.endsWith('.bmp') ||
      cleanUrl.endsWith('.svg')
    );
  }

  trackByRelatedTabKey(_index: number, tab: RelatedEntityTab): string {
    return tab.key;
  }

  private getTreatmentPatientName(): string {
    const firstName = String(this.treatmentData?.firstName || '').trim();
    const lastName = String(this.treatmentData?.lastName || '').trim();
    return `${firstName} ${lastName}`.trim();
  }

  uploadDocument = () => {

    if (this.treatmentData.treatmentStatus != 'Active' && this.treatmentData.treatmentStatus !== 'active'){
      this.generalService.showInfo('Cannot upload documents while treatment is not active.');
    }
    else {
      let title: string = 'Upload Document';
      const ID = this.treatmentId || 0;
      const formPath = 'treatment/uploadDocument.json';
      this.commanModel.showModal(title, 'form', formPath, ID);
    }
  };

  setNewAppointment(slot: any): void {

    const apptId = slot?.patientAppointmentSlotId || 0;
    const providerId = slot?.providerId || 0;

    if (!apptId) {
      this.generalService.showError('Unable to continue — patientAppointmentSlotId not found.');
      return;
    }
    if (!providerId) {
      this.generalService.showError('Unable to continue — providerId not found.');
      return;
    }

    this.followUpPatientAppointmentSlotId = apptId;
    this.followUpProviderId = providerId;

    this.resetFollowUpForm();

    this.isFollowUpApptVisible = true;
    this.cdr.markForCheck();
  }

  private resetFollowUpForm(): void {
    this.isSubmittingFollowUp = false;

    this.followUpSelectedDate = null;
    this.followUpFormattedDate = null;

    this.followUpAvailableSlots = [];
    this.followUpSelectedProviderScheduledSlotId = null;

    this.followUpSlotsError = null;
    this.followUpLoadingSlots = false;
  }

  handleCancelFollowUpAppointment(): void {
    this.isFollowUpApptVisible = false;
    this.resetFollowUpForm();

    this.followUpPatientAppointmentSlotId = null;
    this.followUpProviderId = null;

    this.cdr.markForCheck();
  }

  onFollowUpDateChange(date: Date | null): void {
    if (date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      this.followUpFormattedDate = `${year}-${month}-${day}`;
      this.loadFollowUpSlotsForDate(this.followUpFormattedDate);
    } else {
      this.followUpFormattedDate = null;
      this.followUpAvailableSlots = [];
      this.followUpSlotsError = null;
      this.cdr.markForCheck();
    }
  }

  private loadFollowUpSlotsForDate(dateStr: string): void {
    const providerId = this.followUpProviderId;

    if (!providerId) {
      this.followUpAvailableSlots = [];
      this.followUpSlotsError = 'Provider not found for this appointment.';
      this.cdr.markForCheck();
      return;
    }

    this.followUpLoadingSlots = true;
    this.followUpSlotsError = null;

    this.generalService
      .commonGet(`DropDowns/getProviderScheduledSlotsByProvider?ProviderId=${providerId}&Date=${dateStr}&ClientTimezoneOffsetMinutes=${-new Date().getTimezoneOffset()}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const all = Array.isArray(res?.data) ? res.data : [];
          const target = this.followUpFormattedDate;

          this.followUpAvailableSlots = target
            ? all.filter((s: any) => (s?.slotDate || '').split('T')[0] === target)
            : all;

          this.followUpLoadingSlots = false;
          this.cdr.markForCheck();
        },
        error: (_err) => {
          this.followUpLoadingSlots = false;
          this.followUpAvailableSlots = [];
          this.followUpSlotsError = 'Failed to load slots.';
          this.cdr.markForCheck();
        }
      });
  }

  getFollowUpSlotLabel(s: {
    slotDate: string; startTime: string; endTime: string; duration: number;
  }): string {
    const date = (s.slotDate || '').split('T')[0];
    return `${date} ${s.startTime} - ${s.endTime} • ${s.duration} mins`;
  }

  canSubmitFollowUp(): boolean {
    return !!(
      this.followUpPatientAppointmentSlotId &&
      this.followUpSelectedProviderScheduledSlotId &&
      !this.isSubmittingFollowUp
    );
  }

  submitFollowUpAppointment(): void {
    if (!this.canSubmitFollowUp()) return;

    const userId = this.auth.getUserId() || 0;

    const payload = {
      patientAppointmentSlotId: this.followUpPatientAppointmentSlotId,
      providerScheduledSlotId: this.followUpSelectedProviderScheduledSlotId,
      userId
    };

    this.isSubmittingFollowUp = true;
    this.cdr.markForCheck();

    this.generalService
      .commonPost('PatientAppointments/updateAppointmentForFollowUp', payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isSubmittingFollowUp = false;

          if (res?.status === 1) {
            this.generalService.showSuccess?.(res?.message || 'Appointment updated successfully.');
            this.isFollowUpApptVisible = false;

            this.getTreatmentDetails();

            this.resetFollowUpForm();
            this.followUpPatientAppointmentSlotId = null;
            this.followUpProviderId = null;
          } else {
            this.generalService.showError?.(res?.message || 'Failed to update appointment.');
          }

          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSubmittingFollowUp = false;
          this.generalService.showError?.(err?.error?.message || err?.message || 'Failed to update appointment.');
          this.cdr.markForCheck();
        }
      });
  }

  get fullscriptPatientPayload(): FullscriptPatientPayload | undefined {
    if (!this.treatmentData) return undefined;

    const payload: FullscriptPatientPayload = {};

    if (this.treatmentData.firstName) payload.firstName = this.treatmentData.firstName;
    if (this.treatmentData.lastName) payload.lastName = this.treatmentData.lastName;
    if (this.treatmentData.email) payload.email = this.treatmentData.email;

    const dob = this.formatDobYmd(this.treatmentData.dob);
    if (dob) payload.dateOfBirth = dob;

    if (this.treatmentData.phoneNumber) payload.mobileNumber = this.treatmentData.phoneNumber;

    return Object.keys(payload).length ? payload : undefined;
  }

  private formatDobYmd(input: unknown): string | null {
    if (!input) return null;

    if (typeof input === 'string') {
      const trimmed = input.trim();

      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
      }

      const maybe = trimmed.split('T')[0];
      if (maybe && /^\d{4}-\d{2}-\d{2}$/.test(maybe)) {
        return maybe;
      }
    }

    const d = input instanceof Date ? input : new Date(String(input));
    if (isNaN(d.getTime())) return null;

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  openFullscriptModal(): void {
    this.isFullscriptModalVisible = true;
    this.cdr.markForCheck();
  }

  closeFullscriptModal(): void {
    this.isFullscriptModalVisible = false;
    this.cdr.markForCheck();
  }

}
