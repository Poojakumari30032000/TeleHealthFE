import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzNotificationService } from 'ng-zorro-antd/notification';

import { finalize, Subject, takeUntil } from 'rxjs';
import { GeneralService } from 'app/shared/services/general.service';

interface ApiResponse<T = any> {
  status: number;
  success?: boolean | null;
  message?: string;
  count?: number;
  data: T;
  totalEntityCount?: number;
  totalPages?: number;
}

interface UserRow {
  userId: number;
  userName: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  userRole?: string | null;
  roleTitleId?: number | null;
  roleTitleName?: string | null;
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
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    NzTabsModule,
    NzTableModule,
    NzButtonModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzIconModule,
    NzSwitchModule,
    NzSelectModule,
    NzDatePickerModule
  ],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeTabIndex = 0;

  gaLoading = false;
  gaRows: UserRow[] = [];
  gaTotal = 0;
  gaPageIndex = 1;
  gaPageSize = 100;

  searchName = '';
  selectedStatus: string | null = null;
  statusOptions = ['Active', 'InActive'];

  isGaModalVisible = false;
  isEditMode = false;
  editingId: number | null = null;
  saving = false;
  emailDuplicateCheck = false;

  rowToggleLoadingId: number | null = null;
  rowDeleteLoadingId: number | null = null;

  signUpForm!: FormGroup;

  prLoading = false;
  prRows: UserRow[] = [];
  prTotal = 0;
  prPageIndex = 1;
  prPageSize = 100;

  prSearchName = '';
  prSelectedStatus: string | null = null;

  prRowToggleLoadingId: number | null = null;
  prRowDeleteLoadingId: number | null = null;
  prRowEditLoadingId: number | null = null;

  isProviderModalVisible = false;
  providerEditMode = false;
  providerEditingId: number | null = null;
  providerForm!: FormGroup;
  providerEmailDupCheck = false;

  selectedProviderForEditing:any;

  citiesByState: Array<{ id: number; name: string; shortName?: string }> = [];
  citiesByStateLoading = false;

  categories: Array<{ categoryId: number; categoryName: string }> = [];
  categoriesLoading = false;

  allStates: Array<{ id: number; name: string; shortName: string }> = [];
  allStatesLoading = false;

  techLoading = false;
  techRows: UserRow[] = [];
  techTotal = 0;
  techPageIndex = 1;
  techPageSize = 100;

  techSearchName = '';
  techSelectedStatus: string | null = null;

  isTechModalVisible = false;
  techEditMode = false;
  techEditingId: number | null = null;
  techSaving = false;
  techEmailDuplicateCheck = false;
  techForm!: FormGroup;

  techRowToggleLoadingId: number | null = null;

  selectedTechForEditing: any = null;

  rtLoading = false;
  rtRows: Array<{ id: number; name: string; shortName: string | null }> = [];
  rtSearchName = '';

  isRtModalVisible = false;
  rtEditMode = false;
  rtEditingId: number | null = null;
  rtSaving = false;
  rtForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private gs: GeneralService,
    private cdr: ChangeDetectorRef,
    private notification: NzNotificationService,
    private modal: NzModalService,
    private route: ActivatedRoute
  ) {}

  statusBadgeClass(status: string | null | undefined): string {
    const s = (status || '').toLowerCase();
    if (s === 'active' || s === 'paid' || s === 'completed') return 'ui-status-badge--success';
    if (s === 'pending' || s === 'processing') return 'ui-status-badge--pending';
    if (s === 'inactive' || s === 'cancelled' || s === 'failed') return 'ui-status-badge--danger';
    return 'ui-status-badge--neutral';
  }

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const tab = (params.get('tab') || '').toLowerCase();
        const tabIndexRaw = params.get('tabIndex');
        const tabIndex = tabIndexRaw !== null ? Number(tabIndexRaw) : NaN;

        if (tab === 'global-admin' || tab === 'globaladmin') {
          this.activeTabIndex = 0;
        } else if (tab === 'providers' || tab === 'provider') {
          this.activeTabIndex = 1;
        } else if (tab === 'tech-support' || tab === 'techsupport' || tab === 'tech') {
          this.activeTabIndex = 2;
        } else if (Number.isFinite(tabIndex) && tabIndex >= 0 && tabIndex <= 2) {
          this.activeTabIndex = tabIndex;
        }

        this.cdr.markForCheck();
      });

    this.initGaForm();
    this.initProviderForm();

    this.providerForm.get('stateId')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((stateId: number) => {
      this.citiesByState = [];
      this.providerForm.patchValue({ cityId: null }, { emitEvent: false });
      if (stateId) this.loadCitiesByState(stateId);
      this.cdr.markForCheck();
    });

    this.fetchGlobalAdmins();
    this.fetchProviders();

    this.initTechForm();
    this.fetchTechSupport();

    this.initRtForm();
    this.fetchRoleTitles();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initGaForm(): void {
    this.signUpForm = this.fb.group({
      firstName:   ['', [Validators.required, Validators.maxLength(100)]],
      middleName:  ['', [Validators.maxLength(100)]],
      lastName:    ['', [Validators.required, Validators.maxLength(100)]],
      email:       ['', [Validators.required, Validators.email]],
      phone:       ['', [Validators.maxLength(20)]],
      roleTitleId: [null as number | null]
    });
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

  onBlurTrim(event: FocusEvent, trimBoth: boolean = false): void {
    const el = event.target as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return;
    const raw = el.value ?? '';
    let next = trimBoth ? raw.trim() : raw.replace(/\s+$/g, '');
    if (next.trim().length === 0) next = '';
    el.value = next;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  openAddGaModal(): void {
    this.isEditMode = false;
    this.editingId = null;
    this.signUpForm.reset({ firstName: '', middleName: '', lastName: '', email: '', phone: '', roleTitleId: null });
    this.fetchRoleTitles();
    this.isGaModalVisible = true;
  }

  openEditGaModal(row: UserRow): void {
    const parts = (row.userName || '').split(' ').filter(Boolean);
    const firstName = parts[0] || '';
    const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
    const middleName = parts.length > 2 ? parts.slice(1, -1).join(' ') : '';

    const roleTitleId = row.roleTitleId
      ?? this.rtRows.find(r => r.name === row.roleTitleName)?.id
      ?? null;

    this.isEditMode = true;
    this.editingId = row.userId ?? null;
    this.signUpForm.reset({ firstName, middleName, lastName, email: row.email || '', phone: row.phone || '', roleTitleId });
    this.isGaModalVisible = true;
  }

  closeGaModal(): void {
    this.isGaModalVisible = false;
  }

  onBlurEmailCheck(): void {
    const email = this.signUpForm.get('email')?.value || '';
    if (email && this.signUpForm.get('email')?.valid) {
      this.emailDuplicateCheck = true;
      this.gs
        .checkDuplicateEmail(email)
        .pipe(
          finalize(() => {
            this.emailDuplicateCheck = false;
            this.cdr.markForCheck();
          }),
          takeUntil(this.destroy$)
        )
        .subscribe((response: any) => {
          if (response?.activeUserExists) {
            this.notification.error('Error', 'Email already exists. Please use a different email.');
            this.signUpForm.get('email')?.setErrors({ duplicate: true });
          }
        });
    }
  }

  onPhoneInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const digits = (input.value || '').replace(/\D/g, '').slice(0, 10);
    const parts: string[] = [];
    if (digits.length > 0) parts.push('(' + digits.slice(0, Math.min(3, digits.length)) + ')');
    if (digits.length > 3) parts.push(' ' + digits.slice(3, Math.min(6, digits.length)));
    if (digits.length > 6) parts.push('-' + digits.slice(6));
    input.value = parts.join('');
    this.signUpForm.get('phone')?.setValue(input.value, { emitEvent: false });
  }

  submitGa(): void {
    if (this.signUpForm.invalid) {
      this.signUpForm.markAllAsTouched();
      return;
    }
    this.saving = true;

    const raw = this.signUpForm.value;
    const payload = {
      ...(this.isEditMode && this.editingId ? { userId: this.editingId } : {}),
      firstName:   (raw.firstName || '').trim(),
      middleName:  (raw.middleName || '').trim(),
      lastName:    (raw.lastName || '').trim(),
      email:       (raw.email || '').trim(),
      phone:       String(raw.phone || '').replace(/\D/g, ''),
      ...(raw.roleTitleId ? { roleTitleId: raw.roleTitleId } : {}),
      roleId: 2
    };

    this.gs
      .commonPost('Users/saveUser', payload)
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
            this.notification.success('Success', this.isEditMode ? 'Global Admin updated.' : 'Global Admin created.');
            this.isGaModalVisible = false;
            this.fetchGlobalAdmins();
          } else {
            this.notification.error('Error', res?.message || 'Operation failed.');
          }
        },
        error: (err) => {
          console.error('saveUser error', err);
          this.notification.error('Error', err?.message || 'Failed to save user.');
        }
      });
  }

  applyFilters(): void {
    this.gaPageIndex = 1;
    this.fetchGlobalAdmins();
  }

  clearFilters(): void {
    this.searchName = '';
    this.selectedStatus = null;
    this.gaPageIndex = 1;
    this.fetchGlobalAdmins();
  }

  onGaQueryParams(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;
    if (pageIndex !== this.gaPageIndex || pageSize !== this.gaPageSize) {
      this.gaPageIndex = pageIndex;
      this.gaPageSize = pageSize;
      this.fetchGlobalAdmins();
    }
  }

  private fetchGlobalAdmins(): void {
    let endpoint = `Users/getAllUsers?RoleId=2&PageNumber=${this.gaPageIndex}&PageSize=${this.gaPageSize}`;
    const qs: string[] = [];
    if (this.searchName.trim()) qs.push(`Title=${encodeURIComponent(this.searchName.trim())}`);
    if (this.selectedStatus) qs.push(`Status=${encodeURIComponent(this.selectedStatus)}`);
    if (qs.length) endpoint += `&${qs.join('&')}`;

    this.gaLoading = true;
    this.gs
      .commonGet(endpoint)
      .pipe(
        finalize(() => {
          this.gaLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: ApiResponse<any[]>) => {
          const rows = Array.isArray(res?.data) ? res.data : [];
          this.gaRows = rows.map((r: any) => ({
            userId:      r?.userId,
            userName:    r?.userName ?? '--',
            email:       r?.email ?? null,
            phone:       r?.phone ?? null,
            status:      r?.status ?? (r?.isActive ? 'Active' : 'InActive'),
            roleTitleName: r?.roleTitleName ?? null,
            roleTitleId: r?.roleTitleId ?? null
          }));
          this.gaTotal =
            (typeof res?.totalEntityCount === 'number' && res.totalEntityCount) ||
            (typeof res?.count === 'number' && res.count) ||
            this.gaRows.length;
        },
        error: (err) => {
          console.error('Failed to fetch Global Admins', err);
          this.notification.error('Error', 'Failed to load users.');
        }
      });
  }

  toggleStatus(row: UserRow): void {
    const isActive = String(row.status || '').toLowerCase() === 'active';
    const nextActive = !isActive;
    this.rowToggleLoadingId = row.userId;

    this.gs
      .commonPost('Users/activateUser', { userId: row.userId, isActive: nextActive })
      .pipe(
        finalize(() => {
          this.rowToggleLoadingId = null;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: ApiResponse) => {
          if (res?.status === 1 || res?.success) {
            row.status = nextActive ? 'Active' : 'InActive';
            this.notification.success('Success', 'Status updated.');
          } else {
            this.notification.error('Error', res?.message || 'Failed to update status.');
          }
        },
        error: (err) => {
          console.error('activateUser error', err);
          this.notification.error('Error', err?.message || 'Failed to update status.');
        }
      });
  }

  confirmDelete(row: UserRow): void {
    this.modal.confirm({
      nzTitle: 'Delete user?',
      nzContent: `Are you sure you want to delete "${row.userName}"?`,
      nzOkDanger: true,
      nzOkText: 'Delete',
      nzOnOk: () => this.deleteUser(row)
    });
  }

  private deleteUser(row: UserRow): void {
    this.rowDeleteLoadingId = row.userId;
    this.gs
      .commonPost('Users/deleteUser', { id: row.userId })
      .pipe(
        finalize(() => {
          this.rowDeleteLoadingId = null;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: ApiResponse) => {
          if (res?.status === 1 || res?.success) {
            this.notification.success('Success', 'User deleted.');
            this.fetchGlobalAdmins();
          } else {
            this.notification.error('Error', res?.message || 'Failed to delete user.');
          }
        },
        error: (err) => {
          console.error('deleteUser error', err);
          this.notification.error('Error', err?.message || 'Failed to delete user.');
        }
      });
  }

  viewUser(row: UserRow): void {
    console.log('View GA user:', row);
  }

  providerApplyFilters(): void {
    this.prPageIndex = 1;
    this.fetchProviders();
  }

  providerClearFilters(): void {
    this.prSearchName = '';
    this.prSelectedStatus = null;
    this.prPageIndex = 1;
    this.fetchProviders();
  }

  onProviderQueryParams(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;
    if (pageIndex !== this.prPageIndex || pageSize !== this.prPageSize) {
      this.prPageIndex = pageIndex;
      this.prPageSize = pageSize;
      this.fetchProviders();
    }
  }

  private fetchProviders(): void {
    let endpoint = `Users/getAllUsers?RoleId=4&PageNumber=${this.prPageIndex}&PageSize=${this.prPageSize}`;
    const qs: string[] = [];
    if (this.prSearchName.trim()) qs.push(`Title=${encodeURIComponent(this.prSearchName.trim())}`);
    if (this.prSelectedStatus) qs.push(`Status=${encodeURIComponent(this.prSelectedStatus)}`);
    if (qs.length) endpoint += `&${qs.join('&')}`;

    this.prLoading = true;
    this.gs
      .commonGet(endpoint)
      .pipe(
        finalize(() => {
          this.prLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: ApiResponse<any[]>) => {
          const rows = Array.isArray(res?.data) ? res.data : [];
          this.prRows = rows.map((r: any) => ({
            userId: r?.userId,
            userName: r?.userName ?? '--',
            email: r?.email ?? null,
            phone: r?.phone ?? null,
            status: r?.status ?? (r?.isActive ? 'Active' : 'InActive')
          }));
          this.prTotal =
            (typeof res?.totalEntityCount === 'number' && res.totalEntityCount) ||
            (typeof res?.count === 'number' && res.count) ||
            this.prRows.length;
        },
        error: (err) => {
          console.error('Failed to fetch Providers', err);
          this.notification.error('Error', 'Failed to load providers.');
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

  onProviderEmailCheck(): void {
    const email = this.providerForm.get('email')?.value || '';
    if (this.providerEditMode){
    if (email != this.selectedProviderForEditing.email ){
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
    }
    else {
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

  openAddProviderModal(): void {
    this.providerEditMode = false;
    this.providerEditingId = null;

    this.providerForm.reset({
      npi: '',
      firstName: '',
      middleName: '',
      lastName: '',
      title: '',
      gender: '',
      dob: null,
      email: '',
      phone: '',
      providerType: '',
      address: '',
      cityId: null,
      stateId: null,
      zipCode: '',
      taxId: '',
      medicaid: '',
      caqhId: '',
      license: '',
      ssn: '',
      dea: '',
      categoryId: [],
      licenseStateIds: [],
      bio: ''
    });

    this.loadCategories();
    this.loadAllStates();
    this.citiesByState = [];
    this.isProviderModalVisible = true;
  }

  openEditProviderModal(row: UserRow): void {
    if (!row?.userId) return;
    this.prRowEditLoadingId = row.userId;

    this.loadCategories();
    this.loadAllStates();

    this.gs
      .commonGet(`Users/getUserById?Id=${row.userId}`)
      .pipe(
        finalize(() => {
          this.prRowEditLoadingId = null;
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

          this.providerEditMode = true;
          this.providerEditingId = d.userId ?? null;

          const dobVal = d.dob ? new Date(d.dob) : null;

          const categories = Array.isArray(d.providerCategories)
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
              categoryId: categories,
              licenseStateIds: licenseStateIds,
              bio: d.bio || ''
            },
            { emitEvent: false }
          );

          this.citiesByState = [];
          if (typeof d.stateId === 'number') {
            this.loadCitiesByState(d.stateId, typeof d.cityId === 'number' ? d.cityId : undefined);
          }

          this.isProviderModalVisible = true;
        },
        error: (err) => {
          console.error('getUserById error', err);
          this.notification.error('Error', 'Failed to load provider details.');
        }
      });
  }

  closeProviderModal(): void {
    this.isProviderModalVisible = false;
  }

  submitProvider(): void {
    if (this.providerForm.invalid) {
      this.providerForm.markAllAsTouched();
      return;
    }
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

    const licenseNumber: string = (v.license || '').trim();

    const body: SaveUserPayload = {
      ...(this.providerEditMode && this.providerEditingId ? { userId: this.providerEditingId } : {}),
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
      license: (v.license || '').trim(),
      ...(v.ssn ? { ssn: (v.ssn || '').trim() } : {}),
      ...(v.dea ? { dea: (v.dea || '').trim() } : {}),
      ...(v.bio ? { bio: (v.bio || '').trim() } : {}),
      ...(Array.isArray(v.categoryId) ? { categoryId: v.categoryId } : { categoryId: [] }),
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
          this.selectedProviderForEditing = null;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: ApiResponse) => {
          if (res?.status === 1 || res?.success) {
            this.notification.success('Success', this.providerEditMode ? 'Provider updated.' : 'Provider created.');
            this.isProviderModalVisible = false;
            this.fetchProviders();
          } else {
            this.notification.error('Error', res?.message || 'Operation failed.');
          }
        },
        error: (err) => {
          console.error('saveUser (provider) error', err);
          this.notification.error('Error', err?.message || 'Failed to save provider.');
        }
      });
  }

  toggleProviderStatus(row: UserRow): void {
    const isActive = String(row.status || '').toLowerCase() === 'active';
    const nextActive = !isActive;
    this.prRowToggleLoadingId = row.userId;

    this.gs
      .commonPost('Users/activateUser', { userId: row.userId, isActive: nextActive })
      .pipe(
        finalize(() => {
          this.prRowToggleLoadingId = null;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: ApiResponse) => {
          if (res?.status === 1 || res?.success) {
            row.status = nextActive ? 'Active' : 'InActive';
            this.notification.success('Success', 'Status updated.');
          } else {
            this.notification.error('Error', res?.message || 'Failed to update status.');
          }
        },
        error: (err) => {
          console.error('activateUser (provider) error', err);
          this.notification.error('Error', err?.message || 'Failed to update status.');
        }
      });
  }

  confirmDeleteProvider(row: UserRow): void {
    this.modal.confirm({
      nzTitle: 'Delete provider?',
      nzContent: `Are you sure you want to delete "${row.userName}"?`,
      nzOkDanger: true,
      nzOkText: 'Delete',
      nzOnOk: () => this.deleteProvider(row)
    });
  }

  private deleteProvider(row: UserRow): void {
    this.prRowDeleteLoadingId = row.userId;
    this.gs
      .commonPost('Users/deleteUser', { id: row.userId })
      .pipe(
        finalize(() => {
          this.prRowDeleteLoadingId = null;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: ApiResponse) => {
          if (res?.status === 1 || res?.success) {
            this.notification.success('Success', 'Provider deleted.');
            this.fetchProviders();
          } else {
            this.notification.error('Error', res?.message || 'Failed to delete provider.');
          }
        },
        error: (err) => {
          console.error('deleteUser (provider) error', err);
          this.notification.error('Error', err?.message || 'Failed to delete provider.');
        }
      });
  }

  onZipInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const digitsOnly = (input.value || '').replace(/\D/g, '').slice(0, 5);
    input.value = digitsOnly;
    this.providerForm.get('zipCode')?.setValue(digitsOnly, { emitEvent: false });
  }

  viewProvider(row: UserRow): void {
    console.log('View provider:', row);
  }

  hasProviderError(ctrl: string, key: string): boolean {
    const c = this.providerForm.get(ctrl);
    return !!(c && c.touched && c.hasError(key));
  }

  selectAllLicensedStates(): void {
    const allIds = (this.allStates || [])
      .map(s => s?.id)
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

  private initTechForm(): void {
    this.techForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.maxLength(100)]],
      middleName: ['', [Validators.maxLength(100)]],
      lastName: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.maxLength(20)]]
    });
  }

  openAddTechModal(): void {
    this.techEditMode = false;
    this.techEditingId = null;
    this.selectedTechForEditing = null;

    this.techForm.reset({
      firstName: '',
      middleName: '',
      lastName: '',
      email: '',
      phone: ''
    });

    this.isTechModalVisible = true;
  }

  openEditTechModal(row: UserRow): void {
    const parts = (row.userName || '').split(' ').filter(Boolean);
    const firstName = parts[0] || '';
    const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
    const middleName = parts.length > 2 ? parts.slice(1, -1).join(' ') : '';

    this.techEditMode = true;
    this.techEditingId = row.userId ?? null;
    this.selectedTechForEditing = row;

    this.techForm.reset({
      firstName,
      middleName,
      lastName,
      email: row.email || '',
      phone: row.phone || ''
    });

    this.isTechModalVisible = true;
  }

  closeTechModal(): void {
    this.isTechModalVisible = false;
  }

  onTechEmailCheck(): void {
    const emailCtrl = this.techForm.get('email');
    const email = (emailCtrl?.value || '').trim();

    if (this.techEditMode && this.selectedTechForEditing?.email) {
      if (String(email).toLowerCase() === String(this.selectedTechForEditing.email).toLowerCase()) return;
    }

    if (email && emailCtrl?.valid) {
      this.techEmailDuplicateCheck = true;

      this.gs
        .checkDuplicateEmail(email)
        .pipe(
          finalize(() => {
            this.techEmailDuplicateCheck = false;
            this.cdr.markForCheck();
          }),
          takeUntil(this.destroy$)
        )
        .subscribe((response: any) => {
          if (response?.activeUserExists) {
            this.notification.error('Error', 'Email already exists. Please use a different email.');
            emailCtrl?.setErrors({ duplicate: true });
          }
        });
    }
  }

  onTechPhoneInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const digits = (input.value || '').replace(/\D/g, '').slice(0, 10);

    const parts: string[] = [];
    if (digits.length > 0) parts.push('(' + digits.slice(0, Math.min(3, digits.length)) + ')');
    if (digits.length > 3) parts.push(' ' + digits.slice(3, Math.min(6, digits.length)));
    if (digits.length > 6) parts.push('-' + digits.slice(6));

    input.value = parts.join('');
    this.techForm.get('phone')?.setValue(input.value, { emitEvent: false });
  }

  submitTech(): void {
    if (this.techForm.invalid) {
      this.techForm.markAllAsTouched();
      return;
    }

    this.techSaving = true;

    const raw = this.techForm.value;
    const payload = {
      ...(this.techEditMode && this.techEditingId ? { userId: this.techEditingId } : {}),
      firstName: (raw.firstName || '').trim(),
      middleName: (raw.middleName || '').trim(),
      lastName: (raw.lastName || '').trim(),
      email: (raw.email || '').trim(),
      phone: String(raw.phone || '').replace(/\D/g, ''),
      roleId: 7
    };

    this.gs
      .commonPost('Users/saveUser', payload)
      .pipe(
        finalize(() => {
          this.techSaving = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: ApiResponse) => {
          if (res?.status === 1 || res?.success) {
            this.notification.success('Success', this.techEditMode ? 'Tech Support updated.' : 'Tech Support created.');
            this.isTechModalVisible = false;
            this.fetchTechSupport();
          } else {
            this.notification.error('Error', res?.message || 'Operation failed.');
          }
        },
        error: (err) => {
          console.error('saveUser error (tech support)', err);
          this.notification.error('Error', err?.message || 'Failed to save user.');
        }
      });
  }

  techApplyFilters(): void {
    this.techPageIndex = 1;
    this.fetchTechSupport();
  }

  techClearFilters(): void {
    this.techSearchName = '';
    this.techSelectedStatus = null;
    this.techPageIndex = 1;
    this.fetchTechSupport();
  }

  onTechQueryParams(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;
    if (pageIndex !== this.techPageIndex || pageSize !== this.techPageSize) {
      this.techPageIndex = pageIndex;
      this.techPageSize = pageSize;
      this.fetchTechSupport();
    }
  }

  private fetchTechSupport(): void {
    let endpoint = `Users/getAllUsers?RoleId=7&PageNumber=${this.techPageIndex}&PageSize=${this.techPageSize}`;
    const qs: string[] = [];

    if (this.techSearchName.trim()) qs.push(`Title=${encodeURIComponent(this.techSearchName.trim())}`);
    if (this.techSelectedStatus) qs.push(`Status=${encodeURIComponent(this.techSelectedStatus)}`);

    if (qs.length) endpoint += `&${qs.join('&')}`;

    this.techLoading = true;

    this.gs
      .commonGet(endpoint)
      .pipe(
        finalize(() => {
          this.techLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: ApiResponse<any[]>) => {
          const rows = Array.isArray(res?.data) ? res.data : [];
          this.techRows = rows.map((r: any) => ({
            userId: r?.userId,
            userName: r?.userName ?? '--',
            email: r?.email ?? null,
            phone: r?.phone ?? null,
            status: r?.status ?? (r?.isActive ? 'Active' : 'InActive')
          }));

          this.techTotal =
            (typeof res?.totalEntityCount === 'number' && res.totalEntityCount) ||
            (typeof res?.count === 'number' && res.count) ||
            this.techRows.length;
        },
        error: (err) => {
          console.error('Failed to fetch Tech Support', err);
          this.notification.error('Error', 'Failed to load users.');
        }
      });
  }

  toggleTechStatus(row: UserRow): void {
    const isActive = String(row.status || '').toLowerCase() === 'active';
    const nextActive = !isActive;

    this.techRowToggleLoadingId = row.userId;

    this.gs
      .commonPost('Users/activateUser', { userId: row.userId, isActive: nextActive })
      .pipe(
        finalize(() => {
          this.techRowToggleLoadingId = null;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: ApiResponse) => {
          if (res?.status === 1 || res?.success) {
            row.status = nextActive ? 'Active' : 'InActive';
            this.notification.success('Success', 'Status updated.');
          } else {
            this.notification.error('Error', res?.message || 'Failed to update status.');
          }
        },
        error: (err) => {
          console.error('activateUser error (tech support)', err);
          this.notification.error('Error', err?.message || 'Failed to update status.');
        }
      });
  }

  private initRtForm(): void {
    this.rtForm = this.fb.group({
      roleTitleName: ['', [Validators.required, Validators.maxLength(150)]]
    });
  }

  get filteredRtRows() {
    const q = this.rtSearchName.trim().toLowerCase();
    if (!q) return this.rtRows;
    return this.rtRows.filter(r => (r.name || '').toLowerCase().includes(q));
  }

  private fetchRoleTitles(): void {
    this.rtLoading = true;
    this.gs.getAllRoleTitles()
      .pipe(
        finalize(() => {
          this.rtLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: any) => {
          const list = Array.isArray(res?.data) ? res.data : [];
          this.rtRows = list.map((r: any) => ({
            id: r.id,
            name: r.name ?? '--',
            shortName: r.shortName ?? null
          }));
        },
        error: (err) => {
          console.error('Failed to fetch Role Titles', err);
          this.notification.error('Error', 'Failed to load role titles.');
        }
      });
  }

  openAddRtModal(): void {
    this.rtEditMode = false;
    this.rtEditingId = null;
    this.rtForm.reset({ roleTitleName: '' });
    this.isRtModalVisible = true;
  }

  openEditRtModal(row: { id: number; name: string; shortName: string | null }): void {
    this.rtEditMode = true;
    this.rtEditingId = row.id;
    this.rtForm.reset({ roleTitleName: row.name || '' });
    this.isRtModalVisible = true;
  }

  closeRtModal(): void {
    this.isRtModalVisible = false;
  }

  submitRt(): void {
    if (this.rtForm.invalid) {
      this.rtForm.markAllAsTouched();
      return;
    }

    this.rtSaving = true;
    const raw = this.rtForm.value;

    const payload: { roleTitleId?: number; roleTitleName: string; isActive: boolean } = {
      ...(this.rtEditMode && this.rtEditingId ? { roleTitleId: this.rtEditingId } : {}),
      roleTitleName: (raw.roleTitleName || '').trim(),
      isActive: true
    };

    this.gs.saveRoleTitle(payload)
      .pipe(
        finalize(() => {
          this.rtSaving = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: any) => {
          if (res?.status === 1 || res?.success) {
            this.notification.success('Success', this.rtEditMode ? 'Role Title updated.' : 'Role Title created.');
            this.isRtModalVisible = false;
            this.fetchRoleTitles();
            this.fetchGlobalAdmins();
          } else {
            this.notification.error('Error', res?.message || 'Operation failed.');
          }
        },
        error: (err) => {
          console.error('saveRoleTitle error', err);
          this.notification.error('Error', err?.message || 'Failed to save role title.');
        }
      });
  }

}
