import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';

import { finalize, switchMap, takeUntil } from 'rxjs';
import { Subject } from 'rxjs';
import { GeneralService } from 'app/shared/services/general.service';
import { AuthService } from '../shared/Auth/auth.service';
import { StripeApiService } from 'app/shared/services/stripe-api.service';
import { loadStripeConnectAndInitialize } from 'app/shared/utils/stripe-connect-loader';
import { environment } from 'environments/environment';

interface StripeConnectEmbeddedComponent extends HTMLElement {
  setOnExit?(handler: () => void): void;
}

@Component({
  selector: 'app-integrate-getting-started',
  standalone: true,
  imports: [
    NzCardModule,
    NzButtonModule,
    NzDropDownModule,
    NzGridModule,
    NzIconModule,
    CommonModule,
    NzInputModule,
    FormsModule,
    NzFormModule,
    NzTagModule,
    NzAlertModule,
    NzToolTipModule,
    NzDividerModule,
  ],
  templateUrl: './integrate-getting-started.component.html',
  styleUrl: './integrate-getting-started.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrateGettingStartedComponent implements OnInit, OnDestroy {
  @ViewChild('stripeOnboardingContainer')
  stripeOnboardingContainer?: ElementRef<HTMLDivElement>;

  userDataString = localStorage.getItem('userData');
  userData = this.userDataString ? JSON.parse(this.userDataString) : null;

  userID: string = this.userData?.userId ?? '';
  facilityID: string = this.userData?.facilityId ?? '';

  selectedMenuItem: string = '';

  squareConnected = false;
  squareSandbox = false;
  loadingSquareStatus = false;
  disconnectingSquare = false;
  squareMerchantId = '';
  squareLocationId = '';
  squareEnvironment = '';

  fullscriptConnected = false;
  loadingFullscriptStatus = false;

  loadingStripeStatus = false;
  startingStripeOnboarding = false;
  stripeStatusLabel = 'Not Connected';
  stripeStatusClass = 'text-red-600';
  stripeChargesEnabled = false;
  stripePayoutsEnabled = false;
  stripeDetailsSubmitted = false;
  stripeRequirementsDue: string[] = [];
  stripeRequirementsPastDue: string[] = [];
  stripeEmbeddedOnboardingVisible = false;
  stripeEmbeddedOnboardingLoading = false;
  stripeEmbeddedOnboardingError: string | null = null;
  gaBillingSetupLoading = false;
  gaBillingHasPaymentMethod = false;
  gaBillingHasPlatformCustomer = false;
  gaBillingStatusLoading = false;

  StripeChargeMode : string = ''

  private stripeEmbeddedOnboardingElement: StripeConnectEmbeddedComponent | null = null;

  menuItems: any;
  userRole: any = '';

  facilityPaymentModeId: number | null = null;
  loadingPaymentMode = false;
  private destroy$ = new Subject<void>();

  constructor(
    private notification: NzNotificationService,
    private generalService: GeneralService,
    private cdr: ChangeDetectorRef,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private stripeApi: StripeApiService
  ) {}

  ngOnInit(): void {
    this.userRole = this.auth.getUserRole();

    if (this.userRole === 'Global Admin') {
      this.menuItems = [{ label: 'Fullscript' }];
    } else if (this.userRole === 'Clinic Admin') {
      this.menuItems = [];
      this.loadFacilityPaymentModeAndSetMenu();
    }

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((q) => {
      const integration = q['integration'];
      const square = q['square'];
      const msg = q['message'];
      if (square === 'connected') {
        this.notification.success('Success', 'Square connected successfully.');
        this.router.navigate([], { relativeTo: this.route, queryParams: {}, queryParamsHandling: '' }).then(() => this.cdr.markForCheck());
        this.getSquareStatus();
      } else if (square === 'error') {
        this.notification.error('Error', msg || 'Square connection failed.');
        this.router.navigate([], { relativeTo: this.route, queryParams: {}, queryParamsHandling: '' }).then(() => this.cdr.markForCheck());
      }

      if (integration === 'Stripe') {
        this.selectedMenuItem = 'Stripe';
        this.getStripeStatus();
      }

      const gaBilling = q['ga_billing'];
      if (gaBilling === 'success') {
        this.notification.success('Success', 'Payment method for clinic billing added. You can now pay clinic-to-global invoices via Stripe.');
        this.router.navigate([], { relativeTo: this.route, queryParams: {}, queryParamsHandling: '' }).then(() => {
          this.loadGaBillingStatus();
          this.cdr.markForCheck();
        });
      } else if (gaBilling === 'cancel') {
        this.router.navigate([], { relativeTo: this.route, queryParams: {}, queryParamsHandling: '' }).then(() => this.cdr.markForCheck());
      }

      this.cdr.markForCheck();
    });

    if (this.userRole === 'Clinic Admin') {
      this.getStripeStatus();
    }
  }

  loadFacilityPaymentModeAndSetMenu(): void {
    if (!this.facilityID) {
      this.menuItems = [{ label: 'WordPress' }];
      this.cdr.markForCheck();
      return;
    }
    this.loadingPaymentMode = true;
    this.cdr.markForCheck();
    this.generalService
      .commonGet(`Facilities/getFacilityPaymentMode?id=${this.facilityID}`)
      .pipe(
        finalize(() => {
          this.loadingPaymentMode = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res) => {
          const data = res?.data ?? res;
          const modeId = data?.paymentModeId ?? null;
          this.facilityPaymentModeId = modeId != null ? Number(modeId) : null;

          if (this.facilityPaymentModeId === 2 || this.facilityPaymentModeId === 3) {
            this.menuItems = [{ label: 'WordPress' }, { label: 'Stripe' }];
          } else {
            this.menuItems = [{ label: 'WordPress' }, { label: 'Square' }];
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.facilityPaymentModeId = null;
          this.menuItems = [{ label: 'WordPress' }, { label: 'Square' }];
          this.cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearStripeEmbeddedOnboarding();
  }

  onMenuItemClick(item: any): void {
    this.selectedMenuItem = item.label;

    if (this.selectedMenuItem !== 'Stripe') {
      this.clearStripeEmbeddedOnboarding();
      this.stripeEmbeddedOnboardingVisible = false;
      this.stripeEmbeddedOnboardingError = null;
    }

    if (this.selectedMenuItem === 'Square') {
      this.getSquareStatus();
    }

    if (this.selectedMenuItem === 'Fullscript') {
      this.getFullscriptStatus();
    }

    if (this.selectedMenuItem === 'Stripe') {
      this.getStripeStatus();
    }

    this.cdr.markForCheck();
  }

  getSquareStatus(): void {
    if (!this.facilityID) return;
    this.loadingSquareStatus = true;
    this.cdr.markForCheck();
    this.generalService
      .getSquareConnectionStatus(this.facilityID)
      .pipe(
        finalize(() => {
          this.loadingSquareStatus = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res) => {
          this.squareConnected = !!res?.connected;
          this.squareSandbox = !!res?.sandbox;
          this.squareEnvironment = res?.sandbox ? 'Sandbox' : 'Production';
          this.squareMerchantId = (res as any)?.merchantId ?? '';
          this.squareLocationId = (res as any)?.locationId ?? '';
        },
        error: () => {
          this.squareConnected = false;
          this.squareSandbox = false;
          this.squareEnvironment = '';
          this.squareMerchantId = '';
          this.squareLocationId = '';
        },
      });
  }

  connectSquare(): void {
    if (!this.facilityID) {
      this.notification.error('Error', 'Facility is required.');
      return;
    }
    this.generalService.startSquareConnectRedirect(this.facilityID);
  }

  disconnectSquare(): void {
    this.disconnectingSquare = true;
    this.cdr.markForCheck();
    this.generalService.disconnectSquare().subscribe({
      next: () => {
        this.notification.success('Success', 'Square disconnected.');
        this.getSquareStatus();
        this.disconnectingSquare = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.notification.error('Error', 'Failed to disconnect Square.');
        this.disconnectingSquare = false;
        this.cdr.markForCheck();
      },
    });
  }

  openSquareSandboxDashboard(): void {
    window.open('https://squareupsandbox.com/dashboard', '_blank', 'noopener,noreferrer');
  }

  openSquareDeveloperConsole(): void {
    window.open('https://developer.squareup.com/apps', '_blank', 'noopener,noreferrer');
  }

  getFullscriptStatus(): void {
    this.loadingFullscriptStatus = true;
    this.cdr.markForCheck();

    this.generalService
      .getFullscriptConnectionStatus()
      .pipe(
        finalize(() => {
          this.loadingFullscriptStatus = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res) => {
          this.fullscriptConnected = !!res?.connected;
        },
        error: (err) => {
          console.error('Fullscript status error:', err);
          this.fullscriptConnected = false;
        },
      });
  }

  connectFullscript(): void {

    this.generalService.startFullscriptConnectRedirect();
  }

  private applyStripeStatus(status: any): void {
    const readyToProcess = !!(status?.readyToProcessPayments ?? status?.readyToProcessPayments);
    const onboardingComplete = !!(status?.onboardingComplete ?? status?.onboardingComplete);
    const chargesEnabled = !!(status?.chargesEnabled ?? status?.charges_enabled ?? readyToProcess);
    const payoutsEnabled = !!(status?.payoutsEnabled ?? status?.payouts_enabled ?? readyToProcess);
    const detailsSubmitted = !!(status?.detailsSubmitted ?? status?.details_submitted ?? onboardingComplete);

    this.stripeChargesEnabled = chargesEnabled;
    this.stripePayoutsEnabled = payoutsEnabled;
    this.stripeDetailsSubmitted = detailsSubmitted;
    this.StripeChargeMode = status?.chargeMode

    console.log(this.StripeChargeMode)

    if (readyToProcess || (chargesEnabled && payoutsEnabled)) {
      this.stripeStatusLabel = 'Connected';
      this.stripeStatusClass = 'text-green-600';
    } else if (onboardingComplete || detailsSubmitted) {
      this.stripeStatusLabel = 'Pending';
      this.stripeStatusClass = 'text-yellow-600';
    } else {
      this.stripeStatusLabel = 'Not Connected';
      this.stripeStatusClass = 'text-red-600';
    }

    const requirementsStatus = status?.requirementsStatus ?? status?.requirements_status ?? '';
    if (typeof requirementsStatus === 'string' && requirementsStatus.trim()) {
      this.stripeRequirementsDue = requirementsStatus.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);
    } else {
      const requirements = status?.requirements ?? {};
      this.stripeRequirementsDue = this.toStringList(
        requirements?.currently_due ?? status?.requirementsDue ?? []
      );
      this.stripeRequirementsPastDue = this.toStringList(
        requirements?.past_due ?? status?.requirementsPastDue ?? []
      );
    }

    const showGaBlock = this.stripeDetailsSubmitted || this.stripeStatusLabel === 'Connected' || this.stripeStatusLabel === 'Pending';
    if (showGaBlock) {
      this.loadGaBillingStatus();
    } else {
      this.gaBillingHasPaymentMethod = false;
      this.gaBillingHasPlatformCustomer = false;
      this.gaBillingStatusLoading = false;
    }
  }

  loadGaBillingStatus(): void {
    this.gaBillingStatusLoading = true;
    this.cdr.markForCheck();
    this.stripeApi.getGaBillingStatus().pipe(
      finalize(() => {
        this.gaBillingStatusLoading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (res) => {
        const d = res?.data;
        this.gaBillingHasPlatformCustomer = !!(d?.hasPlatformCustomer);
        this.gaBillingHasPaymentMethod = !!(d?.hasPaymentMethod);
      },
      error: () => {
        this.gaBillingHasPaymentMethod = false;
        this.gaBillingHasPlatformCustomer = false;
      },
    });
  }

  private toStringList(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((v) => String(v)).filter((v) => v.trim().length > 0);
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    }
    return [];
  }

  getStripeStatus(): void {
    if (!this.facilityID) return;
    this.loadingStripeStatus = true;
    this.cdr.markForCheck();

    this.stripeApi
      .getFacilityStatus(this.facilityID)
      .pipe(
        finalize(() => {
          this.loadingStripeStatus = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res) => {
          const status = res?.data ?? res;
          this.applyStripeStatus(status);
        },
        error: () => {
          this.applyStripeStatus(null);
        },
      });
  }

  onStripeOnboardingExit(): void {
    this.stripeApi.onboardingComplete().subscribe({
      next: (res) => {
        const msg = res?.message ?? res?.data?.message;
        if (msg) this.notification.info('Stripe', msg);
        this.getStripeStatus();
      },
      error: () => {
        this.getStripeStatus();
      },
    });
  }

  addGaBillingPaymentMethod(): void {
    const base = typeof window !== 'undefined' ? window.location.origin + (this.router.url?.split('?')[0] || '/integrate-getting-started') : '';
    const successUrl = base + '?ga_billing=success';
    const cancelUrl = base + '?ga_billing=cancel';
    this.gaBillingSetupLoading = true;
    this.cdr.markForCheck();
    this.stripeApi.createGaBillingSetupSession({ successUrl, cancelUrl }).subscribe({
      next: (res) => {
        this.gaBillingSetupLoading = false;
        this.cdr.markForCheck();
        const url = res?.data?.checkoutUrl ?? (res as any)?.checkoutUrl;
        if (url) {
          window.location.href = url;
        } else {
          this.notification.warning('Stripe', res?.message ?? 'No checkout URL returned.');
        }
      },
      error: (err) => {
        this.gaBillingSetupLoading = false;
        this.cdr.markForCheck();
        const msg = err?.error?.message ?? err?.message ?? 'Unable to start payment method setup.';
        this.notification.error('Error', msg);
      },
    });
  }

  startStripeOnboarding(): void {
    if (!this.facilityID) {
      this.notification.error('Error', 'Facility is required.');
      return;
    }

    const displayName = (this.userData as any)?.facilityName || `Facility ${this.facilityID}`;
    const contactEmail = this.userData?.email ?? this.userData?.userName ?? '';

    this.startingStripeOnboarding = true;
    this.stripeEmbeddedOnboardingVisible = true;
    this.stripeEmbeddedOnboardingLoading = true;
    this.stripeEmbeddedOnboardingError = null;
    this.cdr.markForCheck();

    const createAccount$ = this.facilityPaymentModeId === 3
      ? this.stripeApi.createFacilityAccountDestination(displayName, contactEmail)
      : this.stripeApi.createFacilityAccount(displayName, contactEmail);

    createAccount$
      .pipe(
        switchMap(() => this.stripeApi.getEmbeddedOnboardingSession()),
        finalize(() => {
          this.startingStripeOnboarding = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res) => {
          const clientSecret = res?.data?.clientSecret ?? (res as any)?.clientSecret ?? null;
          if (clientSecret && typeof clientSecret === 'string') {
            this.cdr.markForCheck();
            void this.mountStripeEmbeddedOnboarding(clientSecret);
          } else {
            this.stripeEmbeddedOnboardingLoading = false;
            this.stripeEmbeddedOnboardingError = 'Could not start embedded onboarding.';
            this.notification.error('Error', 'Unable to get onboarding session.');
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          const msg = err?.error?.message ?? err?.message ?? 'Unable to start Stripe onboarding.';
          this.stripeEmbeddedOnboardingError = msg;
          this.stripeEmbeddedOnboardingLoading = false;
          this.notification.error('Error', msg);
          this.cdr.markForCheck();
        },
      });
  }

  private async mountStripeEmbeddedOnboarding(clientSecret: string): Promise<void> {
    const publishableKey = environment.stripePublishableKey ?? (environment as any).stripePublishableKey ?? null;
    if (!publishableKey || typeof publishableKey !== 'string') {
      this.stripeEmbeddedOnboardingLoading = false;
      this.stripeEmbeddedOnboardingError = 'Stripe publishable key is not configured.';
      this.notification.error('Error', 'Stripe configuration is incomplete.');
      this.cdr.markForCheck();
      return;
    }
    try {
      const loadConnectAndInitialize = await loadStripeConnectAndInitialize();
      const connectInstance = loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret: async () => clientSecret,
      });
      const onboardingComponent = connectInstance.create('account-onboarding');
      if (!onboardingComponent) {
        throw new Error('Stripe could not create the onboarding component.');
      }
      (onboardingComponent as StripeConnectEmbeddedComponent).setOnExit?.(() => {
        this.onStripeOnboardingExit();
      });
      const container = await this.getStripeOnboardingContainer();
      this.clearStripeEmbeddedOnboarding();
      container.appendChild(onboardingComponent);
      this.stripeEmbeddedOnboardingElement = onboardingComponent as StripeConnectEmbeddedComponent;
      this.stripeEmbeddedOnboardingError = null;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to load embedded onboarding.';
      console.error('Stripe embedded onboarding init error:', error);
      this.stripeEmbeddedOnboardingError = msg;
      this.notification.error('Error', msg);
    } finally {
      this.stripeEmbeddedOnboardingLoading = false;
      this.cdr.markForCheck();
    }
  }

  private async getStripeOnboardingContainer(): Promise<HTMLDivElement> {
    this.cdr.detectChanges();
    let container = this.stripeOnboardingContainer?.nativeElement;
    if (container) return container;
    await new Promise<void>((r) => setTimeout(r, 100));
    this.cdr.detectChanges();
    container = this.stripeOnboardingContainer?.nativeElement;
    if (container) return container;
    throw new Error('Stripe onboarding container not found.');
  }

  private clearStripeEmbeddedOnboarding(): void {
    if (this.stripeEmbeddedOnboardingElement) {
      this.stripeEmbeddedOnboardingElement.remove();
      this.stripeEmbeddedOnboardingElement = null;
    }

    const container = this.stripeOnboardingContainer?.nativeElement;
    if (container) {
      container.innerHTML = '';
    }
  }

  codeSnippet: string = `
  <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html { height: 100%; font-family: Arial, sans-serif; background: #fff8f6; }
    .container { display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; padding: 20px; }
    .iframe-wrapper {
      background: #fff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      border: 1px solid #e5e7eb; width: 100%; max-width: 900px; overflow: hidden;
    }
    .iframe-wrapper iframe { width: 100%; height: 100%; min-height: 100vh; border: none; display: block; }
    @media (max-width: 768px) { .container { padding: 10px; } .iframe-wrapper { border-radius: 12px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="iframe-wrapper">
      <iframe src="http://www.telehealthus.com/get-started/${this.facilityID}"></iframe>
    </div>
  </div>
</body>
</html>`;

  catsWithPackages: string = `
  <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html { height: 100%; font-family: Arial, sans-serif; background: #fff8f6; }
    .container { display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; padding: 20px; }
    .iframe-wrapper {
      background: #fff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      border: 1px solid #e5e7eb; width: 100%; max-width: 900px; overflow: hidden;
    }
    .iframe-wrapper iframe { width: 100%; height: 100%; min-height: 100vh; border: none; display: block; }
    @media (max-width: 768px) { .container { padding: 10px; } .iframe-wrapper { border-radius: 12px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="iframe-wrapper">
      <iframe src="http://www.telehealthus.com/categoriesOffered/${this.facilityID}"></iframe>
    </div>
  </div>
</body>
</html>`;

  codeExpanded = false;

  copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      this.notification.success('Success', 'Code snippet copied to clipboard!');
    });
  }
}
