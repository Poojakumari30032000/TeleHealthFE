import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import {
  Subject,
  of,
  debounceTime,
  distinctUntilChanged,
  filter as rxFilter,
  switchMap,
  takeUntil,
  finalize,
  catchError
} from 'rxjs';

import { GeneralService } from 'app/shared/services/general.service';
import { TitleService } from 'app/shared/services/title.service';
import { AuthService } from 'app/shared/Auth/auth.service';
import { HttpService } from 'app/shared/services/http.service';

interface UserRow {
  userId: number;
  userName?: string;
  phone?: string;
  email?: string;
  status?: string;
  roleId: number;
  userRole: string;
}

interface SubscriptionPlan {
  subscriptionId: number;
  planName: string;
  maxUsers: number;
  maxProviders: number;
  maxPatients: number;
  totalUsers: number;
  totalProviders: number;
  totalPatients: number;
  storage: number;
  status: string;
}

interface Provider {
  id: number;
  name: string;
}

interface CityState {
  id: number;
  name: string;
  shortName: string;
}

@Component({
  selector: 'app-user-list-view',
  templateUrl: './user-list-view.component.html',
  styleUrl: './user-list-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserListViewComponent implements OnInit, OnDestroy {

  users: UserRow[] = [];
  total = 0;
  tableLoading = false;
  pageIndex = 1;
  pageSize = 10;
  private tableQueryInitialized = false;

  searchQuery = '';
  selectedUserType: number | null = null;
  selectedStatus: string | null = null;
  showFilters = true;
  appliedFilters: Array<{ name: string; value: any }> = [];

  selectedFacility: any = this.auth.getUserFacilityId();

  private searchTerms$ = new Subject<string>();

  userRole = this.auth.getUserRole() || '';
  currentUserRole: string = this.auth.getUserRole() || '';
  subscriptionData: SubscriptionPlan | null = null;

  assignProviderModel = false;
  providersLoading = false;
  providers: Provider[] = [];
  selectedProviders: number[] = [];

  userModalVisible = false;
  userModalTitle = 'User Form';

  userId = 0;
  roleId = 0;
  facilityId = 0;

  userAddEditForm!: FormGroup;
  isFormSubmitting = false;

  cities: CityState[] = [];
  states: CityState[] = [];
  state: CityState | null = null;

  emailExist = false;
  loadingStates = false;
  isUpdateForm = false;
  originalEmail = '';

  disableFutureDates = (current: Date): boolean => current > new Date();

  private destroy$ = new Subject<void>();
  private modalClose$ = new Subject<void>();

  userType: any[] = [
    { value: 3, label: 'Clinic Admin' },
    { value: 4, label: 'Provider' },

  ];

  actions: Array<{
    icon?: string;
    label: string;
    type?: 'danger' | string;
    callback: (row: UserRow) => void;
    showIf?: (row: UserRow) => boolean;
  }> = [];

  constructor(
    private route: Router,
    private generalService: GeneralService,
    private titleService: TitleService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
    private http: HttpService
  ) {
    this.searchTerms$
      .pipe(debounceTime(700), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.searchQuery = term;
        this.applyFilter(true);
      });

    this.selectedUserType = this.currentUserRole === 'Global Admin' ? 4 : null;
    this.applyFilter(false, false);
  }

  ngOnInit(): void {
    this.generalService
      .getData()
      .pipe(takeUntil(this.destroy$))
      .subscribe((response) => {
        if (response && response.type === 'subscriptionPlanCheck') {
          if (response.value === this.subscriptionData) return;
          this.subscriptionData = response.value || this.subscriptionData;
          this.cdr.markForCheck();
        }
      });

    this.titleService.updateTitle(this.currentUserRole === 'Global Admin' ? 'Providers' : 'Staff');

    this.actions = [
      {
        label: 'Edit',
        icon: 'fa-regular fa-pen-to-square',
        callback: (d) => this.AddEditUser(d),
        showIf: (d) => d.userRole !== 'Provider' || this.currentUserRole === 'Global Admin'
      },

      {
        label: 'Update Status',
        icon: 'fa-solid fa-sync-alt',
        callback: (d) => this.updateStatus(d),
        showIf: (d) => d.userRole !== 'Provider' || this.currentUserRole === 'Global Admin'
      },

    ];

    this.fetchUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    this.modalClose$.next();
    this.modalClose$.complete();
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;

    const pageSizeChanged = pageSize !== this.pageSize;

    this.pageSize = pageSize;
    this.pageIndex = pageSizeChanged ? 1 : pageIndex;

    if (!this.tableQueryInitialized) {
      this.tableQueryInitialized = true;
      return;
    }

    this.fetchUsers();
  }

  trackByUserId(_i: number, row: UserRow): number {
    return row.userId;
  }

  getRowActions(row: UserRow) {
    return this.actions.filter((a) => !a.showIf || a.showIf(row));
  }

  getStatusBadgeClass(status?: string): string {
    if (status === 'Active') return 'ui-status-badge--success';
    if (status === 'InActive') return 'ui-status-badge--danger';
    return 'ui-status-badge--neutral';
  }

  getStatusBadgeLabel(status?: string): string {
    if (status === 'Active') return 'Active';
    if (status === 'InActive') return 'In-Active';
    return status || '-';
  }

  private extractTotal(res: any): number {

    const total =
      res?.totalEntityCount ??
      res?.totalCount ??
      res?.total ??
      res?.totalRecords ??
      res?.totalItems ??
      null;

    const parsed = Number(total);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  private fetchUsers(): void {
    this.tableLoading = true;
    this.cdr.markForCheck();

    const params = new URLSearchParams();
    params.set('FacilityId', String(this.selectedFacility));
    params.set('PageNumber', String(this.pageIndex));
    params.set('PageSize', String(this.pageSize));

    if (this.selectedUserType !== null && this.selectedUserType !== undefined && this.selectedUserType !== 0) {
      params.set('RoleId', String(this.selectedUserType));
    }

    const title = (this.searchQuery || '').trim();
    if (title) params.set('Title', title);

    if (this.selectedStatus) params.set('Status', this.selectedStatus);

    const url = `Users/getAllUsers?${params.toString()}`;

    this.generalService
      .commonGet(url)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.tableLoading = false;
          this.cdr.markForCheck();
        }),
        catchError((err) => {
          console.error('Failed to fetch users:', err);
          this.users = [];
          this.total = 0;
          return of(null);
        })
      )
      .subscribe((res: any) => {
        if (!res) return;

        if (res.status === 1) {
          this.users = res.data || [];
          this.total = this.extractTotal(res);
        } else {
          this.users = [];
          this.total = 0;
          this.generalService.showError(res.message || 'Failed to load users');
        }
      });
  }

  searchTermChanged(): void {
    this.searchTerms$.next(this.searchQuery);
  }

  applyFilter(resetPage: boolean, fetch: boolean = true): void {
    if (resetPage) this.pageIndex = 1;

    this.appliedFilters = [
      { name: 'FacilityId', value: this.selectedFacility },
      { name: 'RoleId', value: this.selectedUserType },
      { name: 'Title', value: this.searchQuery },
      { name: 'Status', value: this.selectedStatus }
    ].filter((f) => f.value !== null && f.value !== undefined && f.value !== '' && f.value !== 0);

    if (fetch) this.fetchUsers();
  }

  get visibleFiltersCount(): number {
    return this.appliedFilters.filter((f) => !this.shouldHideAppliedFilter(f.name)).length;
  }

  shouldHideAppliedFilter(filterName: string): boolean {
    return filterName === 'FacilityId' || (this.currentUserRole === 'Global Admin' && filterName === 'RoleId');
  }

  getFilterDisplayName(filterName: string): string {
    switch (filterName) {
      case 'RoleId':
        return 'User Type';
      case 'FacilityId':
        return 'Clinic';
      default:
        return filterName;
    }
  }

  getFilterDisplayValue(filter: any): string {
    if (filter.name === 'RoleId') {
      const option = this.userType.find((opt) => opt.value?.toString() === filter.value?.toString());
      return option ? option.label : filter.value;
    }
    return filter.value;
  }

  trackByFilterName(_index: number, filter: any): string {
    return filter.name;
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedStatus = null;
    if (this.currentUserRole !== 'Global Admin') this.selectedUserType = null;
    this.showFilters = false;
    this.applyFilter(true);
  }

  removeFilter(filterName: string): void {
    switch (filterName) {
      case 'Title':
        this.searchQuery = '';
        break;
      case 'Status':
        this.selectedStatus = null;
        break;
      case 'RoleId':
        this.selectedUserType = 0;
        break;
    }
    this.applyFilter(true);
  }

  AddEditUser = (data: any) => {
    const type = data.userRole || 'User';
    const title = data.userId ? `Edit ${type}` : `Add ${type}`;
    const ID = data.userId || 0;
    const roleId = data.roleId;
    const facilityId = data.roleId === 4 ? 0 : this.selectedFacility;
    this.openUserModal(ID, title, roleId, facilityId);
  };

  onView = (data: UserRow) => this.route.navigate(['user/detail', data.userId]);

  updateStatus = (data: UserRow): void => {
    const apiUrl = 'Users/activateUser';
    const title = 'Confirmation';
    const status = data.status === 'Active' ? 'InActive' : 'Active';
    const isActive = data.status === 'Active' ? false : true;
    const content = `Are you sure you want to update the ${data.userName} status to ${status}?`;
    const body = { userId: data.userId, isActive };

    this.generalService
      .commonConfirm(title, content)
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        if (!result) return;

        this.generalService
          .commonPost(apiUrl, body)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (res) => {
              if (res.status === 1) {
                this.generalService.showSuccess(`Status updated to ${status} successfully!`);
                this.fetchUsers();
              } else {
                this.generalService.showError(res.message || 'Failed to update status');
              }
            },
            error: (err) => {
              console.error('Error updating status:', err);
              this.generalService.showError(`Failed to update ${data.userName} status.`);
            }
          });
      });
  };

  onDelete = (data: UserRow): void => {
    const apiUrl = 'Users/deleteUser';
    const title = `User: ${data.userName} `;
    const body = { id: data.userId };

    this.generalService
      .commonDelete(apiUrl, title, body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.fetchUsers(),
        error: (err) => console.error('Delete failed:', err)
      });
  };

  unAssignedProvidersList(): void {
    this.providersLoading = true;
    this.providers = [];

    this.generalService
      .commonGet(`DropDowns/getAllProviders?isAssign=false&FacilityId=${this.selectedFacility}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.providers = response?.status === 1 && response?.data ? response.data || [] : [];
          this.providersLoading = false;
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to fetch providers:', err);
          this.providers = [];
          this.providersLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  trackById(_index: number, data: { id: number; name: string }): number {
    return data.id;
  }

  assignProviders(): void {
    if (!this.selectedProviders.length) {
      this.generalService.showError('Please select at least one provider.');
      return;
    }

    const payload = this.selectedProviders.map((providerId) => ({
      userId: providerId,
      facilityId: this.selectedFacility,
      isAssign: true
    }));

    this.generalService
      .commonPost('users/assignUserToFacility', payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.status === 1) {
            this.generalService.showSuccess('Providers assigned successfully!');
            this.assignProviderModel = false;
            this.selectedProviders = [];
            this.fetchUsers();
          } else {
            this.generalService.showError(response?.message || 'Failed to assign providers.');
          }
        },
        error: (err: HttpErrorResponse) => {
          console.error('Error assigning providers:', err);
          this.generalService.showError('Failed to assign providers.');
        }
      });
  }

  unassignProvider(data: UserRow): void {
    const title = 'Confirmation';
    const content = `Are you sure you want to unassign the provider: ${data.userName} from this clinic?`;

    this.generalService
      .commonConfirm(title, content)
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        if (!result) return;

        const payload = [{ userId: data.userId, facilityId: this.selectedFacility, isAssign: false }];

        this.generalService
          .commonPost('users/assignUserToFacility', payload)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (response) => {
              if (response?.status === 1) {
                this.generalService.showSuccess('Provider unassigned successfully!');
                this.fetchUsers();
              } else {
                this.generalService.showError(response?.message || 'Failed to unassign provider.');
              }
            },
            error: (err: HttpErrorResponse) => {
              console.error('Error unassigning provider:', err);
              this.generalService.showError('Failed to unassign provider.');
            }
          });
      });
  }

  isUserLimitReached(): boolean {
    if (!this.subscriptionData) return false;
    return this.subscriptionData.totalUsers >= this.subscriptionData.maxUsers;
  }

  isProviderLimitReached(): boolean {
    if (!this.subscriptionData) return false;
    return this.subscriptionData.totalProviders >= this.subscriptionData.maxProviders;
  }

  getLimitTooltip(type: 'staff' | 'provider'): string {
    if (type === 'staff' && this.isUserLimitReached() && this.subscriptionData) {
      return `User limit reached (${this.subscriptionData.totalUsers}/${this.subscriptionData.maxUsers}). Upgrade your plan to add more.`;
    }
    if (type === 'provider' && this.isProviderLimitReached() && this.subscriptionData) {
      return `Provider limit reached (${this.subscriptionData.totalProviders}/${this.subscriptionData.maxProviders}). Upgrade your plan to add more.`;
    }
    return '';
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
      zipCode: ['', isProvider ? Validators.required : []]
    });

    this.userAddEditForm.get('roleId')?.disable({ emitEvent: false });

    if (isProvider) {
      this.setupNpiLookup();
      this.userAddEditForm.get('addressType')?.disable({ emitEvent: false });
      this.userAddEditForm.get('facilityId')?.disable({ emitEvent: false });
    } else {
      this.userAddEditForm.get('npi')?.disable({ emitEvent: false });
      this.userAddEditForm.get('title')?.disable({ emitEvent: false });
      this.userAddEditForm.get('gender')?.disable({ emitEvent: false });
      this.userAddEditForm.get('dob')?.disable({ emitEvent: false });
      this.userAddEditForm.get('providerType')?.disable({ emitEvent: false });
    }
  }

  private openUserModal(id: number, title: string, roleId: number, facilityId?: number): void {
    this.modalClose$.next();

    this.userId = id;
    this.userModalTitle = title;
    this.roleId = roleId;
    this.facilityId = facilityId || 0;

    this.emailExist = false;
    this.isFormSubmitting = false;
    this.isUpdateForm = false;
    this.originalEmail = '';
    this.state = null;

    this.initForm();
    this.loadStates();
    this.loadCities();

    this.userAddEditForm
      .get('addressType')
      ?.valueChanges.pipe(takeUntil(this.modalClose$), takeUntil(this.destroy$))
      .subscribe((val) => this.onAddressTypeChange(val));

    this.userAddEditForm
      .get('cityId')
      ?.valueChanges.pipe(takeUntil(this.modalClose$), takeUntil(this.destroy$))
      .subscribe((cityId) => this.onCityChange(Number(cityId) || 0));

    if (id) {
      this.loadUserData(id);
    } else {
      this.userAddEditForm.reset({}, { emitEvent: false });

      this.userAddEditForm.patchValue(
        {
          roleId: this.roleId,
          facilityId: this.facilityId,
          ...(this.roleId !== 4 ? { addressType: 'Same as Clinic' } : {})
        },
        { emitEvent: false }
      );

      this.userAddEditForm.get('roleId')?.setValue(this.roleId, { emitEvent: false });

      this.onAddressTypeChange(this.userAddEditForm.get('addressType')?.value);
    }

    this.userModalVisible = true;
    this.cdr.detectChanges();
  }

  handleUserModalCancel(success = false): void {
    this.userModalVisible = false;
    this.modalClose$.next();

    if (!success) {
      this.userAddEditForm?.reset({}, { emitEvent: false });
      this.state = null;
    }

    this.cdr.markForCheck();
  }

  handleUserModalOk(): void {
    if (!this.validateForm()) return;

    this.isFormSubmitting = true;

    const payload = this.userAddEditForm.getRawValue();

    payload.roleId = this.roleId;
    payload.facilityId = this.facilityId;

    this.generalService
      .commonPost('Users/saveUser', { ...payload, userId: this.userId || 0 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.status === 1) this.generalService.showSuccess(response.message);
          else this.generalService.showError(response?.message || 'Failed');

          this.isFormSubmitting = false;
          this.handleUserModalCancel(true);
          this.fetchUsers();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('saveUser error:', err);
          this.generalService.showError(err.message);
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

  onAddressTypeChange(type: string | null | undefined): void {
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

    this.userAddEditForm.patchValue(
      {
        ...data,
        addressType: data?.addressType || 'Same as Clinic'
      },
      { emitEvent: false }
    );

    this.userAddEditForm.get('roleId')?.setValue(this.roleId, { emitEvent: false });
    this.userAddEditForm.get('facilityId')?.setValue(this.facilityId, { emitEvent: false });

    this.onAddressTypeChange(this.userAddEditForm.get('addressType')?.value);

    const cityId = Number(this.userAddEditForm.get('cityId')?.value) || 0;
    const addrType = this.userAddEditForm.get('addressType')?.value;
    const addressVisible = this.roleId === 4 || addrType === 'Other Address';
    if (cityId > 0 && addressVisible) this.loadStateByCityId(cityId);

    setTimeout(() => {
      this.isUpdateForm = false;
      this.cdr.markForCheck();
    }, 300);
  }

  private setupNpiLookup(): void {
    this.userAddEditForm
      .get('npi')
      ?.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      rxFilter((npi: any) => {
        const isValid = npi && npi.length === 10 && /^\d+$/.test(npi) && !this.isUpdateForm;
        if (npi && npi.length === 10 && !/^\d+$/.test(npi)) {
          this.generalService.showError('NPI must contain only numbers');
        }
        return isValid;
      }),
      switchMap((npi: string) => this.http.post('Commons/getNPIDetails', { npiNumber: npi })),
      takeUntil(this.modalClose$),
      takeUntil(this.destroy$)
    )
      .subscribe();
  }

  private loadStates(): void {
    this.loadingStates = true;
    this.generalService
      .commonGet('DropDowns/GetAllStateOfUSA')
      .pipe(
        takeUntil(this.destroy$),
        takeUntil(this.modalClose$),
        finalize(() => {
          this.loadingStates = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (response) => {
          if (response?.status === 1 && response?.data) this.states = response.data || [];
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
        if (state && !this.userAddEditForm.get('stateId')?.value) {
          this.userAddEditForm.get('stateId')?.setValue(state.id, { emitEvent: false });
        }
        this.cdr.markForCheck();
      });
  }

  onCityChange(cityId: number): void {
    if (!cityId || cityId <= 0) {
      this.state = null;
      if (!this.isUpdateForm) this.userAddEditForm.get('stateId')?.reset(null, { emitEvent: false });
      this.cdr.markForCheck();
      return;
    }

    const addrType = this.userAddEditForm.get('addressType')?.value;
    const addressVisible = this.roleId === 4 || addrType === 'Other Address';
    if (!addressVisible) return;

    this.loadStateByCityId(cityId);

    if (!this.isUpdateForm) {
      this.userAddEditForm.get('stateId')?.reset(null, { emitEvent: false });
    }
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
          this.emailExist = response?.status === 1 && response?.data === true;
          if (this.emailExist) this.generalService.showError('Email Already Exist');
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
