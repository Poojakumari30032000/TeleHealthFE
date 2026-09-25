import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  SimpleChanges,
  SkipSelf,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from "@angular/common";
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';
import { TitleService } from 'app/shared/services/title.service';
import { GeneralService } from 'app/shared/services/general.service';
import { finalize, Subject, takeUntil } from 'rxjs';
import {AuthService} from "../../shared/Auth/auth.service";
import { getUnifiedStatusBadgeClass } from 'app/shared/utils/status-badge.util';
import { ChatService } from 'app/chat/chat.service';
import { NzModalService } from 'ng-zorro-antd/modal';
import { PermissionsService } from 'app/shared/permission/permissions.service';

/** Roles the questionnaire assignment endpoints accept (TEL-57). */
const QUESTIONNAIRE_STAFF_ROLES = ['Super Admin', 'Global Admin', 'Clinic Admin', 'Provider'];

interface PatientData {
  patientId: number;
  userId: number;
  mrn: string;
  createdDate: string;
  createdBy: string;
  modifiedBy: string | null;
  modifiedDate: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  phoneType: number | null;
  address: string;
  gender: string;
  dateOfBirth: string;
  pharmacyId: number | null;
  pharmacyName: string | null;
  providerId: number | null;
  providerName: string | null;
  visitStatus: string | null;
  numberOfOrders: number | null;
  treatments: number | null;
  lastOrderPrice: number | null;
  height: string | null;
  weight: string | null;
  bmi: number | null;
  dateStarted: string | null;
  lastOrderDate: string | null;
  nextVisitDate: string | null;
  nextShippingDate: string | null;
  facilityId: number;
  patientPicture: string | null;
  idPicture: string | null;
  facilityName: string;
  documents?: PatientDocument[] | null;
}

interface PatientDocument {
  patientDocumentId?: number;
  patientId?: number;
  documentName?: string | null;
  description?: string | null;
  documentUrl?: string | null;
  createdByName?: string | null;
  createdDate?: string | null;
}

interface TreatmentHistoryRow {
  patientTreatmentId: number;
  startDate: string | null;
  name: string | null;
  bundleName: string | null;
  frequency: string | null;
  price: number | null;
  prescriptionsCount: number | null;
  orderCount: number | null;
  status: string | null;
  refillStatus: string | null;
}

interface InvoiceHistoryRow {
  paymentId: number;
  invoiceId?: number | null;
  date: string | null;
  id: string | number | null;
  paymentStatus: string | null;
  totalPrice: number | null;
  finalPrice: number | null;
}

interface PatientProfileNote {
  patientProfileNoteId: number;
  patientId: number;
  noteText: string;
  createdBy: number;
  createdByName: string | null;
  createdDate: string | null;
  modifiedBy: number | null;
  modifiedByName: string | null;
  modifiedDate: string | null;
}

interface AuditLog {
  auditLogId: number;
  action: 'Create' | 'Update' | 'Delete' | string;
  module: string;
  entityType: string;
  entityId: number;
  userId: number;
  userName: string;
  description: string;
  status: 'Success' | 'Failed' | string;
  errorMessage: string | null;
  createdDate: string;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  additionalData: any | null;
  requestPath: string | null;
  requestMethod: string | null;
  ipAddress: string | null;
  facilityName: string;
}

interface AuditLogGroup {
  label: string;
  logs: AuditLog[];
}

type EmbeddedPatientTabNavigationRequest = {
  type: 'treatment' | 'invoice' | 'patientMain';
  id?: number;
  data?: any;
};

type PatientRelatedEntityType = 'document';

interface PatientRelatedTab {
  key: string;
  type: PatientRelatedEntityType;
  title: string;
  data: PatientDocument;
  safeUrl?: SafeResourceUrl;
}

