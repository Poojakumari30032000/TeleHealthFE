import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import { GeneralService } from 'app/shared/services/general.service';
import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';
import { Subject } from 'rxjs';
import { SquarePaymentService } from 'app/square-payment.service';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NgxUiLoaderService } from 'ngx-ui-loader';
import { AuthService } from 'app/shared/Auth/auth.service';
import { environment } from "../../../environments/environment";
import { SquareEnv } from "../../shared/square-env.type";
import { StripeService } from 'ngx-stripe';
import { StripeElements, StripePaymentElement } from '@stripe/stripe-js';
import { StripeApiService, PatientStripeCard } from 'app/shared/services/stripe-api.service';

interface PaymentCard {
  cardId: number;
  isActive?: boolean;
  squareCardId?: string;
  squareClientId?: string;
  expirationYear: string;
  expirationMonth: string;
  last4: string;
  cardBrand?: string;
  userId?: number;
  isDefault: boolean;
  cardHolderName: string;
}

@Component({
  selector: 'app-payment-methods',
  templateUrl: './payment-methods.component.html',
  styleUrl: './payment-methods.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentMethodsComponent implements OnInit {
  @ViewChild('cardContainer', { read: ViewContainerRef }) container!: ViewContainerRef;
  @ViewChild('cardTemplate') cardTemplate!: TemplateRef<any>;
  @ViewChild('commanModel', { static: false })
  commanModel!: CommanFormModalComponent;

  confirmModal?: NzModalRef;
  private destroy$ = new Subject<void>();
  addCardModalTrigger: boolean = false;
  card: any;

  showCardContent: boolean = false;
  showCardFields: boolean = false;

  cardholderName: string = '';

  userRole = this.auth.getUserRole()
  isFormSubmitting: boolean = false;

  facilityId: any;
  applicationID: any;
  locationID: any;

  paymentProvider: 'square' | 'stripe' = 'square';

  stripeError: string | null = null;
  private stripeClientSecret: string | null = null;
  private stripeConnectedAccountId: string | null = null;
  private stripeElements: StripeElements | null = null;
  private stripePaymentElement: StripePaymentElement | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private modal: NzModalService,
    private generalService: GeneralService,
    private squareService: SquarePaymentService,
    private notification: NzNotificationService,
    private ngxService: NgxUiLoaderService,
    private auth : AuthService,
    private stripeService: StripeService,
    private stripeApi: StripeApiService,
  ) {}
   ngOnInit() {
    this.showCardContent = true;

    if(this.userRole != 'Patient'){
      this.getUserCards();
    }
    else{
      this.facilityId = this.auth.getUserFacilityId();
      this.resolvePaymentProvider();
    }
  }

   async ngAfterViewInit() {
   }

  private resolvePaymentProvider(): void {
    this.generalService.commonGet(`Facilities/getFacilityPaymentMode?id=${this.facilityId}`).subscribe({
      next: (res: any) => {
        const mode = res?.data?.paymentModeId;

        if (mode === 2 || mode === 3) {
          this.paymentProvider = 'stripe';
          this.loadStripeCards();
        } else {
          this.paymentProvider = 'square';
          this.fetchSquareIds();
          this.getCardsByPatientId();
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.paymentProvider = 'square';
        this.fetchSquareIds();
        this.getCardsByPatientId();
        this.cdr.markForCheck();
      }
    });
  }

  getUserCards(){
    let userId = this.auth.getUserId();
        this.generalService.getCardsByUserID(userId).subscribe((response) => {
      this.cards = response.data;
        this.cdr.markForCheck();
    });
  }

  getCardsByPatientId(){
    this.generalService.getCardsByPatientId(this.auth.getPatientId()).subscribe((response) => {
      this.cards = response.data;
      this.cdr.markForCheck();
    });
  }

  private loadStripeCards(): void {
    this.stripeApi.getPatientStripeCards(this.facilityId, this.auth.getUserId() ?? 0).subscribe({
      next: (res: any) => {
        const list = (res?.data || []) as PatientStripeCard[];
        this.cards = list.map((c) => ({
          cardId: c.cardId,
          isDefault: !!c.isDefault,
          expirationMonth: this.pad2(c.expirationMonth),
          expirationYear: c.expirationYear != null ? String(c.expirationYear) : '',
          last4: c.last4 || '',
          cardBrand: c.cardBrand || '',
          cardHolderName: c.cardHolderName || '',
        } as PaymentCard));
        this.cdr.markForCheck();
      },
      error: () => {
        this.notification.error('Error', 'Unable to load saved cards.');
        this.cdr.markForCheck();
      }
    });
  }

  private pad2(value: number | string | undefined): string {
    if (value == null || value === '') return '';
    return String(value).padStart(2, '0');
  }

  async saveCard() {
    if (this.paymentProvider === 'stripe') {
      this.saveStripeCard();
      return;
    }

    this.isFormSubmitting = true;
    this.cdr.markForCheck();

    if(this.cardholderName.trim() === ''){
      this.notification.error('Error', 'Cardholder name is required.');
      this.isFormSubmitting = false
      this.cdr.markForCheck();
      return;
    }
    else{
    try {
      const result = await this.card.tokenize();
      if (result.status === 'OK') {

        if (this.userRole == 'Clinic Admin'){
        let payload:any ={
          sourceId: result.token,
          cardholderName: this.cardholderName,
          amount: 1
        }
          this.generalService.saveCardInformation(payload).subscribe((response) => {
            if(response.status != 200){
              this.notification.error('Error', response.message || 'Failed to save card information.');
              this.isFormSubmitting = false;
              this.cdr.markForCheck();
            }
            else{
              this.notification.success('Success', response.message || 'Card saved successfully.');
              this.getUserCards();
              this.isFormSubmitting = false;
              this.onCancelAddCard();
              this.cdr.markForCheck();
            }
          });
        }
        else if(this.userRole == 'Patient'){
          let payload:any ={
            sourceId: result.token,
            cardholderName: this.cardholderName,
            amount: 1,
            facilityId : this.auth.getUserFacilityId()
          }
          this.generalService.saveCardInformation(payload).subscribe((response) => {
            if(response.status != 200){
              this.notification.error('Error', response.message || 'Failed to save card information.');
              this.isFormSubmitting = false;
              this.cdr.markForCheck();
            }
            else{
              this.notification.success('Success', response.message || 'Card saved successfully.');
              this.getCardsByPatientId();
              this.isFormSubmitting = false;
              this.onCancelAddCard();
              this.cdr.markForCheck();
            }
          });
        }
      } else {
        console.error(result.errors);
        this.isFormSubmitting = false;
        this.cdr.markForCheck();
      }
    } catch (err) {
      console.error(err);
      this.isFormSubmitting = false;
      this.cdr.markForCheck();
    }
    }
  }

  private saveStripeCard(): void {
    if (!this.stripeElements || !this.stripeClientSecret) {
      this.notification.error('Error', 'Card form is not ready yet.');
      return;
    }

    this.isFormSubmitting = true;
    this.stripeError = null;
    this.cdr.markForCheck();

    this.stripeElements.submit().then((submitResult) => {
      if (submitResult?.error) {
        this.stripeError = submitResult.error.message || 'Please check your card details.';
        this.notification.error('Error', this.stripeError || 'Something went wrong.');
        this.isFormSubmitting = false;
        this.cdr.markForCheck();
        return;
      }

      this.stripeService.confirmSetup({
        elements: this.stripeElements!,
        clientSecret: this.stripeClientSecret!,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      }).subscribe({
        next: (result: any) => {
          if (result?.error) {
            this.stripeError = result.error.message || 'Failed to save card.';
            this.notification.error('Error', this.stripeError || 'Something went wrong.');
            this.isFormSubmitting = false;
            this.cdr.markForCheck();
            return;
          }
          const setupIntentId = result?.setupIntent?.id;
          if (!setupIntentId) {
            this.stripeError = 'Card could not be confirmed. Please try again.';
            this.notification.error('Error', this.stripeError || 'Something went wrong.');
            this.isFormSubmitting = false;
            this.cdr.markForCheck();
            return;
          }
          this.persistStripeCard(setupIntentId);
        },
        error: (err: any) => {
          this.stripeError = err?.message || 'Failed to save card.';
          this.notification.error('Error', this.stripeError || 'Something went wrong.');
          this.isFormSubmitting = false;
          this.cdr.markForCheck();
        }
      });
    }).catch((err) => {
      this.stripeError = err?.message || 'Failed to save card.';
      this.notification.error('Error', this.stripeError || 'Something went wrong.');
      this.isFormSubmitting = false;
      this.cdr.markForCheck();
    });
  }

  private persistStripeCard(setupIntentId: string): void {
    this.stripeApi.savePatientStripeCard({
      facilityId: this.facilityId,
      userId: this.auth.getUserId() ?? 0,
      setupIntentId,
    }).subscribe({
      next: (res: any) => {
        if (res?.status !== 1) {
          this.notification.error('Error', res?.message || 'Card could not be saved.');
          this.isFormSubmitting = false;
          this.cdr.markForCheck();
          return;
        }
        this.notification.success('Success', 'Card saved successfully.');
        this.isFormSubmitting = false;
        this.onCancelAddCard();
        this.loadStripeCards();
        this.cdr.markForCheck();
      },
      error: () => {
        this.notification.error('Error', 'Card could not be saved.');
        this.isFormSubmitting = false;
        this.cdr.markForCheck();
      }
    });
  }

  defaultCard: number = 1;

  modalApiUrl: { save?: string; get?: string } = {
    save: '',
    get: '',
  };

  cards: PaymentCard[] = []

  private fetchSquareIds(): void {

    this.generalService.getSquareAppIdByFacilityId(this.facilityId).subscribe({
      next: (res) => {
        this.applicationID = res?.applicationId || '';
        this.locationID = res?.locationId || '';
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching Square App/Location IDs:', err);
        this.notification.error('Error', 'Unable to load payment configuration.');
        this.cdr.markForCheck();
      }
    });
  }

 async addCard() {
  this.addCardModalTrigger = true;
  this.stripeError = null;

  if (this.paymentProvider === 'stripe') {
    setTimeout(() => this.initStripeAddCard(), 300);
    return;
  }

  setTimeout(async () => {

    this.ngxService.start();

    if (this.userRole == 'Clinic Admin'){
    try {
      let env : SquareEnv = environment.squareEnv

      if(env === 'sandbox') {
        const applicationId = 'sandbox-sq0idb-ec4v0vU6pCs6GpuBefykNg';
        const locationId = 'LZWKJ7Y8Q5FF5';

        this.showCardFields = true;

        await this.squareService.init(applicationId, locationId);
        this.card = await this.squareService.createCard('#card-container');

        this.ngxService.stop();
      }
      else {
        const applicationId = 'sq0idp-pXdJ5rF3ToftO3hNOg1ltg';
        const locationId = 'LY233E9VTZ64J';

        this.showCardFields = true;

        await this.squareService.init(applicationId, locationId);
        this.card = await this.squareService.createCard('#card-container');

        this.ngxService.stop();
      }
    }
    catch (error) {
      console.error('Square init error:', error);
      this.ngxService.stop();
    }}
    else if(this.userRole == 'Patient'){
      try {
        const applicationId = this.applicationID;
        const locationId = this.locationID;

        this.showCardFields = true;

        await this.squareService.init(applicationId, locationId);
        this.card = await this.squareService.createCard('#card-container');

        this.ngxService.stop();
      }
      catch (error) {
        console.error('Square init error:', error);
        this.ngxService.stop();
      }
    }
  }, 500);
}

  private initStripeAddCard(): void {
    this.ngxService.start();
    this.stripeError = null;
    this.stripeClientSecret = null;

    this.stripeApi.createPatientSetupIntent({
      facilityId: this.facilityId,
      patientId: this.auth.getPatientId() ?? 0,
    }).subscribe({
      next: (res: any) => {
        const clientSecret = res?.data?.clientSecret;
        const accountId = res?.data?.stripeAccountId;
        if (res?.status !== 1 || !clientSecret) {
          this.ngxService.stop();
          this.stripeError = res?.message || 'Unable to start card setup.';
          this.notification.error('Error', this.stripeError || 'Something went wrong.');
          this.cdr.markForCheck();
          return;
        }
        this.stripeClientSecret = clientSecret;
        this.stripeConnectedAccountId = accountId || null;
        this.mountStripeElement(clientSecret);
      },
      error: () => {
        this.ngxService.stop();
        this.stripeError = 'Unable to start card setup.';
        this.notification.error('Error', this.stripeError || 'Something went wrong.');
        this.cdr.markForCheck();
      }
    });
  }

  private mountStripeElement(clientSecret: string): void {
    const publishableKey = environment.stripePublishableKey;
    if (!publishableKey) {
      this.ngxService.stop();
      this.stripeError = 'Stripe publishable key is missing.';
      this.notification.error('Error', this.stripeError || 'Something went wrong.');
      this.cdr.markForCheck();
      return;
    }

    this.stripeService.changeKey(
      publishableKey,
      this.stripeConnectedAccountId ? { stripeAccount: this.stripeConnectedAccountId } : undefined
    );

    this.stripeService.elements({ locale: 'en', clientSecret }).subscribe({
      next: (elements) => {
        this.destroyStripeElement();
        this.stripeElements = elements;
        this.stripePaymentElement = elements.create('payment', { layout: 'tabs' });
        this.stripePaymentElement.mount('#stripe-card-element');
        this.showCardFields = true;
        this.ngxService.stop();
        this.cdr.markForCheck();
      },
      error: () => {
        this.ngxService.stop();
        this.stripeError = 'Unable to load the card form.';
        this.notification.error('Error', this.stripeError || 'Something went wrong.');
        this.cdr.markForCheck();
      }
    });
  }

  private destroyStripeElement(): void {
    if (this.stripePaymentElement) {
      try { this.stripePaymentElement.unmount(); } catch {}
      this.stripePaymentElement = null;
    }
    this.stripeElements = null;
  }

  onCancelAddCard()
  {
    this.container?.clear();
    this.destroyStripeElement();
    this.stripeClientSecret = null;
    this.stripeError = null;
    this.addCardModalTrigger = false;
    this.showCardFields = false;
    this.cardholderName = '';
  }

  submitAddCard(){
  }

confirmDelete(event: MouseEvent,data:any): void {

  if(data.isDefault){
    this.notification.error('Error', 'Default card cannot be deleted. Please set another card as default first.');
    return;
  }
  else{
  event.preventDefault();
  event.stopPropagation();

  this.confirmModal = this.modal.confirm({
    nzTitle: 'Confirmation?',
    nzContent: 'Are you sure you want to delete this card?',
    nzOkText: 'Yes, Delete',
    nzCancelText: 'Cancel',
    nzCentered: true,
    nzOnOk: () => {
      this.deleteCard(data);
    },
    nzOnCancel: () => {
      console.log('User canceled deletion');
    }
  });
}
}

  deleteCard(data: PaymentCard) {
    if (this.paymentProvider === 'stripe') {
      if (!data.cardId) return;
      this.stripeApi.detachPatientStripeCard(this.facilityId, this.auth.getUserId() ?? 0, data.cardId).subscribe({
        next: (response: any) => {
          if (response?.status !== 1) {
            this.notification.error('Error', response?.message || 'Failed to delete card.');
            return;
          }
          this.notification.success('Success', response.message || 'Card deleted successfully.');
          this.loadStripeCards();
        },
        error: () => {
          this.notification.error('Error', 'Failed to delete card.');
        }
      });
      return;
    }

    this.generalService.deleteCard(data.cardId).subscribe((response) => {
      this.notification.success('Success', response.message || 'Card deleted successfully.');
      this.refreshSquareCards();
    },
    (error: any) => {
      console.error('Error deleting card:', error);
      this.notification.error('Error', 'Failed to delete card.');
    })
  }

  private refreshSquareCards(): void {
    if (this.userRole === 'Patient') {
      this.getCardsByPatientId();
    } else {
      this.getUserCards();
    }
  }

  onClick(item : PaymentCard) {
    if (this.paymentProvider === 'stripe') {
      if (!item.cardId) return;
      this.stripeApi.setPatientStripeDefaultCard(
        this.facilityId, this.auth.getUserId() ?? 0, item.cardId
      ).subscribe({
        next: (response: any) => {
          if (response?.status !== 1) {
            this.notification.error('Error', response?.message || 'Failed to set default card.');
            return;
          }
          this.notification.success('Success', response.message || 'Default card updated.');
          this.loadStripeCards();
        },
        error: () => {
          this.notification.error('Error', 'Failed to set default card.');
        }
      });
      return;
    }

    this.generalService.setDefaultCard(item.cardId).subscribe(
      (response) => {
       this.notification.success('Success', response.message);
       this.refreshSquareCards();
      },
    (error: any) => {
      console.error('Error setting default card:', error);
      this.notification.error('Error', 'Failed to set default card.');
    })
  }
  ngOnDestroy(): void{
    this.destroyStripeElement();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
