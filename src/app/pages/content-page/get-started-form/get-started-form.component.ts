import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { GeneralService } from 'app/shared/services/general.service';
import { SquarePaymentService } from 'app/square-payment.service';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NgxUiLoaderService } from 'ngx-ui-loader';
import { StripeApiService, StripeAccountStatus } from 'app/shared/services/stripe-api.service';
import { StripeService } from 'ngx-stripe';
import { Observable } from 'rxjs';
import {
  StripeConstructorOptions,
  StripeElements,
  StripePaymentElement,
  StripePaymentElementOptions,
} from '@stripe/stripe-js';

@Component({
  selector: 'app-get-started-form',
  templateUrl: './get-started-form.component.html',
  styleUrl: './get-started-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GetStartedFormComponent implements OnInit, OnDestroy {
  step: 'categories' | 'detail' | 'signup' | 'payment' | 'provider card' | 'providers' | 'confirmation' = 'categories';

  paymentProvider: 'stripe' | 'square' | 'none' = 'none';
  paymentProviderLoading = false;
  paymentProviderMessage: string | null = null;

  paymentElementOptions: StripePaymentElementOptions = { layout: 'tabs' };
  stripeClientSecret: string | null = null;
  stripeLoading = false;
  stripeReturnState: 'idle' | 'processing' | 'succeeded' | 'failed' = 'idle';
  stripeReturnMessage: string | null = null;
  stripeErrorMessage: string | null = null;
  stripeConnectedAccountId: string | null = null;
  stripePublishableKey: string | null = null;

  stripeChargeMode: 'direct' | 'destination' = 'direct';
  private stripeElements: StripeElements | null = null;
  private stripePaymentElementInstance: StripePaymentElement | null = null;
  private stripeContextSignature: string | null = null;

  private lastStripePaymentIntentId: string | null = null;
  private lastStripeSetupIntentId: string | null = null;
  stripeIntentKind: 'payment' | 'setup' | null = null;
  stripeCheckoutSkippedCoupon = false;
  currency = 'usd';

  card: any;
  isSquareReady = false;
  isSquareInitializing = false;
  squareErrorMessage: string | null = null;

  categories: any[] = [];
  providers: any[] = [];
  selectedCategory: any = undefined;
  selectedPlan: any = null;
  selectedProvider: any = null;
  selectedDate: Date | null = null;
  formattedDate: string | null = null;
  facilityId: any = null;
  signUpForm!: FormGroup;
  applicationID: string = '';
  locationID: string = '';
  userId: any;
  patientId: any;
  isFormSubmitting: boolean = false;
  emailDuplicateCheck: boolean = false;

  slots: any[] = [];
  loadingSlots = false;
  slotsError: string | null = null;
  selectedSlot: any;

  couponCode: string = '';
  isCouponValidating: boolean = false;
  couponErrorMessage: string | null = null;
  couponSuccessMessage: string | null = null;
  couponValid: boolean = false;
  couponApplied: boolean = false;
  authorizeRecurringCardCharge: boolean = false;

  constructor(
    private ngxService: NgxUiLoaderService,
    private squareService: SquarePaymentService,
    private route: ActivatedRoute,
    private router: Router,
    private generalService: GeneralService,
    private cdr: ChangeDetectorRef,
    private notification: NzNotificationService,
    private formBuilder: FormBuilder,
    private stripeApi: StripeApiService,
    private stripeService: StripeService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.facilityId = Number(params['clinicId']);
    });

    this.handleStripeReturn();

    this.generalService.getCategoriesWithBundlesByFacilityId(this.facilityId).subscribe(
      (response) => {
        this.categories = response.data;
        this.cdr.markForCheck();
      },
      (error) => {
        console.error('Error fetching categories with drugs:', error);
      }
    );

    this.initSignUpForm();
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.destroyStripePaymentElement();
  }

  initSignUpForm() {
    this.signUpForm = this.formBuilder.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
        ]
      ],
      confirm: ['', Validators.required],
      phone: ['', Validators.required],
      note: ['']
    });
  }

  selectCategory(type: any) {
    this.selectedCategory = type;
    this.step = 'detail';
  }

  goBack(to: typeof this.step) {
    this.step = to;
  }

  goBackToSlots(to: typeof this.step) {
    this.slots = []
    this.selectedDate = null
    this.formattedDate = null
    this.step = to;
  }

  goToSignup(plan: any) {
    this.selectedPlan = plan;
    this.step = 'signup';
  }

  maskPhone() {
    let value: string = this.signUpForm.get('phone')?.value || '';
    value = value.replace(/\D/g, '').slice(0, 10);

    if (value.length > 6) {
      this.signUpForm.get('phone')?.setValue(`(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`, { emitEvent: false });
    } else if (value.length > 3) {
      this.signUpForm.get('phone')?.setValue(`(${value.slice(0, 3)}) ${value.slice(3)}`, { emitEvent: false });
    } else if (value.length > 0) {
      this.signUpForm.get('phone')?.setValue(`(${value}`, { emitEvent: false });
    }
  }

  checkPasswords() {
    if (this.signUpForm.controls['password']?.value != this.signUpForm.controls['confirm']?.value) {
      this.signUpForm.controls['confirm']?.setErrors({ mismatch: true });
      this.cdr.markForCheck();
      return;
    } else {
      this.signUpForm.controls['confirm']?.setErrors(null);
      this.cdr.markForCheck();
    }
  }

  submitSignup() {
    if (this.signUpForm.controls['phone']?.value.replace(/\D/g, '').length !== 10) {
      alert('Enter valid 10-digit phone number.');
      return;
    }

    this.isFormSubmitting = true;

    const payload = {
      facilityId: this.facilityId,
      firstName: this.signUpForm.controls['firstName']?.value,
      lastName: this.signUpForm.controls['lastName']?.value,
      email: this.signUpForm.controls['email']?.value,
      password: this.signUpForm.controls['password']?.value,

      phone:this.signUpForm.controls['phone']?.value.replace(/\D/g, '')
    };

    this.generalService.savePatient(payload).subscribe(
      (response) => {

        if(response.status == 0){
          this.generalService.showError(response.message)
          this.isFormSubmitting = false;
          this.cdr.markForCheck();
        }
        else{
        this.applicationID = response.data.applicationId;
        this.locationID = response.data.locationId;
        this.patientId = response.data.patientId;
        this.userId = response.data.userId;
        this.notification.success('Success', 'Sign Up Successful! Please proceed to payment.');
        this.isFormSubmitting = false;
        this.cdr.markForCheck();
        this.generalService.getAllProviders(this.facilityId, this.selectedCategory?.categoryId)
          .subscribe((providersRes) => {
            const baseProviders = providersRes.data || [];

            this.providers = baseProviders.map((p: any) => ({
              ...p,
              meta: this.generateProviderMeta()
            }));

            this.step = 'provider card';
            this.isFormSubmitting = false;
            this.cdr.markForCheck();
          });
        }
      },
      (error) => {
        this.isFormSubmitting = false;
        this.cdr.markForCheck()
        this.generalService.showError(error)
        console.error('Error saving patient:', error);
      }
    );
  }

  addCard() {
    this.stripeCheckoutSkippedCoupon = false;
    this.stripeIntentKind = null;
    this.lastStripeSetupIntentId = null;
    this.lastStripePaymentIntentId = null;
    this.step = 'payment';
    this.resolvePaymentProvider();
  }

  private resolvePaymentProvider(): void {
    if (!this.facilityId) {
      this.paymentProvider = 'none';
      this.paymentProviderMessage = 'Payment is currently unavailable. Please try again later.';
      this.cdr.markForCheck();
      return;
    }

    this.paymentProviderLoading = true;
    this.paymentProviderMessage = null;
    this.stripeClientSecret = null;
    this.squareErrorMessage = null;
    this.stripeErrorMessage = null;
    this.cdr.markForCheck();

    this.generalService.commonGet(`Facilities/getFacilityPaymentMode?id=${this.facilityId}`).subscribe({
      next: (res) => {
        const data = res?.data ?? res;
        const paymentModeId = data?.paymentModeId != null ? Number(data.paymentModeId) : 1;
        if (paymentModeId === 2) {
          this.stripeChargeMode = 'direct';
          this.resolveStripeOnly();
          return;
        }
        if (paymentModeId === 3) {
          this.stripeChargeMode = 'destination';
          this.resolveStripeOnly();
          return;
        }
        this.resolveSquareOnly();
      },
      error: () => this.resolveSquareOnly(),
    });
  }

  private resolveStripeOnly(): void {
    this.destroyStripePaymentElement();
    this.stripeClientSecret = null;
    this.stripeIntentKind = null;
    this.lastStripeSetupIntentId = null;
    this.stripeLoading = false;
    this.stripeApi.getFacilityStatus(this.facilityId).subscribe({
      next: (res) => {
        const status = (res?.data ?? res) as StripeAccountStatus | undefined;
        const chargesEnabled = !!(status?.chargesEnabled ?? status?.charges_enabled ?? status?.readyToProcessPayments);
        const detailsSubmitted = !!(status?.detailsSubmitted ?? status?.details_submitted ?? status?.onboardingComplete);
        this.stripeConnectedAccountId =
          this.pickFirstString([
            (status as any)?.stripeAccountId,
            (status as any)?.stripe_account_id,
            (status as any)?.stripeAccount,
            (status as any)?.stripe_account,
            (status as any)?.accountId,
            (status as any)?.account_id,
          ]) ?? this.stripeConnectedAccountId;
        this.stripePublishableKey =
          this.pickFirstString([
            (status as any)?.publishableKey,
            (status as any)?.publishable_key,
            (status as any)?.stripePublishableKey,
            (status as any)?.stripe_publishable_key,
          ]) ?? this.stripePublishableKey;

        const backendChargeMode = this.pickFirstString([
          (status as any)?.chargeMode,
          (status as any)?.charge_mode,
        ]);
        if (backendChargeMode && backendChargeMode.toLowerCase() === 'destination') {
          this.stripeChargeMode = 'destination';
        } else if (backendChargeMode && backendChargeMode.toLowerCase() === 'direct') {
          this.stripeChargeMode = 'direct';
        }

        const isReady = this.stripeChargeMode === 'destination'
          ? !!this.stripeConnectedAccountId
          : chargesEnabled;

        if (isReady) {
          this.card = null;
          this.isSquareReady = false;
          this.isSquareInitializing = false;
          this.squareErrorMessage = null;
          this.paymentProvider = 'stripe';
          this.paymentProviderLoading = false;
          this.cdr.markForCheck();
          this.tryPrepareStripeCheckout();
          return;
        }
        this.paymentProvider = 'none';
        this.paymentProviderMessage = detailsSubmitted
          ? 'Payment setup is in progress. Please try again later.'
          : 'Stripe payment is not available for this facility. Please try again later.';
        this.paymentProviderLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.paymentProvider = 'none';
        this.paymentProviderMessage = 'Payment is currently unavailable. Please try again later.';
        this.paymentProviderLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private resolveSquareOnly(): void {
    this.resolveSquareProvider();
  }

  private resolveSquareProvider(): void {
    this.destroyStripePaymentElement();
    this.stripeClientSecret = null;
    this.stripeLoading = false;
    if (this.applicationID && this.locationID) {
      this.paymentProvider = 'square';
      this.paymentProviderLoading = false;
      this.cdr.markForCheck();
      this.initSquareCard();
      return;
    }
    this.fetchSquareIds();
  }

  private fetchSquareIds(): void {
    this.generalService.getSquareAppIdByFacilityId(this.facilityId).subscribe({
      next: (res) => {
        this.applicationID = res?.applicationId || '';
        this.locationID = res?.locationId || '';
        if (this.applicationID && this.locationID) {
          this.paymentProvider = 'square';
          this.initSquareCard();
        } else {
          this.paymentProvider = 'none';
          this.paymentProviderMessage = 'Payment is currently unavailable. Please try again later.';
        }
        this.paymentProviderLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.paymentProvider = 'none';
        this.paymentProviderMessage = 'Payment is currently unavailable. Please try again later.';
        this.paymentProviderLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private initSquareCard(): void {
    if (this.paymentProvider !== 'square') return;
    if (this.isSquareReady && this.card) return;

    if (!this.applicationID || !this.locationID) {
      this.squareErrorMessage = 'Unable to load card input.';
      this.isSquareReady = false;
      this.card = null;
      this.cdr.markForCheck();
      return;
    }

    this.isSquareInitializing = true;
    this.isSquareReady = false;
    this.squareErrorMessage = null;
    this.card = null;
    this.cdr.markForCheck();

    setTimeout(async () => {
      try {
        await this.squareService.init(this.applicationID, this.locationID);
        this.card = await this.squareService.createCard('#card-container');
        this.isSquareReady = true;
      } catch (error) {
        console.error('Square init error:', error);
        this.squareErrorMessage = 'Unable to load card input.';
        this.isSquareReady = false;
        this.card = null;
      } finally {
        this.isSquareInitializing = false;
        this.cdr.markForCheck();
      }
    }, 0);
  }

  async saveCard() {
    if (this.paymentProvider === 'stripe') {
      this.confirmStripePayment();
      return;
    }

    if (this.paymentProvider !== 'square') {
      this.notification.error('Error', 'Payment is currently unavailable.');
      return;
    }

    if (!this.card || !this.isSquareReady) {
      this.notification.error('Error', 'Card input is not ready. Please try again.');
      return;
    }

    this.stripeReturnState = 'idle';
    this.stripeReturnMessage = null;
    this.ngxService.start();
    this.isFormSubmitting = true;
    this.cdr.markForCheck();

    try {
      const result = await this.card.tokenize();
      this.ngxService.stop();
      if (result.status === 'OK') {
        const payload = {
          sourceId: result.token,
          userId: this.userId,
          patientId: this.patientId,
          productId: this.selectedPlan.bundleId,
          facilityId: this.facilityId,
          price: this.selectedPlan.price,
          couponCode: this.couponApplied && this.couponCode ? this.couponCode : null,
          providerScheduledSlotId: this.selectedSlot.providerScheduledSlotId,
          providerId: this.selectedSlot.providerId,
          isRecurring: this.selectedPlan.isRecurring,
        };
        this.generalService.CreatePaymentAndAppointment(payload).subscribe({
          next: (response) => {
            this.isFormSubmitting = false;
            if (response?.status === 200) {
              this.notification.success('Success', response.message);
              this.step = 'confirmation';
            } else {

              this.notification.error(
                'Error',
                response?.message || 'Payment failed. Please try again.'
              );
            }
            this.cdr.markForCheck();
          },
          error: (err) => {
            console.error(err);
            this.isFormSubmitting = false;

            this.notification.error(
              'Error',
              err?.error?.message || 'Payment failed. Please try again.'
            );
            this.cdr.markForCheck();
          }
        });
      } else {
        this.notification.error('Error', 'Card verification failed. Please check your details.');
        this.isFormSubmitting = false;
        this.cdr.markForCheck();
      }
    } catch (err) {
      this.isFormSubmitting = false;
      this.cdr.markForCheck();
      this.ngxService.stop();
      console.error(err);
    }
  }

  private tryPrepareStripeCheckout(): void {
    if (this.paymentProvider !== 'stripe') return;
    if (this.step !== 'payment') return;
    if (this.paymentProviderLoading) return;

    const typedCoupon = (this.couponCode || '').trim();
    if (!this.couponApplied && typedCoupon.length > 0) return;
    if (!this.couponApplied && typedCoupon.length === 0 && !this.stripeCheckoutSkippedCoupon) return;

    this.initStripePaymentIntent();
  }

  continueStripeCheckoutWithoutCoupon(): void {
    if (this.paymentProvider !== 'stripe') return;
    this.stripeCheckoutSkippedCoupon = true;
    this.tryPrepareStripeCheckout();
  }

  private initStripePaymentIntent(): void {
    if (this.paymentProvider !== 'stripe') return;
    if (!this.facilityId || !this.selectedPlan || this.selectedPlan.price == null) {
      this.stripeErrorMessage = 'Invalid payment amount.';
      this.cdr.markForCheck();
      return;
    }

    const amount = this.toMinorUnit(Number(this.selectedPlan.price));
    if (!Number.isFinite(amount) || amount < 0) {
      this.stripeErrorMessage = 'Invalid payment amount.';
      this.cdr.markForCheck();
      return;
    }

    this.stripeReturnState = 'idle';
    this.stripeReturnMessage = null;
    this.stripeLoading = true;
    this.stripeClientSecret = null;
    this.destroyStripePaymentElement();
    this.stripeErrorMessage = null;
    this.cdr.markForCheck();

    const paymentIntentPayload: Parameters<typeof this.stripeApi.createPaymentIntent>[0] = {
        facilityId: this.facilityId,
        amount,
        currency: this.currency,
        patientId: this.patientId,
      };
      if (this.selectedPlan?.bundleId != null) paymentIntentPayload.productId = this.selectedPlan.bundleId;
      if (this.couponApplied && this.couponCode) paymentIntentPayload.couponCode = this.couponCode;

      const paymentIntent$ = this.stripeChargeMode === 'destination'
        ? this.stripeApi.createPaymentIntentDestination(paymentIntentPayload)
        : this.stripeApi.createPaymentIntent(paymentIntentPayload);
      paymentIntent$
      .subscribe({
        next: (res) => {
          const rawResponse = res as any;
          const rawClientSecret =
            rawResponse?.data?.clientSecret ??
            rawResponse?.data?.client_secret ??
            rawResponse?.result?.clientSecret ??
            rawResponse?.result?.client_secret ??
            rawResponse?.clientSecret ??
            rawResponse?.client_secret ??
            null;
          const normalizedClientSecret =
            typeof rawClientSecret === 'string' ? rawClientSecret.trim() : '';
          const clientSecret =
            normalizedClientSecret.length > 0 &&
            normalizedClientSecret.includes('_secret_')
              ? normalizedClientSecret
              : null;
          const responseAccountId = this.pickFirstString([
            rawResponse?.data?.stripeAccountId,
            rawResponse?.data?.stripe_account_id,
            rawResponse?.data?.stripeAccount,
            rawResponse?.data?.stripe_account,
            rawResponse?.data?.accountId,
            rawResponse?.data?.account_id,
            rawResponse?.result?.stripeAccountId,
            rawResponse?.result?.stripe_account_id,
            rawResponse?.result?.stripeAccount,
            rawResponse?.result?.stripe_account,
            rawResponse?.result?.accountId,
            rawResponse?.result?.account_id,
            (rawResponse as any)?.stripeAccountId,
            (rawResponse as any)?.stripe_account_id,
            (rawResponse as any)?.stripeAccount,
            (rawResponse as any)?.stripe_account,
          ]);
          const responsePublishableKey = this.pickFirstString([
            rawResponse?.data?.publishableKey,
            rawResponse?.data?.publishable_key,
            rawResponse?.data?.stripePublishableKey,
            rawResponse?.data?.stripe_publishable_key,
            rawResponse?.result?.publishableKey,
            rawResponse?.result?.publishable_key,
            rawResponse?.result?.stripePublishableKey,
            rawResponse?.result?.stripe_publishable_key,
            (rawResponse as any)?.publishableKey,
            (rawResponse as any)?.publishable_key,
            (rawResponse as any)?.stripePublishableKey,
            (rawResponse as any)?.stripe_publishable_key,
          ]);

          if (responseAccountId) {
            this.stripeConnectedAccountId = responseAccountId;
          }
          if (responsePublishableKey) {
            this.stripePublishableKey = responsePublishableKey;
          }

          if (!clientSecret) {
            this.stripeErrorMessage = 'Unable to initialize payment.';
            this.stripeLoading = false;
            this.cdr.markForCheck();
            return;
          }

          const rawKind =
            rawResponse?.data?.stripeIntentKind ??
            rawResponse?.data?.stripe_intent_kind ??
            'payment';
          this.stripeIntentKind = String(rawKind).toLowerCase() === 'setup' ? 'setup' : 'payment';
          this.lastStripePaymentIntentId = null;
          this.lastStripeSetupIntentId = null;

          this.stripeClientSecret = clientSecret;
          this.stripeLoading = false;
          this.cdr.markForCheck();
          setTimeout(() => this.mountStripePaymentElement(clientSecret), 0);
        },
        error: () => {
          this.stripeErrorMessage = 'Unable to initialize payment.';
          this.stripeLoading = false;
          this.destroyStripePaymentElement();
          this.cdr.markForCheck();
        },
      });
  }

  private confirmStripePayment(): void {
    if (!this.stripeClientSecret) {
      this.notification.error('Error', 'Payment form is not ready. Please try again.');
      return;
    }

    if (!this.configureStripeClientContext()) {
      this.notification.error('Error', 'Stripe client configuration is invalid.');
      return;
    }

    const elements = this.stripeElements;
    if (!elements) {
      this.notification.error('Error', 'Payment form is not ready. Please try again.');
      return;
    }

    this.isFormSubmitting = true;
    this.cdr.markForCheck();

    void elements
      .submit()
      .then((submitResult) => {
        if (submitResult?.error) {
          const message =
            this.extractStripeErrorMessage(submitResult.error) ||
            submitResult.error.message ||
            'Payment details are incomplete.';
          this.stripeErrorMessage = message;
          this.notification.error('Error', message);
          this.isFormSubmitting = false;
          this.cdr.markForCheck();
          return;
        }

        this.storeStripeContext();
        const billing = this.buildStripeBillingDetails();
        const isSetup = this.stripeIntentKind === 'setup';
        const confirm$ = (
          isSetup
            ? this.stripeService.confirmSetup({
                clientSecret: this.stripeClientSecret!,
                elements,
                redirect: 'if_required',
                confirmParams: {
                  return_url: this.buildStripeReturnUrl(),
                  payment_method_data: { billing_details: billing },
                },
              })
            : this.stripeService.confirmPayment({
                clientSecret: this.stripeClientSecret!,
                elements,
                redirect: 'if_required',
                confirmParams: {
                  return_url: this.buildStripeReturnUrl(),
                  payment_method_data: { billing_details: billing },
                },
              })
        ) as Observable<{
          error?: unknown;
          setupIntent?: { id?: string; status?: string };
          paymentIntent?: { id?: string; status?: string };
        }>;

        confirm$.subscribe({
          next: (result: any) => {
            if (result?.error) {
              const message =
                this.extractStripeErrorMessage(result?.error) ||
                result.error?.message ||
                'Payment failed.';
              this.stripeErrorMessage = message;
              this.notification.error('Error', message);
              this.isFormSubmitting = false;
              this.cdr.markForCheck();
              return;
            }

            if (isSetup) {
              this.lastStripeSetupIntentId = result?.setupIntent?.id ?? null;
              this.lastStripePaymentIntentId = null;
              this.handleStripeStatus(result?.setupIntent?.status);
            } else {
              this.lastStripePaymentIntentId = result?.paymentIntent?.id ?? null;
              this.lastStripeSetupIntentId = null;
              this.handleStripeStatus(result?.paymentIntent?.status);
            }
          },
          error: (error: any) => {
            const message =
              this.extractStripeErrorMessage(error) || 'Payment failed. Please try again.';
            console.error('Stripe confirmation failed.', error);
            this.stripeErrorMessage = message;
            this.notification.error('Error', message);
            this.isFormSubmitting = false;
            this.cdr.markForCheck();
          },
        });
      })
      .catch((error: any) => {
        const message =
          this.extractStripeErrorMessage(error) ||
          'Payment details are incomplete. Please check the form and try again.';
        console.error('Stripe elements submit failed.', error);
        this.stripeErrorMessage = message;
        this.notification.error('Error', message);
        this.isFormSubmitting = false;
        this.cdr.markForCheck();
      });
  }

  private mountStripePaymentElement(clientSecret: string): void {
    if (!clientSecret || this.paymentProvider !== 'stripe') {
      return;
    }

    if (!this.configureStripeClientContext()) {
      return;
    }

    this.stripeService
      .elements({
        locale: 'en',
        clientSecret,
      })
      .subscribe({
        next: (elements) => {
          if (!elements) {
            this.stripeErrorMessage = 'Unable to initialize payment.';
            this.cdr.markForCheck();
            return;
          }

          this.destroyStripePaymentElement();
          this.stripeElements = elements;
          this.stripePaymentElementInstance = elements.create('payment', this.buildStripePaymentElementOptions());
          this.stripePaymentElementInstance.mount('#get-started-stripe-payment-element');
          this.stripeErrorMessage = null;
          this.cdr.markForCheck();
        },
        error: () => {
          this.stripeErrorMessage = 'Unable to initialize payment.';
          this.destroyStripePaymentElement();
          this.cdr.markForCheck();
        },
      });
  }

  private destroyStripePaymentElement(): void {
    if (this.stripePaymentElementInstance) {
      try {
        this.stripePaymentElementInstance.unmount();
      } catch {}
      this.stripePaymentElementInstance = null;
    }
    this.stripeElements = null;
  }

  private buildStripePaymentElementOptions(): StripePaymentElementOptions {
    return {
      ...this.paymentElementOptions,
      defaultValues: {
        billingDetails: this.buildStripeBillingDetails(),
      },
    };
  }

  private buildStripeBillingDetails(): { name?: string; email?: string } {
    const firstName = String(this.signUpForm?.get('firstName')?.value || '').trim();
    const lastName = String(this.signUpForm?.get('lastName')?.value || '').trim();
    const email = String(this.signUpForm?.get('email')?.value || '').trim();
    const name = [firstName, lastName].filter(Boolean).join(' ').trim();

    return {
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
    };
  }

  private configureStripeClientContext(): boolean {
    const publishableKey = this.stripePublishableKey || (this.stripeService as any)?.key || null;
    if (!publishableKey) {
      this.stripeErrorMessage = 'Stripe publishable key is missing.';
      this.cdr.markForCheck();
      return false;
    }

    const options: StripeConstructorOptions = {};

    if (this.stripeChargeMode === 'direct' && this.stripeConnectedAccountId) {
      options.stripeAccount = this.stripeConnectedAccountId;
    }

    const stripeAccount = options.stripeAccount ?? '';
    const signature = `${publishableKey}::${stripeAccount}`;
    if (this.stripeContextSignature === signature) {
      return true;
    }

    this.stripeService.changeKey(
      publishableKey,
      Object.keys(options).length > 0 ? options : undefined
    );
    this.stripeContextSignature = signature;
    return true;
  }

  private handleStripeStatus(status?: string): void {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'succeeded') {
      this.setStripeReturnState('processing', 'Finalizing appointment confirmation...');
      this.step = 'confirmation';
      this.saveAppointment();
      return;
    }

    if (normalized === 'processing') {
      this.setStripeReturnState('processing', 'Payment processing. We will update you shortly.');
    } else if (normalized) {
      this.setStripeReturnState('failed', 'Payment failed or was canceled.');
    } else {
      this.setStripeReturnState('processing', 'Payment processing. We will update you shortly.');
    }

    this.step = 'confirmation';
    this.isFormSubmitting = false;
    this.cdr.markForCheck();
  }

  private setStripeReturnState(state: 'processing' | 'succeeded' | 'failed', message: string): void {
    this.stripeReturnState = state;
    this.stripeReturnMessage = message;
  }

  private buildStripeReturnUrl(): string {
    const basePath = this.router.url.split('?')[0] || `/get-started/${this.facilityId}`;
    return `${window.location.origin}${basePath}`;
  }

  private toMinorUnit(amount: number): number {
    const value = Number(amount);
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100);
  }

  private pickFirstString(values: Array<unknown>): string | null {
    const match = values.find(
      (value) => typeof value === 'string' && value.trim().length > 0
    );
    return typeof match === 'string' ? match.trim() : null;
  }

  private extractStripeErrorMessage(error: any): string | null {
    if (!error) return null;
    const candidates = [
      error?.message,
      error?.error?.message,
      error?.raw?.message,
      error?.rawError?.message,
      error?.details?.message,
      error?.statusText,
    ];
    const message = candidates.find(
      (value) => typeof value === 'string' && value.trim().length > 0
    );
    return typeof message === 'string' ? message.trim() : null;
  }

  private storeStripeContext(): void {
    const context = {
      selectedPlan: this.selectedPlan
        ? {
            name: this.selectedPlan.name,
            price: this.selectedPlan.price,
            bundleId: this.selectedPlan.bundleId,
            isRecurring: this.selectedPlan.isRecurring,
          }
        : null,
      selectedDate: this.selectedDate ? this.selectedDate.toISOString() : null,
      selectedSlot: this.selectedSlot
        ? {
            providerScheduledSlotId: this.selectedSlot.providerScheduledSlotId,
            providerId: this.selectedSlot.providerId,
            startTime: this.selectedSlot.startTime,
            endTime: this.selectedSlot.endTime,
            providerName: this.selectedSlot.providerName,
          }
        : null,
      patientId: this.patientId,
      userId: this.userId,
      applicationID: this.applicationID,
      locationID: this.locationID,
    };
    sessionStorage.setItem('getStartedStripeContext', JSON.stringify(context));
  }

  private restoreStripeContext(): void {
    const raw = sessionStorage.getItem('getStartedStripeContext');
    if (!raw) return;

    try {
      const ctx = JSON.parse(raw);
      if (ctx?.selectedPlan) this.selectedPlan = ctx.selectedPlan;
      if (ctx?.selectedDate) this.selectedDate = new Date(ctx.selectedDate);
      if (ctx?.selectedSlot) this.selectedSlot = ctx.selectedSlot;
      if (ctx?.patientId) this.patientId = ctx.patientId;
      if (ctx?.userId) this.userId = ctx.userId;
      if (ctx?.applicationID) this.applicationID = ctx.applicationID;
      if (ctx?.locationID) this.locationID = ctx.locationID;
      sessionStorage.removeItem('getStartedStripeContext');
    } catch {}
  }

  private handleStripeReturn(): void {
    this.route.queryParams.subscribe((params) => {
      const redirectStatus = params['redirect_status'];
      const clientSecret =
        params['payment_intent_client_secret'] || params['setup_intent_client_secret'];
      if (!redirectStatus && !clientSecret) return;

      this.restoreStripeContext();
      if (typeof clientSecret === 'string' && clientSecret.includes('_secret_')) {
        const idPrefix = clientSecret.split('_secret_')[0] || '';
        if (idPrefix.startsWith('seti_')) {
          this.lastStripeSetupIntentId = idPrefix;
          this.lastStripePaymentIntentId = null;
          this.stripeIntentKind = 'setup';
        } else {
          this.lastStripePaymentIntentId = idPrefix;
          this.lastStripeSetupIntentId = null;
          this.stripeIntentKind = 'payment';
        }
      }

      const normalized = (redirectStatus || '').toLowerCase();
      if (normalized === 'succeeded') {
        this.setStripeReturnState('processing', 'Finalizing appointment confirmation...');
        this.step = 'confirmation';
        this.saveAppointment();
      } else if (normalized === 'processing') {
        this.setStripeReturnState('processing', 'Payment processing. We will update you shortly.');
        this.step = 'confirmation';
      } else if (normalized) {
        this.setStripeReturnState('failed', 'Payment failed or was canceled.');
        this.step = 'confirmation';
      } else {
        this.setStripeReturnState('processing', 'Payment processing. We will update you shortly.');
        this.step = 'confirmation';
      }

      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true,
      });
      this.cdr.markForCheck();
    });
  }

  private generateProviderMeta() {

    const rawRating = 4.3 + Math.random() * 0.7;
    const rating = Math.round(rawRating * 10) / 10;

    const reviews = Math.floor(20 + Math.random() * 80);
    const experience = Math.floor(3 + Math.random() * 18);

    const waitOptions = ['10 - 15 Min', '15 - 30 Min', '20 - 40 Min'];
    const waitTime = waitOptions[Math.floor(Math.random() * waitOptions.length)];

    return {
      rating: rating.toFixed(1),
      reviews,
      experience,
      waitTime
    };
  }

  selectProvider(provider: any) {
    this.selectedProvider = provider;
    this.slots = []
    this.selectedDate = null
    this.formattedDate = null

    console.log('Selected provider:', this.selectedProvider);
    console.log('Selected date:', this.selectedDate);
    console.log('Formatted date:', this.formattedDate);

    this.step = 'providers';
    this.cdr.markForCheck();
  }

  disablePastDates = (current: Date): boolean => {
    if (!current) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const date = new Date(current);
    date.setHours(0, 0, 0, 0);

    return date < today;
  };

  onDateChange(date: Date | null): void {
    if (date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      this.formattedDate = `${year}-${month}-${day}`;
      this.loadSlotsForDate(this.formattedDate);
    } else {
      this.formattedDate = null;
      this.slots = [];
      this.slotsError = null;
      this.cdr.markForCheck();
    }
  }

  loadSlotsForDate(formattedDate: string): void {
    if (!formattedDate) return;
    this.slots = [];
    this.slotsError = null;
    this.loadingSlots = true;
    this.cdr.markForCheck();

    this.generalService
      .getProviderScheduledSlots(
        formattedDate,
        this.selectedCategory?.categoryId,
        this.facilityId,
        this.selectedProvider.providerId
      )
      .subscribe(
        (response) => {
          const raw = response?.data || response?.slots || [];

          this.slots = [...raw].sort((a: any, b: any) => {
            return this.timeToMinutes(a?.startTime) - this.timeToMinutes(b?.startTime);
          });

          this.loadingSlots = false;
          this.cdr.markForCheck();
        },
        (err) => {
          console.error('Error loading slots for date', err);
          this.slotsError = 'Unable to load slots. Please try again.';
          this.loadingSlots = false;
          this.cdr.markForCheck();
          this.notification.error('Error', this.slotsError);
        }
      );
  }

  private timeToMinutes(t?: string | null): number {
    if (!t) return Number.POSITIVE_INFINITY;

    const parts = t.split(':');

    const hh = Number(parts[0]);
    const mm = Number(parts[1]);
    const ss = Number(parts[2] ?? 0);

    if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) {
      return Number.POSITIVE_INFINITY;
    }

    return hh * 60 + mm + ss / 60;
  }

  selectSlot(slot: any): void {
    this.selectedDate = new Date(this.formattedDate as string);
    this.selectedSlot = slot;
    this.cdr.markForCheck();

    console.log('Selected slot:', slot);
    console.log('Selected date:', this.selectedDate);
    console.log('Formatted date:', this.formattedDate);

    this.stripeReturnState = 'idle';
    this.stripeReturnMessage = null;
    this.addCard();
  }

  formatTime(time?: string | null): string {
    if (!time) {
      return '';
    }

    const parts = time.split(':');
    if (parts.length < 2) {
      return time;
    }

    let hour: number = Number(parts[0]);
    const minute: number = Number(parts[1]);

    if (isNaN(hour) || isNaN(minute)) {
      return time;
    }

    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12;

    const minuteStr = minute < 10 ? '0' + minute : String(minute);

    return `${hour}:${minuteStr} ${ampm}`;
  }

  saveAppointment(): void {
    this.isFormSubmitting = true;

    const payload = {
      facilityId: this.facilityId,
      productId: this.selectedPlan?.bundleId,
      providerScheduledSlotId: this.selectedSlot?.providerScheduledSlotId,
      providerId: this.selectedSlot?.providerId,
      patientId: this.patientId,
    };

    if (this.paymentProvider === 'stripe' && (this.lastStripePaymentIntentId || this.lastStripeSetupIntentId)) {
      const stripePayload: Parameters<GeneralService['confirmStripePaymentAndCreateAppointment']>[0] = {
        paymentIntentId: this.lastStripePaymentIntentId ?? '',
        facilityId: Number(this.facilityId),
        productId: Number(this.selectedPlan?.bundleId),
        providerScheduledSlotId: Number(this.selectedSlot?.providerScheduledSlotId),
        patientId: Number(this.patientId),
        currency: this.currency,
      };
      if (this.lastStripeSetupIntentId) stripePayload.setupIntentId = this.lastStripeSetupIntentId;
      if (this.selectedSlot?.providerId != null) stripePayload.providerId = this.selectedSlot.providerId;
      if (this.userId != null) stripePayload.userId = this.userId;
      if (this.couponApplied && this.couponCode) stripePayload.couponCode = this.couponCode;
      if (this.selectedPlan?.price != null) stripePayload.price = this.selectedPlan.price;
      if (this.selectedPlan?.isRecurring != null) stripePayload.isRecurring = this.selectedPlan.isRecurring;
      this.generalService.confirmStripePaymentAndCreateAppointment(stripePayload).subscribe(
        (response: any) => {

          if (response && response.status != 200) {
            const failureMsg =
              (response && response.message) ||
              'Payment could not be confirmed. Please try again.';
            if (this.stripeReturnState !== 'idle') {
              this.setStripeReturnState('failed', failureMsg);

            }
            this.notification.error('Error', failureMsg);
            this.isFormSubmitting = false;
            this.cdr.markForCheck();
            return;
          }

          if (this.stripeReturnState !== 'idle') {
            this.setStripeReturnState('succeeded', 'Payment successful and appointment confirmed.');
          }
          this.notification.success('Success', (response && response.message) || 'Appointment booked successfully!');
          this.step = 'confirmation';
          this.isFormSubmitting = false;
          this.cdr.markForCheck();
        },
        () => {
          if (this.stripeReturnState !== 'idle') {
            this.setStripeReturnState(
              'failed',
              'Payment was received, but appointment confirmation failed. Please contact support.'
            );
            this.step = 'confirmation';
          }
          this.isFormSubmitting = false;
          this.notification.error('Error', 'Unable to save appointment. Please try again.');
          this.cdr.markForCheck();
        }
      );
      return;
    }

    this.generalService.savePatientAppointment(payload).subscribe(
      () => {
        if (this.stripeReturnState !== 'idle') {
          this.setStripeReturnState('succeeded', 'Payment successful and appointment confirmed.');
        }
        this.notification.success('Success', 'Appointment booked successfully!');
        this.step = 'confirmation';
        this.isFormSubmitting = false;
        this.cdr.markForCheck();
      },
      () => {
        if (this.stripeReturnState !== 'idle') {
          this.setStripeReturnState(
            'failed',
            'Payment was received, but appointment confirmation failed. Please contact support.'
          );
          this.step = 'confirmation';
        }
        this.isFormSubmitting = false;
        this.notification.error('Error', 'Unable to save appointment. Please try again.');
        this.cdr.markForCheck();
      }
    );
  }

  onBlurTrim(event: FocusEvent, trimBoth: boolean = false): void {
    const el = event.target as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return;

    const raw = el.value ?? '';
    let next = trimBoth ? raw.trim() : raw.replace(/\s+$/g, '');
    if (next.trim().length === 0) next = '';

    el.value = next;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  onBlurEmailCheck() {
    const email = this.signUpForm.get('email')?.value || '';

    if (email && this.signUpForm.get('email')?.valid) {
      this.emailDuplicateCheck = true;

      this.generalService.checkDuplicateEmail(email).subscribe((response) => {
        console.log('Email check response:', response);
        this.emailDuplicateCheck = false;

        if (response.activeUserExists) {
          this.notification.error('Error', 'Email already exists. Please use a different email.');
          this.signUpForm.get('email')?.setErrors({ duplicate: true });
          this.emailDuplicateCheck = true;
          console.log(this.emailDuplicateCheck);
        }

        this.cdr.markForCheck();
      });
    }
  }

  isPayNowDisabled(): boolean {
    if (this.isFormSubmitting || this.paymentProviderLoading || this.paymentProvider === 'none') return true;
    if (this.paymentProvider === 'stripe') return this.stripeLoading || !this.stripeClientSecret;
    if (this.paymentProvider === 'square') return !this.isSquareReady || !this.authorizeRecurringCardCharge;
    return true;
  }

  isValidateDisabled(): boolean {
    return !this.couponCode || this.isCouponValidating || !this.selectedPlan || this.couponApplied;
  }

  validateCoupon() {

    this.couponCode = (this.couponCode || '').toUpperCase();
    if (!this.couponCode || !this.selectedPlan || this.couponApplied) return;

    this.couponErrorMessage = null;
    this.couponSuccessMessage = null;
    this.couponValid = false;

    this.isCouponValidating = true;
    this.cdr.markForCheck();

    const payload = {
      facilityId: this.facilityId,
      couponCode: this.couponCode,
      bundleId: this.selectedPlan.bundleId,
      bundlePrice: this.selectedPlan.price
    };

    this.generalService.validateCoupon(payload).subscribe({
      next: (res) => {
        const data = res?.data;
        if (data?.isValid) {

          if (!this.couponApplied) {
            this.selectedPlan.price = data.discountedPrice;
          }
          this.couponValid = true;
          this.couponApplied = true;
          this.couponSuccessMessage = 'Coupon is valid, discount applied.';
          this.couponErrorMessage = null;
          if (this.step === 'payment' && this.paymentProvider === 'stripe') {
            this.tryPrepareStripeCheckout();
          }
        } else {

          this.couponValid = false;
          this.couponApplied = false;
          this.couponSuccessMessage = null;
          this.couponErrorMessage = 'Coupon is not valid.';
        }
        this.isCouponValidating = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.log(err);
        this.couponValid = false;
        this.couponApplied = false;
        this.couponSuccessMessage = null;
        this.couponErrorMessage = 'Unable to validate coupon. Please try again.';
        this.isCouponValidating = false;
        this.cdr.markForCheck();
      }
    });
  }
}
