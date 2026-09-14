import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  OnDestroy,
  OnInit
} from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { HttpService } from 'app/shared/services/http.service';
import { GeneralService } from 'app/shared/services/general.service';
import { Subject, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  filter as rxFilter,
  finalize,
  switchMap,
  takeUntil,
  catchError
} from 'rxjs/operators';

interface CityState {
  id: number;
  name: string;
  shortName: string;
}

interface Category {
  categoryId: number;
  categoryName: string;
}

interface Supervisor {
  id: number;
  name: string;
}

@Component({
  selector: 'app-user-add-edit-modal',
  templateUrl: './user-add-edit-modal.component.html',
  styleUrl: './user-add-edit-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserAddEditModalComponent implements OnInit, OnDestroy {
  @Input() isVisible = false;
  @Input() modelTitle = 'Provider Form';
  @Output() modalClosed = new EventEmitter<boolean>();

  userId = 0;
  roleId = 0;
  facilityId = 0;

  userAddEditForm!: FormGroup;
  isFormSubmitting = false;

  categories: Category[] = [];
  supervisors: Supervisor[] = [];
  cities: CityState[] = [];
  states: CityState[] = [];
  state: CityState | null = null;

  emailExist = false;
  loadingStates = false;
  loadingSupervisors = false;

  private destroy$ = new Subject<void>();
  private modalClose$ = new Subject<void>();

  isUpdateForm = false;
  originalEmail = '';

  disableFutureDates = (current: Date): boolean => current > new Date();

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private generalService: GeneralService,
    private http: HttpService
  ) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.modalClose$.next();
    this.modalClose$.complete();

    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    const isProvider = this.roleId === 4;

    this.userAddEditForm = this.fb.group({
      roleId: [this.roleId, Validators.required],
      facilityId: [this.facilityId, Validators.required],

      npi: ['', isProvider ? Validators.required : []],
      firstName: ['', Validators.required],
      middleName: [''],
      lastName: ['', Validators.required],
      title: [''],

      gender: [null, isProvider ? Validators.required : []],
      dob: [null, isProvider ? Validators.required : []],

      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],

      addressType: ['Same as Clinic', Validators.required],

      providerType: [null, isProvider ? Validators.required : []],

      address: ['', isProvider ? Validators.required : []],
      cityId: [null, isProvider ? Validators.required : []],
      stateId: [null, isProvider ? Validators.required : []],
      zipCode: ['', isProvider ? Validators.required : []],

      taxId: [''],
      medicaid: [''],
      caqhId: [''],
      license: ['', isProvider ? Validators.required : []],
      ssn: [''],
      dea: [''],

      categoryId: [[], isProvider ? Validators.required : []],
      isSupervisorRequired: [false],
      supervisorId: [[]]
    });

    this.userAddEditForm.get('roleId')?.disable({ emitEvent: false });
    this.userAddEditForm.get('facilityId')?.disable({ emitEvent: false });

    if (isProvider) {
      this.setupNpiLookup();
      this.userAddEditForm.get('addressType')?.disable({ emitEvent: false });
    } else {

      this.userAddEditForm.get('npi')?.disable({ emitEvent: false });
      this.userAddEditForm.get('title')?.disable({ emitEvent: false });
      this.userAddEditForm.get('gender')?.disable({ emitEvent: false });
      this.userAddEditForm.get('dob')?.disable({ emitEvent: false });
      this.userAddEditForm.get('providerType')?.disable({ emitEvent: false });

      this.userAddEditForm.get('taxId')?.disable({ emitEvent: false });
      this.userAddEditForm.get('medicaid')?.disable({ emitEvent: false });
      this.userAddEditForm.get('caqhId')?.disable({ emitEvent: false });
      this.userAddEditForm.get('license')?.disable({ emitEvent: false });
      this.userAddEditForm.get('ssn')?.disable({ emitEvent: false });
      this.userAddEditForm.get('dea')?.disable({ emitEvent: false });

      this.userAddEditForm.get('supervisorId')?.disable({ emitEvent: false });
      this.userAddEditForm.get('isSupervisorRequired')?.disable({ emitEvent: false });
      this.userAddEditForm.get('categoryId')?.disable({ emitEvent: false });

      this.onAddressTypeChange(this.userAddEditForm.get('addressType')?.value);
    }

    this.userAddEditForm
      .get('addressType')
      ?.valueChanges.pipe(takeUntil(this.modalClose$), takeUntil(this.destroy$))
      .subscribe((val) => this.onAddressTypeChange(val));

    this.userAddEditForm
      .get('cityId')
      ?.valueChanges.pipe(takeUntil(this.modalClose$), takeUntil(this.destroy$))
      .subscribe((cityId) => this.onCityChange(Number(cityId) || 0));

    this.userAddEditForm
      .get('isSupervisorRequired')
      ?.valueChanges.pipe(takeUntil(this.modalClose$), takeUntil(this.destroy$))
      .subscribe((value) => {
        if (this.roleId !== 4) return;
        if (value && this.supervisors.length === 0) this.loadSupervisors();

        const supervisorControl = this.userAddEditForm.get('supervisorId');
        value ? supervisorControl?.setValidators(Validators.required) : supervisorControl?.clearValidators();
        supervisorControl?.updateValueAndValidity({ emitEvent: false });
      });
  }

  showModal(id: number, title: string, roleId: number, facilityId?: number): void {

    this.modalClose$.next();

    this.userId = id;
    this.modelTitle = title;
    this.roleId = roleId;
    this.facilityId = facilityId || 0;

    this.emailExist = false;
    this.isFormSubmitting = false;
    this.isUpdateForm = false;
    this.originalEmail = '';
    this.state = null;

    this.initForm();
    this.loadCategories();
    this.loadStates();
    this.loadCities();

    if (id) {
      this.loadUserData(id);
    } else {

      this.userAddEditForm.reset({}, { emitEvent: false });

      this.userAddEditForm.patchValue(
        {
          roleId: this.roleId,
          facilityId: this.facilityId,
          addressType: this.roleId === 4 ? 'Same as Clinic' : 'Same as Clinic',
          isSupervisorRequired: false,
          supervisorId: [],
          categoryId: []
        },
        { emitEvent: false }
      );

      this.userAddEditForm.get('roleId')?.setValue(this.roleId, { emitEvent: false });
      this.userAddEditForm.get('facilityId')?.setValue(this.facilityId, { emitEvent: false });

      this.onAddressTypeChange(this.userAddEditForm.get('addressType')?.value);
    }

    this.isVisible = true;
    this.cdr.detectChanges();
  }

  handleCancel(success = false): void {
    this.isVisible = false;
    this.modalClose$.next();
    this.modalClosed.emit(success);

    if (!success) {
      this.userAddEditForm?.reset({}, { emitEvent: false });
      this.state = null;
    }
    this.cdr.markForCheck();
  }

  handleOk(): void {
    if (!this.validateForm()) return;

    this.isFormSubmitting = true;

    const raw = this.userAddEditForm.getRawValue();

    raw.roleId = this.roleId;
    raw.facilityId = this.facilityId;

    const body = {
      ...raw,
      userId: this.userId || 0
    };

    this.generalService
      .commonPost('Users/saveUser', body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.status === 1 && response?.data >= 0) {
            this.generalService.showSuccess(response.message);
          } else {
            this.generalService.showError(response?.message || 'Failed to save user');
          }

          this.isFormSubmitting = false;
          this.handleCancel(true);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('saveUser error:', err);
          this.generalService.showError(err?.message || 'Failed to save user');
          this.isFormSubmitting = false;
          this.cdr.detectChanges();
        }
      });
  }

  private validateForm(): boolean {
    if (this.emailExist) {
      this.generalService.showError('Email already exist use different email');
      return false;
    }

    if (!this.userAddEditForm.valid) {
      const invalid = Object.keys(this.userAddEditForm.controls).filter((k) => this.userAddEditForm.get(k)?.invalid);
      console.log('Invalid controls:', invalid);
      console.log('Raw value:', this.userAddEditForm.getRawValue());

      Object.keys(this.userAddEditForm.controls).forEach((field) => {
        const control = this.userAddEditForm.get(field);
        control?.markAsTouched({ onlySelf: true });
        control?.updateValueAndValidity({ emitEvent: false });
      });

      this.generalService.showError('Please fill all the required fields');
      return false;
    }

    return true;
  }

  private loadUserData(userId: number): void {
    this.generalService
      .commonGet(`Users/getUserById?Id=${userId}`)
      .pipe(takeUntil(this.destroy$), takeUntil(this.modalClose$))
      .subscribe({
        next: (response) => {
          if (response?.status === 1 && response?.data) {
            this.originalEmail = response.data.email || '';
            this.patchFormValues(response.data);
          }
        }
      });
  }

  private patchFormValues(data: any): void {
    this.isUpdateForm = true;

    const uniqueCategories = [...new Set(data.providerCategories?.map((c: any) => c.categoryId) || [])];

    this.userAddEditForm.patchValue(
      {
        ...data,
        roleId: this.roleId,
        facilityId: this.facilityId,
        categoryId: uniqueCategories,
        isSupervisorRequired: !!data.isSupervisorRequired,
        supervisorId: data.supervisorId ?? data.supervisors ?? []
      },
      { emitEvent: false }
    );

    this.userAddEditForm.get('roleId')?.setValue(this.roleId, { emitEvent: false });
    this.userAddEditForm.get('facilityId')?.setValue(this.facilityId, { emitEvent: false });

    this.onAddressTypeChange(this.userAddEditForm.get('addressType')?.value);

    if (this.roleId !== 4 && this.userAddEditForm.get('addressType')?.value === 'Other Address') {
      const cityId = Number(this.userAddEditForm.get('cityId')?.value) || 0;
      if (cityId > 0) this.loadStateByCityId(cityId);
    }

    setTimeout(() => {
      this.isUpdateForm = false;
      this.cdr.markForCheck();
    }, 300);
  }

  onAddressTypeChange(type: string): void {
    if (this.roleId === 4) return;

    const address = this.userAddEditForm.get('address');
    const city = this.userAddEditForm.get('cityId');
    const state = this.userAddEditForm.get('stateId');
    const zipcode = this.userAddEditForm.get('zipCode');

    const isOther = type === 'Other Address';

    if (isOther) {
      address?.setValidators(Validators.required);
      city?.setValidators(Validators.required);
      state?.setValidators(Validators.required);
      zipcode?.setValidators(Validators.required);
    } else {
      address?.clearValidators();
      city?.clearValidators();
      state?.clearValidators();
      zipcode?.clearValidators();

      address?.reset('', { emitEvent: false });
      city?.reset(null, { emitEvent: false });
      state?.reset(null, { emitEvent: false });
      zipcode?.reset('', { emitEvent: false });
      this.state = null;
    }

    address?.updateValueAndValidity({ emitEvent: false });
    city?.updateValueAndValidity({ emitEvent: false });
    state?.updateValueAndValidity({ emitEvent: false });
    zipcode?.updateValueAndValidity({ emitEvent: false });

    this.cdr.markForCheck();
  }

  private setupNpiLookup(): void {
    this.userAddEditForm
      .get('npi')
      ?.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged(),

      rxFilter((npi: string | null | undefined): npi is string => {
        const val = (npi ?? '').trim();

        if (!val) return false;

        if (val.length === 10 && !/^\d+$/.test(val)) {
          this.generalService.showError('NPI must contain only numbers');
          return false;
        }

        return val.length === 10 && /^\d+$/.test(val) && !this.isUpdateForm;
      }),

      switchMap((npi: string) => {
        this.generalService.showInfo('Searching NPI...');
        return this.http.post('Commons/getNPIDetails', { npiNumber: npi.trim() });
      }),

      takeUntil(this.destroy$),
      takeUntil(this.modalClose$)
    )
      .subscribe({
        next: (response) => this.handleNpiResponse(response),
        error: (error) => {
          this.generalService.showError('Failed to fetch NPI details. Please try again.');
          console.error('NPI lookup error:', error);
        }
      });
  }

  private handleNpiResponse(response: any): void {
    if (response?.result_count > 0 && response?.results?.length > 0) {
      const npiData = response.results[0];
      this.fillFormFromNpiData(npiData);
      this.generalService.showSuccess('User Data Fetched Successfully');
    } else {
      this.generalService.showSuccess('No user found against this NPI');
    }
  }

  private fillFormFromNpiData(npiData: any): void {
    this.userAddEditForm.patchValue(
      {
        firstName: npiData?.basic?.first_name,
        lastName: npiData?.basic?.last_name,
        middleName: npiData?.basic?.middle_name,
        gender: npiData?.basic?.gender,
        title: npiData?.basic?.name_prefix
      },
      { emitEvent: false }
    );

    const practiceAddress = npiData?.addresses?.find((a: any) => a.address_purpose === 'LOCATION');
    if (practiceAddress) {
      this.userAddEditForm.patchValue(
        {
          address: practiceAddress.address_1,
          zipCode: practiceAddress.postal_code
        },
        { emitEvent: false }
      );

      const cityName = (practiceAddress.city || '').toLowerCase();
      const stateName = (practiceAddress.state || '').toLowerCase();

      const city = this.cities.find((c) => c.name?.toLowerCase().includes(cityName));
      if (city) {
        this.userAddEditForm.get('cityId')?.setValue(city.id, { emitEvent: false });
        this.loadStateByCityId(city.id);
      }

      const st = this.states.find((s) => s.shortName?.toLowerCase() === stateName);
      if (st) {
        setTimeout(() => {
          this.userAddEditForm.get('stateId')?.setValue(st.id, { emitEvent: false });
          this.cdr.markForCheck();
        }, 100);
      }
    }

    const phoneAddress = npiData?.addresses?.find((a: any) => a.telephone_number);
    if (phoneAddress) {
      this.userAddEditForm.get('phone')?.setValue(phoneAddress.telephone_number, { emitEvent: false });
    }

    this.cdr.markForCheck();
  }

  private loadCategories(): void {
    const orgId = Number(localStorage.getItem('OFL'));
    this.generalService
      .commonGet(`DropDowns/getAllCategories?Id=${orgId}`)
      .pipe(
        takeUntil(this.destroy$),
        takeUntil(this.modalClose$),
        catchError(() => {
          this.generalService.showError('Failed to load categories');
          return of(null);
        })
      )
      .subscribe((response) => {
        if (response?.status === 1 && response?.data) this.categories = response.data;
        this.cdr.markForCheck();
      });
  }

  private loadSupervisors(): void {
    this.loadingSupervisors = true;
    this.generalService
      .commonGet('DropDowns/getAllProviders?IsSupervisor=true')
      .pipe(
        finalize(() => (this.loadingSupervisors = false)),
        takeUntil(this.destroy$),
        takeUntil(this.modalClose$)
      )
      .subscribe({
        next: (response) => {
          if (response?.status === 1) this.supervisors = response.data || [];
          this.cdr.markForCheck();
        }
      });
  }

  private loadStates(): void {
    this.loadingStates = true;
    this.generalService
      .commonGet('DropDowns/GetAllStateOfUSA')
      .pipe(
        finalize(() => (this.loadingStates = false)),
        takeUntil(this.destroy$),
        takeUntil(this.modalClose$)
      )
      .subscribe({
        next: (response) => {
          if (response?.status === 1 && response?.data) this.states = response.data || [];
          this.cdr.markForCheck();
        }
      });
  }

  private loadCities(): void {
    this.generalService
      .getAllCities()
      .pipe(takeUntil(this.destroy$), takeUntil(this.modalClose$))
      .subscribe((cities) => {
        this.cities = cities || [];
        this.cdr.markForCheck();
      });
  }

  private loadStateByCityId(cityId: number): void {
    this.generalService
      .getStateByCityId(cityId)
      .pipe(takeUntil(this.destroy$), takeUntil(this.modalClose$))
      .subscribe((state) => {
        this.state = state;
        this.cdr.markForCheck();
      });
  }

  onCityChange(cityId: number): void {
    if (cityId > 0) this.loadStateByCityId(cityId);
    else this.state = null;

    if (this.isUpdateForm) return;
    this.userAddEditForm.get('stateId')?.reset(null, { emitEvent: false });
    this.cdr.markForCheck();
  }

  checkEmailExists(event: any): void {
    if (this.userAddEditForm.get('email')?.invalid) return;

    const email = event?.target?.value || '';
    if (!email) return;
    if (this.originalEmail === email) return;

    this.http
      .get(`Users/checkEmailAlreadyExist?Email=${encodeURIComponent(email)}`)
      .pipe(takeUntil(this.destroy$), takeUntil(this.modalClose$))
      .subscribe({
        next: (response) => {
          if (response?.status === 1 && response?.data === true) {
            this.generalService.showError('Email Already Exist');
            this.emailExist = true;
          } else {
            this.emailExist = false;
          }
          this.cdr.markForCheck();
        }
      });
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
}
