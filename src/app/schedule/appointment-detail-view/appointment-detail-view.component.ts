import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { Location } from "@angular/common";
import { GeneralService } from 'app/shared/services/general.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from 'app/shared/Auth/auth.service';
import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';
import { TitleService } from 'app/shared/services/title.service';
import { getUnifiedStatusBadgeClass } from 'app/shared/utils/status-badge.util';

interface InTakeForm {
  questionaireName: string,
  inTakeForm: Array<{ question: string; answer: string; otherText: string; type: string }>
}

interface TreatmentApi {
  patientTreatmentId: number | null;
  treatmentGuid: string | null;
  treatmentStatus: string | null;
  productId: number | null;
  bundleName: string | null;
  providerScheduledSlotId: number | null;
  createdDate: string | null;
  modifiedDate: string | null;
  expiryDate: string | null;
}

interface Appointment {
  patientId: number
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  address: string
  gender: string
  dob: string
  patientAppointmentId: number
  productId: number
  productName: string
  startDate: string
  duration: number
  startTime: string
  endTime: string
  providerId: number
  providerName: string
  treatment?: TreatmentApi | null
  zoomJoinUrl?: string | null
  status:string
}

interface TreatmentViewRow {

  startDate: string | null;
  name: string | null;
  bundleName: string | null;
  frequency: string | number | null;
  price: number | null;
  prescriptionsCount: number | null;
  orderCount: number | null;
  status: 'Completed' | 'Active' | 'Paused' | 'Canceled' | string | null;

  patientTreatmentId: number | null;
}

type EmbeddedTabNavigationRequest = {
  type: 'appointment' | 'prescription' | 'order' | 'soapNote' | 'treatmentMain';
  id?: number;
  data?: any;
};

