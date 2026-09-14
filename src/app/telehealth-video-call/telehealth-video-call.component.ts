import { Component, OnInit, ChangeDetectorRef, OnDestroy, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { GeneralService } from 'app/shared/services/general.service';
import { CanComponentDeactivate } from 'app/shared/Guard/can-deactivate.guard';
import { Subject, takeUntil } from 'rxjs'
import { NzInputModule } from 'ng-zorro-antd/input';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'app/shared/Auth/auth.service';
import { Location } from "@angular/common";
import { ValidationService } from 'app/shared/Validation/validation.service';

interface Prescription {
  patientPrescriptionId: number;
  patientPrescriptionGuid: string;
  facilityGuid: string;
  patientId: number;
  patientName: string;
  patientTreatmentId: number;
  patientTreamentGuid: string;
  patientOrderId: number;
  patientOrderGuid: string;
  productId: number;
  productName: string;
  productType: string;
  prescriptionInstruction: string;
  prescriptionStatus: string;
}

interface PreviousPrescription {
  prescriptionId: number;
  prescriptionInstruction: string;
  name: string;
  pharmacyName: string;
  writtenDate: string;
  visitStatus: string;
  productVarient: string;
  drugName: string;
  orderDate: string;
  orderStatus: string;
  createdBy: string;
  lastEditedDate: string;
}

interface OpenTokCredentials {
  apiKey: string;
  sessionId: string;
  token: string;
}

interface StreamEvent {
  stream: any;
  reason?: string;
}

interface ExtendedStream {
  streamId: string;
  connection: { connectionId: string };
  hasVideo: boolean;
  hasAudio: boolean;
  name: string;
  subscriber?: any;
}

@Component({
  selector: 'app-telehealth-video-call',
  standalone: true,
  imports: [
    NzInputModule,
    NzSelectModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './telehealth-video-call.component.html',
  styleUrl: './telehealth-video-call.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TelehealthVideoCallComponent implements OnInit, CanComponentDeactivate, OnDestroy {
  session: any;
  publisher: any;
  streams: ExtendedStream[] = [];

  layout: 'floating-self' = 'floating-self';
  sidebarOpen = false;
  activePanel: 'participants' | 'prescription' | null = null;
  publishVideo = true;
  publishAudio = true;
  isLoading = true;

  prescriptionForm!: FormGroup;
  prescriptionData: Prescription | null = null;
  isDirty: boolean = false;
  LoadingPrevPrescription: boolean = false;
  prevPrescriptionData: PreviousPrescription[] | null = null;
  LoadingProductVarients: boolean = false;
  productVarients: Array<{productId: number; productName: string}> | null = null;

  isPrescriptionCollapsed = false;
  private appointmentId: number = 0;
  private destroy$ = new Subject<void>();
  private valueChangesDestroy$ = new Subject<void>();
  userData = this.auth.getUserData();
  participantNames: { [connectionId: string]: string } = {};
  private OT: any;

  get cameraStreams(): ExtendedStream[] {
    return this.streams;
  }

  get totalVideos(): number {
    return this.cameraStreams.length + 1;
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (this.isDirty) {
      return false;
    }
    return true;
  }

  constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private generalService: GeneralService,
    private router: ActivatedRoute,
    private validationService: ValidationService,
    private fb: FormBuilder,
    private auth: AuthService,
    private _location: Location,
    private route: Router,
    private ngZone: NgZone
  ) {
    this.appointmentId = Number(this.router.snapshot.paramMap.get('id') || 0);
  }

  async ngOnInit() {
    await this.loadOpenTok();
    this.initializeSession();
    this.initForm();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.valueChangesDestroy$.next();
    this.valueChangesDestroy$.complete();
    this.disconnectSession();
  }

  private async loadOpenTok(): Promise<void> {
    try {

      const OTModule = await import('@opentok/client');
      this.OT = OTModule.default || OTModule;
    } catch (error) {
      console.error('Failed to load OpenTok:', error);
      this.generalService.showError('Failed to load video components');
    }
  }

  private cleanupSession(): void {
    try {
      this.streams.forEach(stream => {
        const containerId = `subscriber-${stream.streamId}`;
        const container = document.getElementById(containerId);
        if (container) container.remove();
        if (stream.subscriber) {
          this.session?.unsubscribe(stream.subscriber);
        }
      });

      if (this.publisher) {
        this.publisher.destroy();
        this.publisher = undefined;
      }

      if (this.session) {
        this.session.disconnect();
        this.session.off();
        this.session = undefined;
      }
    } catch (err) {
      console.error('Error during session cleanup:', err);
    }
  }

  initForm(): void {
    this.prescriptionForm = this.fb.group({
      patientPrescriptionId: [0, Validators.required],
      facilityGuid: ['', Validators.required],
      patientId: [0, Validators.required],
      patientTreatmentId: [0, Validators.required],
      patientOrderId: [0, Validators.required],
      productId: [0, Validators.required],
      prescriptionInstruction: ['', Validators.required],
      prescriptionStatus: ['', Validators.required]
    });
    this.validationService.applyGlobalValidators(this.prescriptionForm);
    this.changeDetectorRef.detectChanges();
  }

  initializeSession() {
    if (!this.appointmentId || !this.OT) return;

    this.isLoading = true;
    this.generalService.commonGet(`PatientAppointments/getPatientAppointmentVideoCallId?Id=${this.appointmentId}&RoleId=4&UserId=49`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        const Data = response?.data;
        if (response?.status === 1 && (Data.sessionId !== null || Data.token !== null)) {
          const credentials: OpenTokCredentials = Data;
          this.setupOpenTokSession(credentials.apiKey, credentials.sessionId, credentials.token);
          this.getPrescriptionDetails();
        } else {
          this.generalService.showError(response.message);
          this.isLoading = false;

        }
      },
      error: (err) => {
        console.error('Error fetching OpenTok credentials:', err);
        this.generalService.showError(err.message);
        this.isLoading = false;

      }
    });
  }

  private setupOpenTokSession(apiKey: string, sessionId: string, token: string) {
    try {
      const apikeyyy = apiKey || "";
      this.session = this.OT.initSession(apikeyyy, sessionId, {
        connectionEventsSuppressed: false,
        iceConfig: {
          includeServers: 'all',
          transportPolicy: 'relay',
          customServers: []
        }
      });

      this.setupSessionEventHandlers();
      this.connectToSession(token);
    } catch (err) {
      console.error('Error initializing session:', err);
      this.generalService.showError('Error setting up video session');
      this.isLoading = false;
    }
  }

  private setupSessionEventHandlers() {
    if (!this.session) return;

    this.session.on('sessionDisconnected', (event: any) => {
      console.log('Session disconnected:', event);
      this.handleSessionDisconnect();
    });

    this.session.on('streamCreated', (event: StreamEvent) => {
      console.log('Stream created event:', event);
      this.handleStreamCreated(event);
    });

    this.session.on('streamDestroyed', (event: StreamEvent) => {
      console.log('Stream destroyed event:', event);
      this.handleStreamDestroyed(event);
    });

    this.session.on('connectionCreated', (event: any) => {
      console.log('New connection:', event.connection);
      const name = this.userData?.firstName + " " + this.userData?.lastName || null;

      this.session?.signal(
        {
          type: 'participant-name',
          data: JSON.stringify({
            connectionId: this.session?.connection?.connectionId,
            name: name
          }),
          to: event.connection
        },
        (signalError: any) => {
          if (signalError) {
            console.error('Error sending participant name signal:', signalError);
          } else {
            console.log('Participant name signal sent successfully');
          }
        }
      );
    });

    this.session.on('connectionDestroyed', (event: any) => {
      delete this.participantNames[event.connection.connectionId];
      console.log('Connection destroyed:', event.connection);
    });

    this.session.on('streamPropertyChanged', (event: any) => {
      console.log('Stream property changed:', event);
      if (event.changedProperty === 'hasVideo') {
        console.log(`Stream ${event.stream.streamId} hasVideo: ${event.newValue}`);
        this.changeDetectorRef.detectChanges();
      }
    });

    this.session.on('signal:participant-name', (event: any) => {
      if (!event.data) return;
      const signalData = JSON.parse(event.data);
      const { connectionId, name } = signalData;

      this.participantNames[connectionId] = name;
      console.log(`Received participant name: ${name} for connection ${connectionId}`);

      this.streams = this.streams.map(stream => {
        if (stream.connection.connectionId === connectionId) {
          (stream as ExtendedStream).name = name;
        }
        return stream;
      });
      this.changeDetectorRef.detectChanges();
    });

    this.session.on('signal:end-call', () => {
      if(this.userData?.roleName !== 'Provider')this.generalService.showInfo('Provider has ended the call');
      this.cleanupSession();
      this.redirectToRoleDashboard();
    });
  }

  private connectToSession(token: string) {
    this.session?.connect(token, (error: any) => {
      if (error) {
        this.handleSessionError('Failed to connect to session', error);
        return;
      }
      const name = this.userData?.firstName + " " + this.userData?.lastName || '';
      this.participantNames[this.session?.connection?.connectionId || '0'] = name;
      this.initializePublisher();
    });
  }

  private initializePublisher() {
    const publisherId = 'publisher-floating';
    setTimeout(() => {
      const publisherElement = document.getElementById(publisherId);
      if (publisherElement) {
        this.publisher = this.OT.initPublisher(publisherId, {
          insertMode: 'append',
          width: '100%',
          height: '100%',
          publishVideo: this.publishVideo,
          publishAudio: this.publishAudio
        }, (err: any) => {
          if (err) {
            this.handleSessionError('Failed to initialize publisher', err);
            return;
          }

          this.session?.publish(this.publisher!, (publishError: any) => {
            if (publishError) {
              this.handleSessionError('Failed to publish video', publishError);
            }
            this.isLoading = false;
            this.changeDetectorRef.detectChanges();
          });
        });
      } else {
        console.error(`Publisher element with ID ${publisherId} not found in DOM`);
        this.isLoading = false;
      }
    }, 100);
  }

  private handleStreamCreated(event: StreamEvent) {
    try {
      this.isLoading = true;
      const newStream = event.stream as ExtendedStream;
      const connectionId = newStream.connection.connectionId;

      if (connectionId === this.session?.connection?.connectionId) {
        this.isLoading = false;
        return;
      }

      newStream.name = this.participantNames[connectionId] || `Participant ${this.streams.length + 1}`;

      if (!this.streams.some(s => s.streamId === newStream.streamId)) {
        this.streams = [...this.streams, newStream];
      }

      this.subscribeToStream(newStream);
      this.changeDetectorRef.detectChanges();
    } catch (err) {
      this.handleSessionError('Error processing new stream', err);
    }
  }

  private subscribeToStream(stream: ExtendedStream) {
    const containerId = `subscriber-${stream.streamId}`;
    setTimeout(() => {
      const container = document.getElementById(containerId);
      if (container && this.session) {
        stream.subscriber = this.session.subscribe(stream, containerId, {
          insertMode: 'append',
          width: '100%',
          height: '100%',
        }, (err: any) => {
          if (err) {
            this.handleSessionError('Failed to subscribe to stream', err);
          }
          this.isLoading = false;
          this.changeDetectorRef.detectChanges();
        });
      } else {
        console.error(`Subscriber container with ID ${containerId} not found`);
        this.isLoading = false;
      }
    }, 100);
  }

  private handleStreamDestroyed(event: StreamEvent) {
    try {
      const stream = event.stream as ExtendedStream;
      if (stream.subscriber) {
        this.session?.unsubscribe(stream.subscriber);
      }
      this.streams = this.streams.filter(s => s.streamId !== event.stream.streamId);

      const containerId = `subscriber-${stream.streamId}`;
      const container = document.getElementById(containerId);
      if (container) container.remove();

      this.changeDetectorRef.detectChanges();
    } catch (err) {
      this.handleSessionError('Error processing stream removal', err);
    }
  }

  private handleSessionDisconnect() {
    this.generalService.showInfo('Session disconnected. Please reconnect.');
    this.isLoading = false;
    this.streams = [];
    this.changeDetectorRef.detectChanges();
  }

  private handleSessionError(message: string, error?: any) {
    console.error(message, error);
    this.generalService.showError(message);
    this.isLoading = false;
    this.changeDetectorRef.detectChanges();
  }

  togglePanel(panel: 'participants' | 'prescription' | null): void {
    if (this.activePanel === panel) {
      this.activePanel = null;
      this.sidebarOpen = false;
    } else {
      this.activePanel = panel;
      this.sidebarOpen = true;
    }
    this.changeDetectorRef.detectChanges();
  }

  toggleVideo() {
    this.publishVideo = !this.publishVideo;
    if (this.publisher) {
      this.publisher.publishVideo(this.publishVideo);
      this.changeDetectorRef.detectChanges();
    }
  }

  toggleAudio() {
    this.publishAudio = !this.publishAudio;
    if (this.publisher) {
      this.publisher.publishAudio(this.publishAudio);
      this.changeDetectorRef.detectChanges();
    }
  }

  disconnectSession() {
    if(this.isDirty){
      this.generalService.showError('Before ending the call, please ensure you either save or discard your changes in the prescription to avoid losing any progress')
      return;
    }

    if (this.session) {
      if (this.userData?.roleName === 'Provider') {
        this.session.signal(
          {
            type: 'end-call',
            data: 'Provider has ended the call'
          },
          (error: any) => {
            if (error) {
              console.error('Error sending end-call signal:', error);
            }
            this.cleanupSession();
            this.redirectToRoleDashboard();
          }
        );
      } else {
        this.cleanupSession();
        this.redirectToRoleDashboard();
      }
    }
  }

  private redirectToRoleDashboard() {
    const role = this.userData?.roleName || '';
    const roleRoutes: Record<string, string> = {
      'Global Admin': '/dashboard/admin',
      'Clinic Admin': '/dashboard/clinic',
      'Provider': '/dashboard/provider',
      'Patient': '/dashboard/patient',
    };
    const redirectPath = roleRoutes[role] || '';
    this.ngZone.run(() => {
      this.route.navigate([redirectPath]);
    });
  }

  getInitials(name: string): string {
    return name.split(' ').map(word => word.charAt(0)).join('').toUpperCase();
  }

  muteParticipant(stream: any) {
    console.log(`Muting participant with stream ID: ${stream.streamId}`);
  }

  goBack() {
    this._location.back();
  }

  getPrescriptionDetails(): void {
    if (!this.appointmentId) return;

    this.isLoading = true;
    this.generalService.commonGet(`PatientPrescriptions/getPatientPrescriptionById?AppointmentId=${this.appointmentId}`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response?.status === 1 && response?.data) {
          this.prescriptionData = response.data;
          this.populateForm(this.prescriptionData);
          this.getPatientPreviousPrescription();
          this.getProductVarient();
          console.log('Fetched product data:', this.prescriptionData);

          this.prescriptionForm.valueChanges.pipe(takeUntil(this.valueChangesDestroy$)).subscribe(() => {
            this.isDirty = true;
            console.log('this.isDirty', this.isDirty);
          });
        }
        this.isLoading = false;
        this.changeDetectorRef.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  getPatientPreviousPrescription(): void {
    if (!this.prescriptionData) return;
    if (!this.prescriptionData.patientId || !this.prescriptionData.productId) return;

    this.LoadingPrevPrescription = false;
    this.generalService.commonGet(`PatientPrescriptions/getAllPatientPrescriptionsHistory?AppointmentId=${this.appointmentId}&PatientId=${this.prescriptionData.patientId}&ProductId=${this.prescriptionData.productId}`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response?.status === 1 && response?.data) {
          this.prevPrescriptionData = response.data;
        } else {
          console.error(response?.message);
        }
        this.LoadingPrevPrescription = false;
        this.changeDetectorRef.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.LoadingPrevPrescription = false;
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  getProductVarient(): void {
    if (!this.prescriptionData) return;
    if (!this.prescriptionData.productType.includes('Drug')) return;

    this.LoadingProductVarients = false;
    this.generalService.commonGet(`DropDowns/getAllInTakeFormProducts`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response?.status === 1 && response?.data) {
          this.productVarients = response.data;
        } else {
          console.error(response?.message);
        }
        this.LoadingProductVarients = false;
        this.changeDetectorRef.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.LoadingProductVarients = false;
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  savePrescription() {
    if (this.prescriptionForm.invalid) {
      this.generalService.showError('Please fill all required fields.');
      Object.keys(this.prescriptionForm.controls).forEach(field => {
        const control = this.prescriptionForm.get(field);
        if (control) {
          control.markAsTouched({ onlySelf: true });
          control.updateValueAndValidity();
        }
      });
      return;
    }

    this.valueChangesDestroy$.next();
    this.valueChangesDestroy$.complete();

    const apiUrl = 'PatientPrescriptions/savePatientPrescription';
    const payload = {
      patientPrescriptionId: this.prescriptionData?.patientPrescriptionId || 0,
      facilityGuid: this.prescriptionData?.facilityGuid || '',
      patientId: this.prescriptionData?.patientId || 0,
      patientTreatmentId: this.prescriptionData?.patientTreatmentId || 0,
      patientOrderId: this.prescriptionData?.patientOrderId || 0,
      prescriptionInstruction: this.prescriptionData?.prescriptionInstruction || '',
      productId: this.prescriptionData?.productId || 0
    };

    console.log('payload', payload);

    this.generalService.commonPost(apiUrl, payload).pipe(takeUntil(this.destroy$)).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response?.status === 1 && response.data) {
          this.generalService.showSuccess(response.message);
          this.isDirty = false;
          return;
        }
        this.generalService.showError(response.message);
      },
      error: (err) => {
        this.generalService.showError(err.message);
      }
    });
  }

  populateForm(data: any): void {
    this.prescriptionForm.patchValue({
      patientPrescriptionId: data.patientPrescriptionId || 0,
      facilityGuid: data.facilityGuid || '',
      patientId: data.patientId || 0,
      patientTreatmentId: data.patientTreatmentId || 0,
      patientOrderId: data.patientOrderId || 0,
      prescriptionInstruction: data.prescriptionInstructionGRA || '',
      prescriptionStatus: data.prescriptionStatus || '',
      productId: data.productId || 0,
    });
  }

  clearPrescriptionForm() {
    this.prescriptionForm.get('prescriptionInstruction')?.setValue('');
    if (this.prescriptionData?.productType?.includes('Drug')) {
      this.prescriptionForm.get('productId')?.setValue(this.prescriptionData?.productId);
    }
    this.isDirty = false;
    this.changeDetectorRef.detectChanges();
  }

  copyInstruction(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.generalService.showSuccess('Instruction copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy text:', err);
      this.generalService.showError('Failed to copy instruction');
    });
  }

  trackByProductId(_index: number, product: {productId: number; productName: string}): number {
    return product.productId;
  }

  trackByPrescriptionId(_index: number, prescription: PreviousPrescription): string {
    return prescription.drugName + prescription.writtenDate;
  }
}
