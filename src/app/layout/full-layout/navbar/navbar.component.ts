import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  signal,
  computed,
  ViewChild,
} from '@angular/core';
import { SidebarService } from '../../../shared/services/sidebar.service';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterModule,
} from '@angular/router';
import { NzModalModule, NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import { AuthService } from '../../../shared/Auth/auth.service';
import { GeneralService } from '../../../shared/services/general.service';
import { filter, Subject, takeUntil } from 'rxjs';
import { FormGroup, FormBuilder, Validators, FormsModule } from '@angular/forms';
import { TitleService } from '../../../shared/services/title.service';
import { BrandingService } from 'app/branding/branding.service';
import { CommonModule, formatDate } from '@angular/common';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzUploadChangeParam, NzUploadModule, NzUploadFile } from 'ng-zorro-antd/upload';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from 'app/shared/shared.module';
import { NzMessageService } from 'ng-zorro-antd/message';
import { environment } from 'environments/environment';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { CommanFormModalComponent } from 'app/shared/comman-form-modal/comman-form-modal.component';
import { ChatService } from 'app/chat/chat.service';

interface Breadcrumb {
  label: string;
  path: string;
}

interface Notification {
  notificationId: number;
  facilityId: number;
  notificationType: string;
  title: string;
  description: string;
  createdDate: string;
  isRead: boolean;
}

