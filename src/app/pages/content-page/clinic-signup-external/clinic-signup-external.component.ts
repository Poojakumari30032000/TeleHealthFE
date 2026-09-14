import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { GeneralService } from 'app/shared/services/general.service';

interface DropdownOption {
  id: number;
  name: string;
}

const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])[\s\S]{8,}$/;

const passwordsMatchValidator: ValidatorFn = (
  group: AbstractControl
): ValidationErrors | null => {
  const pwd = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  if (!pwd || !confirm) return null;
  return pwd === confirm ? null : { passwordsMismatch: true };
};

@Component({
  selector: 'app-clinic-signup-external',
  templateUrl: './clinic-signup-external.component.html',
  styleUrls: ['./clinic-signup-external.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicSignupExternalComponent implements OnInit, OnDestroy {

  currentStep: 1 | 2 | 3 = 1;
  readonly totalSteps = 3;
  readonly stepLabels = ['Clinic Info', 'Address', 'Admin & Security'];

  step1Form!: FormGroup;
  step2Form!: FormGroup;
  step3Form!: FormGroup;

  isSubmitting = false;
  signupSuccess = false;
  apiErrorMessage: string | null = null;
  apiSuccessMessage: string | null = null;

  emailCheckStatus: 'idle' | 'checking' | 'available' | 'taken' = 'idle';
  private emailToCheck$ = new Subject<string>();

  showPassword = false;
  showConfirmPassword = false;

  states: DropdownOption[] = [];
  cities: DropdownOption[] = [];
  billingCities: DropdownOption[] = [];
  loadingStates = false;
  loadingCities = false;
  loadingBillingCities = false;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private gs: GeneralService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initForms();
    this.loadStates();
    this.wireEmailDuplicateCheck();
  }

  private wireEmailDuplicateCheck(): void {

    this.step3Form
      .get('email')!
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((value: string) => {
        const trimmed = (value || '').trim();

        const ctrl = this.step3Form.get('email')!;
        if (!trimmed || ctrl.hasError('email') || ctrl.hasError('required')) {
          this.emailCheckStatus = 'idle';
          this.cdr.markForCheck();
          return;
        }
        this.emailCheckStatus = 'checking';
        this.cdr.markForCheck();
        this.emailToCheck$.next(trimmed);
      });

    this.emailToCheck$
      .pipe(
        debounceTime(600),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((email: string) => {
        if (!email) return;
        this.gs
          .commonGet(`Users/ActiveUserExists?email=${encodeURIComponent(email)}`)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (res: any) => {

              const currentEmail = (this.step3Form.get('email')?.value || '').trim();
              if (currentEmail !== email) return;

              const exists = res?.activeUserExists === true;
              this.emailCheckStatus = exists ? 'taken' : 'available';
              this.cdr.markForCheck();
            },
            error: () => {

              this.emailCheckStatus = 'idle';
              this.cdr.markForCheck();
            },
          });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForms(): void {
    this.step1Form = this.fb.group({
      titleLong: ['', [Validators.required, Validators.maxLength(150)]],
      titleShort: ['', [Validators.required, Validators.maxLength(60)]],
      npi: ['', [Validators.maxLength(20)]],
      fedearlTaxId: ['', [Validators.maxLength(20)]],
      fax: ['', [Validators.maxLength(20)]],
    });

    this.step2Form = this.fb.group({
      address: ['', [Validators.required, Validators.maxLength(250)]],
      stateId: [null, [Validators.required]],
      cityId: [{ value: null, disabled: true }, [Validators.required]],
      zipCode: [
        '',
        [Validators.required, Validators.pattern(/^\d{5}(?:[-\s]\d{4})?$/)],
      ],
      billingAddressType: ['Same as Clinic', [Validators.required]],
      billingAddress: [{ value: '', disabled: true }],
      billingStateId: [{ value: null, disabled: true }],
      billingCityId: [{ value: null, disabled: true }],
      billingZipCode: [{ value: '', disabled: true }],
    });

    this.step3Form = this.fb.group(
      {
        clinicAdminFirstName: [
          '',
          [Validators.required, Validators.maxLength(60)],
        ],
        clinicAdminLastName: [
          '',
          [Validators.required, Validators.maxLength(60)],
        ],
        email: ['', [Validators.required, Validators.email]],
        phone: ['', [Validators.required]],
        password: [
          '',
          [Validators.required, Validators.pattern(PASSWORD_PATTERN)],
        ],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: passwordsMatchValidator }
    );

    this.step2Form
      .get('stateId')!
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((stateId: number | null) => {
        const cityCtrl = this.step2Form.get('cityId')!;
        cityCtrl.reset();
        cityCtrl.disable({ emitEvent: false });
        this.cities = [];
        if (stateId) {
          this.loadCities(stateId);
        }
        this.cdr.markForCheck();
      });

    this.step2Form
      .get('billingAddressType')!
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((type: string) => {
        this.toggleBillingFields(type === 'Other Address');
      });

    this.step2Form
      .get('billingStateId')!
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((stateId: number | null) => {
        const billingCityCtrl = this.step2Form.get('billingCityId')!;
        billingCityCtrl.reset();
        billingCityCtrl.disable({ emitEvent: false });
        this.billingCities = [];
        if (stateId) {
          this.loadBillingCities(stateId);
        }
        this.cdr.markForCheck();
      });
  }

  private toggleBillingFields(enabled: boolean): void {
    const fields = [
      'billingAddress',
      'billingStateId',
      'billingCityId',
      'billingZipCode',
    ];
    fields.forEach((name) => {
      const ctrl = this.step2Form.get(name);
      if (!ctrl) return;
      if (enabled) {

        ctrl.enable({ emitEvent: false });
        if (name === 'billingZipCode') {
          ctrl.setValidators([
            Validators.required,
            Validators.pattern(/^\d{5}(?:[-\s]\d{4})?$/),
          ]);
        } else if (name === 'billingCityId') {

          ctrl.disable({ emitEvent: false });
          ctrl.setValidators([Validators.required]);
        } else {
          ctrl.setValidators([Validators.required]);
        }
      } else {
        ctrl.clearValidators();
        ctrl.reset({ value: '', disabled: true }, { emitEvent: false });
      }
      ctrl.updateValueAndValidity({ emitEvent: false });
    });
    this.cdr.markForCheck();
  }

  private loadStates(): void {
    this.loadingStates = true;
    this.cdr.markForCheck();
    this.gs
      .commonGet('Dropdowns/GetAllStateOfUSA')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.states = Array.isArray(res?.data) ? res.data : [];
          this.loadingStates = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingStates = false;
          this.cdr.markForCheck();
        },
      });
  }

  private loadCities(stateId: number): void {
    this.loadingCities = true;
    this.cdr.markForCheck();
    this.gs
      .commonGet(`Dropdowns/GetCitiesByStateId?Id=${stateId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.cities = Array.isArray(res?.data) ? res.data : [];
          this.loadingCities = false;
          if (this.cities.length > 0) {
            this.step2Form.get('cityId')?.enable({ emitEvent: false });
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingCities = false;
          this.cdr.markForCheck();
        },
      });
  }

  private loadBillingCities(stateId: number): void {
    this.loadingBillingCities = true;
    this.cdr.markForCheck();
    this.gs
      .commonGet(`Dropdowns/GetCitiesByStateId?Id=${stateId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.billingCities = Array.isArray(res?.data) ? res.data : [];
          this.loadingBillingCities = false;
          if (this.billingCities.length > 0) {
            this.step2Form.get('billingCityId')?.enable({ emitEvent: false });
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingBillingCities = false;
          this.cdr.markForCheck();
        },
      });
  }

  goToStep(step: 1 | 2 | 3): void {

    if (step > this.currentStep) return;
    this.currentStep = step;
    this.cdr.markForCheck();
  }

  nextStep(): void {
    const form = this.currentStepForm;
    if (form.invalid) {
      form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }
    if (this.currentStep < 3) {
      this.currentStep = (this.currentStep + 1) as 1 | 2 | 3;
      this.cdr.markForCheck();
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep = (this.currentStep - 1) as 1 | 2 | 3;
      this.cdr.markForCheck();
    }
  }

  get currentStepForm(): FormGroup {
    return this.currentStep === 1
      ? this.step1Form
      : this.currentStep === 2
      ? this.step2Form
      : this.step3Form;
  }

  onPhoneInput(event: Event, controlName: 'phone' | 'fax'): void {
    const target = event.target as HTMLInputElement;
    const digits = (target.value || '').replace(/\D/g, '').slice(0, 10);
    let formatted = digits;
    if (digits.length >= 7) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length >= 4) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else if (digits.length > 0) {
      formatted = `(${digits}`;
    }
    target.value = formatted;
    if (controlName === 'phone') {
      this.step3Form.get('phone')?.setValue(formatted, { emitEvent: false });
    } else {
      this.step1Form.get('fax')?.setValue(formatted, { emitEvent: false });
    }
  }

  get passwordValue(): string {
    return this.step3Form.get('password')?.value || '';
  }

  get pwdHasMin(): boolean {
    return this.passwordValue.length >= 8;
  }
  get pwdHasUpper(): boolean {
    return /[A-Z]/.test(this.passwordValue);
  }
  get pwdHasLower(): boolean {
    return /[a-z]/.test(this.passwordValue);
  }
  get pwdHasNumber(): boolean {
    return /\d/.test(this.passwordValue);
  }
  get pwdHasSpecial(): boolean {
    return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(this.passwordValue);
  }
  get passwordsMismatch(): boolean {
    return (
      !!this.step3Form.errors?.['passwordsMismatch'] &&
      !!this.step3Form.get('confirmPassword')?.touched
    );
  }

  togglePasswordVisibility(field: 'password' | 'confirm'): void {
    if (field === 'password') {
      this.showPassword = !this.showPassword;
    } else {
      this.showConfirmPassword = !this.showConfirmPassword;
    }
    this.cdr.markForCheck();
  }

  onBlurTrim(event: FocusEvent, trimBoth: boolean = false): void {
    const el = event.target as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return;

    const raw = el.value ?? '';
    let next = trimBoth ? raw.trim() : raw.replace(/\s+$/g, '');
    if (next.trim().length === 0) next = '';

    if (next === raw) return;
    el.value = next;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  submit(): void {
    if (this.step3Form.invalid) {
      this.step3Form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }
    if (this.step1Form.invalid || this.step2Form.invalid) {

      this.apiErrorMessage =
        'Please complete all required fields in earlier steps.';
      this.cdr.markForCheck();
      return;
    }

    if (this.emailCheckStatus === 'taken') {
      this.apiErrorMessage =
        'A clinic with this email already exists. Please use a different email.';
      this.cdr.markForCheck();
      return;
    }

    if (this.emailCheckStatus === 'checking') {
      this.apiErrorMessage =
        'Verifying email — please wait a moment, then try again.';
      this.cdr.markForCheck();
      return;
    }

    this.isSubmitting = true;
    this.apiErrorMessage = null;
    this.cdr.markForCheck();

    const payload = this.buildPayload();

    this.gs
      .commonPost('UnAuthorize/ClinicSignup', payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.isSubmitting = false;

          if (res?.data === true) {
            this.signupSuccess = true;
            this.apiSuccessMessage =
              res?.message ||
              'Clinic sign-up submitted successfully.';
          } else {

            this.apiErrorMessage =
              res?.message ||
              'Something went wrong while creating your clinic. Please try again.';

            if (
              typeof res?.message === 'string' &&
              /email\s+already\s+exists/i.test(res.message)
            ) {
              this.emailCheckStatus = 'taken';
            }
          }
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          this.isSubmitting = false;
          this.apiErrorMessage =
            err?.error?.message ||
            err?.message ||
            'Unable to reach the server. Please try again in a moment.';
          this.cdr.markForCheck();
        },
      });
  }

  private buildPayload(): any {
    const s1 = this.step1Form.getRawValue();
    const s2 = this.step2Form.getRawValue();
    const s3 = this.step3Form.getRawValue();

    const stripPhone = (v: string | null | undefined): string =>
      (v || '').replace(/\D/g, '');

    const sameBilling = s2.billingAddressType === 'Same as Clinic';

    return {
      clinicAdminFirstName: (s3.clinicAdminFirstName || '').trim(),
      clinicAdminLastName: (s3.clinicAdminLastName || '').trim(),
      titleLong: (s1.titleLong || '').trim(),
      titleShort: (s1.titleShort || '').trim(),
      email: (s3.email || '').trim(),
      phone: stripPhone(s3.phone),
      fax: stripPhone(s1.fax),
      billingAddressType: s2.billingAddressType,
      address: (s2.address || '').trim(),
      cityId: Number(s2.cityId) || 0,
      stateId: Number(s2.stateId) || 0,
      zipCode: (s2.zipCode || '').trim(),
      billingAddress: sameBilling
        ? (s2.address || '').trim()
        : (s2.billingAddress || '').trim(),
      billingCityId: sameBilling
        ? Number(s2.cityId) || 0
        : Number(s2.billingCityId) || 0,
      billingStateId: sameBilling
        ? Number(s2.stateId) || 0
        : Number(s2.billingStateId) || 0,
      billingZipCode: sameBilling
        ? (s2.zipCode || '').trim()
        : (s2.billingZipCode || '').trim(),
      fedearlTaxId: (s1.fedearlTaxId || '').trim(),
      npi: (s1.npi || '').trim(),
      password: s3.password,
      confirmPassword: s3.confirmPassword,
    };
  }

  goToLogin(): void {
    this.router.navigate(['/content/login']);
  }

  hasError(form: FormGroup, controlName: string, errorKey: string): boolean {
    const ctrl = form.get(controlName);
    return !!ctrl && ctrl.touched && ctrl.hasError(errorKey);
  }

  isInvalid(form: FormGroup, controlName: string): boolean {
    const ctrl = form.get(controlName);
    return !!ctrl && ctrl.touched && ctrl.invalid;
  }

  get isOtherBilling(): boolean {
    return this.step2Form?.get('billingAddressType')?.value === 'Other Address';
  }
}
