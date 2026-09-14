import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'environments/environment';

export interface StripeApiResponse<T = unknown> {
  status: number;
  message: string;
  data?: T;
}

@Injectable({ providedIn: 'root' })
export class StripeApiService {

  private baseUrl = `${environment.PROTOCOL}://${environment.baseURL}/`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders().set('Content-Type', 'application/json');
    if (typeof window !== 'undefined') {
      const authToken = localStorage.getItem('isolHealthToken');
      if (authToken) {
        headers = headers.set('Authorization', `Bearer ${authToken}`);
      }
    }
    return headers;
  }

  createFacilityAccount(displayName: string, contactEmail: string): Observable<StripeApiResponse> {
    return this.http.post<StripeApiResponse>(
      `${this.baseUrl}StripeConnect/account/create`,
      { displayName, contactEmail },
      { headers: this.getHeaders() }
    );
  }

  createFacilityAccountDestination(displayName: string, contactEmail: string): Observable<StripeApiResponse> {
    return this.http.post<StripeApiResponse>(
      `${this.baseUrl}StripeConnect/account/create-destination`,
      { displayName, contactEmail },
      { headers: this.getHeaders() }
    );
  }

  getOnboardLink(): Observable<StripeApiResponse<{ url?: string }>> {
    return this.http.get<StripeApiResponse<{ url?: string }>>(
      `${this.baseUrl}StripeConnect/account/onboard-link`,
      { headers: this.getHeaders() }
    );
  }

  createOnboardingLink(
    _facilityId: number | string,
    _returnUrl: string,
    _refreshUrl: string
  ): Observable<StripeApiResponse<{ url?: string }>> {
    return this.getOnboardLink();
  }

  getEmbeddedOnboardingSession(): Observable<StripeApiResponse<{ clientSecret?: string }>> {
    return this.http.get<StripeApiResponse<{ clientSecret?: string }>>(
      `${this.baseUrl}StripeConnect/account/account-session`,
      { headers: this.getHeaders() }
    );
  }

  getAccountSessionForPlatform(component: 'payments' | 'payment-details' | 'payouts-list' | 'disputes-list'): Observable<StripeApiResponse<StripeAccountSessionData>> {
    return this.http.get<StripeApiResponse<StripeAccountSessionData>>(
      `${this.baseUrl}StripeConnect/account/account-session-platform`,
      { headers: this.getHeaders(), params: { component } }
    );
  }

  getAccountSessionForConnectedFacility(
    facilityId: number | string,
    component: 'payments' | 'payment-details' | 'payouts' | 'payouts-list' | 'disputes-list' | 'balances' | 'documents' | 'reporting'
  ): Observable<StripeApiResponse<StripeAccountSessionData>> {
    return this.http.get<StripeApiResponse<StripeAccountSessionData>>(
      `${this.baseUrl}StripeConnect/account/account-session-connected`,
      { headers: this.getHeaders(), params: { facilityId: String(facilityId), component } }
    );
  }

  getAccountSessionForFacilityPayments(readOnly: boolean = true): Observable<StripeApiResponse<StripeAccountSessionData>> {
    return this.http.get<StripeApiResponse<StripeAccountSessionData>>(
      `${this.baseUrl}StripeConnect/account/account-session-facility-payments`,
      { headers: this.getHeaders(), params: { readOnly: String(readOnly) } }
    );
  }

  getAccountSessionForFacilityComponent(
    component: 'balances' | 'payouts' | 'payouts-list' | 'disputes-list' | 'reporting' | 'documents' | 'payments' | 'payment-details',
    readOnly: boolean = false
  ): Observable<StripeApiResponse<StripeAccountSessionData>> {
    return this.http.get<StripeApiResponse<StripeAccountSessionData>>(
      `${this.baseUrl}StripeConnect/account/account-session-facility-component`,
      { headers: this.getHeaders(), params: { component, readOnly: String(readOnly) } }
    );
  }

  createEmbeddedOnboardingSession(
    _facilityId: number | string,
    _returnUrl: string,
    _refreshUrl: string
  ): Observable<StripeApiResponse<{ clientSecret?: string; url?: string }>> {
    return this.getEmbeddedOnboardingSession();
  }

  getFacilityStatus(_facilityId: number | string): Observable<StripeApiResponse<StripeAccountStatus>> {

    const params = new HttpParams().set('patientFacilityId', _facilityId)

    return this.http.get<StripeApiResponse<StripeAccountStatus>>(
      `${this.baseUrl}StripeConnect/account/status`,
      { headers: this.getHeaders(),params: params }
    );
  }

  getFacilityDashboardLink(_facilityId: number | string): Observable<StripeApiResponse<{ checkoutUrl?: string }>> {
    return this.http.get<StripeApiResponse<{ checkoutUrl?: string }>>(
      `${this.baseUrl}StripeConnect/subscription/portal`,
      { headers: this.getHeaders() }
    );
  }

  onboardingComplete(): Observable<StripeApiResponse<{ message?: string }>> {
    return this.http.post<StripeApiResponse<{ message?: string }>>(
      `${this.baseUrl}StripeConnect/onboarding-complete`,
      {},
      { headers: this.getHeaders() }
    );
  }

  createGaBillingSetupSession(params: { successUrl: string; cancelUrl: string }): Observable<StripeApiResponse<{ checkoutUrl?: string }>> {
    return this.http.post<StripeApiResponse<{ checkoutUrl?: string }>>(
      `${this.baseUrl}StripeConnect/create-ga-billing-setup-session`,
      { successUrl: params.successUrl, cancelUrl: params.cancelUrl },
      { headers: this.getHeaders() }
    );
  }

  getGaBillingStatus(): Observable<StripeApiResponse<GaBillingStatus>> {
    return this.http.get<StripeApiResponse<GaBillingStatus>>(
      `${this.baseUrl}StripeConnect/ga-billing-status`,
      { headers: this.getHeaders() }
    );
  }

  createPaymentIntent(payload: {
    facilityId: number | string;
    amount: number;
    applicationFeeAmountCents?: number;
    currency: string;
    orderId?: number | string | null;
    patientId?: number | string | null;
    productId?: number | string | null;
    couponCode?: string | null;
  }): Observable<StripeApiResponse<StripePaymentIntentData>> {
    const requestBody: any = {
      facilityId: Number(payload.facilityId),
      amount: payload.amount,
      currency: payload.currency || 'usd',
      orderId: payload.orderId != null ? Number(payload.orderId) : undefined,
      patientId: payload.patientId != null ? Number(payload.patientId) : undefined,
      productId: payload.productId != null ? Number(payload.productId) : undefined,
      couponCode: payload.couponCode && payload.couponCode.trim() ? payload.couponCode.trim() : undefined,
    };

    if (typeof payload.applicationFeeAmountCents === 'number') {
      requestBody.applicationFeeAmountCents = payload.applicationFeeAmountCents;
    }

    return this.http.post<StripeApiResponse<StripePaymentIntentData>>(
      `${this.baseUrl}StripeConnect/payment-intent`,
      requestBody,
      { headers: this.getHeaders() }
    );
  }

  createPaymentIntentDestination(payload: {
    facilityId: number | string;
    amount: number;
    applicationFeeAmountCents?: number;
    currency: string;
    orderId?: number | string | null;
    patientId?: number | string | null;
    productId?: number | string | null;
    couponCode?: string | null;
  }): Observable<StripeApiResponse<StripePaymentIntentData>> {
    const requestBody: any = {
      facilityId: Number(payload.facilityId),
      amount: payload.amount,
      currency: payload.currency || 'usd',
      orderId: payload.orderId != null ? Number(payload.orderId) : undefined,
      patientId: payload.patientId != null ? Number(payload.patientId) : undefined,
      productId: payload.productId != null ? Number(payload.productId) : undefined,
      couponCode: payload.couponCode && payload.couponCode.trim() ? payload.couponCode.trim() : undefined,
    };

    if (typeof payload.applicationFeeAmountCents === 'number') {
      requestBody.applicationFeeAmountCents = payload.applicationFeeAmountCents;
    }

    return this.http.post<StripeApiResponse<StripePaymentIntentData>>(
      `${this.baseUrl}StripeConnect/payment-intent-destination`,
      requestBody,
      { headers: this.getHeaders() }
    );
  }

  createPatientSetupIntent(payload: {
    facilityId: number | string;
    patientId: number | string;
  }): Observable<StripeApiResponse<StripePaymentIntentData>> {
    return this.http.post<StripeApiResponse<StripePaymentIntentData>>(
      `${this.baseUrl}StripeConnect/patient/setup-intent`,
      { facilityId: Number(payload.facilityId), patientId: Number(payload.patientId) },
      { headers: this.getHeaders() }
    );
  }

  savePatientStripeCard(payload: {
    facilityId: number | string;
    userId: number | string;
    setupIntentId: string;
  }): Observable<StripeApiResponse<boolean>> {
    return this.http.post<StripeApiResponse<boolean>>(
      `${this.baseUrl}StripeConnect/patient/payment-methods/save`,
      { facilityId: Number(payload.facilityId), userId: Number(payload.userId), setupIntentId: payload.setupIntentId },
      { headers: this.getHeaders() }
    );
  }

  getPatientStripeCards(
    facilityId: number | string,
    userId: number | string
  ): Observable<StripeApiResponse<PatientStripeCard[]>> {
    return this.http.get<StripeApiResponse<PatientStripeCard[]>>(
      `${this.baseUrl}StripeConnect/patient/payment-methods`,
      { headers: this.getHeaders(), params: { facilityId: String(facilityId), userId: String(userId) } }
    );
  }

  detachPatientStripeCard(
    facilityId: number | string,
    userId: number | string,
    cardId: number | string
  ): Observable<StripeApiResponse<boolean>> {
    return this.http.post<StripeApiResponse<boolean>>(
      `${this.baseUrl}StripeConnect/patient/payment-methods/detach`,
      { facilityId: Number(facilityId), userId: Number(userId), cardId: Number(cardId) },
      { headers: this.getHeaders() }
    );
  }

  setPatientStripeDefaultCard(
    facilityId: number | string,
    userId: number | string,
    cardId: number | string
  ): Observable<StripeApiResponse<boolean>> {
    return this.http.post<StripeApiResponse<boolean>>(
      `${this.baseUrl}StripeConnect/patient/payment-methods/default`,
      { facilityId: Number(facilityId), userId: Number(userId), cardId: Number(cardId) },
      { headers: this.getHeaders() }
    );
  }

  getAdminFacilities(): Observable<unknown> {
    return this.http.get(`${this.baseUrl}admin/stripe/facilities`, {
      headers: this.getHeaders(),
    });
  }

  getAdminDashboardLink(): Observable<unknown> {
    return this.http.get(`${this.baseUrl}admin/stripe/dashboard-link`, {
      headers: this.getHeaders(),
    });
  }

  getAdminPayments(filters?: {
    facilityId?: string | number | null;
    status?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }): Observable<unknown> {
    let params = new HttpParams();
    if (filters?.facilityId) params = params.set('facilityId', String(filters.facilityId));
    if (filters?.status) params = params.set('status', String(filters.status));
    if (filters?.startDate) params = params.set('startDate', String(filters.startDate));
    if (filters?.endDate) params = params.set('endDate', String(filters.endDate));
    return this.http.get(`${this.baseUrl}admin/stripe/payments`, {
      headers: this.getHeaders(),
      params,
    });
  }

  getAdminPayouts(filters?: {
    facilityId?: string | number | null;
    status?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }): Observable<unknown> {
    let params = new HttpParams();
    if (filters?.facilityId) params = params.set('facilityId', String(filters.facilityId));
    if (filters?.status) params = params.set('status', String(filters.status));
    if (filters?.startDate) params = params.set('startDate', String(filters.startDate));
    if (filters?.endDate) params = params.set('endDate', String(filters.endDate));
    return this.http.get(`${this.baseUrl}admin/stripe/payouts`, {
      headers: this.getHeaders(),
      params,
    });
  }

  getAdminDisputes(filters?: {
    facilityId?: string | number | null;
    status?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }): Observable<unknown> {
    let params = new HttpParams();
    if (filters?.facilityId) params = params.set('facilityId', String(filters.facilityId));
    if (filters?.status) params = params.set('status', String(filters.status));
    if (filters?.startDate) params = params.set('startDate', String(filters.startDate));
    if (filters?.endDate) params = params.set('endDate', String(filters.endDate));
    return this.http.get(`${this.baseUrl}admin/stripe/disputes`, {
      headers: this.getHeaders(),
      params,
    });
  }
}

export interface GaBillingStatus {
  hasPlatformCustomer?: boolean;
  hasPaymentMethod?: boolean;
}

export interface StripeAccountStatus {
  readyToProcessPayments?: boolean;
  onboardingComplete?: boolean;
  requirementsStatus?: string;
  error?: string;

  chargesEnabled?: boolean;
  charges_enabled?: boolean;
  detailsSubmitted?: boolean;
  details_submitted?: boolean;
}

export interface StripePaymentIntentData {
  clientSecret?: string;
  client_secret?: string;

  stripeIntentKind?: string;
  stripe_intent_kind?: string;
}

export interface PatientStripeCard {
  cardId: number;
  paymentMethodId?: string;
  cardBrand?: string;
  last4?: string;
  expirationMonth?: string;
  expirationYear?: string;
  cardHolderName?: string;
  isDefault?: boolean;
}

export interface StripeAccountSessionData {
  clientSecret?: string;
  client_secret?: string;
  stripeAccountId?: string;
  stripe_account_id?: string;
  component?: string;
}