interface AppointmentNoti {
  patientAppointmentSlotId: number;
  facilityId: number;
  providerScheduledSlotId: number;
  patientName: string;
  providerId: number;
  patientId: number;
  startDate: string;
  startTime: string;
  endTime: string;
  duration: number;
  vonageSessionId: string;
  vonageTokenId: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    NzLayoutModule,
    SharedModule,
    ReactiveFormsModule,
    NzDropDownModule,
    NzUploadModule,
    NzDrawerModule,
    NzModalModule,
    CommonModule,
    RouterModule,
    FormsModule,
    NzInputModule,
    NzInputNumberModule,
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarComponent implements OnInit {
  @ViewChild('commanModel', { static: false }) commanModel!: CommanFormModalComponent;
  userRole: string = '';
  userRoleId: number|null = null;
  userId: number = 0;
  patientId: number = 0;
  profileName: string = '';
  isProfileDropdownOpen: boolean = false;
  isDarkMode: boolean = false;
  notifications: Notification[] = [];
  isViewAllModalVisible: boolean = false;
  notifViewAllFilter: 'all' | 'unread' | 'read' = 'all';
  notifViewAllSearch: string = '';
  private notificationInterval: any;
  private unreadCheckInterval: any;
  confirmModal?: NzModalRef;
  selectedFacility: number = Number(localStorage.getItem('FOS') || 0);
  appointmentDrawerVisible = false;
  appointmentData: AppointmentNoti | null = null;
  private destroy$ = new Subject<void>();
  isVisible: boolean = false;
  ChangePasswordForm!: FormGroup;
  isConfirmLoading = false;
  uploadUrl: string = `${environment.IAMGE_PATH}/api/Commons/UploadFile`;
  supportIsVisible: boolean = false;
  supportText: string = '';

  getProfileUrl: string = '';

  private readonly MAX_IMAGE_MB = 5;

  token=this.auth.getToken();

  profileIsVisible: boolean = false;

  currentTitle = signal<string>('');
  breadcrumbs = signal<Breadcrumb[]>([]);

  totalUnreadMessages = computed(() => {
    try {
      const onlineUsers = this.chatService.onlineUsers();
      const chatChannels = this.chatService.chatChannels();

      const directMessagesCount = onlineUsers.reduce((total, user) => {
        return total + (user.unreadCount || 0);
      }, 0);

      const channelsCount = chatChannels.reduce((total, channel) => {
        return total + (channel.unreadCount || 0);
      }, 0);

      return directMessagesCount + channelsCount;
    } catch (error) {
      console.error('Error calculating unread messages:', error);
      return 0;
    }
  });

    modalApiUrl: { save?: string; get?: string } = {
    save: 'Patients/savePatient',
    get: 'Patients/getPatientById?Id=',
  };

  constructor(
    private fb: FormBuilder,
    private modal: NzModalService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private auth: AuthService,
    private titleService: TitleService,
    private sidebarService: SidebarService,
    private generalService: GeneralService,
    private brandingService: BrandingService,
    private cdr: ChangeDetectorRef,
    private messageService: NzMessageService,
    private chatService: ChatService
  ) {}

  private previousUserId: number | null = null;

  ngOnInit() {
    this.profileName = this.auth.getUserName() || '';
    this.userRole = this.auth.getUserRole() || '';
    this.userRoleId = this.auth.getUserRoleId() || null;
    this.userId = this.auth.getUserId() || 0;
    this.patientId = this.auth.getPatientId() || 0;
    this.previousUserId = this.userId;

    this.getProfileUrl = this.auth.getProfileUrl() || '';

    console.log(this.getProfileUrl);

    const theme = localStorage.getItem('theme') || '';
    if (theme === 'dark') {
      this.isDarkMode = true;
      document.documentElement.classList.add('dark');
    }

    this.titleService.currentTitle
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ title, breadcrumbs }) => {
        this.currentTitle.set(title);
        this.breadcrumbs.set(breadcrumbs);
      });

    this.router.events
      .pipe(
        takeUntil(this.destroy$),
        filter((event) => event instanceof NavigationEnd)
      )
      .subscribe(() => {
        this.setTitleFromRoute();
        this.fetchNotifications();

        const currentUserId = this.auth.getUserId() || 0;
        if (this.previousUserId !== null && this.previousUserId !== currentUserId) {
          console.log('NavbarComponent: User changed, updating user info');
          this.profileName = this.auth.getUserName() || '';
          this.userRole = this.auth.getUserRole() || '';
          this.userRoleId = this.auth.getUserRoleId() || null;
          this.userId = currentUserId;
          this.patientId = this.auth.getPatientId() || 0;
          this.previousUserId = currentUserId;
          this.getProfileUrl = this.auth.getProfileUrl() || '';

          this.cdr.markForCheck();
        }

        if (this.userRole === 'Clinic Admin') this.subscriptionPlanDeatils();
      });

    this.initializeForm();
    this.setTitleFromRoute();

    if (this.userRole === 'Clinic Admin') this.subscriptionPlanDeatils();

    this.fetchNotifications();
    this.notificationInterval = setInterval(() => {

      if (this.userRole === 'Clinic Admin') this.subscriptionPlanDeatils();
      this.fetchNotifications();
    }, 600000);

    this.unreadCheckInterval = setInterval(() => {

      const currentUserId = this.auth.getUserId() || 0;
      if (this.previousUserId !== null && this.previousUserId !== currentUserId) {
        this.previousUserId = currentUserId;

        this.profileName = this.auth.getUserName() || '';
        this.userRole = this.auth.getUserRole() || '';
        this.userRoleId = this.auth.getUserRoleId() || null;
        this.userId = currentUserId;
        this.patientId = this.auth.getPatientId() || 0;
        this.getProfileUrl = this.auth.getProfileUrl() || '';
      }

      this.cdr.markForCheck();
    }, 500);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.notificationInterval) {
      clearInterval(this.notificationInterval);
    }
    if (this.unreadCheckInterval) {
      clearInterval(this.unreadCheckInterval);
    }
  }

  private setTitleFromRoute() {
    const title = this.getRouteTitle(this.activatedRoute.root);
    const breadcrumbs = this.createBreadcrumbs(this.activatedRoute.root);
    this.titleService.updateTitle(title, breadcrumbs);
  }

  private getRouteTitle(route: ActivatedRoute): string {
    let child = route.firstChild;
    while (child?.firstChild) {
      child = child.firstChild;
    }
    return child?.snapshot.data['title'] || '';
  }

  private createBreadcrumbs(route: ActivatedRoute): Breadcrumb[] {
    const breadcrumbs: Array<{ label: string; path: string }> = [];
    let currentRoute: ActivatedRoute | null = route;
    let url = '';

    while (currentRoute?.firstChild) {
      currentRoute = currentRoute.firstChild;
      const routeData = currentRoute.snapshot.data;
      const pathSegment = currentRoute.snapshot.url
        .map((segment) => segment.path)
        .join('/');

      if (pathSegment) {
        url += `/${pathSegment}`;
      }

      if (routeData['breadcrumb']) {
        breadcrumbs.push({
          label: routeData['breadcrumb'],
          path: url || '',
        });
      }
    }
    return breadcrumbs;
  }

  toggleSidebar(): void {
    this.sidebarService.toggleSidebar();
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    if (this.isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      this.generalService.sendData({ type: 'themeChanged', value: 'dark' });
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      this.generalService.sendData({ type: 'themeChanged', value: 'light' });
    }
  }

  fetchNotifications() {

    const queryParts: string[] = [];

    if (this.selectedFacility) {
      queryParts.push(`FacilityId=${this.selectedFacility}`);
    }

    if (this.userId) {
      queryParts.push(`UserId=${this.userId}`);
    }

    if (this.userRoleId) {

      queryParts.push(`RoleId=${this.userRoleId}`);
    }

    const queryString = queryParts.length ? `?${queryParts.join('&')}` : '';

    this.generalService
      .commonGet(`Notifications/getAllNotifications${queryString}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.status === 1 && response.data) {

            this.notifications = (response.data as Notification[])
              .map((notif: Notification) => ({
                ...notif,
                createdDate: this.getRelativeTime(notif.createdDate),
              }));

            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          console.error('Error fetching notifications:', err);
          this.cdr.markForCheck();
        },
      });

  }

  private getRelativeTime(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    const isPast = seconds >= 0;
    const absSeconds = Math.abs(seconds);

    const intervals = [
      { unit: 'year', seconds: 31536000 },
      { unit: 'month', seconds: 2592000 },
      { unit: 'day', seconds: 86400 },
      { unit: 'hr', seconds: 3600 },
      { unit: 'min', seconds: 60 },
      { unit: 'sec', seconds: 1 },
    ];

    for (const { unit, seconds: divisor } of intervals) {
      const count = Math.floor(absSeconds / divisor);
      if (count >= 1) {
        const plural = count > 1 ? 's' : '';
        return isPast
          ? `${count} ${unit}${plural} ago`
          : `in ${count} ${unit}${plural}`;
      }
    }

    return isPast ? 'just now' : 'soon';
  }

  prettifyNotificationType(type: string | null | undefined): string {
    if (!type) return 'Notification';

    return type
      .replace(/([a-z\d])([A-Z])/g, '$1 $2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
      .trim();
  }

  getNotifTitle(n: Notification): string {
    const t = (n?.title || '').trim();
    if (t) return t;
    return this.prettifyNotificationType(n?.notificationType);
  }

  openViewAllNotifications(): void {
    this.isViewAllModalVisible = true;
    this.notifViewAllFilter = 'all';
    this.notifViewAllSearch = '';
  }

  closeViewAllNotifications(): void {
    this.isViewAllModalVisible = false;
  }

  get filteredViewAllNotifications(): Notification[] {
    const search = (this.notifViewAllSearch || '').trim().toLowerCase();
    return (this.notifications || []).filter((n) => {
      if (this.notifViewAllFilter === 'unread' && n.isRead) return false;
      if (this.notifViewAllFilter === 'read' && !n.isRead) return false;
      if (!search) return true;
      const haystack = [
        this.getNotifTitle(n),
        n.description || '',
        n.notificationType || '',
        this.prettifyNotificationType(n.notificationType),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  get unreadNotificationCount(): number {
    return (this.notifications || []).filter((n) => !n.isRead).length;
  }

  markAsRead(notificationId: number, type: string = '') {
    let body: Array<{ id: number }> = [];
    if (type === 'All') {

      this.notifications
        .filter((n) => !n.isRead)
        .forEach((n) => body.push({ id: n.notificationId }));
    } else {
      body = [{ id: notificationId }];
    }
    if (body.length === 0) return;

    this.generalService
      .commonPost('Notifications/updateNotifications', body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.status !== 1 || !response.data) {
            this.generalService.showError(
              'Something went wrong, Please try again later'
            );
            return;
          }

          if (type === 'All') {
            this.notifications = this.notifications.map((n) => ({ ...n, isRead: true }));
          } else {
            this.notifications = this.notifications.map((n) =>
              n.notificationId === notificationId ? { ...n, isRead: true } : n
            );
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error marking notification as read:', err);
        },
      });
  }

  checkForAppointments() {
    this.generalService
      .commonGet(
        `PatientAppointments/getPatientAppointmentAlert?Id=${this.userId}`
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.status === 1 && response.data) {
            this.appointmentData = {
              ...response.data,
              startDate: formatDate(
                response.data.startDate,
                'yyyy-MM-dd',
                'en-US'
              ),
            };
            this.appointmentDrawerVisible = true;
          }
        },
        error: (err) => {
          console.error('Error fetching appointments:', err);
        },
      });
  }

  subscriptionPlanDeatils() {
    const facilityGuid = localStorage.getItem('FOSG');
    this.generalService
      .commonGet(
        `Subscriptions/getSubscriptionByFacilityId?FacilityGuid=${facilityGuid}`
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const data = response.data;
          if (response.status !== 1 && !data) return;
          if (data?.subscriptionId === 0) return;
          this.generalService.sendData({
            type: 'subscriptionPlanCheck',
            value: data,
          });
        },
        error: (err) => {
          console.error('Error fetching appointments:', err);
        },
      });
  }

  confirmLogout(): void {
    this.confirmModal = this.modal.confirm({
      nzTitle: 'Are you sure you want to log out?',
      nzContent: 'You will be redirected to the login page.',
      nzOkText: 'Yes, Log Out',
      nzCancelText: 'Cancel',
      nzCentered: true,
      nzOnOk: () => this.logout(),
    });
  }

  logout(): void {

    console.log('NavbarComponent: Logout - clearing chat data');
    this.chatService.clearAllData();

    this.auth.logout();
    this.brandingService.resetBranding();
    this.router.navigate(['login']);
  }

  private initializeForm(): void {
    this.ChangePasswordForm = this.fb.group(
      {
        currentPassword: ['', [Validators.required]],
        newPassword: [
          '',
          [
            Validators.required,
            Validators.minLength(8),
            Validators.pattern(
              /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/
            ),
          ],
        ],
        confirmNewPassword: ['', [Validators.required]],
      },
      { validator: this.passwordMatchValidator }
    );
  }

  private passwordMatchValidator(form: FormGroup): void {
    const password = form.get('newPassword');
    const confirmPassword = form.get('confirmNewPassword');

    if (password?.value !== confirmPassword?.value) {
      confirmPassword?.setErrors({ mismatch: true });
    } else {
      confirmPassword?.setErrors(null);
    }
  }

  chnagePasswordModal(): void {
    this.isVisible = true;
    this.ChangePasswordForm.reset();
  }

  handleOk(): void {
    if (this.ChangePasswordForm.invalid) {
      this.generalService.showError('Fill all the fields with required format');
      this.markFormControlsAsTouched();
      return;
    }
    this.isConfirmLoading = true;

    const payload = {
      loginId: this.auth.getUserLoginId(),
      currentPassword: this.ChangePasswordForm.value.currentPassword,
      newPassword: this.ChangePasswordForm.value.newPassword,
      confirmNewPassword: this.ChangePasswordForm.value.confirmNewPassword,
    };

    this.generalService
      .commonPost('Accounts/changePassword', payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const data = response.data;
          if (data && data.isUpdated) {
            this.generalService.showSuccess(data.message);
            this.isVisible = false;
            this.isConfirmLoading = false;
            this.cdr.markForCheck();
          } else {
            this.generalService.showError(data.message);
            this.cdr.markForCheck();
          }
          this.isConfirmLoading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.generalService.showError(error.message);
          this.isConfirmLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  handleCancel(): void {
    this.isVisible = false;
    this.ChangePasswordForm.reset();
  }

  private markFormControlsAsTouched(): void {
    Object.values(this.ChangePasswordForm.controls).forEach((control) => {
      control.markAsTouched();
    });
  }

  get f() {
    return this.ChangePasswordForm.controls;
  }

  beforeUploadImage = (file: NzUploadFile, _fileList: NzUploadFile[]): boolean => {

    const mimeOk = !!file.type && file.type.startsWith('image/');
    const extOk = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name || '');
    if (!mimeOk && !extOk) {
      this.messageService.error('Only image files are allowed (PNG, JPG, GIF, WEBP, etc).');
      return false;
    }

    const sizeBytes = file.size ?? 0;
    const maxBytes = this.MAX_IMAGE_MB * 1024 * 1024;

    if (sizeBytes <= 0) {
      this.messageService.error('Invalid file size.');
      return false;
    }

    if (sizeBytes > maxBytes) {
      this.messageService.error(`Image must be ${this.MAX_IMAGE_MB}MB or smaller.`);
      return false;
    }

    return true;
  };

  handleChange(info: NzUploadChangeParam): void {

    const mimeOk = !!info.file.type && info.file.type.startsWith('image/');
    const extOk = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(info.file.name || '');
    if (!mimeOk && !extOk) {
      this.messageService.error('Only image files are allowed.');
      return;
    }

    const sizeBytes = info.file.size ?? 0;
    if (sizeBytes > this.MAX_IMAGE_MB * 1024 * 1024) {
      this.messageService.error(`Image must be ${this.MAX_IMAGE_MB}MB or smaller.`);
      return;
    }

    if (info.file.status !== 'uploading') {
      console.log(info.file, info.fileList);
    }

    if (info.file.status === 'done') {
      this.messageService.success(`${info.file.name} file uploaded successfully`);

      const filePath = info.file.response?.fileDetails?.filePath;
      if (!filePath) {
        this.messageService.error('Upload succeeded but no file path was returned by the server.');
        return;
      }

      this.getProfileUrl = filePath;
      this.cdr.markForCheck();

      const payload: any = {
        userId: this.auth.getUserId(),
        profileUrl: filePath
      };

      this.generalService.uploadUserProfilePicture(payload).subscribe({
        next: (response) => console.log(response),
        error: (error) => console.log(error)
      });
    } else if (info.file.status === 'error') {
      this.messageService.error(`${info.file.name} file upload failed.`);
    }
  }

  showModal(): void {
    this.supportIsVisible = true;
  }

  handleSupportOk(): void {
    console.log('Button ok clicked!');
    this.supportIsVisible = false;
  }

  handleSupportCancel(): void {
    console.log('Button cancel clicked!');
    this.supportIsVisible = false;
  }

  handleProfileCancel(): void {

    this.profileIsVisible = false;
  }

  handleProfileOk(){

  }

    UpdateProfile = () => {

      console.log(this.userRole)
    let title: string = 'Update Profile';
    const ID = this.patientId
    const formPath = 'patient/add-edit-patient-form.json';
    this.commanModel.showModal(
      title,
      'form',
      formPath,
      ID,
      Number(this.selectedFacility)
    );
  };

  getTotalUnreadMessages(): number {
    return this.totalUnreadMessages();
  }

  navigateToChat(): void {
    this.router.navigate(['/chat']).then(() => {

      this.cdr.markForCheck();
    });
  }

}
