import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { AuthService } from 'app/shared/Auth/auth.service';
import { TitleService } from 'app/shared/services/title.service';
import { StripeApiService } from 'app/shared/services/stripe-api.service';
import { loadStripeConnectAndInitialize } from 'app/shared/utils/stripe-connect-loader';
import { environment } from 'environments/environment';

interface StripeFacilityRow {
  facilityId: number | string;
  facilityName?: string | null;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  updatedAt?: string | null;
}

@Component({
  selector: 'app-ga-payment-dashboard',
  templateUrl: './ga-payment-dashboard.component.html',
  styleUrl: './ga-payment-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GaPaymentDashboardComponent implements OnInit, AfterViewInit {
  userRole = '';
  facilityId: number | string | null = null;
  isGlobalAdmin = false;
  isClinicAdmin = false;

  dashboardLoading = false;
  dashboardSafeUrl: SafeResourceUrl | null = null;
  dashboardPublicUrl: string | null = null;
  dashboardError: string | null = null;

  stripeTabIndex = 0;
  embedLoading = false;
  embedError: string | null = null;
  embedElement: HTMLElement | null = null;

  @ViewChild('paymentsEmbedContainer') paymentsEmbedContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('payoutsEmbedContainer') payoutsEmbedContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('disputesEmbedContainer') disputesEmbedContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('balancesEmbedContainer') balancesEmbedContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('reportingEmbedContainer') reportingEmbedContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('clinicPaymentsEmbedContainer') clinicPaymentsEmbedContainer?: ElementRef<HTMLDivElement>;

  @ViewChild('clinicBalancesEmbedContainer') clinicBalancesEmbedContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('clinicPayoutsEmbedContainer') clinicPayoutsEmbedContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('clinicDisputesEmbedContainer') clinicDisputesEmbedContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('clinicReportingEmbedContainer') clinicReportingEmbedContainer?: ElementRef<HTMLDivElement>;

  stripeFacilities: StripeFacilityRow[] = [];
  stripeFacilitiesLoading = false;

  clinicPaymentsLoading = false;
  clinicPaymentsError: string | null = null;
  clinicPaymentsEmbedElement: HTMLElement | null = null;

  clinicTabIndex = 0;
  clinicEmbedLoading = false;
  clinicEmbedError: string | null = null;
  clinicEmbedElement: HTMLElement | null = null;

  selectedFacilityIdForEmbed: number | string | null = null;

  get selectedFacilityForEmbed(): StripeFacilityRow | null {
    if (this.selectedFacilityIdForEmbed == null) return null;
    return this.stripeFacilities.find((f) => f?.facilityId === this.selectedFacilityIdForEmbed) ?? null;
  }

  constructor(
    private cdr: ChangeDetectorRef,
    private title: TitleService,
    private auth: AuthService,
    private stripeApi: StripeApiService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.hydrateUserContext();
    this.title.updateTitle('Payment Dashboard');

    if (this.isClinicAdmin) {
      this.loadEmbeddedDashboard();
    }
    if (this.isGlobalAdmin) {
      this.loadStripeFacilities();
    }
  }

  ngAfterViewInit(): void {
    if (this.isClinicAdmin) {
      this.loadClinicPaymentsEmbed();
    }
  }

  onStripeTabChange(index: number): void {
    if (!this.isGlobalAdmin) return;

    this.stripeTabIndex = index;
    this.clearEmbeddedComponent();
    this.embedError = null;
    this.cdr.markForCheck();

    if (index === 0) {
      this.loadStripeFacilities();
      return;
    }
    if (this.selectedFacilityIdForEmbed != null) {
      if (index === 1) this.loadEmbeddedComponent('payments', 'paymentsEmbedContainer');
      if (index === 2) this.loadEmbeddedComponent('balances', 'balancesEmbedContainer');
      if (index === 3) this.loadEmbeddedComponent('payouts-list', 'payoutsEmbedContainer');
      if (index === 4) this.loadEmbeddedComponent('disputes-list', 'disputesEmbedContainer');
      if (index === 5) this.loadEmbeddedComponent('documents', 'reportingEmbedContainer');
    }
  }

  onFacilityForEmbedChange(): void {
    this.clearEmbeddedComponent();
    this.embedError = null;
    if (this.stripeTabIndex === 0) return;
    if (this.selectedFacilityIdForEmbed == null) {
      this.cdr.markForCheck();
      return;
    }
    if (this.stripeTabIndex === 1) this.loadEmbeddedComponent('payments', 'paymentsEmbedContainer');
    if (this.stripeTabIndex === 2) this.loadEmbeddedComponent('balances', 'balancesEmbedContainer');
    if (this.stripeTabIndex === 3) this.loadEmbeddedComponent('payouts-list', 'payoutsEmbedContainer');
    if (this.stripeTabIndex === 4) this.loadEmbeddedComponent('disputes-list', 'disputesEmbedContainer');
    if (this.stripeTabIndex === 5) this.loadEmbeddedComponent('documents', 'reportingEmbedContainer');
  }

  onClinicTabChange(index: number): void {
    if (!this.isClinicAdmin) return;
    this.clinicTabIndex = index;
    this.clearClinicEmbed();
    this.clinicEmbedError = null;
    this.cdr.markForCheck();

    if (index === 0) {

      this.loadClinicPaymentsEmbed();
      return;
    }
    if (index === 1) this.loadClinicFacilityComponent('balances', 'clinicBalancesEmbedContainer');
    if (index === 2) this.loadClinicFacilityComponent('payouts', 'clinicPayoutsEmbedContainer');
    if (index === 3) this.loadClinicFacilityComponent('disputes-list', 'clinicDisputesEmbedContainer');
    if (index === 4) this.loadClinicFacilityComponent('documents', 'clinicReportingEmbedContainer');
  }

  refreshEmbeddedDashboard(): void {
    this.loadEmbeddedDashboard();
  }

  async loadClinicPaymentsEmbed(): Promise<void> {
    if (!this.isClinicAdmin) return;

    const publishableKey = (environment as { stripePublishableKey?: string }).stripePublishableKey ?? '';
    if (!publishableKey) {
      this.clinicPaymentsError = 'Stripe publishable key is not configured.';
      this.cdr.markForCheck();
      return;
    }

    this.clinicPaymentsLoading = true;
    this.clinicPaymentsError = null;
    if (this.clinicPaymentsEmbedElement?.parentNode) {
      this.clinicPaymentsEmbedElement.remove();
    }
    this.clinicPaymentsEmbedElement = null;
    const container = this.clinicPaymentsEmbedContainer?.nativeElement;
    if (container) container.innerHTML = '';
    this.cdr.markForCheck();

    const fetchClientSecret = async (): Promise<string> => {
      const res = await firstValueFrom(this.stripeApi.getAccountSessionForFacilityPayments(true));
      const secret = res?.data?.clientSecret ?? (res?.data as { client_secret?: string })?.client_secret;
      if (!secret) throw new Error(res?.message ?? 'Failed to get account session.');
      return secret;
    };

    try {
      const loadConnectAndInitialize = await loadStripeConnectAndInitialize();
      const instance = loadConnectAndInitialize({ publishableKey, fetchClientSecret });
      const element = instance.create('payments');
      if (element) {
        this.clinicPaymentsEmbedElement = element as HTMLElement;
        setTimeout(() => {
          const el = this.clinicPaymentsEmbedContainer?.nativeElement;
          if (el && this.clinicPaymentsEmbedElement) {
            el.innerHTML = '';
            el.appendChild(this.clinicPaymentsEmbedElement);
          }
          this.clinicPaymentsLoading = false;
          this.cdr.markForCheck();
        }, 100);
      } else {
        this.clinicPaymentsError = 'Could not create Stripe Payments component.';
        this.clinicPaymentsLoading = false;
        this.cdr.markForCheck();
      }
    } catch (err) {
      this.clinicPaymentsError = err instanceof Error ? err.message : 'Failed to load Payments.';
      this.clinicPaymentsLoading = false;
      this.cdr.markForCheck();
    }
  }

  openStripeDashboard(): void {
    const url = this.dashboardPublicUrl || this.defaultDashboardUrl();
    if (typeof window !== 'undefined' && url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  loadStripeFacilities(): void {
    if (!this.isGlobalAdmin) return;

    this.stripeFacilitiesLoading = true;
    this.cdr.markForCheck();

    this.stripeApi
      .getAdminFacilities()
      .pipe(
        finalize(() => {
          this.stripeFacilitiesLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res) => {
          this.stripeFacilities = this.unwrapStripeList<StripeFacilityRow>(res);
        },
        error: () => {
          this.stripeFacilities = [];
        },
      });
  }

  async loadEmbeddedComponent(
    component: 'payments' | 'payouts-list' | 'disputes-list' | 'balances' | 'documents',
    containerRef: 'paymentsEmbedContainer' | 'payoutsEmbedContainer' | 'disputesEmbedContainer' | 'balancesEmbedContainer' | 'reportingEmbedContainer'
  ): Promise<void> {
    if (!this.isGlobalAdmin || this.selectedFacilityIdForEmbed == null) return;

    const publishableKey = (environment as { stripePublishableKey?: string }).stripePublishableKey ?? '';
    if (!publishableKey) {
      this.embedError = 'Stripe publishable key is not configured.';
      this.embedLoading = false;
      this.cdr.markForCheck();
      return;
    }

    this.embedLoading = true;
    this.embedError = null;
    this.clearEmbeddedComponent();
    this.cdr.markForCheck();

    const facilityId = this.selectedFacilityIdForEmbed;
    const fetchClientSecret = async (): Promise<string> => {
      const res = await firstValueFrom(this.stripeApi.getAccountSessionForConnectedFacility(facilityId, component));
      const secret = res?.data?.clientSecret ?? (res?.data as { client_secret?: string })?.client_secret;
      if (!secret) throw new Error(res?.message ?? 'Failed to get account session.');
      return secret;
    };

    try {
      const loadConnectAndInitialize = await loadStripeConnectAndInitialize();
      const instance = loadConnectAndInitialize({ publishableKey, fetchClientSecret });
      const element = instance.create(component);
      if (element) {
        this.embedElement = element as HTMLElement;
        setTimeout(() => this.mountEmbedComponent(containerRef), 100);
      } else {
        this.embedError = `Could not create Stripe ${component} component.`;
      }
    } catch (err) {
      this.embedError = err instanceof Error ? err.message : 'Failed to load Stripe Connect component.';
    } finally {
      this.embedLoading = false;
      this.cdr.markForCheck();
    }
  }

  private mountEmbedComponent(
    ref: 'paymentsEmbedContainer' | 'payoutsEmbedContainer' | 'disputesEmbedContainer' | 'balancesEmbedContainer' | 'reportingEmbedContainer'
  ): void {
    const container =
      ref === 'paymentsEmbedContainer'
        ? this.paymentsEmbedContainer?.nativeElement
        : ref === 'payoutsEmbedContainer'
        ? this.payoutsEmbedContainer?.nativeElement
        : ref === 'disputesEmbedContainer'
        ? this.disputesEmbedContainer?.nativeElement
        : ref === 'balancesEmbedContainer'
        ? this.balancesEmbedContainer?.nativeElement
        : this.reportingEmbedContainer?.nativeElement;
    if (container && this.embedElement) {
      container.innerHTML = '';
      container.appendChild(this.embedElement);
    }
  }

  private clearEmbeddedComponent(): void {
    if (this.embedElement?.parentNode) {
      this.embedElement.remove();
    }
    this.embedElement = null;
    [
      this.paymentsEmbedContainer,
      this.payoutsEmbedContainer,
      this.disputesEmbedContainer,
      this.balancesEmbedContainer,
      this.reportingEmbedContainer,
    ].forEach((c) => {
      const el = c?.nativeElement;
      if (el) el.innerHTML = '';
    });
  }

  async loadClinicFacilityComponent(
    component: 'balances' | 'payouts' | 'payouts-list' | 'disputes-list' | 'documents' | 'reporting',
    containerRef: 'clinicBalancesEmbedContainer' | 'clinicPayoutsEmbedContainer' | 'clinicDisputesEmbedContainer' | 'clinicReportingEmbedContainer'
  ): Promise<void> {
    if (!this.isClinicAdmin) return;

    const publishableKey = (environment as { stripePublishableKey?: string }).stripePublishableKey ?? '';
    if (!publishableKey) {
      this.clinicEmbedError = 'Stripe publishable key is not configured.';
      this.clinicEmbedLoading = false;
      this.cdr.markForCheck();
      return;
    }

    this.clinicEmbedLoading = true;
    this.clinicEmbedError = null;
    this.clearClinicEmbed();
    this.cdr.markForCheck();

    const fetchClientSecret = async (): Promise<string> => {
      const res = await firstValueFrom(
        this.stripeApi.getAccountSessionForFacilityComponent(component, false)
      );
      const secret = res?.data?.clientSecret ?? (res?.data as { client_secret?: string })?.client_secret;
      if (!secret) throw new Error(res?.message ?? 'Failed to get account session.');
      return secret;
    };

    try {
      const loadConnectAndInitialize = await loadStripeConnectAndInitialize();
      const instance = loadConnectAndInitialize({ publishableKey, fetchClientSecret });

      const sdkComponent = component === 'reporting' ? 'documents' : component;
      const element = instance.create(sdkComponent as any);
      if (element) {
        this.clinicEmbedElement = element as HTMLElement;
        setTimeout(() => this.mountClinicEmbed(containerRef), 100);
      } else {
        this.clinicEmbedError = `Could not create Stripe ${component} component.`;
      }
    } catch (err) {
      this.clinicEmbedError = err instanceof Error ? err.message : 'Failed to load Stripe Connect component.';
    } finally {
      this.clinicEmbedLoading = false;
      this.cdr.markForCheck();
    }
  }

  private mountClinicEmbed(
    ref: 'clinicBalancesEmbedContainer' | 'clinicPayoutsEmbedContainer' | 'clinicDisputesEmbedContainer' | 'clinicReportingEmbedContainer'
  ): void {
    const container =
      ref === 'clinicBalancesEmbedContainer'
        ? this.clinicBalancesEmbedContainer?.nativeElement
        : ref === 'clinicPayoutsEmbedContainer'
        ? this.clinicPayoutsEmbedContainer?.nativeElement
        : ref === 'clinicDisputesEmbedContainer'
        ? this.clinicDisputesEmbedContainer?.nativeElement
        : this.clinicReportingEmbedContainer?.nativeElement;
    if (container && this.clinicEmbedElement) {
      container.innerHTML = '';
      container.appendChild(this.clinicEmbedElement);
    }
  }

  private clearClinicEmbed(): void {
    if (this.clinicEmbedElement?.parentNode) {
      this.clinicEmbedElement.remove();
    }
    this.clinicEmbedElement = null;
    [
      this.clinicBalancesEmbedContainer,
      this.clinicPayoutsEmbedContainer,
      this.clinicDisputesEmbedContainer,
      this.clinicReportingEmbedContainer,
    ].forEach((c) => {
      const el = c?.nativeElement;
      if (el) el.innerHTML = '';
    });
  }

  getFacilityOptionId(f: StripeFacilityRow): number | string {
    const id = f?.facilityId;
    return id !== undefined && id !== null ? id : 0;
  }

  getFacilityOptionLabel(f: StripeFacilityRow): string {
    const id = this.getFacilityOptionId(f);
    const name = f?.facilityName;
    return (name != null && String(name).trim()) ? `${name} (ID: ${id})` : `Facility (ID: ${id})`;
  }

  stripeOnboardingStatus(row: StripeFacilityRow): string {
    const chargesEnabled = this.stripeChargesEnabled(row);
    const payoutsEnabled = this.stripePayoutsEnabled(row);
    const detailsSubmitted = !!((row as any)?.detailsSubmitted ?? (row as any)?.details_submitted);

    if (chargesEnabled && payoutsEnabled) return 'Connected';
    if (detailsSubmitted) return 'Pending';
    return 'Not Connected';
  }

  stripeChargesEnabled(row: StripeFacilityRow): boolean {
    return !!((row as any)?.chargesEnabled ?? (row as any)?.charges_enabled);
  }

  stripePayoutsEnabled(row: StripeFacilityRow): boolean {
    return !!((row as any)?.payoutsEnabled ?? (row as any)?.payouts_enabled);
  }

  private hydrateUserContext(): void {
    this.userRole = this.auth.getUserRole() || '';
    this.facilityId = this.auth.getUserFacilityId();

    if (!this.userRole || this.facilityId == null) {
      const userDataRaw = localStorage.getItem('userData');
      if (userDataRaw) {
        try {
          const userData = JSON.parse(userDataRaw);
          this.userRole = this.userRole || userData?.roleName || '';
          this.facilityId = this.facilityId ?? userData?.facilityId ?? null;
        } catch {

        }
      }
    }

    this.isGlobalAdmin = this.userRole === 'Global Admin';
    this.isClinicAdmin = this.userRole === 'Clinic Admin';
  }

  private loadEmbeddedDashboard(): void {
    this.dashboardLoading = true;
    this.dashboardError = null;
    this.dashboardSafeUrl = null;
    this.dashboardPublicUrl = null;
    this.cdr.markForCheck();

    const request$ = this.isGlobalAdmin
      ? this.stripeApi.getAdminDashboardLink()
      : this.facilityId != null
      ? this.stripeApi.getFacilityDashboardLink(this.facilityId)
      : null;

    if (!request$) {
      this.applyDashboardFallback('Unable to load embedded Stripe dashboard for this user context.');
      return;
    }

    request$
      .pipe(
        finalize(() => {
          this.dashboardLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res) => {
          const url = this.extractDashboardUrl(res);
          if (!url) {
            this.applyDashboardFallback('Embedded dashboard link is not available right now.');
            return;
          }

          this.dashboardPublicUrl = url;
          this.dashboardSafeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
          this.dashboardError = null;
        },
        error: () => {
          this.applyDashboardFallback('Embedded dashboard is unavailable. Use "Open Stripe Dashboard".');
        },
      });
  }

  private applyDashboardFallback(message: string): void {
    const fallbackUrl = this.defaultDashboardUrl();
    this.dashboardError = message;
    this.dashboardPublicUrl = fallbackUrl;
    this.dashboardSafeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(fallbackUrl);
    this.dashboardLoading = false;
    this.cdr.markForCheck();
  }

  private extractDashboardUrl(res: any): string | null {
    const candidates = [
      res?.url,
      res?.data?.url,
      res?.dashboardUrl,
      res?.data?.dashboardUrl,
      res?.link,
      res?.data?.link,
    ];

    const url = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    return typeof url === 'string' ? url : null;
  }

  private defaultDashboardUrl(): string {
    return 'https://dashboard.stripe.com/express';
  }

  private unwrapStripeList<T>(res: any): T[] {
    const data = res?.data ?? res?.items ?? res?.results ?? res ?? [];
    return Array.isArray(data) ? data : [];
  }
}