@Component({
  selector: 'app-patient-detail-view',
  templateUrl: './patient-detail-view.component.html',
  styleUrl: './patient-detail-view.component.css',
  providers: [ChatService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientDetailViewComponent {
  @Input() patientIdInput: number | null = null;
  @Input() embeddedInTabs = false;
  @Input() openInPatientTabs:
    | ((request: EmbeddedPatientTabNavigationRequest) => void)
    | null = null;
  @Output() backToList = new EventEmitter<void>();

  @ViewChild('commanModel', { static: false }) commanModel!: CommanFormModalComponent;
  readonly patientMainTabKey = 'patient-main';
  activeRelatedTabKey = this.patientMainTabKey;
  relatedTabs: PatientRelatedTab[] = [];
  modalApiUrl : { save?: string; get?: string } = {
    save : '',
    get : ''
  };
  userRole : string | null = null
  patientId : number | null = 0;
  patientData: PatientData | null = null;
  hasError: boolean = false;
  isLoading: boolean = false;
  private destroy$ = new Subject<void>();

  patientPictureLoadError = false;
  idPictureLoadError = false;
  historyTreatments: TreatmentHistoryRow[] = [];
  historyInvoices: InvoiceHistoryRow[] = [];
  documents: PatientDocument[] = [];
  historyLoadingTreatments = false;
  historyLoadingInvoices = false;
  profileNotes: PatientProfileNote[] = [];
  notesLoading = false;
  notesSaving = false;
  deletingNoteId: number | null = null;
  editingNoteId: number | null = null;
  noteFetchingId: number | null = null;
  noteDraft = '';

  sendingReminderIds = new Set<number>();
  sendingInvoiceReminderIds = new Set<number>();

  moveFacilityModalVisible = false;
  moveFacilityList: Array<{ facilityId: number; titlelong?: string; titleshort?: string }> = [];
  moveFacilityListLoading = false;
  moveFacilitySelectedId: number | null = null;
  movingPatient = false;

  activityLogs: AuditLog[] = [];
  activityLogGroups: AuditLogGroup[] = [];
  activityLogsLoading = false;
  activityLogsLoaded = false;
  activityLogsPage = 1;
  activityLogsPageSize = 20;
  activityLogsTotalPages = 1;
  expandedLogIds = new Set<number>();

  constructor(
    private route : Router,
    private cdr: ChangeDetectorRef,
    private _location: Location,
    private titleService: TitleService,
    private generalService: GeneralService,
    private router: ActivatedRoute,
    private auth : AuthService,
    private sanitizer: DomSanitizer,
    private modal: NzModalService,
    private permissions: PermissionsService,

    @SkipSelf() private rootChatService: ChatService,
  ){
  }

  ngOnInit(): void {
    this.userRole = this.auth.getUserRole();
    this.resolveAndLoadPatient();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patientIdInput'] && !changes['patientIdInput'].firstChange) {
      this.resolveAndLoadPatient();
    }
  }

  ngOnDestroy(): void{
    this.destroy$.next();
    this.destroy$.complete();
  }

  get canManageNotes(): boolean {
    return this.userRole === 'Global Admin';
  }

  get canViewQuestionnaires(): boolean {
    return !!this.userRole && QUESTIONNAIRE_STAFF_ROLES.includes(this.userRole)
      && this.permissions.hasPermission('patient_view');
  }

  get canAssignQuestionnaires(): boolean {
    return this.canViewQuestionnaires && this.permissions.hasPermission('patient_edit');
  }

  get canMessagePatient(): boolean {
    if (this.userRole === 'Global Admin') return true;

    if (this.userRole === 'Clinic Admin') return this.rootChatService.canViewChannels();
    return false;
  }

  get noteDraftLength(): number {
    return (this.noteDraft || '').length;
  }

  private resolveAndLoadPatient(): void {
    let resolvedPatientId: number | null = null;

    if (this.patientIdInput && this.patientIdInput > 0) {
      resolvedPatientId = this.patientIdInput;
    } else if (this.userRole === 'Patient') {
      resolvedPatientId = this.auth.getPatientId();
    } else {
      const routeId = Number(this.router.snapshot.paramMap.get('id'));
      resolvedPatientId = routeId > 0 ? routeId : null;
    }

    if (!resolvedPatientId) {
      this.patientId = 0;
      this.patientData = null;
      this.hasError = true;
      this.isLoading = false;
      this.cdr.markForCheck();
      return;
    }

    if (this.patientId !== resolvedPatientId) {
      this.patientId = resolvedPatientId;
      this.relatedTabs = [];
      this.activeRelatedTabKey = this.patientMainTabKey;
      this.getPatientDetails();
    } else if (!this.patientData && !this.isLoading) {
      this.getPatientDetails();
    }
  }

  getPatientDetails(): void {

    if(!this.patientId)return;
    this.isLoading = true;
    this.hasError = false;
    this.patientPictureLoadError = false;
    this.idPictureLoadError = false;
    this.historyTreatments = [];
    this.historyInvoices = [];
    this.documents = [];
    this.profileNotes = [];
    this.resetNoteComposer();
    this.activityLogs = [];
    this.activityLogGroups = [];
    this.activityLogsLoaded = false;
    this.activityLogsPage = 1;
    this.expandedLogIds.clear();

    const clientTimezoneOffsetMinutes = -new Date().getTimezoneOffset();

    this.generalService.commonGet(`Patients/getPatientDetails?Id=${this.patientId}&ClientTimezoneOffsetMinutes=${clientTimezoneOffsetMinutes}`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response?.status === 1 && response?.data) {
          this.patientData = response.data;
          this.documents = response.data.documents || [];
          this.loadHistoryData();
          if (!this.embeddedInTabs) {
            this.titleService.updateTitle(
              response.data.firstName + ' ' + response.data.lastName,

            );
          }
        } else {
          console.error(response?.message);
          this.hasError = true;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
        this.hasError = true;
        this.cdr.detectChanges();
      }
    });
  }

  onImageError(type: 'patient' | 'id'): void {
    if (type === 'patient') this.patientPictureLoadError = true;
    if (type === 'id') this.idPictureLoadError = true;
    this.cdr.markForCheck();
  }

  private loadHistoryData(): void {
    this.loadTreatmentHistory();
    this.loadInvoiceHistory();
    this.loadPatientNotes();
  }

  private isApiSuccess(response: any): boolean {
    return response?.status === 1 || response?.success === true;
  }

  private extractDataArray(response: any): any[] {
    if (Array.isArray(response?.data)) {
      return response.data;
    }
    if (Array.isArray(response?.data?.items)) {
      return response.data.items;
    }
    if (Array.isArray(response?.data?.records)) {
      return response.data.records;
    }
    return [];
  }

  private loadTreatmentHistory(): void {
    if (!this.patientId) return;

    this.historyLoadingTreatments = true;
    this.cdr.markForCheck();

    this.generalService
      .commonGet(`Patients/getPatientTreatmentsBundle?Id=${this.patientId}&PageNumber=1&PageSize=200`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          const rows = response?.status === 1 ? this.extractDataArray(response) : [];
          this.historyTreatments = rows as TreatmentHistoryRow[];
          this.historyLoadingTreatments = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.historyTreatments = [];
          this.historyLoadingTreatments = false;
          this.cdr.markForCheck();
        },
      });
  }

  private loadInvoiceHistory(): void {
    if (!this.patientId) return;

    this.historyLoadingInvoices = true;
    this.cdr.markForCheck();

    this.generalService
      .commonGet(`Patients/getPatientPayments?Id=${this.patientId}&PageNumber=1&PageSize=200`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          const rows = response?.status === 1 ? this.extractDataArray(response) : [];
          this.historyInvoices = rows as InvoiceHistoryRow[];
          this.historyLoadingInvoices = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.historyInvoices = [];
          this.historyLoadingInvoices = false;
          this.cdr.markForCheck();
        },
      });
  }

  private loadPatientNotes(): void {
    if (!this.patientId) return;

    this.notesLoading = true;
    this.cdr.markForCheck();

    const clientTimezoneOffsetMinutes = -new Date().getTimezoneOffset();

    this.generalService
      .commonGet(`Patients/getPatientProfileNotes?PatientId=${this.patientId}&ClientTimezoneOffsetMinutes=${clientTimezoneOffsetMinutes}`)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.notesLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (response: any) => {
          const rows = this.isApiSuccess(response) ? this.extractDataArray(response) : [];
          this.profileNotes = (rows as PatientProfileNote[]).sort((a, b) => {
            const aTime = new Date(a.modifiedDate || a.createdDate || '').getTime() || 0;
            const bTime = new Date(b.modifiedDate || b.createdDate || '').getTime() || 0;
            return bTime - aTime;
          });
        },
        error: () => {
          this.profileNotes = [];
        },
      });
  }

  onInnerTabChange(index: number): void {
    if (index === 5 && !this.activityLogsLoaded && !this.activityLogsLoading) {
      this.loadActivityLogs();
    }
  }

  loadActivityLogs(append: boolean = false): void {
    if (!this.patientData?.patientId || this.activityLogsLoading) return;

    if (this.userRole !== 'Global Admin') return;
    if (!append) {
      this.activityLogsPage = 1;
      this.activityLogs = [];
      this.activityLogGroups = [];
    }
    this.activityLogsLoading = true;
    this.cdr.markForCheck();

    this.generalService
      .commonGet(
        `AuditLogs/getPatientAuditLogs?PatientId=${this.patientData.patientId}&PageNumber=${this.activityLogsPage}&PageSize=${this.activityLogsPageSize}`
      )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.activityLogsLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: any) => {
          if (res?.status === 1) {
            const incoming: AuditLog[] = Array.isArray(res.data) ? res.data : [];
            this.activityLogsTotalPages = res.totalPages ?? 1;
            this.activityLogs = append ? [...this.activityLogs, ...incoming] : incoming;
            this.activityLogGroups = this.groupLogsByDate(this.activityLogs);
          }
          this.activityLogsLoaded = true;
        },
        error: () => {
          this.activityLogsLoaded = true;
        },
      });
  }

  loadMoreActivityLogs(): void {
    if (this.activityLogsPage >= this.activityLogsTotalPages) return;
    this.activityLogsPage++;
    this.loadActivityLogs(true);
  }

  private groupLogsByDate(logs: AuditLog[]): AuditLogGroup[] {
    const todayStr     = this.toLocalDateStr(new Date());
    const yesterdayStr = this.toLocalDateStr(new Date(Date.now() - 864e5));
    const map = new Map<string, AuditLog[]>();
    for (const log of logs) {
      const key = this.toLocalDateStr(new Date(log.createdDate));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(log);
    }
    return [...map.entries()].map(([dateStr, entries]) => {
      const label = dateStr === todayStr ? 'Today'
        : dateStr === yesterdayStr ? 'Yesterday'
        : new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return { label, logs: entries };
    });
  }

  private toLocalDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  getActionDotColor(action: string): string {
    return action === 'Create' ? '#10b981'
      : action === 'Update' ? '#f59e0b'
      : action === 'Delete' ? '#ef4444'
      : '#6366f1';
  }

  getModuleIcon(module: string): string {
    const icons: Record<string, string> = {
      Treatment:   'fa-prescription-bottle-medical',
      Invoice:     'fa-file-invoice-dollar',
      Appointment: 'fa-calendar-check',
      Payment:     'fa-credit-card',
    };
    return icons[module] ?? 'fa-circle-info';
  }

  getRelativeTime(iso: string): string {
    const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1)  return 'Just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24)  return `${hr}h ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  getDiffKeys(log: AuditLog): string[] {
    return [...new Set([...Object.keys(log.oldValues ?? {}), ...Object.keys(log.newValues ?? {})])];
  }

  hasDiff(log: AuditLog): boolean {
    return !!(log.oldValues || log.newValues);
  }

  toggleLogExpand(id: number): void {
    this.expandedLogIds.has(id) ? this.expandedLogIds.delete(id) : this.expandedLogIds.add(id);
    this.cdr.markForCheck();
  }

  savePatientNote(): void {
    if (!this.canManageNotes || !this.patientId || this.notesSaving) return;

    const trimmedNote = (this.noteDraft || '').trim();
    if (!trimmedNote) return;

    const isEditing = !!this.editingNoteId;
    const payload: {
      patientProfileNoteId?: number;
      patientId: number;
      noteText: string;
    } = {
      patientId: this.patientId,
      noteText: trimmedNote,
    };

    if (isEditing && this.editingNoteId) {
      payload.patientProfileNoteId = this.editingNoteId;
    }

    this.notesSaving = true;
    this.cdr.markForCheck();

    this.generalService
      .commonPost('Patients/savePatientProfileNote', payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.notesSaving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (response: any) => {
          if (this.isApiSuccess(response)) {
            this.generalService.showSuccess(
              response?.message || (isEditing ? 'Note updated successfully.' : 'Note added successfully.')
            );
            this.resetNoteComposer();
            this.loadPatientNotes();
            return;
          }

          this.generalService.showError(response?.message || 'Failed to save note.');
        },
        error: () => {
          this.generalService.showError('Failed to save note.');
        },
      });
  }

  startEditPatientNote(note: PatientProfileNote): void {
    if (!this.canManageNotes) return;

    const noteId = Number(note?.patientProfileNoteId || 0);
    if (!noteId) return;

    const clientTimezoneOffsetMinutes = -new Date().getTimezoneOffset();
    this.noteFetchingId = noteId;
    this.cdr.markForCheck();

    this.generalService
      .commonGet(
        `Patients/getPatientProfileNoteById?Id=${noteId}&ClientTimezoneOffsetMinutes=${clientTimezoneOffsetMinutes}`
      )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.noteFetchingId = null;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (response: any) => {
          const responseData = this.isApiSuccess(response) ? response?.data : null;
          const noteData = Array.isArray(responseData) ? responseData[0] : responseData;
          this.editingNoteId = noteId;
          this.noteDraft = String(noteData?.noteText || note?.noteText || '');
          this.cdr.markForCheck();
        },
        error: () => {
          this.editingNoteId = noteId;
          this.noteDraft = String(note?.noteText || '');
          this.cdr.markForCheck();
        },
      });
  }

  cancelPatientNoteEdit(): void {
    this.resetNoteComposer();
    this.cdr.markForCheck();
  }

  deletePatientNote(note: PatientProfileNote): void {
    if (!this.canManageNotes || !note?.patientProfileNoteId || this.deletingNoteId) return;

    const payload = {
      id: Number(note.patientProfileNoteId),
      facilityId: Number(this.patientData?.facilityId || this.auth.getUserFacilityId() || 0),
      clientTimezoneOffsetMinutes: -new Date().getTimezoneOffset(),
    };

    this.deletingNoteId = note.patientProfileNoteId;
    this.cdr.markForCheck();

    this.generalService
      .commonDelete('Patients/deletePatientProfileNote', 'profile note', payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          if (this.editingNoteId === note.patientProfileNoteId) {
            this.resetNoteComposer();
          }
          this.loadPatientNotes();
        },
        error: () => {},
        complete: () => {
          this.deletingNoteId = null;
          this.cdr.markForCheck();
        },
      });
  }

  getInitials(name: string | null | undefined): string {
    const clean = String(name || '').trim();
    if (!clean) return 'N';
    const parts = clean.split(/\s+/).filter(Boolean);
    const first = parts[0]?.charAt(0) || '';
    const second = parts[1]?.charAt(0) || '';
    return (first + second || clean.slice(0, 2)).toUpperCase();
  }

  private resetNoteComposer(): void {
    this.editingNoteId = null;
    this.noteFetchingId = null;
    this.noteDraft = '';
  }

  AddEditPatient(): void {
    let title : string = 'Update Patient';
    this.modalApiUrl = {
      save : 'Patients/savePatient',
      get : 'Patients/getPatientById?Id='
    };
    const selectedFacility = this.patientData?.facilityId;
    const ID = this.patientId || 0
    const formPath = 'patient/add-edit-patient-form.json';
    this.commanModel.showModal(title, 'form', formPath, ID, selectedFacility)
  }

  openMovePatientModal(): void {
    if (this.userRole !== 'Global Admin') return;
    if (!this.patientData?.patientId) return;

    this.moveFacilitySelectedId = null;
    this.moveFacilityModalVisible = true;

    if (!this.moveFacilityList.length && !this.moveFacilityListLoading) {
      this.moveFacilityListLoading = true;
      this.cdr.markForCheck();
      this.generalService.getAllFacilitiesDropdown()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res: any) => {
            this.moveFacilityList = Array.isArray(res?.data) ? res.data : [];
            this.moveFacilityListLoading = false;
            this.cdr.markForCheck();
          },
          error: () => {
            this.moveFacilityList = [];
            this.moveFacilityListLoading = false;
            this.cdr.markForCheck();
          }
        });
    } else {
      this.cdr.markForCheck();
    }
  }

  closeMovePatientModal(): void {
    if (this.movingPatient) return;
    this.moveFacilityModalVisible = false;
    this.moveFacilitySelectedId = null;
    this.cdr.markForCheck();
  }

  get moveFacilityOptions(): Array<{ facilityId: number; titlelong?: string; titleshort?: string }> {
    const currentFacilityId = this.patientData?.facilityId ?? 0;
    return this.moveFacilityList.filter(f => f && f.facilityId && f.facilityId !== currentFacilityId);
  }

  confirmMovePatient(): void {
    const patientId = this.patientData?.patientId;
    const destinationFacilityId = this.moveFacilitySelectedId;
    if (!patientId || !destinationFacilityId || this.movingPatient) return;

    this.movingPatient = true;
    this.cdr.markForCheck();

    this.generalService
      .movePatientToFacility({ patientId, destinationFacilityId })
      .pipe(
        finalize(() => {
          this.movingPatient = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: any) => {
          const ok = res?.status === 1 || res?.data?.success === true;
          if (!ok) {
            this.generalService.showError(res?.message || 'Failed to move patient.');
            return;
          }

          const data = res?.data || {};
          const parts: string[] = ['Patient moved to the new facility.'];
          if (data.treatmentsClosed > 0) {
            parts.push(`${data.treatmentsClosed} active treatment(s) marked Completed.`);
          }
          if (data.cardsDeleted > 0) {
            parts.push(`${data.cardsDeleted} saved card(s) removed.`);
          }
          if (data.patientReactivated) {
            parts.push('Patient login reactivated.');
          }
          this.generalService.showSuccess(parts.join(' '));

          this.moveFacilityModalVisible = false;
          this.moveFacilitySelectedId = null;

          this.resolveAndLoadPatient();
        },
        error: () => {
          this.generalService.showError('Failed to move patient. Please try again.');
        }
      });
  }

  moveBack() {
    if (this.embeddedInTabs) {
      this.backToList.emit();
      return;
    }
    this._location.back();
  }

  private resolveInvoiceId(data?: {
    paymentId?: number;
    invoiceId?: number | null;
    id?: number | string | null;
  }): number {
    return Number(data?.invoiceId || data?.id || data?.paymentId || 0);
  }

  navigateToOrder = (data: {paymentId?: number; invoiceId?: number | null; id?: number | string | null}) =>{
    const ID = this.resolveInvoiceId(data);
    if (!ID) return;

    if (this.embeddedInTabs && this.openInPatientTabs) {
      this.openInPatientTabs({
        type: 'invoice',
        id: ID,
        data,
      });
      return;
    }

    this.route.navigate(['billing/clinicInvoices/detail', ID ]);
  }

  navigateToAppt = (data: {visitId: number}) =>{
    const ID = data.visitId
    this.route.navigate(['schedule/appointment/details', ID ]);
  }

  navigateToViewTreatment = (data: {patientTreatmentId: number}) =>{
    const ID = Number(data.patientTreatmentId || 0);
    if (!ID) return;

    if (this.embeddedInTabs && this.openInPatientTabs) {
      this.openInPatientTabs({
        type: 'treatment',
        id: ID,
        data,
      });
      return;
    }

    this.route.navigate(['treatment/detail', ID ]);
  }

  updateStatus = (data: {patientTreatmentId?: number, patientOrderId?: number, paymentId?: number, visitId?: number } , optionalData: string) =>{
    this.modalApiUrl = {
      save: 'Patients/updateStatus',
      get : `Patients/getStatus?Type=${optionalData}&Id=`
    }
    const title: string = `Update ${optionalData} Status`;
    let ID : number =  0;
    let formPath : string = '';

    switch(optionalData) {
      case 'Treatment':
        ID = data.patientTreatmentId || 0;
        formPath = 'statusUpdates/update-treatment-status-form.json';
        break;
      case 'Order':
        ID = data.patientOrderId || 0;
        formPath = 'statusUpdates/update-order-status-form.json';
        break;
      case 'Payment':
        ID = data.paymentId || 0;
        formPath = 'statusUpdates/update-payment-status-form.json';
        break;
      case 'Appointment':
        ID = data.visitId || 0;
        formPath = 'statusUpdates/update-appointment-status-form.json';
        break;
    }

    this.commanModel.showModal(title, 'form', formPath, ID);
  }

  refreshData(title : string){
    if(title === 'Update Patient' || title === 'Upload Document'){
      this.getPatientDetails();
      return;
    }
    this.loadHistoryData();
  }

  getStatusBadgeClass(status: string | null | undefined): string {
    return getUnifiedStatusBadgeClass(status);
  }

  viewDocument(doc: PatientDocument): void {
    this.openRelatedEntityTab('document', doc);
  }

  downloadDocument(doc: PatientDocument): void {
    const url = String(doc?.documentUrl || '').trim();
    if (!url) {
      this.generalService.showError('Document URL is not available.');
      return;
    }

    const fallbackName = `patient-document-${doc?.patientDocumentId || Date.now()}.pdf`;
    const rawName = String(doc?.documentName || fallbackName).trim() || fallbackName;
    const fileName = rawName.toLowerCase().endsWith('.pdf') ? rawName : `${rawName}.pdf`;

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.rel = 'noopener noreferrer';
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  private getRelatedEntityId(type: PatientRelatedEntityType, data: PatientDocument): number | string {
    switch (type) {
      case 'document':
      default:
        return Number(data?.patientDocumentId || 0) || String(data?.documentUrl || '');
    }
  }

  private buildRelatedTabTitle(type: PatientRelatedEntityType, data: PatientDocument): string {
    switch (type) {
      case 'document':
      default:
        return data?.documentName || `Document #${data?.patientDocumentId || '-'}`;
    }
  }

  private openRelatedEntityTab(type: PatientRelatedEntityType, data: PatientDocument): void {
    const entityId = this.getRelatedEntityId(type, data);
    if (!entityId) return;

    const key = `${type}-${entityId}`;
    const existingTab = this.relatedTabs.find((tab) => tab.key === key);
    if (existingTab) {
      existingTab.data = data;
      existingTab.title = this.buildRelatedTabTitle(type, data);
      if (type === 'document' && data?.documentUrl) {
        existingTab.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(data.documentUrl);
      }
      this.activeRelatedTabKey = existingTab.key;
      this.cdr.markForCheck();
      return;
    }

    const tab: PatientRelatedTab = {
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
    if (this.activeRelatedTabKey === this.patientMainTabKey) return 0;
    const detailTabIndex = this.relatedTabs.findIndex((tab) => tab.key === this.activeRelatedTabKey);
    return detailTabIndex >= 0 ? detailTabIndex + 1 : 0;
  }

  onRelatedTabIndexChange(index: number): void {
    if (index <= 0) {
      this.activeRelatedTabKey = this.patientMainTabKey;
      return;
    }

    const selectedTab = this.relatedTabs[index - 1];
    this.activeRelatedTabKey = selectedTab?.key ?? this.patientMainTabKey;
  }

  onRelatedTabClose(event: { index: number } | number): void {
    const closedIndex = typeof event === 'number' ? Number(event) : Number(event?.index ?? -1);
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
      const fallbackTab = this.relatedTabs[closingIndex - 1] ?? this.relatedTabs[closingIndex] ?? null;
      this.activeRelatedTabKey = fallbackTab?.key ?? this.patientMainTabKey;
    }

    this.cdr.markForCheck();
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

  uploadDocument(): void {
    if (!this.patientId) return;

    this.modalApiUrl = {
      save: 'Patients/createPatientDocument',
      get: ''
    };
    this.commanModel.showModal('Upload Document', 'form', 'patient/uploadDocument.json', this.patientId);
  }

  trackByRelatedTabKey(_index: number, tab: PatientRelatedTab): string {
    return tab.key;
  }

  sendInvoiceReminder(invoice: InvoiceHistoryRow): void {
    const invoiceId = Number(invoice.invoiceId || invoice.id || invoice.paymentId || 0);
    if (!invoiceId || this.sendingInvoiceReminderIds.has(invoiceId)) return;

    this.modal.confirm({
      nzTitle: 'Send Payment Reminder?',
      nzContent: `Are you sure you want to send a payment reminder for Invoice #${invoiceId}?`,
      nzCentered: true,
      nzOnOk: () =>
        new Promise<void>((resolve) => {
          this.sendingInvoiceReminderIds.add(invoiceId);
          this.cdr.markForCheck();

          this.generalService
            .sendInvoiceReminder(invoiceId)
            .pipe(
              finalize(() => {
                this.sendingInvoiceReminderIds.delete(invoiceId);
                this.cdr.markForCheck();
                resolve();
              }),
              takeUntil(this.destroy$)
            )
            .subscribe({
              next: (res: any) => {
                if (res?.success === true || res?.status === 1) {
                  this.generalService.showSuccess(res?.message || 'Payment reminder sent successfully.');
                } else {
                  this.generalService.showError(res?.message || 'Failed to send reminder.');
                }
              },
              error: () => {
                this.generalService.showError('Failed to send payment reminder.');
              },
            });
        }),
    });
  }

  sendIntakeFormReminder(treatment: TreatmentHistoryRow): void {
    const id = Number(treatment.patientTreatmentId || 0);
    if (!id || this.sendingReminderIds.has(id)) return;

    this.modal.confirm({
      nzTitle: 'Resend Intake Form?',
      nzContent: `Resend the intake form for Treatment #${id}?`,
      nzCentered: true,
      nzOnOk: () =>
        new Promise<void>((resolve) => {
          this.sendingReminderIds.add(id);
          this.cdr.markForCheck();

          this.generalService
            .sendTreatmentQuestionnaireReminder(id)
            .pipe(
              finalize(() => {
                this.sendingReminderIds.delete(id);
                this.cdr.markForCheck();
                resolve();
              }),
              takeUntil(this.destroy$)
            )
            .subscribe({
              next: (res: any) => {
                if (res?.success === true || res?.status === 1) {
                  this.generalService.showSuccess(res?.message || 'Intake form reminder sent successfully.');
                } else {
                  this.generalService.showError(res?.message || 'Failed to send reminder.');
                }
              },
              error: () => {
                this.generalService.showError('Failed to send intake form reminder.');
              },
            });
        }),
    });
  }

}
