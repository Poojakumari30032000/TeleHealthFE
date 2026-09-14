import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from "@angular/common";
import { GeneralService } from 'app/shared/services/general.service';
import { UserAddEditModalComponent } from 'app/shared/user-add-edit-modal/user-add-edit-modal.component';
import { TitleService } from 'app/shared/services/title.service';
import { AuthService } from 'app/shared/Auth/auth.service';
import { Subject, takeUntil } from 'rxjs';

interface User {
  userId: number
  firstName: string
  middleName: string
  lastName: string
  dob: string
  title: string
  gender: string
  email: string
  phone: string
  addressType: string
  address: string
  stateId: number
  stateName: string
  cityId: number
  cityName: string
  zipCode: string
  status: string
  taxId: string
  medicaid: string
  caqhId: string
  npi: string
  license: string
  ssn: string
  dea: string
  providerType: string
  isSupervisorRequired: boolean
  supervisorId: number[]
  supervisorName: string[]
  password: string
  roleId: number
  roleName: string
  createdByName: string
  modifiedDate: string
}

@Component({
  selector: 'app-user-detail-view',
  templateUrl: './user-detail-view.component.html',
  styleUrl: './user-detail-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserDetailViewComponent {

  @ViewChild('userAddEditModal', { static: false }) userAddEditModal!: UserAddEditModalComponent;
  modalApiUrl : { save?: string; get?: string } = {
    save : '',
    get : ''
  };
  activeTab: string = 'Appointments';
  userId: number = 0;
  userRole : string = this.auth.getUserRole() || '';
  isLoading: boolean = false;
  userData: User | null = null
    private destroy$ = new Subject<void>();

  constructor(
    private generalService: GeneralService,
    private cdr: ChangeDetectorRef,
    private _location: Location,
    private router: ActivatedRoute,
    private titleService: TitleService,
    private auth: AuthService
  ) {
    this.userId = Number(this.router.snapshot.paramMap.get('id'));
  }

  ngOnInit(): void{
    this.getUserData();
  }

  getUserData() {
    this.isLoading = true;
    this.generalService.commonGet(`Users/getUserById?Id=${this.userId}`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response?.status === 1 && response?.data) {
          this.userData = response.data;
          console.log('User Data:', this.userData);
          this.titleService.updateTitle(
            response.data.firstName + ' ' + response.data.lastName,
            [
              { label: this.userRole === 'Global Admin' ?  'Providers' : 'Staff', path: '/user/view' },
              { label: 'User Detail', path: `/user/detail/${this.userId}` }
            ]
          );
          this.isLoading = false;
          this.cdr.markForCheck();
        } else {
          console.warn('Failed to fetch user data:', response?.message);
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        console.error('API Error:', err);
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  moveBack() {
    this._location.back();
  }

  AddEditUser() : void {
    const data = this.userData;
    const optionalData = this.userData?.roleName
    let title: string = 'Add ' + optionalData;
    const ID = data?.userId || 0;
    const roleId = data?.roleId || 0;
    const facilityId = data?.roleId === 4 ? 0 : Number(localStorage.getItem('FOS') || 0 );
    this.modalApiUrl = {
      save: 'Users/saveUser',
      get: 'Users/getUserById?Id='
    }
    if (data) {
      title = 'Update ' + optionalData;
    }
    this.userAddEditModal.showModal(ID, title, roleId, facilityId);
  }

  onTabChange(event: any): void {
    this.activeTab = event.tab.nzTitle;
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void{
    this.destroy$.next();
    this.destroy$.complete();
  }

}
