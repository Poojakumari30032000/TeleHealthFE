import {
  AfterViewInit,
  Component,
  Input,
  NgZone,
  OnDestroy,
  inject, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { Fullscript } from '@fullscript/fullscript-js';

import { environment } from '../../environments/environment';
import { GeneralService } from 'app/shared/services/general.service';

export type FullscriptPatientPayload = {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  dateOfBirth?: string;
  biologicalSex?: 'male' | 'female' | 'prefer not to say';
  mobileNumber?: string;
  discount?: number;
};

type SessionGrantResponse = {
  secretToken: string;
  patient?: FullscriptPatientPayload;
};

@Component({
  selector: 'app-fullscript-platform',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fullscript-platform.component.html',
})
export class FullscriptPlatformComponent implements AfterViewInit, OnDestroy {
  private readonly generalService = inject(GeneralService);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly destroy$ = new Subject<void>();
  private platformFeature: any;

  @Input() patient: FullscriptPatientPayload | undefined;

  @Input() entrypoint: 'catalog' | 'labs' = 'catalog';

  uiState: 'loading' | 'needs-connect' | 'ready' | 'error' = 'loading';
  errorMessage = '';
  currentOrigin = '';

  ngAfterViewInit(): void {
    this.currentOrigin = window.location.origin;
    this.startEmbed();
  }

  private startEmbed(): void {
    this.uiState = 'loading';
    this.errorMessage = '';

    this.safeUnmount();

    this.generalService
      .getFullscriptSessionGrant()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: SessionGrantResponse) => {
          if (!res?.secretToken) {
            this.uiState = 'needs-connect';
            this.cdr.markForCheck();
            return;
          }

          try {
            console.log('Initializing Fullscript Embed with:', {
              publicKey: environment.fullscript.publicKey?.substring(0, 10) + '...',
              env: environment.fullscript.env,
              currentOrigin: window.location.origin
            });

            const fullscriptClient = Fullscript({
              publicKey: environment.fullscript.publicKey,
              env: environment.fullscript.env,
            });

            const resolvedPatient = this.patient ?? res.patient;

            const options: any = {
              secretToken: res.secretToken,
              entrypoint: this.entrypoint,
              ...(resolvedPatient ? { patient: resolvedPatient } : {}),
            };

            this.platformFeature = fullscriptClient.create('platform', options);

            this.setupEventListeners();

            this.uiState = 'ready';

            this.cdr.markForCheck();

            this.ngZone.runOutsideAngular(() => {
              try {
                this.platformFeature.mount('fullscript-embed-container');
                this.cdr.markForCheck();
              } catch (mountError: any) {
                console.error('Fullscript mount error:', mountError);
                this.cdr.markForCheck();
                this.ngZone.run(() => {
                  this.uiState = 'error';
                  this.errorMessage = `Failed to mount Fullscript: ${mountError?.message || 'Connection refused. Please check Origin URI configuration in Fullscript API Dashboard.'}`;
                  this.cdr.markForCheck();
                });
              }
            });
          } catch (initError: any) {
            console.error('Fullscript initialization error:', initError);
            this.uiState = 'error';
            this.cdr.markForCheck();
            this.errorMessage = `Failed to initialize Fullscript: ${initError?.message || 'Please verify your public key and environment settings.'}`;
          }
        },
        error: (err) => {
          const status = err?.status;
          if (status === 401 || status === 403) {
            this.uiState = 'needs-connect';
            this.cdr.markForCheck();
            return;
          }

          console.error('Fullscript session-grant failed:', err);
          this.uiState = 'error';
          this.errorMessage = 'Failed to load Fullscript. Please try again.';
          this.cdr.markForCheck();
        },
      });
  }

  connectFullscript(): void {
    this.generalService.startFullscriptConnectRedirect();
    this.cdr.markForCheck();
  }

  retry(): void {
    this.startEmbed();
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.safeUnmount();
  }

  private safeUnmount(): void {
    try {
      if (this.platformFeature) {

        this.removeEventListeners();
        this.platformFeature.unmount?.();
        this.cdr.markForCheck();
      }
    } finally {
      this.platformFeature = null;
      this.cdr.markForCheck();
    }
  }

  private setupEventListeners(): void {
    if (!this.platformFeature) return;

    this.platformFeature.on('patient.selected', (data: any) => {
      this.ngZone.run(() => {
        console.log('Patient selected:', data);

        this.cdr.markForCheck();
      });
    });

    this.platformFeature.on('treatmentPlan.activated', (data: any) => {
      this.ngZone.run(() => {
        console.log('Treatment plan activated:', data);

        this.cdr.markForCheck();
      });
    });
  }

  private removeEventListeners(): void {
    if (!this.platformFeature) return;

    try {

      this.platformFeature.off?.('patient.selected', () => {});
      this.platformFeature.off?.('treatmentPlan.activated', () => {});
      this.cdr.markForCheck();
    } catch (error) {
      console.warn('Error removing event listeners:', error);
      this.cdr.markForCheck();
    }
  }
}
