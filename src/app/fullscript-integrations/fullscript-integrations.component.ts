import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { GeneralService } from '../shared/services/general.service';
import { FullscriptPlatformComponent } from '../fullscript-platform/fullscript-platform.component';

@Component({
  selector: 'app-fullscript-integrations',
  standalone: true,
  imports: [CommonModule, FullscriptPlatformComponent],
  templateUrl: './fullscript-integrations.component.html',
  styleUrls: ['./fullscript-integrations.component.css']
})
export class FullscriptIntegrationsComponent implements OnInit, OnDestroy {
  private readonly generalService = inject(GeneralService);
  private readonly notification = inject(NzNotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  isConnected = false;
  isLoading = true;
  showEmbed = false;
  patientData: any = null;

  ngOnInit(): void {
    this.checkConnectionStatus();
    this.handleOAuthCallback();
    this.logConfigurationInfo();
  }

  private logConfigurationInfo(): void {

    console.log('Fullscript Configuration:', {
      currentOrigin: window.location.origin,
      currentUrl: window.location.href,
      environment: (window as any).environment?.fullscript?.env || 'unknown',
      note: 'Make sure this origin is whitelisted in Fullscript API Dashboard'
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private checkConnectionStatus(): void {
    this.isLoading = true;
    this.generalService.getFullscriptConnectionStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: { connected: boolean }) => {
          this.isConnected = response?.connected || false;
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error checking Fullscript status:', error);
          this.isConnected = false;
          this.isLoading = false;
        }
      });
  }

  private handleOAuthCallback(): void {

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params['fullscript'] === 'connected') {
          this.notification.success(
            'Success',
            'Fullscript account connected successfully!'
          );

          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {},
            replaceUrl: true
          });
          this.checkConnectionStatus();
        } else if (params['fullscript'] === 'error') {
          const errorMessage = params['message'] || 'Failed to connect Fullscript account';
          this.notification.error(
            'Connection Error',
            errorMessage
          );

          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {},
            replaceUrl: true
          });
        }
      });
  }

  connectFullscript(): void {
    this.generalService.startFullscriptConnectRedirect();
  }

  disconnectFullscript(): void {
    this.generalService.disconnectFullscript()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notification.success(
            'Success',
            'Fullscript account disconnected successfully!'
          );
          this.isConnected = false;
          this.showEmbed = false;
        },
        error: (error) => {
          console.error('Error disconnecting Fullscript:', error);
          this.notification.error(
            'Error',
            'Failed to disconnect Fullscript account'
          );
        }
      });
  }

  openFullscriptPlatform(): void {
    if (this.isConnected) {
      this.showEmbed = true;
    } else {
      this.notification.warning(
        'Not Connected',
        'Please connect your Fullscript account first'
      );
    }
  }

  closeFullscriptPlatform(): void {
    this.showEmbed = false;
  }
}
