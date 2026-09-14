import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GeneralService } from '../../shared/services/general.service';
import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';
import { Subject, takeUntil, finalize } from 'rxjs';
import { UserAddEditModalComponent } from 'app/shared/user-add-edit-modal/user-add-edit-modal.component';
import { TitleService } from 'app/shared/services/title.service';
import { HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {NzNotificationService} from "ng-zorro-antd/notification";
import { getUnifiedStatusBadgeClass } from 'app/shared/utils/status-badge.util';
import {AuthService} from "../../shared/Auth/auth.service";

export interface User {
  userId: number;
  userName?: string;
  status?: string | null;
  roleId: number;
  roleName: string;
}

interface TableUser {
  userId: number;
  userName: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  address: string | null;
}

interface Provider { providerId: number; name: string; }

interface FacilityData {
  facilityId: number;
  guid: string;
  titleLong: string;
  titleShort: string;
  email: string;
  phone: string;
  fax: string;
  billingAddressType: string;
  address: string;
  cityId: number;
  stateId: number;
  zipCode: string;
  completeAddress: string;
  completeBillingAddress: string;
  fedearlTaxId: string;
  npi: string;
  subscriptionName: string;
  subscriptionStatus: string;
  paymentModeId: number;
  isBillable?: boolean;
  isBaaSigned?: boolean;
  baaPdfUrl?: string | null;
  baaSignedByName?: string | null;
  baaSignedByRole?: string | null;
  baaSignedDate?: string | null;
}

interface Subscription {
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

interface ApiResponse<T = any> {
  status: number;
  success?: boolean | null;
  message?: string;
  count?: number;
  data: T;
  totalEntityCount?: number;
  totalPages?: number;
}

interface CityState { id: number; name: string; shortName: string; }

interface IframeSnippets {
  iframeSrc: number;
  iframeTitle: string;
}

interface PackageSnippet {
  bundleId: number;
  name: string;
  categoryId: number;
  categoryName: string | null;
  description: string | null;
  status: string | null;
  clinicPrice: number | null;
}

@Component({
  selector: 'app-facility-info-view',
  templateUrl: './facility-info-view.component.html',
  styleUrls: ['./facility-info-view.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FacilityInfoViewComponent implements OnInit, OnChanges, OnDestroy {
  @Input() facilityIdInput: number | null = null;
  @Input() embeddedInTabs = false;

  @ViewChild('commanModel', { static: false }) commanModel!: CommanFormModalComponent;
  @ViewChild('userAddEditModal', { static: false }) userAddEditModal!: UserAddEditModalComponent;

  modalApiUrl: { save?: string; get?: string } = { save: '', get: '' };

  private destroy$ = new Subject<void>();
  readonly selectedOrgId: number = Number(localStorage.getItem('OFL'));

  facilityData: FacilityData | null = null;
  facilityId = 0;
  isLoading = false;

  globalPlan: { monthlyPrice: number; planName?: string } | null = null;
  showToggleBillingModal = false;
  togglingBilling = false;

  iframeSnippets : IframeSnippets[] = [{
    iframeSrc:1,
    iframeTitle: 'Get Started Snippet'
  }]

  packageSnippetsLoading = false;
  packageSnippets: PackageSnippet[] = [];
  packageSnippetsTotal = 0;
  packageSnippetPageIndex = 1;
  packageSnippetPageSize = 200;

  assignProviderModel = false;
  providersLoading = false;
  providers: Provider[] = [];
  selectedProviders: number[] = [];

  subscriptionData: Subscription | null = null;

  caLoading = false;
  caRows: TableUser[] = [];
  caTotal = 0;
  caPageIndex = 1;
  caPageSize = 10;

  prLoading = false;
  prRows: TableUser[] = [];
  prTotal = 0;
  prPageIndex = 1;
  prPageSize = 10;

  csLoading = false;
  csRows: TableUser[] = [];
  csTotal = 0;
  csPageIndex = 1;
  csPageSize = 10;

  addEditVisible = false;
  addEditTitle = '';
  addEditRoleId = 0;
  addEditUserId = 0;
  addEditForm!: FormGroup;
  isFormSubmitting = false;
  emailExist = false;
  originalEmail = '';

  cities: CityState[] = [];
  states: CityState[] = [];
  state: CityState | null = null;
  loadingStates = false;

  readonly updateStages = [
    { label: 'Saving Clinic Info', icon: 'fa-floppy-disk'  },
    { label: 'Updating Records',   icon: 'fa-rotate'       },
    { label: 'Finalizing',         icon: 'fa-circle-check' },
  ];

  savingLoaderVisible = false;
  savingStages: { label: string; icon: string }[] = [];
  savingStageIndex = 0;
  savingComplete = false;
  private stageTimers: any[] = [];

  showAddCategoriesModal = false;
  categoriesDropdownData:any[] = []
  isCategoriesLoading: boolean = false;
  selectedCategories: any[] = []
  assignedCategories: any[] = []

  userRole: string | null = null;
  isClinicAdmin = false;

  constructor(
    private route: Router,
    private generalService: GeneralService,
    public cdr: ChangeDetectorRef,
    private router: ActivatedRoute,
    private titleService: TitleService,
    private fb: FormBuilder,
    private notification: NzNotificationService,
    private authService: AuthService,
    private sanitizer: DomSanitizer,) {}

  ngOnInit(): void {

    this.userRole = this.authService.getUserRole()
    if(this.userRole === 'Clinic Admin'){
      this.isClinicAdmin = true;
    }
    this.resolveFacilityIdAndLoad();
    this.loadCities();
    this.loadStates();

    this.getCategoriesDropdown();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['facilityIdInput'] && !changes['facilityIdInput'].firstChange) {
      this.resolveFacilityIdAndLoad();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearStageTimers();
  }

  private resolveFacilityIdAndLoad(): void {
    const resolvedId = this.isClinicAdmin ? this.authService.getUserFacilityId() :
      this.facilityIdInput && Number(this.facilityIdInput) > 0
        ? Number(this.facilityIdInput)
        : Number(this.router.snapshot.paramMap.get('id'));

    if (!resolvedId || resolvedId <= 0) return;
    if (resolvedId === this.facilityId && this.facilityData) return;

    this.facilityId = resolvedId;
    this.facilityData = null;
    this.subscriptionData = null;

    this.caRows = [];
    this.prRows = [];
    this.csRows = [];
    this.caTotal = 0;
    this.prTotal = 0;
    this.csTotal = 0;
    this.caPageIndex = 1;
    this.prPageIndex = 1;
    this.csPageIndex = 1;
    this.packageSnippets = [];
    this.packageSnippetsTotal = 0;
    this.packageSnippetPageIndex = 1;

    this.getFacilityData();
    this.fetchClinicAdmins();
    this.fetchProviders();
    this.fetchCustomerSupport();
    this.getAssignedCategories();
    this.fetchPackageSnippets();
  }

  getCategoriesDropdown() {
    this.isCategoriesLoading = true;
    this.generalService.getAllCategoriesDropdown().subscribe({
      next: res => {
        this.categoriesDropdownData = res.data;
        this.isCategoriesLoading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        console.log(err);
      }
    })
  }

  getAssignedCategories(){

    this.selectedCategories = []

    this.generalService.getAllAssignedCategoriesByFacilityID(this.facilityId).subscribe({
      next: res => {
        this.assignedCategories = res.data;
        this.assignedCategories.forEach((category) => {
          this.selectedCategories.push(category.categoryId)
        })
        this.cdr.markForCheck();
      },
      error: err => {
        console.log(err);
      }
    })

  }

  getFacilityData(): void {
    this.isLoading = true;
    this.generalService
      .commonGet(`Facilities/getFacilityById?Id=${this.facilityId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.status === 1 && response?.data) {
            this.facilityData = response.data as FacilityData;
            this.subscriptionPlanDeatils();
            if (this.userRole === 'Global Admin') {
              this.loadGlobalPlan();
            }
            if (!this.embeddedInTabs) {
              const breadcrumbs = this.isClinicAdmin
                ? []
                : [
                    { label: 'Clinics', path: '/clinic' },
                    { label: 'Clinic Detail', path: `/clinic/detail/${this.facilityId}` }
                  ];
              this.titleService.updateTitle(response.data.titleLong, breadcrumbs);
            }
          } else {
            if (!this.embeddedInTabs) {
              if (this.isClinicAdmin) {
                this.titleService.updateTitle('Error', []);
              } else {
                this.titleService.updateTitle('Error');
              }
            }
          }
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (error: HttpErrorResponse) => {
          console.error('API Error:', error);
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadGlobalPlan(): void {
    this.generalService
      .commonGet('Subscriptions/getGlobalSubscription')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.globalPlan = res?.data || null;
          this.cdr.markForCheck();
        },
        error: () => {
          this.globalPlan = null;
          this.cdr.markForCheck();
        },
      });
  }

  openToggleBillingModal(): void {
    this.showToggleBillingModal = true;
    this.cdr.markForCheck();
  }

  closeToggleBillingModal(): void {
    if (this.togglingBilling) return;
    this.showToggleBillingModal = false;
    this.cdr.markForCheck();
  }

  confirmToggleBilling(): void {
    if (!this.facilityData) return;
    const newValue = !this.facilityData.isBillable;
    this.togglingBilling = true;
    this.cdr.markForCheck();
    this.generalService
      .commonPost('Facilities/updateFacilityBillingByFacilityID', {
        facilityId: this.facilityId,
        isBillable: newValue,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.togglingBilling = false;
          if (res?.status === 1 || res?.data === true || res?.success === true) {
            if (this.facilityData) this.facilityData.isBillable = newValue;
            this.generalService.showSuccess(
              newValue ? 'Clinic is now billable.' : 'Clinic is now free.'
            );
            this.showToggleBillingModal = false;
          } else {
            this.generalService.showError(res?.message || 'Failed to update billing.');
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.togglingBilling = false;
          this.generalService.showError('Network error. Please try again.');
          this.cdr.markForCheck();
        },
      });
  }

  private subscriptionPlanDeatils(): void {
    if (!this.facilityData) return;
    this.generalService
      .commonGet(`Subscriptions/getSubscriptionByFacilityId?FacilityGuid=${this.facilityData.guid}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const data = response.data as Subscription;
          if (response.status !== 1 || !data) return;
          if (data.subscriptionId === 0) return;
          this.subscriptionData = data;
          this.cdr.markForCheck();
        },
        error: (err) => console.error('Error fetching subscription:', err)
      });
  }

  EditFacility(): void {
    this.modalApiUrl = { save: 'Facilities/saveFacility', get: 'Facilities/getFacilityById?Id=' };
    const title = 'Update Clinic';
    const ID = this.facilityId || 0;
    const formPath = 'facility/add-edit-facility-form.json';
    this.commanModel.showModal(title, 'form', formPath, ID);
  }

  onClinicSaveStarted(): void {
    this.savingStages = [...this.updateStages];
    this.savingStageIndex = 0;
    this.savingComplete = false;
    this.savingLoaderVisible = true;
    this.cdr.markForCheck();
    this.scheduleStageAdvancement([4000, 5000]);
  }

  private scheduleStageAdvancement(delays: number[]): void {
    this.clearStageTimers();
    let accumulated = 0;
    for (let i = 0; i < delays.length; i++) {
      accumulated += delays[i]!;
      const targetStage = i + 1;
      const timer = setTimeout(() => {
        if (this.savingLoaderVisible && !this.savingComplete) {
          this.savingStageIndex = targetStage;
          this.cdr.markForCheck();
        }
      }, accumulated);
      this.stageTimers.push(timer);
    }
  }

  private clearStageTimers(): void {
    this.stageTimers.forEach(t => clearTimeout(t));
    this.stageTimers = [];
  }

  private completeSavingLoader(callback: () => void): void {
    this.clearStageTimers();
    this.savingStageIndex = this.savingStages.length - 1;
    this.savingComplete = true;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.savingLoaderVisible = false;
      this.savingComplete = false;
      this.savingStageIndex = 0;
      this.cdr.markForCheck();
      callback();
    }, 1500);
  }

  onClinicSaveValidationFailed(): void {
    this.clearStageTimers();
    this.savingLoaderVisible = false;
    this.savingComplete = false;
    this.savingStageIndex = 0;
    this.cdr.markForCheck();
  }

  get savingProgressPercent(): number {
    if (!this.savingStages.length) return 0;
    if (this.savingComplete) return 100;
    return Math.round((this.savingStageIndex / this.savingStages.length) * 100);
  }

  navigateToFacility(): void {
    this.route.navigate(['clinic/view']);
  }

  refreshTable(data?: string): void {
    if (data && data === 'Update Clinic') {
      if (this.savingLoaderVisible) {
        this.completeSavingLoader(() => this.getFacilityData());
      } else {
        this.getFacilityData();
      }
      return;
    }
    this.refreshAllTables();
  }

  refreshAllTables(): void {
    this.fetchClinicAdmins();
    this.fetchProviders();
    this.fetchCustomerSupport();
  }

  private mapPackageSnippet(row: any): PackageSnippet {
    return {
      bundleId: Number(row?.bundleId || 0),
      name: row?.name || '',
      categoryId: Number(row?.categoryId || 0),
      categoryName: row?.categoryName ?? null,
      description: row?.description ?? null,
      status: row?.status ?? null,
      clinicPrice: row?.clinicPrice ?? null
    };
  }

  private fetchPackageSnippets(): void {
    this.packageSnippetsLoading = true;
    const endpoint = `Products/getAllBundlesByFacilities?FacilityId=${this.facilityId}&PageNumber=${this.packageSnippetPageIndex}&PageSize=${this.packageSnippetPageSize}&ProductType=Bundle`;
    this.generalService
      .commonGet(endpoint)
      .pipe(
        finalize(() => {
          this.packageSnippetsLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response: ApiResponse<any[]>) => {
          const rows = Array.isArray(response?.data) ? response.data.map((row) => this.mapPackageSnippet(row)) : [];
          this.packageSnippets = rows;

          const totalEntityCount =
            typeof response?.totalEntityCount === 'number' ? response.totalEntityCount : undefined;
          const count = typeof response?.count === 'number' ? response.count : undefined;
          const totalPages = Number(response?.totalPages || 0);

          this.packageSnippetsTotal =
            totalEntityCount ??
            count ??
            (totalPages > 0 ? totalPages * this.packageSnippetPageSize : rows.length);
        },
        error: (error: HttpErrorResponse) => {
          console.error('Failed to load package snippets:', error);
          this.packageSnippets = [];
          this.packageSnippetsTotal = 0;
        }
      });
  }

  openAddForRole(roleId: number, roleName: string): void {
    this.AddEditUser({ userId: 0, roleId, roleName });
  }

  openEditForRole(roleId: number, roleName: string, row: TableUser): void {
    this.AddEditUser({
      userId: row.userId,
      roleId,
      roleName,
      userName: row.userName || ''
    });
  }

  updateRowStatus(roleId: number, roleName: string, row: TableUser): void {
    this.updateStatus({
      userId: row.userId,
      roleId,
      roleName,
      userName: row.userName || '',
      status: row.status ?? null
    });
  }

  deleteRow(roleId: number, roleName: string, row: TableUser): void {
    this.onUserDelete({
      userId: row.userId,
      roleId,
      roleName,
      userName: row.userName || ''
    });
  }

  unassignProviderFromRow(row: TableUser): void {
    this.unassignProvider({
      userId: row.userId,
      roleId: 4,
      roleName: 'Provider',
      userName: row.userName || ''
    });
  }

  onUserView = (data: any): void => {
    this.route.navigate(['user/detail', data.userId]);
  };

  AddEditUser = (data: User): void => {
    if (data.roleId === 3 || data.roleId === 5) {
      this.addEditRoleId = data.roleId;
      this.addEditUserId = data.userId || 0;
      this.addEditTitle = data.userId ? `Edit ${data.roleName}` : `Add ${data.roleName}`;
      this.emailExist = false;
      this.originalEmail = '';
      this.initAddEditForm();
      if (this.addEditUserId > 0) {
        this.loadUserDataForEdit(this.addEditUserId);
      } else {
        this.addEditForm.patchValue({
          roleId: this.addEditRoleId,
          facilityId: this.facilityId,
          addressType: 'Same as Clinic'
        });
      }
      this.addEditVisible = true;
      this.cdr.markForCheck();
      return;
    }

    const type = data.roleName || 'User';
    const title = data.userId ? `Edit ${type}` : `Add ${type}`;
    const ID = data.userId || 0;
    const roleId = data.roleId;
    if (this.userAddEditModal) {
      this.userAddEditModal.showModal(ID, title, roleId, this.facilityId);
    } else {
      console.error('User add/edit modal is not initialized');
    }
  };

  onUserDelete = (data: User): void => {
    const apiUrl = 'Users/deleteUser';
    const title = `${data.roleName || 'User'}: ${data.userName || ''}`;
    const body = { id: data.userId };
    this.generalService
      .commonDelete(apiUrl, title, body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.refreshAllTables(),
        error: (err) => console.error('Delete failed:', err)
      });
  };

  updateStatus = (data: User): void => {
    const apiUrl = 'Users/activateUser';
    const title = 'Confirmation';
    const nextStatus = (data.status || '').toLowerCase() === 'active' ? 'InActive' : 'Active';
    const isActive = nextStatus === 'Active';
    const content = `Are you sure you want to update the ${data.roleName || 'User'}: ${data.userName || ''} status to ${nextStatus}?`;
    const body = { userId: data.userId, isActive };

    this.generalService
      .commonConfirm(title, content)
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        if (result) {
          this.generalService
            .commonPost(apiUrl, body)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (res) => {
                if (res.status === 1) {
                  this.generalService.showSuccess(`Status updated to ${nextStatus} successfully!`);
                  this.refreshAllTables();
                } else {
                  this.generalService.showError(res.message || 'Failed to update status');
                }
              },
              error: (err: HttpErrorResponse) => {
                console.error('Error updating status:', err);
                this.generalService.showError('Failed to update provider status.');
              }
            });
        }
      });
  };

  unAssignedProvidersList(): void {
    this.providersLoading = true;
    this.providers = [];
    this.generalService
      .commonGet(`DropDowns/getAllProviders?isAssign=false&FacilityId=${this.facilityId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.status === 1 && response?.data) {
            this.providers = response?.data || [];
          } else {
            this.providers = [];
          }
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

  trackById(_index: number, data: { providerId: number; name: string }): number {
    return data.providerId;
  }

  getStatusBadgeClass(status: string | null | undefined): string {
    return getUnifiedStatusBadgeClass(status);
  }

  getFacilityInitials(): string {
    const title = (this.facilityData?.titleLong || 'Clinic').trim();
    if (!title) return 'CL';
    return title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  assignProviders(): void {
    if (!this.selectedProviders.length) {
      this.generalService.showError('Please select at least one provider.');
      return;
    }

    const payload = this.selectedProviders.map((providerId) => ({
      userId: providerId,
      facilityId: this.facilityId,
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
            this.refreshAllTables();
            this.cdr.markForCheck();
          } else {
            this.generalService.showError(response?.message || 'Failed to assign providers.');
            this.cdr.markForCheck();
          }
        },
        error: (err: HttpErrorResponse) => {
          console.error('Error assigning providers:', err);
          this.generalService.showError('Failed to assign providers.');
        }
      });
  }

  unassignProvider = (data: User): void => {
    const title = 'Confirmation';
    const content = `Are you sure you want to unassign the provider: ${data.userName || ''} from this ${this.facilityData?.titleLong || 'clinic'}?`;

    this.generalService
      .commonConfirm(title, content)
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        if (result) {
          const payload = [{ userId: data.userId, facilityId: this.facilityId, isAssign: false }];

          this.generalService
            .commonPost('users/assignUserToFacility', payload)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (response) => {
                if (response?.status === 1) {
                  this.generalService.showSuccess('Provider unassigned successfully!');
                  this.refreshAllTables();
                } else {
                  this.generalService.showError(response?.message || 'Failed to unassign provider.');
                }
              },
              error: (err: HttpErrorResponse) => {
                console.error('Error unassigning provider:', err);
                this.generalService.showError('Failed to unassign provider.');
              }
            });
        }
      });
  };

  private mapRow(r: any): TableUser {
    return {
      userId: r?.userId,
      userName: r?.userName ?? null,
      email: r?.email ?? null,
      phone: r?.phone ?? null,
      status: r?.status ?? (r?.isActive === true ? 'Active' : r?.isActive === false ? 'InActive' : null),
      address: r?.address ?? null
    };
  }

  private buildUserEndpoint(roleId: number, pageIndex: number, pageSize: number): string {
    return `Users/getAllUsers?RoleId=${roleId}&facilityId=${this.facilityId}&PageNumber=${pageIndex}&PageSize=${pageSize}`;
  }

  onCaQueryParams(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;
    if (pageIndex !== this.caPageIndex || pageSize !== this.caPageSize) {
      this.caPageIndex = pageIndex;
      this.caPageSize = pageSize;
      this.fetchClinicAdmins();
    }
  }

  private fetchClinicAdmins(): void {
    const endpoint = this.buildUserEndpoint(3, this.caPageIndex, this.caPageSize);
    this.caLoading = true;
    this.generalService
      .commonGet(endpoint)
      .pipe(
        finalize(() => {
          this.caLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: ApiResponse<any[]>) => {
          const rows = Array.isArray(res?.data) ? res.data : [];
          this.caRows = rows.map((r: any) => this.mapRow(r));
          this.caTotal =
            (typeof res?.totalEntityCount === 'number' && res.totalEntityCount) ||
            (typeof res?.count === 'number' && res.count) ||
            this.caRows.length;
        },
        error: (err) => console.error('Failed to fetch Clinic Admins', err)
      });
  }

  onPrQueryParams(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;
    if (pageIndex !== this.prPageIndex || pageSize !== this.prPageSize) {
      this.prPageIndex = pageIndex;
      this.prPageSize = pageSize;
      this.fetchProviders();
    }
  }

  private fetchProviders(): void {
    if (this.userRole == 'Global Admin') {
      const endpoint = this.buildUserEndpoint(4, this.prPageIndex, this.prPageSize);
      this.prLoading = true;
      this.generalService
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
            this.prRows = rows.map((r: any) => this.mapRow(r));
            this.prTotal =
              (typeof res?.totalEntityCount === 'number' && res.totalEntityCount) ||
              (typeof res?.count === 'number' && res.count) ||
              this.prRows.length;
          },
          error: (err) => console.error('Failed to fetch Providers', err)
        });
    }
  }

  onCsQueryParams(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;
    if (pageIndex !== this.csPageIndex || pageSize !== this.csPageSize) {
      this.csPageIndex = pageIndex;
      this.csPageSize = pageSize;
      this.fetchCustomerSupport();
    }
  }

  onPackageSnippetQueryParams(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;
    if (pageIndex !== this.packageSnippetPageIndex || pageSize !== this.packageSnippetPageSize) {
      this.packageSnippetPageIndex = pageIndex;
      this.packageSnippetPageSize = pageSize;
      this.fetchPackageSnippets();
    }
  }

  private fetchCustomerSupport(): void {
    const endpoint = this.buildUserEndpoint(5, this.csPageIndex, this.csPageSize);
    this.csLoading = true;
    this.generalService
      .commonGet(endpoint)
      .pipe(
        finalize(() => {
          this.csLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (res: ApiResponse<any[]>) => {
          const rows = Array.isArray(res?.data) ? res.data : [];
          this.csRows = rows.map((r: any) => this.mapRow(r));
          this.csTotal =
            (typeof res?.totalEntityCount === 'number' && res.totalEntityCount) ||
            (typeof res?.count === 'number' && res.count) ||
            this.csRows.length;
        },
        error: (err) => console.error('Failed to fetch Customer Support', err)
      });
  }

  private initAddEditForm(): void {
    this.addEditForm = this.fb.group({
      roleId: [this.addEditRoleId, Validators.required],
      facilityId: [this.facilityId, Validators.required],
      firstName: ['', [Validators.required]],
      middleName: [''],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      addressType: ['Same as Clinic', [Validators.required]],
      address: [''],
      cityId: [null],
      stateId: [null],
      zipCode: ['']
    });

    this.addEditForm.get('addressType')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((type: string) => this.onAddressTypeChange(type));

    this.addEditForm.get('cityId')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((cityId: number) => this.onCityChange(cityId));
  }

  private toggleAddressValidators(require: boolean): void {
    const address = this.addEditForm.get('address');
    const city = this.addEditForm.get('cityId');
    const state = this.addEditForm.get('stateId');
    const zipcode = this.addEditForm.get('zipCode');

    if (require) {
      address?.setValidators([Validators.required]);
      city?.setValidators([Validators.required]);
      state?.setValidators([Validators.required]);
      zipcode?.setValidators([Validators.required]);
    } else {
      address?.clearValidators();
      city?.clearValidators();
      state?.clearValidators();
      zipcode?.clearValidators();
      address?.setValue('');
      city?.setValue(null);
      state?.setValue(null);
      zipcode?.setValue('');
      this.state = null;
    }

    address?.updateValueAndValidity();
    city?.updateValueAndValidity();
    state?.updateValueAndValidity();
    zipcode?.updateValueAndValidity();
  }

  private loadUserDataForEdit(userId: number): void {
    this.isFormSubmitting = true;
    this.generalService
      .commonGet(`Users/getUserById?Id=${userId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.status === 1 && response.data) {
            const d = response.data || {};
            this.originalEmail = d.email || '';
            const addressType = d.addressType || 'Same as Clinic';
            this.addEditForm.patchValue({
              roleId: this.addEditRoleId,
              facilityId: this.facilityId,
              firstName: d.firstName || '',
              middleName: d.middleName || '',
              lastName: d.lastName || '',
              email: d.email || '',
              phone: d.phone || '',
              addressType,
              address: d.address || '',
              cityId: d.cityId ?? null,
              stateId: d.stateId ?? null,
              zipCode: d.zipCode || ''
            });
            this.toggleAddressValidators(addressType === 'Other Address');
            if (d.cityId) this.onCityChange(d.cityId);
            this.isFormSubmitting = false;
            this.cdr.markForCheck();
          }
        }
      });
  }

  private loadCities(): void {
    this.generalService.getAllCities().pipe(takeUntil(this.destroy$)).subscribe((cities) => {
      this.cities = cities || [];
      this.cdr.markForCheck();
    });
  }

  private loadStates(): void {
    this.loadingStates = true;
    this.generalService
      .commonGet('DropDowns/GetAllStateOfUSA')
      .pipe(
        finalize(() => (this.loadingStates = false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => {
          if (response.status === 1 && response.data) {
            this.states = response.data;
          }
          this.cdr.markForCheck();
        },
        error: () => (this.loadingStates = false)
      });
  }

  private loadStateByCityId(cityId: number): void {
    this.generalService.getStateByCityId(cityId).pipe(takeUntil(this.destroy$)).subscribe((st) => {
      this.state = st || null;
      if (this.state) this.addEditForm.get('stateId')?.setValue(this.state.id);
      this.cdr.markForCheck();
    });
  }

  onCityChange(cityId: number): void {
    if (cityId > 0) {
      this.loadStateByCityId(cityId);
    } else {
      this.state = null;
      this.addEditForm.get('stateId')?.reset();
    }
  }

  onAddressTypeChange(type: string): void {
    this.toggleAddressValidators(type === 'Other Address');
    const cityId = this.addEditForm.get('cityId')?.value;
    if (cityId) this.onCityChange(cityId);
  }

  checkEmailExists(event: any): void {
    const control = this.addEditForm.get('email');
    if (!control || control.invalid) return;
    const email = (event?.target?.value || '').trim();
    if (!email || email === this.originalEmail) {
      this.emailExist = false;
      return;
    }
    this.generalService
      .commonGet(`Users/checkEmailAlreadyExist?Email=${encodeURIComponent(email)}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.emailExist = response.status === 1 && response.data === true;
          if (this.emailExist) this.generalService.showError('Email Already Exist');
          this.cdr.markForCheck();
        },
        error: () => (this.emailExist = false)
      });
  }

  handleAddEditCancel(): void {
    this.addEditVisible = false;
    this.isFormSubmitting = false;
    this.emailExist = false;
  }

  private validateAddEditForm(): boolean {
    if (this.emailExist) {
      this.generalService.showError('Email already exist. Use a different email.');
      return false;
    }
    if (!this.addEditForm.valid) {
      Object.keys(this.addEditForm.controls).forEach((key) => {
        const c = this.addEditForm.get(key);
        c?.markAsTouched();
        c?.updateValueAndValidity();
      });
      this.generalService.showError('Please fill all the required fields');
      return false;
    }
    return true;
  }

  handleAddEditOk(): void {
    if (!this.validateAddEditForm()) return;

    this.isFormSubmitting = true;

    const body = {
      ...this.addEditForm.value,
      userId: this.addEditUserId || 0,
      roleId: this.addEditRoleId,
      facilityId: this.facilityId
    };

    this.generalService
      .commonPost('Users/saveUser', body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.status === 1) {
            this.generalService.showSuccess(res.message || 'Saved successfully');
            this.addEditVisible = false;
            this.refreshAllTables();
          } else {
            this.generalService.showError(res.message || 'Failed to save');
          }
          this.isFormSubmitting = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Save user failed:', err);
          this.generalService.showError(err?.message || 'Failed to save');
          this.isFormSubmitting = false;
          this.cdr.markForCheck();
        }
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

  getLimitTooltip(type: 'user' | 'provider'): string {
    if (type === 'user' && this.isUserLimitReached() && this.subscriptionData) {
      return `User limit reached (${this.subscriptionData.totalUsers}/${this.subscriptionData.maxUsers}). Upgrade your plan to add more.`;
    }
    if (type === 'provider' && this.isProviderLimitReached() && this.subscriptionData) {
      return `Provider limit reached (${this.subscriptionData.totalProviders}/${this.subscriptionData.maxProviders}). Upgrade your plan to add more.`;
    }
    return '';
  }

  handleCategoriesCancel(): void {
    this.showAddCategoriesModal = false;
  }

  handleCategoriesOK(): void {
    this.isFormSubmitting = true
    this.cdr.markForCheck();

    let payload = {
      facilityId: this.facilityId,
      categoryIds: this.selectedCategories
    }

    this.generalService.assignCategoriesToFacility(payload).subscribe({
      next: (response) => {
        this.notification.success('Success',response.message)
        this.isFormSubmitting = false;
        this.showAddCategoriesModal = false;
        this.getAssignedCategories()
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.log(err);
        this.isFormSubmitting = false;
        this.cdr.markForCheck();
      }
    })
  }

  unassignCategory(category:any){
    console.log(category);
    let payload = {
      facilityId: this.facilityId,
      categoryIds: [category.categoryId]
    }

    this.generalService.unAssignCategoriesToFacility(payload).subscribe({
      next: (response) => {
        this.notification.success('Success',response.message)
        this.getAssignedCategories()
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.log(err);
        this.cdr.markForCheck();
      }
    })

  }

  private buildIframeSnippet(url: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html { height: 100%; font-family: Arial, sans-serif; background: #fff8f6; }
    .container { display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; padding: 20px; }
    .iframe-wrapper {
      background: #fff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      border: 1px solid #e5e7eb; width: 100%; max-width: 900px; overflow: hidden;
    }
    .iframe-wrapper iframe { width: 100%; height: 100%; min-height: 100vh; border: none; display: block; }
    @media (max-width: 768px) { .container { padding: 10px; } .iframe-wrapper { border-radius: 12px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="iframe-wrapper">
      <iframe src="${url}"></iframe>
    </div>
  </div>
</body>
</html>`;
  }

  copyCode(src:number) {
    if (src == 1){
      const code = this.buildIframeSnippet(`http://www.telehealthus.com/get-started/${this.facilityId}`);
      navigator.clipboard.writeText(code).then(() => {
        this.notification.success('Success', 'Code snippet copied to clipboard!');
      });
    }
  }

  copyCategoryCode(categoryId: number): void {
    const code = this.buildIframeSnippet(
      `http://www.telehealthus.com/packageByCategory/${this.facilityId}/${categoryId}`
    );
    navigator.clipboard.writeText(code).then(() => {
      this.notification.success('Success', 'Code snippet copied to clipboard!');
    });
  }

  exportCategorySnippetsTxt(): void {
    if (!this.assignedCategories?.length) {
      this.notification.info('Info', 'No category snippets available to export.');
      return;
    }

    const lines = this.assignedCategories.map((category: any) => {
      const snippetURL = `http://www.telehealthus.com/packageByCategory/${this.facilityId}/${category.categoryId}`;
      const htmlSnippet = this.buildIframeSnippet(snippetURL).trim();

      return [
        `Category ID: ${category.categoryId ?? ''}`,
        `Category Name: ${category.categoryName ?? ''}`,
        `Category Description: ${category.categoryDescription ?? ''}`,
        `Image URL: ${category.imageURL ?? ''}`,
        `Snippet URL: ${snippetURL}`,
        'HTML Snippet:',
        htmlSnippet,
        ''.padEnd(100, '=')
      ].join('\n');
    });

    const content = lines.join('\n\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `category-snippets-facility-${this.facilityId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.notification.success('Success', 'Category snippets exported as TXT successfully.');
  }

  copyPackageCode(bundle: PackageSnippet): void {
    if (!bundle?.bundleId || !bundle?.categoryId) {
      this.notification.error('Error', 'Invalid package snippet data.');
      return;
    }

    const code = this.buildIframeSnippet(
      `http://www.telehealthus.com/get-started-by-package/${this.facilityId}/${bundle.categoryId}/${bundle.bundleId}`
    );

    navigator.clipboard.writeText(code).then(() => {
      this.notification.success('Success', 'Package snippet copied to clipboard!');
    });
  }

  exportPackageSnippetsTxt(): void {
    if (!this.packageSnippets?.length) {
      this.notification.info('Info', 'No package snippets available to export.');
      return;
    }

    const lines = this.packageSnippets.map((bundle) => {
      const snippetURL = `http://www.telehealthus.com/get-started-by-package/${this.facilityId}/${bundle.categoryId}/${bundle.bundleId}`;
      const htmlSnippet = this.buildIframeSnippet(snippetURL).trim();

      return [
        `Bundle ID: ${bundle.bundleId ?? ''}`,
        `Bundle Name: ${bundle.name ?? ''}`,
        `Category ID: ${bundle.categoryId ?? ''}`,
        `Category Name: ${bundle.categoryName ?? ''}`,
        `Description: ${bundle.description ?? ''}`,
        `Status: ${bundle.status ?? ''}`,
        `Clinic Price: ${bundle.clinicPrice ?? ''}`,
        `Snippet URL: ${snippetURL}`,
        'HTML Snippet:',
        htmlSnippet,
        ''.padEnd(100, '=')
      ].join('\n');
    });

    const content = lines.join('\n\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `package-snippets-facility-${this.facilityId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.notification.success('Success', 'Package snippets exported as TXT successfully.');
  }

  baaViewerVisible = false;
  baaSafeUrl: SafeResourceUrl | null = null;

  viewBaaPdf(): void {
    const url = String(this.facilityData?.baaPdfUrl || '').trim();
    if (!url) {
      this.notification.error('Error', 'BAA document is not available.');
      return;
    }
    this.baaSafeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    this.baaViewerVisible = true;
    this.cdr.markForCheck();
  }

  closeBaaViewer(): void {
    this.baaViewerVisible = false;
    this.baaSafeUrl = null;
    this.cdr.markForCheck();
  }

  downloadBaaPdf(): void {
    const url = String(this.facilityData?.baaPdfUrl || '').trim();
    if (!url) {
      this.notification.error('Error', 'BAA document is not available.');
      return;
    }
    const clinic = (this.facilityData?.titleLong || 'clinic').replace(/[^a-z0-9]+/gi, '-');
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.download = `BAA-${clinic}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }
}