@Component({
  selector: 'app-appointment-detail-view',
  templateUrl: './appointment-detail-view.component.html',
  styleUrl: './appointment-detail-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppointmentDetailViewComponent {
  @Input() appointmentIdInput: number | null = null;
  @Input() embeddedInTabs = false;
  @Input() openInTreatmentTabs: ((request: EmbeddedTabNavigationRequest) => void) | null = null;

  showUpdateAppointmentModal: boolean = false;
  selectedStatus: string = '';
  selectedAppointmentId: number | null = null;
  savingStatus: boolean = false;
  meetingWindowOpen: boolean = false;
  private meetingWindow: Window | null = null;
  private meetingPollInterval: any = null;

  @ViewChild('commanModel', { static: false }) commanModel!: CommanFormModalComponent;
  activeTab: string = 'Prescription';
  intakeFormData: InTakeForm[] | null = null;
  modalApiUrl: { save?: string; get?: string } = {
    save: '',
    get: ''
  };
  appointmentId: number = 0;
  apptData: Appointment | null = null;
  isLoading: boolean = false;
  loadingIntakeForm: boolean = false;
  readonly facilityGuid: string = localStorage.getItem('FOSG') || '';
  private destroy$ = new Subject<void>();
  userRole: string = '';

  constructor(
    private cdr: ChangeDetectorRef,
    private _location: Location,
    private route: ActivatedRoute,
    private router: Router,
    private generalService: GeneralService,
    private auth: AuthService,
    private titleService: TitleService
  ) {
  }

  ngOnInit(): void {
    this.userRole = this.auth.getUserRole() || '';
    this.resolveAndLoadAppointment();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['appointmentIdInput'] && !changes['appointmentIdInput'].firstChange) {
      this.resolveAndLoadAppointment();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.meetingPollInterval) clearInterval(this.meetingPollInterval);
  }

  private resolveAndLoadAppointment(): void {
    const inputId = Number(this.appointmentIdInput || 0);
    const routeId = Number(this.route.snapshot.paramMap.get('id') || 0);
    const resolvedId = inputId > 0 ? inputId : routeId;

    if (!resolvedId) {
      this.apptData = null;
      this.isLoading = false;
      this.cdr.markForCheck();
      return;
    }

    if (this.appointmentId !== resolvedId) {
      this.appointmentId = resolvedId;
      this.getApptData();
      return;
    }

    if (!this.apptData && !this.isLoading) {
      this.getApptData();
    }
  }

  get treatmentViewRows(): any[] {
    const t = this.apptData?.treatment;
    if (!t) return [];

    return [this.toViewRow(t)];
  }

  private toViewRow(t: any): any {

    return {
      treatmentId : t.patientTreatmentId,
      startDate: t.createdDate ?? this.apptData?.startDate ?? null,
      name: t.name,
      bundleName: t.bundleName ?? this.apptData?.productName ?? null,
      frequency: t.frequency,
      price: t.price,
      prescriptionsCount: t.prescriptionsCount,
      orderCount: t.orderCount,
      status: (t.treatmentStatus as any) ?? null,

      patientTreatmentId: t.patientTreatmentId ?? null
    };
  }

  getApptData() {
    if (!this.appointmentId) return;
    this.isLoading = true;
    this.generalService.commonGet(`PatientAppointments/getPatientAppointmentInfo?Id=${this.appointmentId}&ClientTimezoneOffsetMinutes=${-new Date().getTimezoneOffset()}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.status === 1 && response?.data) {
            this.apptData = response.data;
            if (!this.embeddedInTabs) {
              this.titleService.updateTitle(
                `${response.data.firstName} ${response.data.lastName}`,
                [
                  { label: 'Appointments', path: '/schedule/calendar' },
                  { label: 'Appointment Detail', path: `/schedule/appointment/detail/${this.appointmentId}` }
                ]
              );
            }
            this.isLoading = false;
          } else {
            console.warn('Failed to fetch Appointment data:', response?.message);
            this.apptData = null;
            this.isLoading = false;
          }
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('API Error:', error);
          this.apptData = null;
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '--';
    const isDefault = value.startsWith('0001-01-01');
    if (isDefault) return '--';
    const d = new Date(value);
    return isNaN(d.getTime()) ? '--' : d.toLocaleDateString();
  }

  formatPrice(value: number | null | undefined): string {
    if (value === null || value === undefined) return '--';
    const num = Number(value);
    if (isNaN(num)) return '--';
    return `$${num.toFixed(2)}`;
  }

  getStatusClass(status: string | null | undefined): string {
    return getUnifiedStatusBadgeClass(status);
  }

  get canUpdateAppointmentStatus(): boolean {
    return this.userRole === 'Provider' || this.userRole === 'Global Admin';
  }

  get canJoinMeeting(): boolean {
    return this.userRole === 'Provider' || this.userRole === 'Patient' || this.userRole === 'Global Admin';
  }

  private requestEmbeddedTabOpen(request: EmbeddedTabNavigationRequest): boolean {
    if (!this.embeddedInTabs || !this.openInTreatmentTabs) return false;
    this.openInTreatmentTabs(request);
    return true;
  }

  openTreatment(patientTreatmentId: number | null): void {
    if (!patientTreatmentId) return;
    if (this.requestEmbeddedTabOpen({ type: 'treatmentMain', id: patientTreatmentId })) return;
    this.router.navigate([`/treatment/detail/${patientTreatmentId}`]);
  }

  onTabChange(event: any): void {
    this.activeTab = event.tab.nzTitle;
    this.cdr.detectChanges();
  }

  moveBack() {
    if (this.embeddedInTabs) return;
    this._location.back();
  }

  editPrescription = (data: any): void => {
    const title: string = 'Update Prescription';
    const ID = data?.id || 0
    const formPath = 'edit-prescription-form.json';
    this.commanModel.showModal(title, 'form', formPath, ID)
  }

  openZoomMeeting(): void {
    if (!this.apptData?.zoomJoinUrl) {
      this.generalService.showInfo('No Zoom Meeting link found for this appointment');
      return;
    }

    this.meetingWindow = window.open(this.apptData.zoomJoinUrl, '_blank');

    this.meetingWindowOpen = true;
    this.cdr.markForCheck();
    if (this.meetingWindow) {
      this.startMeetingPoll();
    }
  }

  private startMeetingPoll(): void {
    this.meetingPollInterval = setInterval(() => {
      if (this.meetingWindow?.closed) {
        this.meetingWindowOpen = false;
        this.meetingWindow = null;
        clearInterval(this.meetingPollInterval);
        this.cdr.markForCheck();
      }
    }, 1000);
  }

  rejoinMeeting(): void {
    if (this.meetingWindow && !this.meetingWindow.closed) {
      this.meetingWindow.focus();
    } else {
      this.openZoomMeeting();
    }
  }

  endMeeting(): void {
    if (this.meetingWindow && !this.meetingWindow.closed) {
      this.meetingWindow.close();
    }
    this.meetingWindowOpen = false;
    this.meetingWindow = null;
    if (this.meetingPollInterval) clearInterval(this.meetingPollInterval);
    this.cdr.markForCheck();
  }

  trackByTreatmentId = (_: number, item: TreatmentViewRow) => item?.patientTreatmentId ?? 0;

  updateApptStatus() {
    this.showUpdateAppointmentModal = true;
    this.selectedAppointmentId = this.appointmentId;
    this.selectedStatus = this.apptData?.status || '';
    this.cdr.markForCheck();
  }

  handleCancelUpdateAppointment(){
    this.showUpdateAppointmentModal = false;
  }

  handleUpdateAppointment(){

    if(this.selectedStatus === '' || this.selectedStatus === null || this.selectedStatus === undefined){
      this.generalService.showError('Please select a status')
    }
    else{
      this.savingStatus = true;
      let payload = {
        appointmentId: this.selectedAppointmentId,
        status: this.selectedStatus
      }

      this.generalService.updateAppointmentStatus(payload).subscribe({
        next: (res) => {
          console.log('res', res);
          this.generalService.showSuccess('Appointment status updated successfully');
          this.showUpdateAppointmentModal = false;
          this.selectedStatus = ''
          this.getApptData();
          this.savingStatus = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.savingStatus = false;
          this.generalService.showError(err?.message || 'Failed to update appointment status');
          this.cdr.markForCheck();
        }
      })
    }

    console.log(this.selectedAppointmentId);
    console.log(this.selectedStatus)

  }

}
