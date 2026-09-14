import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzCardModule } from 'ng-zorro-antd/card';

import { finalize, Subject, takeUntil } from 'rxjs';

import { GeneralService } from 'app/shared/services/general.service';
import { AuthService } from '../shared/Auth/auth.service';

interface ApiResponse<T = any> {
  status: number;
  success?: boolean | null;
  message?: string;
  count?: number;
  data: T;
  totalEntityCount?: number;
  totalPages?: number;
}

type SaveUserPayload = {
  userId?: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  dob?: string;
  title?: string;
  gender?: string;
  email: string;
  providerType?: string;
  phone?: string;
  addressType?: string;
  address?: string;
  stateId?: number;
  cityId?: number;
  zipCode?: string;
  taxId?: string;
  medicaid?: string;
  caqhId?: string;
  npi?: string;
  license?: string;
  ssn?: string;
  dea?: string;
  bio?: string;
  categoryId?: number[];
  isSupervisorRequired: boolean;
  supervisorId: number[];
  roleId: number;
  providerLicense: Array<{ stateId: number; stateLicense: string }>;
};

@Component({
  selector: 'app-provider-user-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzCardModule,
    NzSpinModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzDatePickerModule,
    NzButtonModule
  ],
  templateUrl: './provider-user-profile.component.component.html',
  styleUrl: './provider-user-profile.component.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProviderUserProfileComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  userId!: number;
  loadingProfile = false;
  saving = false;

  providerEmailDupCheck = false;
  selectedProviderForEditing: any = null;

  providerForm!: FormGroup;

  citiesByState: Array<{ id: number; name: string; shortName?: string }> = [];
  citiesByStateLoading = false;

  categories: Array<{ categoryId: number; categoryName: string }> = [];
  categoriesLoading = false;

  allStates: Array<{ id: number; name: string; shortName: string }> = [];
  allStatesLoading = false;

  get profileInitials(): string {
    const first = String(this.providerForm?.get('firstName')?.value || '').trim();
    const last = String(this.providerForm?.get('lastName')?.value || '').trim();
    const initialFirst = first ? first.charAt(0) : '';
    const initialLast = last ? last.charAt(0) : '';
    const initials = `${initialFirst}${initialLast}`.toUpperCase();
    return initials || 'PR';
  }

  get selectedCategoriesCount(): number {
    const values = this.providerForm?.get('categoryId')?.value;
    return Array.isArray(values) ? values.length : 0;
  }

  get selectedLicensedStatesCount(): number {
    const values = this.providerForm?.get('licenseStateIds')?.value;
    return Array.isArray(values) ? values.length : 0;
  }

  constructor(
    private fb: FormBuilder,
    private gs: GeneralService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private notification: NzNotificationService
  ) {}

  ngOnInit(): void {
    this.initProviderForm();

    this.providerForm
      .get('stateId')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((stateId: number) => {
        this.citiesByState = [];
        this.providerForm.patchValue({ cityId: null }, { emitEvent: false });
        if (stateId) this.loadCitiesByState(stateId);
        this.cdr.markForCheck();
      });

    const id = this.auth.getUserId();
    if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) {
      this.notification.error('Error', 'Unable to determine current userId from AuthService.');
      return;
    }
    this.userId = id;

    this.loadCategories();
    this.loadAllStates();
    this.loadProviderProfile(this.userId);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initProviderForm(): void {
    this.providerForm = this.fb.group({
      npi: ['', [Validators.required]],
      firstName: ['', [Validators.required]],
      middleName: [''],
      lastName: ['', [Validators.required]],
      title: [''],
      gender: ['', [Validators.required]],
      dob: [null, [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      providerType: ['', [Validators.required]],
      address: ['', [Validators.required]],
      cityId: [null, [Validators.required]],
      stateId: [null, [Validators.required]],
      zipCode: ['', [Validators.required, Validators.pattern(/^\d+$/), Validators.minLength(5), Validators.maxLength(5)]],
      taxId: [''],
      medicaid: [''],
      caqhId: [''],
      license: ['', [Validators.required]],
      ssn: [''],
      dea: [''],
      categoryId: [<number[]>[], [Validators.required]],

      licenseStateIds: [<number[]>[], [Validators.required]],

      bio: ['', [Validators.required]]
    });
  }

  private loadProviderProfile(userId: number): void {
    this.loadingProfile = true;

    this.gs
      .commonGet(`Users/getUserById?Id=${userId}`)
      .pipe(
        finalize(() => {
          this.loadingProfile = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: ApiResponse<any>) => {
          const d = res?.data;
          this.selectedProviderForEditing = d;

          if (!d) {
            this.notification.error('Error', 'No user data returned.');
            return;
          }

          const dobVal = d.dob ? new Date(d.dob) : null;

          const cats: number[] = Array.isArray(d.providerCategories)
            ? d.providerCategories
              .map((c: any) => c?.categoryId)
              .filter((x: any) => typeof x === 'number')
            : [];

          const licenseStateIds: number[] = Array.isArray(d.providerLicense)
            ? d.providerLicense
              .map((pl: any) => pl?.stateId)
              .filter((x: any) => typeof x === 'number')
            : [];

          const licenseValue =
            (Array.isArray(d.providerLicense) && d.providerLicense.length && typeof d.providerLicense[0]?.stateLicense === 'string'
                ? String(d.providerLicense[0].stateLicense)
                : String(d.license || '')
            ).trim();

          this.providerForm.patchValue(
            {
              npi: d.npi || '',
              firstName: d.firstName || '',
              middleName: d.middleName || '',
              lastName: d.lastName || '',
              title: d.title || '',
              gender: d.gender || '',
              dob: dobVal,
              email: d.email || '',
              phone: d.phone || '',
              providerType: d.providerType || '',
              address: d.address || '',
              stateId: typeof d.stateId === 'number' ? d.stateId : null,
              cityId: null,
              zipCode: d.zipCode || '',
              taxId: d.taxId || '',
              medicaid: d.medicaid || '',
              caqhId: d.caqhId || '',
              license: licenseValue,
              ssn: d.ssn || '',
              dea: d.dea || '',
              categoryId: cats,
              licenseStateIds: licenseStateIds,
              bio: d.bio || ''
            },
            { emitEvent: false }
          );

          this.citiesByState = [];
          if (typeof d.stateId === 'number') {
            this.loadCitiesByState(d.stateId, typeof d.cityId === 'number' ? d.cityId : undefined);
          }

          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('getUserById error', err);
          this.notification.error('Error', 'Failed to load provider profile.');
        }
      });
  }

  private loadCitiesByState(stateId: number, preselectCityId?: number): void {
    if (!stateId) {
      this.citiesByState = [];
      this.providerForm.patchValue({ cityId: null }, { emitEvent: false });
      return;
    }

    this.citiesByStateLoading = true;
    this.gs
      .commonGet(`DropDowns/GetCitiesByStateId?Id=${stateId}`)
      .pipe(
        finalize(() => {
          this.citiesByStateLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: ApiResponse<any[]>) => {
          const list = Array.isArray(res?.data) ? res.data : [];
          this.citiesByState = list.map((x: any) => ({ id: x.id, name: x.name, shortName: x.shortName }));
          if (typeof preselectCityId === 'number') {
            this.providerForm.patchValue({ cityId: preselectCityId }, { emitEvent: false });
          }
        },
        error: () => this.notification.error('Error', 'Failed to load cities.')
      });
  }

  private loadCategories(): void {
    this.categoriesLoading = true;
    this.gs
      .commonGet('DropDowns/getAllCategories?Id=1')
      .pipe(
        finalize(() => {
          this.categoriesLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: ApiResponse<any[]>) => {
          const list = Array.isArray(res?.data) ? res.data : [];
          this.categories = list.map((x: any) => ({ categoryId: x.categoryId, categoryName: x.categoryName }));
        },
        error: () => this.notification.error('Error', 'Failed to load categories.')
      });
  }

  private loadAllStates(): void {
    this.allStatesLoading = true;
    this.gs
      .commonGet('DropDowns/GetAllStateOfUSA')
      .pipe(
        finalize(() => {
          this.allStatesLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: ApiResponse<any[]>) => {
          const list = Array.isArray(res?.data) ? res.data : [];
          this.allStates = list.map((x: any) => ({ id: x.id, name: x.name, shortName: x.shortName }));
        },
        error: () => this.notification.error('Error', 'Failed to load licensed states.')
      });
  }

  selectAllLicensedStates(): void {
    const allIds = (this.allStates || [])
      .map((s) => s?.id)
      .filter((x): x is number => typeof x === 'number');

    this.providerForm.get('licenseStateIds')?.setValue(allIds);
    this.providerForm.get('licenseStateIds')?.markAsDirty();
    this.providerForm.get('licenseStateIds')?.updateValueAndValidity();
  }

  clearLicensedStates(): void {
    this.providerForm.get('licenseStateIds')?.setValue([]);
    this.providerForm.get('licenseStateIds')?.markAsDirty();
    this.providerForm.get('licenseStateIds')?.updateValueAndValidity();
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

  onProviderPhoneInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const digits = (input.value || '').replace(/\D/g, '').slice(0, 10);
    const parts: string[] = [];
    if (digits.length > 0) parts.push('(' + digits.slice(0, Math.min(3, digits.length)) + ')');
    if (digits.length > 3) parts.push(' ' + digits.slice(3, Math.min(6, digits.length)));
    if (digits.length > 6) parts.push('-' + digits.slice(6));
    input.value = parts.join('');
    this.providerForm.get('phone')?.setValue(input.value, { emitEvent: false });
  }

  onZipInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const digitsOnly = (input.value || '').replace(/\D/g, '').slice(0, 5);
    input.value = digitsOnly;
    this.providerForm.get('zipCode')?.setValue(digitsOnly, { emitEvent: false });
  }

  hasProviderError(ctrl: string, key: string): boolean {
    const c = this.providerForm.get(ctrl);
    return !!(c && c.touched && c.hasError(key));
  }

  onProviderEmailCheck(): void {
    const email = this.providerForm.get('email')?.value || '';
    const originalEmail = this.selectedProviderForEditing?.email;

    if (originalEmail && email === originalEmail) return;

    if (email && this.providerForm.get('email')?.valid) {
      this.providerEmailDupCheck = true;
      this.gs
        .checkDuplicateEmail(email)
        .pipe(
          finalize(() => {
            this.providerEmailDupCheck = false;
            this.cdr.markForCheck();
          }),
          takeUntil(this.destroy$)
        )
        .subscribe((response: any) => {
          if (response?.activeUserExists) {
            this.notification.error('Error', 'Email already exists. Please use a different email.');
            this.providerForm.get('email')?.setErrors({ duplicate: true });
          }
        });
    }
  }

  saveProfile(): void {
    if (this.providerForm.invalid) {
      this.providerForm.markAllAsTouched();
      return;
    }
    if (!this.userId) return;

    this.saving = true;

    const v = this.providerForm.value;

    let dobIso: string | undefined;
    if (v.dob) {
      const d = new Date(v.dob);
      const dateOnly = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      dobIso = dateOnly.toISOString();
    }

    const numericPhone = String(v.phone || '').replace(/\D/g, '');

    const selectedLicensedStateIds: number[] = Array.isArray(v.licenseStateIds)
      ? v.licenseStateIds.filter((x: any): x is number => typeof x === 'number')
      : [];

    const licenseNumber: string = String(v.license || '').trim();

    const body: SaveUserPayload = {
      userId: this.userId,
      firstName: (v.firstName || '').trim(),
      ...(v.middleName ? { middleName: (v.middleName || '').trim() } : {}),
      lastName: (v.lastName || '').trim(),
      ...(dobIso ? { dob: dobIso } : {}),
      ...(v.title ? { title: (v.title || '').trim() } : {}),
      ...(v.gender ? { gender: v.gender } : {}),
      email: (v.email || '').trim(),
      ...(v.providerType ? { providerType: v.providerType } : {}),
      phone: numericPhone,
      addressType: '',
      ...(v.address ? { address: (v.address || '').trim() } : {}),
      ...(typeof v.stateId === 'number' ? { stateId: v.stateId } : {}),
      ...(typeof v.cityId === 'number' ? { cityId: v.cityId } : {}),
      ...(v.zipCode ? { zipCode: (v.zipCode || '').trim() } : {}),
      ...(v.taxId ? { taxId: (v.taxId || '').trim() } : {}),
      ...(v.medicaid ? { medicaid: (v.medicaid || '').trim() } : {}),
      ...(v.caqhId ? { caqhId: (v.caqhId || '').trim() } : {}),
      ...(v.npi ? { npi: (v.npi || '').trim() } : {}),
      license: licenseNumber,
      ...(v.ssn ? { ssn: (v.ssn || '').trim() } : {}),
      ...(v.dea ? { dea: (v.dea || '').trim() } : {}),
      ...(v.bio ? { bio: (v.bio || '').trim() } : {}),
      categoryId: Array.isArray(v.categoryId) ? v.categoryId : [],
      isSupervisorRequired: false,
      supervisorId: [],
      roleId: 4,

      providerLicense: selectedLicensedStateIds.map((sid: number) => ({
        stateId: sid,
        stateLicense: licenseNumber
      }))
    };

    this.gs
      .commonPost('Users/saveUser', body)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: ApiResponse) => {
          if (res?.status === 1 || res?.success) {
            this.notification.success('Success', 'Profile updated.');
            this.loadProviderProfile(this.userId);
          } else {
            this.notification.error('Error', res?.message || 'Operation failed.');
          }
        },
        error: (err) => {
          console.error('saveUser (provider profile) error', err);
          this.notification.error('Error', err?.message || 'Failed to save profile.');
        }
      });
  }
}
