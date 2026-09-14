import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { GeneralService } from 'app/shared/services/general.service';
import { ValidationService } from 'app/shared/Validation/validation.service';
import { Subject, takeUntil } from 'rxjs';

interface drugList {
  productId: number;
  productName: string;
  productType: string;
  categoryId: number;
  categoryName: string;
  drugType: string;
  price: number;
  quantity: number;
  quantityUnit: string;
  refills: number;
  dose: string;
  dosage: string;
  strenght: string;
  shippingFrequency: string;
  billingFrequency: string;
  regularImageURL: string;
}

@Component({
  selector: 'app-visit-payment',
  templateUrl: './visit-payment.component.html',
  styleUrl: './visit-payment.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VisitPaymentComponent implements OnInit {
  @Input() selectedSub: drugList | null = null;
  @Input() paymentData: any = null;
  @Input() currentStep: number = 0;
  @Output() onContinue = new EventEmitter<any>();
  @Output() onPrevious = new EventEmitter<any>();

  paymentForm!: FormGroup;
  stateList: any = null;
  cityList: any[] = [];
  couponCode: string = '';
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private validationService: ValidationService,
    private generalService: GeneralService,
    private cdr: ChangeDetectorRef
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    console.log('this.selectedSubselectedSub', this.selectedSub);
    console.log('this.paymentData', this.paymentData);
    this.loadCities();
    if (this.paymentData) {
      this.paymentForm.patchValue({
        addressLine1: this.paymentData?.addressLine1 || '',
        street: this.paymentData?.street || '',
        city: this.paymentData?.city || '',
        state: this.paymentData?.state || '',
        zipCode: this.paymentData?.zipCode || '',
        cardNumber: this.paymentData?.cardNumber || '',
        expiryDate: this.paymentData?.expiryDate || '',
        cvc: this.paymentData?.cvc || '',
      });
      this.loadStateById(this.paymentData?.city);
    }

    this.validationService.applyGlobalValidators(this.paymentForm);
  }

  initForm(): void {
    this.paymentForm = this.fb.group({
      addressLine1: ['', Validators.required],
      street: [''],
      city: ['', Validators.required],
      state: ['', Validators.required],
      zipCode: ['', Validators.required],
      cardNumber: ['', Validators.required],
      expiryDate: ['', Validators.required],
      cvc: ['', Validators.required],
    });
  }

  get form() {
    return this.paymentForm.controls;
  }

  onSubmit(): void {
    if (this.paymentForm.valid) {
      const data = {
        stage: 'continue',
        paymentForm: { ...this.paymentForm.value, couponCode: this.couponCode },
      };
      this.onContinue.emit(data);
    } else {
      Object.keys(this.paymentForm.controls).forEach((field) => {
        const control = this.paymentForm.get(field);
        if (control) {
          control.markAsTouched({ onlySelf: true });
          control.updateValueAndValidity();
        }
      });
      this.generalService.showError(`Fill all the required fields`);
    }
  }

  goToPreviousStep(): void {
    const data = { stage: 'previous', paymentForm: this.paymentForm.value };
    this.onPrevious.emit(data);
  }

  loadCities(): void {
    this.generalService
      .getAllCities()
      .pipe(takeUntil(this.destroy$))
      .subscribe((cities) => {
        this.cityList = cities;
        console.log('All Cities:', this.cityList);
        this.cdr.markForCheck();
      });
  }

  loadStateById(cityId: number): void {
    this.generalService
      .getStateByCityId(cityId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
        this.stateList = state;
        console.log(`State :`, this.stateList);
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void{
    this.destroy$.next();
    this.destroy$.complete();
  }
}
